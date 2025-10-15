import { type User, type InsertUser, type AppSettings, type UpdateAppSettings } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

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
  private appSettings: AppSettings;

  constructor() {
    this.users = new Map();
    // Hash the default password synchronously to avoid race conditions
    const hashedPassword = bcrypt.hashSync("admin123", SALT_ROUNDS);
    this.appSettings = {
      id: randomUUID(),
      appName: "Molin Nature Area Neighborhood Support",
      adminEmail: "molin.nature.area.care@gmail.com",
      adminPassword: hashedPassword,
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
    return this.appSettings;
  }

  async updateAppSettings(settings: UpdateAppSettings): Promise<AppSettings> {
    // If password is being updated, hash it
    if (settings.adminPassword) {
      settings.adminPassword = await bcrypt.hash(settings.adminPassword, SALT_ROUNDS);
    }
    
    this.appSettings = {
      ...this.appSettings,
      ...settings,
      updatedAt: new Date(),
    };
    return this.appSettings;
  }

  async verifyAdminCredentials(email: string, password: string): Promise<boolean> {
    if (!this.appSettings || !this.appSettings.adminPassword) {
      return false;
    }
    // Compare email and verify password using bcrypt
    const emailMatches = this.appSettings.adminEmail === email;
    const passwordMatches = await bcrypt.compare(password, this.appSettings.adminPassword);
    return emailMatches && passwordMatches;
  }
}

export const storage = new MemStorage();
