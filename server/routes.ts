import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import MemoryStore from "memorystore";
import { updateAppSettingsSchema } from "@shared/schema";
import { z } from "zod";

// Extend session data type
declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
  }
}

// Helper function to calculate distance between two lat/lng points in meters (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Helper function to calculate parcel centroid from geometry
function getParcelCentroid(geometry: any): { lat: number; lng: number } | null {
  if (!geometry) return null;
  
  // Handle both formats: {type: 'Polygon', coordinates: [...]} or {coordinates: [...]}
  let coordinates = geometry.coordinates;
  
  // If geometry has coordinates property, use it
  if (!coordinates || !Array.isArray(coordinates)) {
    return null;
  }
  
  // Get the outer ring (first array for Polygon)
  const ring = Array.isArray(coordinates[0]) ? coordinates[0] : coordinates;
  
  if (!ring || ring.length === 0) {
    return null;
  }
  
  // Calculate centroid - coordinates are in [lng, lat] format (GeoJSON standard)
  let sumLat = 0, sumLng = 0;
  ring.forEach((point: number[]) => {
    if (Array.isArray(point) && point.length >= 2) {
      sumLng += point[0];  // longitude is first
      sumLat += point[1];  // latitude is second
    }
  });
  
  return {
    lat: sumLat / ring.length,
    lng: sumLng / ring.length
  };
}

// Admin authentication middleware
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.isAdmin) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized - Admin access required" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  const MemoryStoreSession = MemoryStore(session);
  
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "molin-nature-area-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStoreSession({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Admin login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const isValid = await storage.verifyAdminCredentials(email, password);
      
      if (isValid) {
        req.session.isAdmin = true;
        return res.json({ success: true });
      } else {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // Admin logout
  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  // Check admin session
  app.get("/api/admin/session", (req, res) => {
    res.json({ isAdmin: !!req.session?.isAdmin });
  });

  // Get app settings (public - needed for map display)
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      if (!settings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      // Don't send password to client
      const { adminPassword, ...publicSettings } = settings;
      res.json(publicSettings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Update app settings (protected)
  app.patch("/api/admin/settings", isAdmin, async (req, res) => {
    try {
      const validatedData = updateAppSettingsSchema.parse(req.body);
      const settings = await storage.updateAppSettings(validatedData);
      // Don't send password to client
      const { adminPassword, ...publicSettings } = settings;
      res.json(publicSettings);
    } catch (error: any) {
      console.error("Error updating settings:", error);
      // Handle Zod validation errors
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          message: "Invalid input data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Get parcels (protected)
  app.get("/api/parcels", isAdmin, async (req, res) => {
    try {
      const parcels = await storage.getAllParcels();
      res.json(parcels);
    } catch (error) {
      console.error("Error fetching parcels:", error);
      res.status(500).json({ message: "Failed to fetch parcels" });
    }
  });

  // Get all areas
  app.get("/api/areas", async (_req, res) => {
    try {
      const areas = await storage.getAllAreas();
      res.json(areas);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get parcels in a specific area
  app.get("/api/areas/:areaId/parcels", async (req, res) => {
    try {
      const { areaId } = req.params;
      const parcelIds = await storage.getParcelsInArea(areaId);
      res.json(parcelIds);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all parcels within display radius of an area (for admin map display)
  app.get("/api/admin/areas/:areaId/map-parcels", isAdmin, async (req, res) => {
    try {
      const { areaId } = req.params;
      
      // Get the area to know its center and display radius
      const area = await storage.getAreaById(areaId);
      if (!area) {
        return res.status(404).json({ message: "Area not found" });
      }
      
      // Get all parcels and selected parcel IDs
      const allParcels = await storage.getAllParcels();
      const selectedParcelIds = await storage.getParcelsInArea(areaId);
      const selectedIdsSet = new Set(selectedParcelIds);
      
      // Haversine distance calculation
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      
      // Filter parcels: include if within display radius OR already selected in area
      const parcelsToShow = allParcels.filter(parcel => {
        // Always show parcels that are already in the area
        if (selectedIdsSet.has(parcel.id)) {
          return true;
        }
        
        // Check if within display radius
        const geom = parcel.geometry as any;
        if (!geom || !geom.coordinates || !geom.coordinates[0]) {
          return false;
        }
        
        // Calculate parcel centroid
        const ring = geom.coordinates[0];
        let sumLat = 0, sumLng = 0;
        ring.forEach((point: number[]) => {
          sumLng += point[0];
          sumLat += point[1];
        });
        const centroidLat = sumLat / ring.length;
        const centroidLng = sumLng / ring.length;
        
        // Calculate distance from area center
        const distance = calculateDistance(
          area.centerLat,
          area.centerLng,
          centroidLat,
          centroidLng
        );
        
        return distance <= area.displayRadiusMeters;
      });
      
      res.json(parcelsToShow);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Toggle parcel in area (protected)
  app.post("/api/admin/areas/:areaId/parcels/:parcelId/toggle", isAdmin, async (req, res) => {
    try {
      const { areaId, parcelId } = req.params;
      
      const isInArea = await storage.isParcelInArea(areaId, parcelId);
      
      if (isInArea) {
        await storage.removeParcelFromArea(areaId, parcelId);
        res.json({ message: "Parcel removed from area", inArea: false });
      } else {
        await storage.addParcelToArea(areaId, parcelId);
        res.json({ message: "Parcel added to area", inArea: true });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new area (protected)
  app.post("/api/admin/areas", isAdmin, async (req, res) => {
    try {
      // Validate request body
      const createSchema = z.object({
        name: z.string().min(1),
        centerLat: z.number().min(-90).max(90),
        centerLng: z.number().min(-180).max(180),
        defaultZoom: z.number().min(1).max(20),
        displayRadiusMeters: z.number().min(1),
      });
      
      const validated = createSchema.parse(req.body);
      
      const newArea = await storage.createArea(validated);
      
      res.json(newArea);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Update area settings (protected)
  app.patch("/api/admin/areas/:areaId", isAdmin, async (req, res) => {
    try {
      const { areaId } = req.params;
      
      // Validate request body
      const updateSchema = z.object({
        centerLat: z.number().min(-90).max(90),
        centerLng: z.number().min(-180).max(180),
        defaultZoom: z.number().min(1).max(20),
        displayRadiusMeters: z.number().min(1),
      }).partial();
      
      const validated = updateSchema.parse(req.body);
      
      const updatedArea = await storage.updateArea(areaId, validated);
      
      if (!updatedArea) {
        return res.status(404).json({ message: "Area not found" });
      }
      
      res.json(updatedArea);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Upload parcels from local file (protected)
  app.post("/api/admin/upload-parcels", isAdmin, async (req, res) => {
    try {
      const { features } = req.body;
      
      if (!features || !Array.isArray(features)) {
        return res.status(400).json({ message: "Invalid file format. Expected GeoJSON features array." });
      }

      if (features.length === 0) {
        return res.status(400).json({ message: "No parcels found in uploaded file" });
      }

      // Transform GeoJSON features to format expected by storage
      // GeoJSON has "properties", ArcGIS has "attributes"
      // For geometry: extract coordinates and convert to [lat, lng] format for Leaflet
      const transformedFeatures = features.map(feature => {
        // Handle both GeoJSON and ArcGIS formats
        const properties = feature.properties || feature.attributes || {};
        const geom = feature.geometry;

        if (!geom) {
          console.warn("Feature missing geometry:", feature);
          return {
            attributes: properties,
            geometry: { coordinates: [] }
          };
        }

        // Extract coordinates in Leaflet format: [[lat, lng], ...]
        let coordinates;
        
        if (geom.rings) {
          // ArcGIS format: { rings: [[[x, y], ...]] }
          // ArcGIS uses [lng, lat] or [x, y], Leaflet expects [lat, lng]
          coordinates = geom.rings.map((ring: number[][]) => 
            ring.map(([x, y]) => [y, x]) // Swap to [lat, lng]
          );
        } else if (geom.coordinates && geom.type === 'Polygon') {
          // GeoJSON Polygon format: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
          // GeoJSON uses [lng, lat], Leaflet expects [lat, lng]
          coordinates = geom.coordinates.map((ring: number[][]) => 
            ring.map(([lng, lat]) => [lat, lng]) // Swap to [lat, lng]
          );
        } else if (geom.coordinates) {
          // Assume it's already in the right format
          coordinates = geom.coordinates;
        } else {
          console.warn("Unknown geometry format:", geom);
          coordinates = [];
        }

        return {
          attributes: properties,
          geometry: { coordinates } // Store in format expected by map: { coordinates: [[[lat, lng], ...]] }
        };
      });

      // Process the transformed features
      const count = await storage.loadParcelsFromGeoJSON(transformedFeatures);
      
      res.json({ 
        message: `Successfully loaded ${count} parcels from uploaded file`,
        count 
      });
    } catch (error: any) {
      console.error("Error uploading parcels:", error);
      res.status(500).json({ message: error.message || "Failed to upload parcels" });
    }
  });

  // Initialize Molin Nature Area (protected)
  app.post("/api/admin/initialize-molin-area", isAdmin, async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const MOLIN_CENTER_LAT = 42.248002;
      const MOLIN_CENTER_LNG = -83.715407;
      const SELECTION_RADIUS = 200; // meters
      const DISPLAY_RADIUS = 5000; // meters - increased to show parcels farther from center
      
      // Step 1: Load parcels if not already loaded
      const existingParcels = await storage.getAllParcels();
      let parcelCount = existingParcels.length;
      
      if (parcelCount === 0) {
        const filePath = path.join(process.cwd(), 'attached_assets', 'molin_area_parcels.geojson');
        
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "Molin area parcels file not found" });
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const geojson = JSON.parse(fileContent);
        
        if (!geojson.features || !Array.isArray(geojson.features)) {
          return res.status(400).json({ message: "Invalid GeoJSON format" });
        }
        
        parcelCount = await storage.loadParcelsFromGeoJSON(geojson.features);
      }
      
      // Step 2: Create Molin Nature Area if it doesn't exist
      const existingAreas = await storage.getAllAreas();
      let molinArea = existingAreas.find(a => a.name === "Molin Nature Area");
      
      if (!molinArea) {
        molinArea = await storage.createArea({
          name: "Molin Nature Area",
          centerLat: MOLIN_CENTER_LAT,
          centerLng: MOLIN_CENTER_LNG,
          displayRadiusMeters: DISPLAY_RADIUS,
        });
      }
      
      // Step 3: Auto-select parcels within 200m
      const allParcels = await storage.getAllParcels();
      let selectedCount = 0;
      
      for (const parcel of allParcels) {
        const centroid = getParcelCentroid(parcel.geometry);
        if (!centroid) continue;
        
        const distance = calculateDistance(
          MOLIN_CENTER_LAT,
          MOLIN_CENTER_LNG,
          centroid.lat,
          centroid.lng
        );
        
        if (distance <= SELECTION_RADIUS) {
          // Check if already in area
          const alreadyInArea = await storage.isParcelInArea(molinArea.id, parcel.id);
          if (!alreadyInArea) {
            await storage.addParcelToArea(molinArea.id, parcel.id);
            selectedCount++;
          }
        }
      }
      
      res.json({
        message: `Molin Nature Area initialized successfully`,
        parcelCount,
        selectedCount,
        area: molinArea,
      });
    } catch (error: any) {
      console.error("Error initializing Molin area:", error);
      res.status(500).json({ message: error.message || "Failed to initialize Molin area" });
    }
  });

  // Load parcels from ArcGIS (protected)
  app.post("/api/admin/load-parcels", isAdmin, async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      if (!settings) {
        return res.status(400).json({ message: "Settings not configured" });
      }

      const { areaMode, centerLat, centerLng, radiusMeters, boundingBoxTopLeft, boundingBoxBottomRight } = settings;
      console.log("Area settings:", { areaMode, centerLat, centerLng, radiusMeters, boundingBoxTopLeft, boundingBoxBottomRight });

      // Construct ArcGIS query URL
      // NOTE: This endpoint requires authentication - Washtenaw County ArcGIS services are token-protected
      // User will need to either:
      //   1. Obtain an API token from Washtenaw County GIS
      //   2. Use the downloadable parcel shapefile from https://data-washtenaw.opendata.arcgis.com/
      //   3. Manually import parcels via CSV
      const baseUrl = "https://services1.arcgis.com/4ezfu5dIwH83BUNL/ArcGIS/rest/services/tax_parcels/FeatureServer/0/query";
      const params = new URLSearchParams({
        f: "json",
        outFields: "*",
        returnGeometry: "true",
        spatialRel: "esriSpatialRelIntersects",
        outSR: "4326",  // Ensure output is in WGS84
      });

      // Add spatial filter based on area mode
      if (areaMode === 'center') {
        if (!radiusMeters || radiusMeters <= 0) {
          return res.status(400).json({ message: "Radius must be set and greater than 0 for center mode" });
        }
        // Query by center point and radius
        const geometry = JSON.stringify({
          x: centerLng,
          y: centerLat,
          spatialReference: { wkid: 4326 }
        });
        params.append("geometry", geometry);
        params.append("geometryType", "esriGeometryPoint");
        params.append("distance", radiusMeters.toString());
        params.append("units", "esriSRUnit_Meter");
      } else if (areaMode === 'bbox') {
        if (!boundingBoxTopLeft || !boundingBoxBottomRight) {
          return res.status(400).json({ message: "Bounding box corners must be set for bbox mode" });
        }
        // Query by bounding box
        const [topLat, leftLng] = boundingBoxTopLeft.split(',').map(s => parseFloat(s.trim()));
        const [bottomLat, rightLng] = boundingBoxBottomRight.split(',').map(s => parseFloat(s.trim()));
        
        const geometry = JSON.stringify({
          xmin: leftLng,
          ymin: bottomLat,
          xmax: rightLng,
          ymax: topLat,
          spatialReference: { wkid: 4326 }
        });
        params.append("geometry", geometry);
        params.append("geometryType", "esriGeometryEnvelope");
      } else {
        return res.status(400).json({ message: `Invalid area mode: ${areaMode}. Must be 'center' or 'bbox'` });
      }

      // Fetch parcels from ArcGIS
      const queryUrl = `${baseUrl}?${params}`;
      console.log("ArcGIS Query URL:", queryUrl);
      
      const response = await fetch(queryUrl);
      const data = await response.json();
      
      console.log("ArcGIS Response:", JSON.stringify(data).substring(0, 500));

      if (data.error) {
        console.error("ArcGIS Error:", data.error);
        return res.status(500).json({ message: `ArcGIS Error: ${data.error.message || 'Unknown error'}` });
      }

      if (!data.features || data.features.length === 0) {
        console.log("No parcels found in area");
        return res.json({ count: 0, message: "No parcels found in the specified area" });
      }

      // Process and save parcels
      const count = await storage.loadParcelsFromGeoJSON(data.features);

      res.json({ count, message: `Successfully loaded ${count} parcels` });
    } catch (error: any) {
      console.error("Error loading parcels:", error);
      res.status(500).json({ message: error.message || "Failed to load parcels" });
    }
  });

  // Update parcel (protected - admin only)
  app.patch("/api/admin/parcels/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const parcel = await storage.updateParcel(id, req.body);
      
      if (!parcel) {
        return res.status(404).json({ message: "Parcel not found" });
      }
      
      res.json(parcel);
    } catch (error) {
      console.error("Error updating parcel:", error);
      res.status(500).json({ message: "Failed to update parcel" });
    }
  });

  // Regenerate nature phrase for parcel (protected - admin only)
  app.post("/api/admin/parcels/:id/regenerate-phrase", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const newPhrase = await storage.regenerateNaturePhrase(id);
      
      if (!newPhrase) {
        return res.status(404).json({ message: "Parcel not found" });
      }
      
      res.json({ codePhrase: newPhrase });
    } catch (error) {
      console.error("Error regenerating phrase:", error);
      res.status(500).json({ message: "Failed to regenerate phrase" });
    }
  });

  // Parcel login verification
  app.post("/api/parcels/verify", async (req, res) => {
    try {
      const { parcelId, codePhrase } = req.body;
      
      if (!parcelId || !codePhrase) {
        return res.status(400).json({ message: "Parcel ID and code phrase are required" });
      }
      
      const isValid = await storage.verifyParcelCredentials(parcelId, codePhrase);
      
      if (!isValid) {
        return res.status(401).json({ message: "Invalid parcel ID or code phrase" });
      }

      // Check if parcel is in any area
      const isInArea = await storage.isParcelInAnyArea(parcelId);
      
      if (!isInArea) {
        return res.status(403).json({ message: "This parcel is not currently included in any survey area. Please contact the area coordinator if you believe this is an error." });
      }

      const parcel = await storage.getParcelById(parcelId);
      res.json({ success: true, parcel });
    } catch (error) {
      console.error("Parcel verification error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Submit survey for parcel
  app.post("/api/parcels/:id/survey", async (req, res) => {
    try {
      const { id } = req.params;
      const { address, q1Response, q2Response, q3Response } = req.body;
      
      const updates: any = {
        q1Response,
        q2Response,
        q3Response,
        responseDate: new Date(),
      };
      
      // Include address if provided
      if (address) {
        updates.address = address;
      }
      
      const parcel = await storage.updateParcel(id, updates);
      
      if (!parcel) {
        return res.status(404).json({ message: "Parcel not found" });
      }
      
      res.json({ success: true, parcel });
    } catch (error) {
      console.error("Survey submission error:", error);
      res.status(500).json({ message: "Failed to submit survey" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
