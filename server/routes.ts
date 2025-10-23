import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./dbStorage";
import session from "express-session";
import MemoryStore from "memorystore";
import { updateAppSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { calculateCentroid, calculateDistance, calculateBoundingBox } from "./geomUtils";

// Extend session data type
declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
  }
}

// Helper function to calculate parcel centroid from geometry (legacy, kept for compatibility)
function getParcelCentroid(geometry: any): { lat: number; lng: number } | null {
  // Use the shared robust centroid calculation that handles Polygon and MultiPolygon
  return calculateCentroid(geometry);
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

  // Get statistics for a specific area
  app.get("/api/areas/:areaId/statistics", async (req, res) => {
    try {
      const { areaId } = req.params;
      const statistics = await storage.getAreaStatistics(areaId);
      res.json(statistics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all parcels that are in any area (for public survey map)
  app.get("/api/survey/parcels", async (_req, res) => {
    try {
      // Get all areas
      const areas = await storage.getAllAreas();
      
      // Collect all unique parcel IDs from all areas
      const parcelIdsSet = new Set<string>();
      for (const area of areas) {
        const areaParcelIds = await storage.getParcelsInArea(area.id);
        areaParcelIds.forEach(id => parcelIdsSet.add(id));
      }
      
      // Get full parcel data for these IDs only
      const areaParcels = await storage.getParcelsByIds(Array.from(parcelIdsSet));
      
      res.json(areaParcels);
    } catch (error: any) {
      console.error("Error fetching survey parcels:", error);
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
      
      console.log(`[map-parcels] Area: ${area.name}`);
      console.log(`[map-parcels] Center: ${area.centerLat}, ${area.centerLng}`);
      console.log(`[map-parcels] Display radius: ${area.displayRadiusMeters}m`);
      
      // Calculate dynamic bounding box based on displayRadiusMeters
      const bbox = calculateBoundingBox(area.centerLat, area.centerLng, area.displayRadiusMeters);
      console.log(`[map-parcels] Bounding box: lat ${bbox.minLat.toFixed(6)} to ${bbox.maxLat.toFixed(6)}, lng ${bbox.minLng.toFixed(6)} to ${bbox.maxLng.toFixed(6)}`);
      
      // Get parcels in bounding box (optional parcels - deterministic square area)
      const nearbyParcels = await storage.getParcelsInBoundingBox(bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng);
      console.log(`[map-parcels] Bounding box returned ${nearbyParcels.length} parcels`);
      
      // Get parcels already assigned to the area
      const selectedParcelIds = await storage.getParcelsInArea(areaId);
      const selectedIdsSet = new Set(selectedParcelIds);
      console.log(`[map-parcels] Area has ${selectedParcelIds.length} assigned parcels`);
      
      // Get full data for assigned parcels (NOT filtered by radius - show all assigned regardless of distance)
      const assignedParcels = selectedParcelIds.length > 0 
        ? await storage.getParcelsByIds(selectedParcelIds)
        : [];
      
      // Filter optional parcels to exclude already-assigned ones
      const optionalParcels = nearbyParcels.filter(parcel => !selectedIdsSet.has(parcel.id));
      
      // Combine: ALL assigned parcels + optional parcels in bounding box
      // Return full parcel objects with all fields (codePhrase, survey responses, etc.)
      const allParcels = [
        ...assignedParcels,
        ...optionalParcels
      ];
      
      console.log(`[map-parcels] Returning ${allParcels.length} parcels: ${assignedParcels.length} assigned + ${optionalParcels.length} optional`);
      
      res.json(allParcels);
    } catch (error: any) {
      console.error("Error in map-parcels endpoint:", error);
      console.error("Error stack:", error.stack);
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
      
      const newArea = await storage.createArea({
        ...validated,
        parcelIds: []
      });
      
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
        name: z.string().min(1),
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

  // Delete area (protected)
  app.delete("/api/admin/areas/:areaId", isAdmin, async (req, res) => {
    try {
      const { areaId } = req.params;
      
      const deleted = await storage.deleteArea(areaId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Area not found" });
      }
      
      res.json({ message: "Area deleted successfully" });
    } catch (error: any) {
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
          defaultZoom: 16,
          displayRadiusMeters: DISPLAY_RADIUS,
          parcelIds: []
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

  // Load parcels from ArcGIS (DEPRECATED - no longer supported with file-based areas)
  app.post("/api/admin/load-parcels", isAdmin, async (req, res) => {
    res.status(410).json({ 
      message: "ArcGIS import is no longer supported. Parcels are now loaded from GeoJSON files on startup." 
    });
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

  // Parcel login verification - uses shortCode instead of full parcelId
  app.post("/api/parcels/verify", async (req, res) => {
    try {
      const { parcelId: shortCode, codePhrase } = req.body;
      
      if (!shortCode || !codePhrase) {
        return res.status(400).json({ message: "Parcel code and nature phrase are required" });
      }
      
      // Verify using shortCode and get the actual parcelId
      const verification = await storage.verifyParcelCredentialsByShortCode(shortCode, codePhrase);
      
      if (!verification.isValid || !verification.parcelId) {
        return res.status(401).json({ message: "Invalid parcel code or nature phrase" });
      }

      // Check if parcel is in any area
      const isInArea = await storage.isParcelInAnyArea(verification.parcelId);
      
      if (!isInArea) {
        return res.status(403).json({ message: "This parcel is not currently included in any survey area. Please contact the area coordinator if you believe this is an error." });
      }

      const parcel = await storage.getParcelById(verification.parcelId);
      res.json({ success: true, parcel });
    } catch (error) {
      console.error("Parcel verification error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Get parcel data by ID
  app.get("/api/parcels/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const parcel = await storage.getParcelById(id);
      
      if (!parcel) {
        return res.status(404).json({ message: "Parcel not found" });
      }
      
      res.json(parcel);
    } catch (error) {
      console.error("Error fetching parcel:", error);
      res.status(500).json({ message: "Failed to fetch parcel" });
    }
  });

  // Submit survey for parcel
  app.post("/api/parcels/:id/survey", async (req, res) => {
    try {
      const { id } = req.params;
      const { address, q1Response, q1Comment, q2Response, q2Comment, q3Response, q3Comment } = req.body;
      
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
      
      // Include comments if provided
      if (q1Comment !== undefined) {
        updates.q1Comment = q1Comment;
      }
      if (q2Comment !== undefined) {
        updates.q2Comment = q2Comment;
      }
      if (q3Comment !== undefined) {
        updates.q3Comment = q3Comment;
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
