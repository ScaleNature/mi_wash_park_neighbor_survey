import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appName: text("app_name").notNull().default("Molin Nature Area Neighborhood Support"),
  adminEmail: text("admin_email").notNull().default("molin.nature.area.care@gmail.com"),
  adminPassword: text("admin_password").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({
  id: true,
  updatedAt: true,
});

export const updateAppSettingsSchema = createInsertSchema(appSettings).omit({
  id: true,
  updatedAt: true,
}).partial();

export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type UpdateAppSettings = z.infer<typeof updateAppSettingsSchema>;
export type AppSettings = typeof appSettings.$inferSelect;

export const parcels = pgTable("parcels", {
  id: varchar("id").primaryKey(),
  shortCode: varchar("short_code").unique(),
  address: text("address"),
  codePhrase: text("code_phrase").notNull(),
  geometry: jsonb("geometry").notNull(),
  q1Response: boolean("q1_response"),
  q1Comment: text("q1_comment"),
  q2Response: boolean("q2_response"),
  q2Comment: text("q2_comment"),
  q3Response: boolean("q3_response"),
  q3Comment: text("q3_comment"),
  responseDate: timestamp("response_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertParcelSchema = createInsertSchema(parcels).omit({
  createdAt: true,
});

export const updateParcelSchema = createInsertSchema(parcels).omit({
  id: true,
  createdAt: true,
}).partial();

export type InsertParcel = z.infer<typeof insertParcelSchema>;
export type UpdateParcel = z.infer<typeof updateParcelSchema>;
export type Parcel = typeof parcels.$inferSelect;

// Area types for file-based storage (not in database)
export interface Area {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  defaultZoom: number;
  displayRadiusMeters: number;
  parcelIds: string[];
  createdAt?: Date;
}

export interface AreaData {
  areas: Area[];
  version: string;
  description?: string;
}

export const areaSchema = z.object({
  id: z.string(),
  name: z.string(),
  centerLat: z.number(),
  centerLng: z.number(),
  defaultZoom: z.number().default(16),
  displayRadiusMeters: z.number().default(500),
  parcelIds: z.array(z.string()).default([]),
  createdAt: z.date().optional(),
});

export const insertAreaSchema = areaSchema.omit({ id: true, createdAt: true });

export type InsertArea = z.infer<typeof insertAreaSchema>;
