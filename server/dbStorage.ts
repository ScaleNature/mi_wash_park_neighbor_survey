import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import proj4 from "proj4";

import {
  type User,
  type InsertUser,
  type AppSettings,
  type UpdateAppSettings,
  type Parcel,
  type InsertParcel,
  type UpdateParcel,
  type Area,
  type InsertArea,
  type AreaData,
  users,
  appSettings,
  parcels
} from "@shared/schema";

const SALT_ROUNDS = 10;
const AREAS_FILE_PATH = path.join(process.cwd(), 'data', 'areas.json');

// Nature-themed word lists for generating code phrases
const natureAdjectives = ["Ancient", "Blooming", "Cascading", "Dancing", "Emerald", "Flowering", "Golden", "Hidden", "Ivory", "Jubilant", "Kindred", "Luminous", "Mystic", "Noble", "Peaceful", "Quiet", "Radiant", "Sacred", "Tranquil", "Verdant", "Whispering", "Pristine", "Vibrant", "Majestic"];
const natureNouns = ["Aspen", "Birch", "Cedar", "Daisy", "Elm", "Fern", "Grove", "Hickory", "Iris", "Juniper", "Lily", "Maple", "Nectar", "Oak", "Pine", "Rose", "Sage", "Thicket", "Violet", "Willow", "Yarrow", "Meadow", "Brook", "Haven"];
const natureElements = ["Bloom", "Breeze", "Creek", "Dawn", "Echo", "Field", "Glen", "Hill", "Knoll", "Leaf", "Mist", "Path", "Ridge", "Spring", "Trail", "Vale", "Woods", "Glade", "Pond", "Stream", "Forest", "Garden", "Canopy", "Dell"];

function generateNaturePhrase(): string {
  const adj = natureAdjectives[Math.floor(Math.random() * natureAdjectives.length)];
  const noun = natureNouns[Math.floor(Math.random() * natureNouns.length)];
  const elem = natureElements[Math.floor(Math.random() * natureElements.length)];
  const combos = [
    `${adj} ${noun}`,
    `${noun} ${elem}`,
    `${adj} ${elem}`,
  ];
  return combos[Math.floor(Math.random() * combos.length)].toLowerCase().replace(/\s+/g, '-');
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAppSettings(): Promise<AppSettings | undefined>;
  updateAppSettings(settings: UpdateAppSettings): Promise<AppSettings>;
  verifyAdminCredentials(email: string, password: string): Promise<boolean>;
  
  getAllParcels(): Promise<Parcel[]>;
  getParcelsForMapDisplay(): Promise<Pick<Parcel, 'id' | 'address' | 'geometry'>[]>;
  getParcelsInBoundingBox(minLat: number, maxLat: number, minLng: number, maxLng: number): Promise<Pick<Parcel, 'id' | 'address' | 'geometry'>[]>;
  getParcelsByIds(ids: string[]): Promise<Parcel[]>;
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

export class DbStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private areaCache: Area[] | null = null;

  constructor() {
    const sql = neon(process.env.DATABASE_URL!);
    this.db = drizzle(sql);
    this.initializeAppSettings();
    this.initializeParcels();
  }

  private async initializeParcels(): Promise<void> {
    try {
      // Check if parcels are already loaded
      const existing = await this.db.select().from(parcels).limit(1);
      if (existing.length > 0) {
        console.log("✓ Parcels already loaded in database");
        return;
      }

      // Load parcels from GeoJSON file
      const geojsonPath = path.join(process.cwd(), 'attached_assets', 'washtenaw_parcels_full.geojson');
      
      try {
        await fs.access(geojsonPath);
      } catch {
        console.log("No parcel GeoJSON file found");
        return;
      }

      const geojsonData = await fs.readFile(geojsonPath, 'utf-8');
      const geojson = JSON.parse(geojsonData);
      
      if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
        console.log(`Loading ${geojson.features.length} parcels from GeoJSON file...`);
        const count = await this.loadParcelsFromGeoJSON(geojson.features);
        console.log(`✓ Auto-loaded ${count} parcels from ${geojsonPath}`);
      }
    } catch (error) {
      console.error("Failed to initialize parcels:", error);
    }
  }

  private async initializeAppSettings(): Promise<void> {
    try {
      const existing = await this.db.select().from(appSettings).limit(1);
      if (existing.length === 0) {
        const hashedPassword = await bcrypt.hash("password", SALT_ROUNDS);
        await this.db.insert(appSettings).values({
          appName: "Molin Nature Area Neighborhood Support",
          adminEmail: "molin.nature.area.care@gmail.com",
          adminPassword: hashedPassword,
        });
      }
    } catch (error) {
      console.error("Failed to initialize app settings:", error);
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
    const result = await this.db.insert(users).values({
      username: user.username,
      password: hashedPassword,
    }).returning();
    return result[0];
  }

  // App settings methods
  async getAppSettings(): Promise<AppSettings | undefined> {
    const result = await this.db.select().from(appSettings).limit(1);
    return result[0];
  }

  async updateAppSettings(settings: UpdateAppSettings): Promise<AppSettings> {
    const current = await this.getAppSettings();
    if (!current) {
      throw new Error("App settings not initialized");
    }

    const updates: any = { ...settings };
    if (settings.adminPassword) {
      updates.adminPassword = await bcrypt.hash(settings.adminPassword, SALT_ROUNDS);
    }

    const result = await this.db
      .update(appSettings)
      .set(updates)
      .where(eq(appSettings.id, current.id))
      .returning();
    return result[0];
  }

  async verifyAdminCredentials(email: string, password: string): Promise<boolean> {
    const settings = await this.getAppSettings();
    if (!settings) return false;
    
    const emailMatches = settings.adminEmail === email;
    const passwordMatches = await bcrypt.compare(password, settings.adminPassword);
    return emailMatches && passwordMatches;
  }

  // Parcel methods
  async getAllParcels(): Promise<Parcel[]> {
    return await this.db.select().from(parcels);
  }

  async getParcelsForMapDisplay(): Promise<Pick<Parcel, 'id' | 'address' | 'geometry'>[]> {
    // Fetch only a limited number of parcels to avoid response size limits
    // The filtering by radius should be done at the route level using this limited set
    return await this.db.select({
      id: parcels.id,
      address: parcels.address,
      geometry: parcels.geometry
    }).from(parcels).limit(10000); // Limit to prevent response overflow
  }
  
  async getParcelsInBoundingBox(minLat: number, maxLat: number, minLng: number, maxLng: number): Promise<Pick<Parcel, 'id' | 'address' | 'geometry'>[]> {
    // Use parcel ID prefix for efficient filtering
    // IDs are formatted as "{lat},{lng}-{count}", so we can filter by latitude prefix
    // Generate all possible lat prefixes in the range (e.g., "42.23", "42.24", "42.25", "42.26")
    const latPrefixes: string[] = [];
    const minLatInt = Math.floor(minLat * 100); // e.g., 42.23 -> 4223
    const maxLatInt = Math.ceil(maxLat * 100);   // e.g., 42.26 -> 4226
    
    for (let latInt = minLatInt; latInt <= maxLatInt; latInt++) {
      const latPrefix = (latInt / 100).toFixed(2); // e.g., 4223 -> "42.23"
      latPrefixes.push(latPrefix);
    }
    
    // Build OR conditions for all latitude prefixes
    const conditions = latPrefixes.map(prefix => sql`id LIKE ${prefix + '%'}`);
    const whereClause = conditions.length > 0 
      ? sql.join(conditions, sql` OR `)
      : sql`FALSE`;
    
    const result = await this.db.execute<Pick<Parcel, 'id' | 'address' | 'geometry'>>(
      sql`
        SELECT id, address, geometry 
        FROM ${parcels}
        WHERE ${whereClause}
        LIMIT 10000
      `
    );
    return result.rows as Pick<Parcel, 'id' | 'address' | 'geometry'>[];
  }

  async getParcelsByIds(ids: string[]): Promise<Parcel[]> {
    if (ids.length === 0) return [];
    return await this.db.select().from(parcels).where(inArray(parcels.id, ids));
  }

  async getParcelById(id: string): Promise<Parcel | undefined> {
    const result = await this.db.select().from(parcels).where(eq(parcels.id, id)).limit(1);
    return result[0];
  }

  async updateParcel(id: string, updates: UpdateParcel): Promise<Parcel | undefined> {
    const result = await this.db
      .update(parcels)
      .set(updates)
      .where(eq(parcels.id, id))
      .returning();
    return result[0];
  }

  async regenerateNaturePhrase(id: string): Promise<string | undefined> {
    const newPhrase = generateNaturePhrase();
    const result = await this.db
      .update(parcels)
      .set({ codePhrase: newPhrase })
      .where(eq(parcels.id, id))
      .returning();
    return result[0]?.codePhrase;
  }

  async verifyParcelCredentials(parcelId: string, codePhrase: string): Promise<boolean> {
    const parcel = await this.getParcelById(parcelId);
    if (!parcel) return false;
    return parcel.codePhrase === codePhrase;
  }

  async loadParcelsFromGeoJSON(features: any[]): Promise<number> {
    proj4.defs('EPSG:2898', '+proj=lcc +lat_1=42.1 +lat_2=43.66666666666666 +lat_0=41.5 +lon_0=-84.36666666666666 +x_0=4000000 +y_0=0 +ellps=GRS80 +units=us-ft +no_defs');
    
    let count = 0;
    const batchSize = 100;
    
    // Helper: Detect CRS by checking representative points
    const detectCRS = (coords: number[][]): 'EPSG:2898' | 'EPSG:4326' => {
      // Sample first few points to detect coordinate system
      const samplePoints = coords.slice(0, Math.min(5, coords.length));
      const avgX = samplePoints.reduce((sum, p) => sum + Math.abs(p[0]), 0) / samplePoints.length;
      
      // State Plane Michigan South: X (easting) ~ 13,000,000-14,000,000 feet, Y (northing) ~ 0-1,000,000 feet
      // WGS84: longitude ~ -180 to 180, latitude ~ -90 to 90
      // Robust threshold: if avg |x| > 1000, it's State Plane
      return avgX > 1000 ? 'EPSG:2898' : 'EPSG:4326';
    };
    
    // Helper: Transform a single ring of coordinates
    const transformRing = (ring: number[][], sourceCRS: string): number[] [] => {
      if (sourceCRS === 'EPSG:4326') {
        // Already WGS84 - return as-is
        return ring.map(p => [p[0], p[1]]);
      }
      
      // Transform from State Plane to WGS84
      return ring.map(point => {
        try {
          const [lng, lat] = proj4('EPSG:2898', 'EPSG:4326', [point[0], point[1]]);
          return [lng, lat];
        } catch (e) {
          console.warn(`Failed to transform point [${point[0]}, ${point[1]}]:`, e);
          return point; // Fallback
        }
      });
    };
    
    // Helper: Transform geometry (handles Polygon and MultiPolygon with all rings)
    const transformGeometry = (geom: any): any => {
      if (!geom || !geom.type || !geom.coordinates) {
        return geom;
      }
      
      if (geom.type === 'Polygon') {
        // Detect CRS from outer ring
        const sourceCRS = detectCRS(geom.coordinates[0]);
        
        // Transform all rings (outer + holes)
        const transformedRings = geom.coordinates.map((ring: number[][]) => 
          transformRing(ring, sourceCRS)
        );
        
        return {
          type: 'Polygon',
          coordinates: transformedRings
        };
      } else if (geom.type === 'MultiPolygon') {
        // Transform each polygon in the MultiPolygon
        const transformedPolygons = geom.coordinates.map((polygonRings: number[][][]) => {
          const sourceCRS = detectCRS(polygonRings[0]); // Detect from first ring
          return polygonRings.map((ring: number[][]) => transformRing(ring, sourceCRS));
        });
        
        return {
          type: 'MultiPolygon',
          coordinates: transformedPolygons
        };
      }
      
      // Unsupported geometry type - return as-is
      console.warn(`Unsupported geometry type: ${geom.type}`);
      return geom;
    };
    
    for (let i = 0; i < features.length; i += batchSize) {
      const batch = features.slice(i, i + batchSize);
      const parcelsToInsert = [];
      
      for (const feature of batch) {
        const properties = feature.properties || {};
        const originalGeometry = feature.geometry;
        
        // Transform geometry (handles all types and rings)
        const convertedGeometry = transformGeometry(originalGeometry);
        
        let parcelId;
        if (convertedGeometry && convertedGeometry.type === 'Polygon' && convertedGeometry.coordinates && convertedGeometry.coordinates[0]) {
          const ring = convertedGeometry.coordinates[0];
          
          // Calculate centroid excluding duplicate closing vertex
          // GeoJSON rings have first point == last point, so exclude last point
          const uniquePoints = ring.slice(0, -1);
          let sumLat = 0, sumLng = 0;
          uniquePoints.forEach((point: number[]) => {
            sumLng += point[0];  // GeoJSON: [lng, lat]
            sumLat += point[1];
          });
          const centroidLng = sumLng / uniquePoints.length;
          const centroidLat = sumLat / uniquePoints.length;
          parcelId = `${centroidLat.toFixed(6)},${centroidLng.toFixed(6)}-${count}`;
        } else if (convertedGeometry && convertedGeometry.type === 'MultiPolygon') {
          // For MultiPolygon, use centroid of first polygon
          const firstPolygon = convertedGeometry.coordinates[0];
          if (firstPolygon && firstPolygon[0]) {
            const ring = firstPolygon[0];
            const uniquePoints = ring.slice(0, -1);
            let sumLat = 0, sumLng = 0;
            uniquePoints.forEach((point: number[]) => {
              sumLng += point[0];
              sumLat += point[1];
            });
            const centroidLng = sumLng / uniquePoints.length;
            const centroidLat = sumLat / uniquePoints.length;
            parcelId = `${centroidLat.toFixed(6)},${centroidLng.toFixed(6)}-${count}`;
          } else {
            parcelId = `multipolygon-unknown-${count}`;
          }
        } else {
          parcelId = `unknown-${count}`;
        }
        
        const address = properties.address || properties.ADDRESS || properties.street_address || null;
        const codePhrase = generateNaturePhrase();
        
        parcelsToInsert.push({
          id: parcelId,
          address,
          codePhrase,
          geometry: convertedGeometry,
        });
        
        count++;
      }
      
      if (parcelsToInsert.length > 0) {
        await this.db.insert(parcels).values(parcelsToInsert).onConflictDoNothing();
      }
    }
    
    return count;
  }

  // File-based area methods
  private async loadAreasFromFile(): Promise<Area[]> {
    if (this.areaCache) {
      return this.areaCache;
    }

    try {
      const fileContent = await fs.readFile(AREAS_FILE_PATH, 'utf-8');
      const data: AreaData = JSON.parse(fileContent);
      this.areaCache = data.areas || [];
      console.log(`✓ Loaded ${this.areaCache.length} areas from file`);
      return this.areaCache;
    } catch (error: any) {
      // In production, failing to load areas is critical - the app can't function
      if (process.env.NODE_ENV === 'production') {
        console.error("CRITICAL: Failed to load areas from file in production:", error);
        throw new Error(`Failed to load area configuration: ${error.message}`);
      }
      
      // In development, log warning but allow empty state for initial setup
      console.warn("Failed to load areas from file (development mode):", error.message);
      this.areaCache = [];
      return [];
    }
  }

  private async saveAreasToFile(areas: Area[]): Promise<void> {
    // Only allow writes in development
    if (process.env.NODE_ENV === 'production') {
      throw new Error("Area modifications are not allowed in production");
    }

    try {
      const data: AreaData = {
        areas,
        version: "1.0",
        description: "Area definitions for Molin Nature Area Neighborhood Support. Edit only in development environment."
      };

      await fs.writeFile(AREAS_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
      this.areaCache = areas;
      console.log(`✓ Saved ${areas.length} areas to file`);
    } catch (error: any) {
      console.error("CRITICAL: Failed to save areas to file:", error);
      throw new Error(`Failed to save area configuration: ${error.message}`);
    }
  }

  async getAllAreas(): Promise<Area[]> {
    return await this.loadAreasFromFile();
  }

  async getAreaById(id: string): Promise<Area | undefined> {
    const areas = await this.loadAreasFromFile();
    return areas.find(area => area.id === id);
  }

  async createArea(area: InsertArea): Promise<Area> {
    const areas = await this.loadAreasFromFile();
    
    const newArea: Area = {
      id: randomUUID(),
      ...area,
      parcelIds: area.parcelIds || [],
      createdAt: new Date(),
    };
    
    areas.push(newArea);
    await this.saveAreasToFile(areas);
    
    return newArea;
  }

  async updateArea(id: string, updates: Partial<Omit<Area, 'id' | 'name'>>): Promise<Area | undefined> {
    const areas = await this.loadAreasFromFile();
    const index = areas.findIndex(area => area.id === id);
    
    if (index === -1) return undefined;
    
    areas[index] = { ...areas[index], ...updates };
    await this.saveAreasToFile(areas);
    
    return areas[index];
  }

  async addParcelToArea(areaId: string, parcelId: string): Promise<void> {
    const areas = await this.loadAreasFromFile();
    const area = areas.find(a => a.id === areaId);
    
    if (!area) {
      throw new Error("Area not found");
    }
    
    if (!area.parcelIds.includes(parcelId)) {
      area.parcelIds.push(parcelId);
      await this.saveAreasToFile(areas);
    }
  }

  async removeParcelFromArea(areaId: string, parcelId: string): Promise<void> {
    const areas = await this.loadAreasFromFile();
    const area = areas.find(a => a.id === areaId);
    
    if (!area) {
      throw new Error("Area not found");
    }
    
    area.parcelIds = area.parcelIds.filter(id => id !== parcelId);
    await this.saveAreasToFile(areas);
  }

  async getParcelsInArea(areaId: string): Promise<string[]> {
    const area = await this.getAreaById(areaId);
    return area?.parcelIds || [];
  }

  async isParcelInArea(areaId: string, parcelId: string): Promise<boolean> {
    const area = await this.getAreaById(areaId);
    return area?.parcelIds.includes(parcelId) || false;
  }

  async isParcelInAnyArea(parcelId: string): Promise<boolean> {
    const areas = await this.loadAreasFromFile();
    return areas.some(area => area.parcelIds.includes(parcelId));
  }
}

export const storage = new DbStorage();
