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
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
