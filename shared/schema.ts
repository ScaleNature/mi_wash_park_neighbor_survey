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
  address: text("address").notNull(),
  codePhrase: text("code_phrase").notNull(),
  geometry: jsonb("geometry").notNull(),
  status: varchar("status").notNull().default("none"),
  hasCompost: boolean("has_compost").notNull().default(false),
  responseDate: timestamp("response_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertParcelSchema = createInsertSchema(parcels).omit({
  createdAt: true,
});

export type InsertParcel = z.infer<typeof insertParcelSchema>;
export type Parcel = typeof parcels.$inferSelect;
