import { type User, type InsertUser, type AppSettings, type UpdateAppSettings, type Parcel, type InsertParcel, type UpdateParcel, type Area, type InsertArea, type AreaParcel, type InsertAreaParcel } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// Nature-themed word lists for generating code phrases
const natureAdjectives = ["Ancient", "Blooming", "Cascading", "Dancing", "Emerald", "Flowering", "Golden", "Hidden", "Ivory", "Jubilant", "Kindred", "Luminous", "Mystic", "Noble", "Peaceful", "Quiet", "Radiant", "Sacred", "Tranquil", "Verdant", "Whispering", "Pristine", "Vibrant", "Majestic"];
const natureNouns = ["Aspen", "Birch", "Cedar", "Daisy", "Elm", "Fern", "Grove", "Hickory", "Iris", "Juniper", "Lily", "Maple", "Nectar", "Oak", "Pine", "Rose", "Sage", "Thicket", "Violet", "Willow", "Yarrow", "Meadow", "Brook", "Haven"];
const natureElements = ["Bloom", "Breeze", "Creek", "Dawn", "Echo", "Field", "Glen", "Hill", "Knoll", "Leaf", "Mist", "Path", "Ridge", "Spring", "Trail", "Vale", "Woods", "Glade", "Pond", "Stream", "Forest", "Garden", "Canopy", "Dell"];

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAppSettings(): Promise<AppSettings | undefined>;
  updateAppSettings(settings: UpdateAppSettings): Promise<AppSettings>;
  verifyAdminCredentials(email: string, password: string): Promise<boolean>;
  
  getAllParcels(): Promise<Parcel[]>;
  getParcelById(id: string): Promise<Parcel | undefined>;
  updateParcel(id: string, updates: UpdateParcel): Promise<Parcel | undefined>;
  regenerateNaturePhrase(id: string): Promise<string | undefined>;
  verifyParcelCredentials(parcelId: string, codePhrase: string): Promise<boolean>;
  loadParcelsFromGeoJSON(features: any[]): Promise<number>;
  
  getAllAreas(): Promise<Area[]>;
  getAreaById(id: string): Promise<Area | undefined>;
  createArea(area: InsertArea): Promise<Area>;
  updateArea(id: string, updates: Partial<Omit<Area, 'id' | 'name'>>): Promise<Area | undefined>;
  addParcelToArea(areaId: string, parcelId: string): Promise<void>;
  removeParcelFromArea(areaId: string, parcelId: string): Promise<void>;
  getParcelsInArea(areaId: string): Promise<string[]>;
  isParcelInArea(areaId: string, parcelId: string): Promise<boolean>;
  isParcelInAnyArea(parcelId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private appSettings: AppSettings;
  private parcels: Map<string, Parcel>;
  private areas: Map<string, Area>;
  private areaParcels: Map<string, AreaParcel>;

  constructor() {
    this.users = new Map();
    this.parcels = new Map();
    this.areas = new Map();
    this.areaParcels = new Map();
    // Hash the default password synchronously to avoid race conditions
    const hashedPassword = bcrypt.hashSync("password", SALT_ROUNDS);
    this.appSettings = {
      id: randomUUID(),
      appName: "Molin Nature Area Neighborhood Support",
      adminEmail: "molin.nature.area.care@gmail.com",
      adminPassword: hashedPassword,
      centerLat: 42.2808,
      centerLng: -83.7430,
      defaultZoom: 16,
      areaMode: "center",
      radiusMeters: null,
      boundingBoxTopLeft: null,
      boundingBoxBottomRight: null,
      updatedAt: new Date(),
    };
  }

  private generateNaturePhrase(): string {
    const adj = natureAdjectives[Math.floor(Math.random() * natureAdjectives.length)];
    const noun = natureNouns[Math.floor(Math.random() * natureNouns.length)];
    const elem = natureElements[Math.floor(Math.random() * natureElements.length)];
    return `${adj} ${noun} ${elem}`;
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

  async getAllParcels(): Promise<Parcel[]> {
    return Array.from(this.parcels.values());
  }

  async getParcelById(id: string): Promise<Parcel | undefined> {
    return this.parcels.get(id);
  }

  async updateParcel(id: string, updates: UpdateParcel): Promise<Parcel | undefined> {
    const parcel = this.parcels.get(id);
    if (!parcel) return undefined;
    
    const updated: Parcel = {
      ...parcel,
      ...updates,
    };
    
    this.parcels.set(id, updated);
    return updated;
  }

  async regenerateNaturePhrase(id: string): Promise<string | undefined> {
    const parcel = this.parcels.get(id);
    if (!parcel) return undefined;
    
    const newPhrase = this.generateNaturePhrase();
    parcel.codePhrase = newPhrase;
    this.parcels.set(id, parcel);
    return newPhrase;
  }

  async verifyParcelCredentials(parcelId: string, codePhrase: string): Promise<boolean> {
    const parcel = this.parcels.get(parcelId);
    if (!parcel) return false;
    return parcel.codePhrase === codePhrase;
  }

  async loadParcelsFromGeoJSON(features: any[]): Promise<number> {
    let count = 0;
    
    for (const feature of features) {
      // GeoJSON format
      const properties = feature.properties || {};
      const geometry = feature.geometry;
      
      // Generate a stable parcel ID based on geometry centroid
      // This creates consistent IDs like "P42.2808_-83.7430" that can be reused
      let parcelId;
      if (geometry && geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
        const ring = geometry.coordinates[0];
        let sumLat = 0, sumLng = 0;
        ring.forEach((point: number[]) => {
          sumLng += point[0];
          sumLat += point[1];
        });
        const centroidLat = (sumLat / ring.length).toFixed(6);
        const centroidLng = (sumLng / ring.length).toFixed(6);
        parcelId = `P${centroidLat}_${centroidLng}`;
      } else {
        // Fallback to sequential ID
        parcelId = `PARCEL_${String(count + 1).padStart(4, '0')}`;
      }
      
      // Generate unique nature phrase for this parcel
      const codePhrase = this.generateNaturePhrase();
      
      const parcel: Parcel = {
        id: parcelId,
        address: null,
        codePhrase,
        geometry,
        q1Response: null,
        q2Response: null,
        q3Response: null,
        responseDate: null,
        createdAt: new Date(),
      };
      
      this.parcels.set(parcelId, parcel);
      count++;
    }
    
    return count;
  }

  async getAllAreas(): Promise<Area[]> {
    return Array.from(this.areas.values());
  }

  async getAreaById(id: string): Promise<Area | undefined> {
    return this.areas.get(id);
  }

  async createArea(insertArea: InsertArea): Promise<Area> {
    const id = randomUUID();
    const area: Area = {
      id,
      name: insertArea.name,
      centerLat: insertArea.centerLat,
      centerLng: insertArea.centerLng,
      defaultZoom: insertArea.defaultZoom ?? 16,
      displayRadiusMeters: insertArea.displayRadiusMeters ?? 5000,
      createdAt: new Date(),
    };
    this.areas.set(id, area);
    return area;
  }

  async updateArea(id: string, updates: Partial<Omit<Area, 'id' | 'name'>>): Promise<Area | undefined> {
    const area = this.areas.get(id);
    if (!area) return undefined;
    
    const updated: Area = {
      ...area,
      ...updates,
    };
    
    this.areas.set(id, updated);
    return updated;
  }

  async addParcelToArea(areaId: string, parcelId: string): Promise<void> {
    // Validate area exists
    const area = this.areas.get(areaId);
    if (!area) {
      throw new Error(`Area with id ${areaId} does not exist`);
    }
    
    // Validate parcel exists
    const parcel = this.parcels.get(parcelId);
    if (!parcel) {
      throw new Error(`Parcel with id ${parcelId} does not exist`);
    }
    
    // Check if already exists to prevent duplicates
    const values = Array.from(this.areaParcels.values());
    const exists = values.some(ap => ap.areaId === areaId && ap.parcelId === parcelId);
    if (exists) {
      return; // Already exists, no need to add again
    }
    
    const id = randomUUID();
    const areaParcel: AreaParcel = {
      id,
      areaId,
      parcelId,
      createdAt: new Date(),
    };
    this.areaParcels.set(id, areaParcel);
  }

  async removeParcelFromArea(areaId: string, parcelId: string): Promise<void> {
    const entries = Array.from(this.areaParcels.entries());
    for (const [id, areaParcel] of entries) {
      if (areaParcel.areaId === areaId && areaParcel.parcelId === parcelId) {
        this.areaParcels.delete(id);
        break;
      }
    }
  }

  async getParcelsInArea(areaId: string): Promise<string[]> {
    const parcelIds: string[] = [];
    const values = Array.from(this.areaParcels.values());
    for (const areaParcel of values) {
      if (areaParcel.areaId === areaId) {
        parcelIds.push(areaParcel.parcelId);
      }
    }
    return parcelIds;
  }

  async isParcelInArea(areaId: string, parcelId: string): Promise<boolean> {
    const values = Array.from(this.areaParcels.values());
    for (const areaParcel of values) {
      if (areaParcel.areaId === areaId && areaParcel.parcelId === parcelId) {
        return true;
      }
    }
    return false;
  }

  async isParcelInAnyArea(parcelId: string): Promise<boolean> {
    const values = Array.from(this.areaParcels.values());
    for (const areaParcel of values) {
      if (areaParcel.parcelId === parcelId) {
        return true;
      }
    }
    return false;
  }
}

export const storage = new MemStorage();
