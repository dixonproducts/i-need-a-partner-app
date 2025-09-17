import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, uuid, unique, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  groupSize: integer("group_size").notNull().default(4),
  groupSizeChangedAt: timestamp("group_size_changed_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const administrators = pgTable("administrators", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  groupSize: integer("group_size").notNull(),
  groupSizeChangedAt: timestamp("group_size_changed_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  assignedBy: uuid("assigned_by"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  companyId: uuid("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const partnerships = pgTable("partnerships", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: text("group_id").notNull().unique(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  teamNumber: integer("team_number").notNull(),
  leaderId: uuid("leader_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("filling"), // filling, complete, inactive
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Constraint 1: Each user can only be a leader in one active team per company (partial unique index)
  uniqueActiveLeaderIndex: uniqueIndex("unique_active_leader_idx").on(table.leaderId, table.companyId).where(sql`status IN ('filling', 'complete')`),
  
  // Constraint 4: Only one team per company can have "filling" status (partial unique index)
  uniqueFillingTeamIndex: uniqueIndex("unique_filling_team_idx").on(table.companyId).where(sql`status = 'filling'`),
  
  // Constraint 3: Ensure team numbers are positive and reasonable (basic validation)
  validTeamNumber: check("valid_team_number", sql`team_number > 0 AND team_number <= 1000`),
  
  // Unique constraint for company + team number combination (no two teams with same number in same company)
  uniqueCompanyTeam: unique("unique_company_team").on(table.companyId, table.teamNumber),
  
  // Index for better performance on company + team number queries
  companyTeamIndex: index("company_team_idx").on(table.companyId, table.teamNumber),
}));

export const partnershipMembers = pgTable("partnership_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  partnershipId: uuid("partnership_id").references(() => partnerships.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniquePartnershipUser: unique("unique_partnership_user").on(table.partnershipId, table.userId),
  
  // Index for performance on user membership queries
  userMembershipIndex: index("user_membership_idx").on(table.userId),
}));

export const partnershipHistory = pgTable("partnership_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user1Id: uuid("user1_id").references(() => users.id).notNull(),
  user2Id: uuid("user2_id").references(() => users.id).notNull(),
  partnershipId: uuid("partnership_id").references(() => partnerships.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appDataMigrations = pgTable("app_data_migrations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  checksum: text("checksum").notNull(),
  executedAt: timestamp("executed_at").defaultNow(),
  environment: text("environment").notNull(), // 'development' or 'production'
  status: text("status").notNull().default("completed"), // 'completed', 'failed', 'pending'
  executedBy: text("executed_by"), // admin email who executed the migration
  description: text("description"), // optional description of what the migration does
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueNameEnvironment: unique("unique_name_environment").on(table.name, table.environment),
}));

export const companyRelations = relations(companies, ({ many }) => ({
  users: many(users),
  partnerships: many(partnerships),
}));

export const userRelations = relations(users, ({ one }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
}));

export const partnershipRelations = relations(partnerships, ({ many, one }) => ({
  members: many(partnershipMembers),
  history: many(partnershipHistory),
  company: one(companies, {
    fields: [partnerships.companyId],
    references: [companies.id],
  }),
}));

export const partnershipMembersRelations = relations(partnershipMembers, ({ one }) => ({
  partnership: one(partnerships, {
    fields: [partnershipMembers.partnershipId],
    references: [partnerships.id],
  }),
  user: one(users, {
    fields: [partnershipMembers.userId],
    references: [users.id],
  }),
}));

export const partnershipHistoryRelations = relations(partnershipHistory, ({ one }) => ({
  user1: one(users, {
    fields: [partnershipHistory.user1Id],
    references: [users.id],
  }),
  user2: one(users, {
    fields: [partnershipHistory.user2Id],
    references: [users.id],
  }),
  partnership: one(partnerships, {
    fields: [partnershipHistory.partnershipId],
    references: [partnerships.id],
  }),
}));

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  isActive: true,
});

export const insertAdministratorSchema = createInsertSchema(administrators).omit({
  id: true,
  createdAt: true,
  isActive: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
  isActive: true,
  assignedBy: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertPartnershipSchema = createInsertSchema(partnerships).omit({
  id: true,
  createdAt: true,
  teamNumber: true, // Auto-assigned by trigger
});

export const insertAppDataMigrationSchema = createInsertSchema(appDataMigrations).omit({
  id: true,
  createdAt: true,
  executedAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertAdministrator = z.infer<typeof insertAdministratorSchema>;
export type Administrator = typeof administrators.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPartnership = z.infer<typeof insertPartnershipSchema>;
export type Partnership = typeof partnerships.$inferSelect;
export type PartnershipMember = typeof partnershipMembers.$inferSelect;
export type PartnershipHistory = typeof partnershipHistory.$inferSelect;
export type InsertAppDataMigration = z.infer<typeof insertAppDataMigrationSchema>;
export type AppDataMigration = typeof appDataMigrations.$inferSelect;
