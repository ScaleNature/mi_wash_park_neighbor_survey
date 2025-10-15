import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp } from "drizzle-orm/pg-core";
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
