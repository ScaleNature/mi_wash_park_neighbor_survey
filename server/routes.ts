import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import MemoryStore from "memorystore";
import { updateAppSettingsSchema } from "@shared/schema";

// Extend session data type
declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
  }
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

  // Load Molin area parcels from prepared GeoJSON file (protected)
  app.post("/api/admin/load-molin-parcels", isAdmin, async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const filePath = path.join(process.cwd(), 'attached_assets', 'molin_area_parcels.geojson');
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Molin area parcels file not found" });
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const geojson = JSON.parse(fileContent);
      
      if (!geojson.features || !Array.isArray(geojson.features)) {
        return res.status(400).json({ message: "Invalid GeoJSON format" });
      }
      
      // Load parcels - coordinates are already in lat/lon format
      const count = await storage.loadParcelsFromGeoJSON(geojson.features);
      
      res.json({ 
        count, 
        message: `Successfully loaded ${count} parcels from Molin area` 
      });
    } catch (error: any) {
      console.error("Error loading Molin parcels:", error);
      res.status(500).json({ message: error.message || "Failed to load parcels" });
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
      
      if (isValid) {
        const parcel = await storage.getParcelById(parcelId);
        res.json({ success: true, parcel });
      } else {
        res.status(401).json({ message: "Invalid parcel ID or code phrase" });
      }
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
