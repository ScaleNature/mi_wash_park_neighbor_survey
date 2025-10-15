import { type User, type InsertUser, type AppSettings, type UpdateAppSettings } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAppSettings(): Promise<AppSettings | undefined>;
  updateAppSettings(settings: UpdateAppSettings): Promise<AppSettings>;
  verifyAdminCredentials(email: string, password: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private appSettings: AppSettings | null;

  constructor() {
    this.users = new Map();
    // Initialize with default settings
    this.appSettings = {
      id: randomUUID(),
      appName: "Molin Nature Area Neighborhood Support",
      adminEmail: "molin.nature.area.care@gmail.com",
      adminPassword: "admin123", // Default password - should be changed
      centerLat: 42.2808,
      centerLng: -83.7430,
      defaultZoom: 16,
      updatedAt: new Date(),
    };
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAppSettings(): Promise<AppSettings | undefined> {
    return this.appSettings || undefined;
  }

  async updateAppSettings(settings: UpdateAppSettings): Promise<AppSettings> {
    if (!this.appSettings) {
      throw new Error("App settings not initialized");
    }
    this.appSettings = {
      ...this.appSettings,
      ...settings,
      updatedAt: new Date(),
    };
    return this.appSettings;
  }

  async verifyAdminCredentials(email: string, password: string): Promise<boolean> {
    if (!this.appSettings) {
      return false;
    }
    return this.appSettings.adminEmail === email && this.appSettings.adminPassword === password;
  }
}

export const storage = new MemStorage();
