import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const dashboardState = sqliteTable("dashboard_state", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
