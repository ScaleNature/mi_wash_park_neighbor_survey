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
      // Note: This endpoint may need to be updated with the correct Washtenaw County ArcGIS REST API URL
      // The WMS service works, but the REST API endpoint structure may be different
      const baseUrl = "https://services3.arcgis.com/mRwarx73j5FhfOkR/ArcGIS/rest/services/Parcels/MapServer/0/query";
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
      const count = await storage.loadParcelsFromGIS(data.features);

      res.json({ count, message: `Successfully loaded ${count} parcels` });
    } catch (error: any) {
      console.error("Error loading parcels:", error);
      res.status(500).json({ message: error.message || "Failed to load parcels" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
