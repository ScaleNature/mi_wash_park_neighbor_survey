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
  centerLat: real("center_lat").notNull().default(42.2808),
  centerLng: real("center_lng").notNull().default(-83.7430),
  defaultZoom: real("default_zoom").notNull().default(16),
  areaMode: text("area_mode").default("center"),
  radiusMeters: real("radius_meters"),
  boundingBoxTopLeft: text("bounding_box_top_left"),
  boundingBoxBottomRight: text("bounding_box_bottom_right"),
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
  address: text("address"),
  codePhrase: text("code_phrase").notNull(),
  geometry: jsonb("geometry").notNull(),
  q1Response: boolean("q1_response"),
  q2Response: boolean("q2_response"),
  q3Response: boolean("q3_response"),
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

export const areas = pgTable("areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  centerLat: real("center_lat").notNull(),
  centerLng: real("center_lng").notNull(),
  defaultZoom: real("default_zoom").notNull().default(16),
  displayRadiusMeters: real("display_radius_meters").notNull().default(5000),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAreaSchema = createInsertSchema(areas).omit({
  id: true,
  createdAt: true,
});

export type InsertArea = z.infer<typeof insertAreaSchema>;
export type Area = typeof areas.$inferSelect;

export const areaParcels = pgTable("area_parcels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  areaId: varchar("area_id").notNull().references(() => areas.id, { onDelete: "cascade" }),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAreaParcelSchema = createInsertSchema(areaParcels).omit({
  id: true,
  createdAt: true,
});

export type InsertAreaParcel = z.infer<typeof insertAreaParcelSchema>;
export type AreaParcel = typeof areaParcels.$inferSelect;
