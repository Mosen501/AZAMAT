import { z } from "zod";
import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const scoreKeys = [
  "operationalControl",
  "responseTempo",
  "stakeholderTrust",
  "teamAlignment",
  "executiveComms",
] as const;

export const scoreSchema = z.object({
  operationalControl: z.number(),
  responseTempo: z.number(),
  stakeholderTrust: z.number(),
  teamAlignment: z.number(),
  executiveComms: z.number(),
});

export type ScoreKey = typeof scoreKeys[number];
export type ScoreSet = z.infer<typeof scoreSchema>;

export const languageSchema = z.enum(["en", "ar"]);
export type Language = z.infer<typeof languageSchema>;
export const simulationLevelSchema = z.enum(["beginner", "advanced"]);
export type SimulationLevel = z.infer<typeof simulationLevelSchema>;
export const sectorIdSchema = z.string().min(1);
export type SectorId = z.infer<typeof sectorIdSchema>;

export const localizedCopySchema = z.object({
  en: z.string(),
  ar: z.string(),
});

export type LocalizedCopy = z.infer<typeof localizedCopySchema>;

// Define the core types for the simulation
export const choiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  scoreDeltas: scoreSchema,
  nextStepId: z.string().nullable()
});

export const stepSchema = z.object({
  id: z.string(),
  timeLabel: z.string(),
  description: z.string(),
  choices: z.array(choiceSchema)
});

export const localizedStepContentSchema = z.object({
  description: z.string(),
  choices: z.record(z.string(), z.string()),
});

export const localizedScenarioContentSchema = z.object({
  title: z.string(),
  description: z.string(),
  steps: z.record(z.string(), localizedStepContentSchema),
});

export const scenarioTranslationsSchema = z.object({
  en: localizedScenarioContentSchema.optional(),
  ar: localizedScenarioContentSchema.optional(),
});

export const scenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  initialScores: scoreSchema,
  steps: z.record(z.string(), stepSchema), // Map of step ID to Step
  startStepId: z.string(),
  translations: scenarioTranslationsSchema.optional(),
  metadata: z
    .object({
      sectorId: sectorIdSchema.optional(),
      roleIds: z.array(z.string()).optional(),
    })
    .optional(),
});

export type Scenario = z.infer<typeof scenarioSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Choice = z.infer<typeof choiceSchema>;
export type LocalizedScenarioContent = z.infer<typeof localizedScenarioContentSchema>;

export const scenarioSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  sectorId: sectorIdSchema.optional(),
  roleIds: z.array(z.string()).optional(),
});

export type ScenarioSummary = z.infer<typeof scenarioSummarySchema>;

// Types for tracking the user's run locally
export const runHistoryItemSchema = z.object({
  stepId: z.string(),
  choiceId: z.string(),
  timestamp: z.number(),
  scoresAfter: scoreSchema
});

export type RunHistoryItem = z.infer<typeof runHistoryItemSchema>;

export const advancedChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

export type AdvancedChatMessage = z.infer<typeof advancedChatMessageSchema>;

export const debriefRequestSchema = z.object({
  scenarioId: z.string(),
  language: languageSchema.optional().default("ar"),
  role: z.string(),
  history: z.array(runHistoryItemSchema),
  chatHistory: z.array(advancedChatMessageSchema).max(24).optional(),
});

export type DebriefRequest = z.infer<typeof debriefRequestSchema>;

export const debriefResponseSchema = z.object({
  summary: z.array(z.string()),
  wentWell: z.array(z.string()),
  toImprove: z.array(z.string()),
  missedSignals: z.array(z.string()),
  checklist: z.array(z.string())
});

export type DebriefResponse = z.infer<typeof debriefResponseSchema>;

export const advancedChatRequestSchema = z.object({
  scenarioId: z.string(),
  language: languageSchema.optional().default("ar"),
  sectorId: sectorIdSchema,
  role: z.string(),
  currentScores: scoreSchema,
  responseRules: z.array(z.string().min(3).max(250)).min(3).max(20),
  history: z.array(advancedChatMessageSchema).min(1).max(24),
});

export type AdvancedChatRequest = z.infer<typeof advancedChatRequestSchema>;

export const advancedChatResponseSchema = z.object({
  assistantMessage: z.string(),
  scoreDeltas: scoreSchema,
  updatedScores: scoreSchema,
  impactReason: z.string(),
  source: z.enum(["ai", "local_recovery", "local_fallback"]).default("ai"),
  failureCode: z
    .enum(["upstream_unavailable", "invalid_model_json", "policy_reprompt_needed"])
    .optional(),
});

export type AdvancedChatResponse = z.infer<typeof advancedChatResponseSchema>;

export const adminScenarioMutationSchema = z.object({
  scenario: scenarioSchema,
  isActive: z.boolean().optional().default(false),
});

export type AdminScenarioMutation = z.infer<typeof adminScenarioMutationSchema>;

export const adminScenarioSchema = z.object({
  id: z.number(),
  scenarioId: z.string(),
  title: z.string(),
  isActive: z.boolean(),
  version: z.number().int().positive(),
  updatedBy: z.string(),
  definition: scenarioSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminScenario = z.infer<typeof adminScenarioSchema>;

export const trainingSectorSchema = z.object({
  id: z.string().min(1),
  label: localizedCopySchema,
  description: localizedCopySchema,
  isActive: z.boolean().optional().default(true),
});

export type TrainingSector = z.infer<typeof trainingSectorSchema>;

export const trainingRoleSchema = z.object({
  id: z.string().min(1),
  title: localizedCopySchema,
  description: localizedCopySchema,
  sectorIds: z.array(z.string().min(1)).default([]),
  isActive: z.boolean().optional().default(true),
});

export type TrainingRole = z.infer<typeof trainingRoleSchema>;

export const trainingRuleSchema = z.object({
  id: z.string().min(1),
  text: localizedCopySchema,
  sectorId: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  isActive: z.boolean().optional().default(true),
}).refine((value) => Boolean(value.sectorId || value.roleId), {
  message: "A rule must be linked to a sector, a role, or both.",
});

export type TrainingRule = z.infer<typeof trainingRuleSchema>;

export const trainingScenarioLinkSchema = z.object({
  scenarioId: z.string().min(1),
  sectorId: z.string().min(1),
  roleIds: z.array(z.string().min(1)).default([]),
});

export type TrainingScenarioLink = z.infer<typeof trainingScenarioLinkSchema>;

export const trainingConfigSchema = z.object({
  sectors: z.array(trainingSectorSchema),
  roles: z.array(trainingRoleSchema),
  rules: z.array(trainingRuleSchema),
  scenarioLinks: z.array(trainingScenarioLinkSchema),
});

export type TrainingConfig = z.infer<typeof trainingConfigSchema>;

export const adminTrainingConfigMutationSchema = z.object({
  config: trainingConfigSchema,
  isActive: z.boolean().optional().default(true),
});

export type AdminTrainingConfigMutation = z.infer<typeof adminTrainingConfigMutationSchema>;

export const adminTrainingConfigSchema = z.object({
  id: z.number(),
  isActive: z.boolean(),
  version: z.number().int().positive(),
  updatedBy: z.string(),
  definition: trainingConfigSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminTrainingConfig = z.infer<typeof adminTrainingConfigSchema>;

export const adminRoleSchema = z.enum(["owner", "editor", "viewer"]);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const adminPermissionSchema = z.enum([
  "scenario:read",
  "scenario:write",
  "scenario:rollback",
  "training-config:read",
  "training-config:write",
  "training-config:rollback",
  "audit:read",
]);
export type AdminPermission = z.infer<typeof adminPermissionSchema>;

export const adminSessionSchema = z.object({
  label: z.string(),
  role: adminRoleSchema,
  permissions: z.array(adminPermissionSchema),
  source: z.enum(["db", "env"]),
});
export type AdminSession = z.infer<typeof adminSessionSchema>;

export const adminAuditLogSchema = z.object({
  id: z.number(),
  actorLabel: z.string(),
  actorRole: adminRoleSchema,
  action: z.string(),
  entityType: z.enum(["scenario", "training_config", "auth"]),
  entityRef: z.string(),
  details: z.record(z.any()).nullable(),
  createdAt: z.string(),
});
export type AdminAuditLog = z.infer<typeof adminAuditLogSchema>;

export const scenarioVersionSchema = z.object({
  id: z.number(),
  scenarioId: z.string(),
  version: z.number().int().positive(),
  title: z.string(),
  isActive: z.boolean(),
  changeType: z.enum(["seed", "create", "update", "rollback"]),
  actorLabel: z.string(),
  createdAt: z.string(),
});
export type ScenarioVersion = z.infer<typeof scenarioVersionSchema>;

export const trainingConfigVersionSchema = z.object({
  id: z.number(),
  configId: z.number().int().positive(),
  version: z.number().int().positive(),
  isActive: z.boolean(),
  changeType: z.enum(["seed", "create", "update", "rollback"]),
  actorLabel: z.string(),
  createdAt: z.string(),
});
export type TrainingConfigVersion = z.infer<typeof trainingConfigVersionSchema>;

export const adminRollbackSchema = z.object({
  targetVersion: z.number().int().positive(),
});
export type AdminRollbackInput = z.infer<typeof adminRollbackSchema>;

export const adminImportModeSchema = z.enum(["merge", "replace"]);
export type AdminImportMode = z.infer<typeof adminImportModeSchema>;

export const adminDataExportSchema = z.object({
  exportedAt: z.string(),
  scenarios: z.array(adminScenarioSchema),
  trainingConfigs: z.array(adminTrainingConfigSchema),
});
export type AdminDataExport = z.infer<typeof adminDataExportSchema>;

export const adminDataImportSchema = z.object({
  mode: adminImportModeSchema.default("merge"),
  scenarios: z.array(adminScenarioMutationSchema).default([]),
  trainingConfigs: z.array(adminTrainingConfigMutationSchema).default([]),
});
export type AdminDataImport = z.infer<typeof adminDataImportSchema>;

export const publicActivityItemSchema = z.object({
  id: z.number(),
  action: z.string(),
  entityType: z.enum(["scenario", "training_config", "auth"]),
  entityRef: z.string(),
  createdAt: z.string(),
});
export type PublicActivityItem = z.infer<typeof publicActivityItemSchema>;

export const scenarios = pgTable("scenarios", {
  id: serial("id").primaryKey(),
  scenarioId: text("scenario_id").notNull().unique(),
  title: text("title").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").notNull().default("system"),
  definition: jsonb("definition").$type<Scenario>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const trainingConfigs = pgTable("training_configs", {
  id: serial("id").primaryKey(),
  isActive: boolean("is_active").notNull().default(true),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").notNull().default("system"),
  definition: jsonb("definition").$type<TrainingConfig>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const adminApiKeys = pgTable("admin_api_keys", {
  id: serial("id").primaryKey(),
  label: text("label").notNull().unique(),
  role: text("role").notNull().$type<AdminRole>(),
  keyHash: text("key_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const scenarioVersions = pgTable(
  "scenario_versions",
  {
    id: serial("id").primaryKey(),
    scenarioId: text("scenario_id").notNull(),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    changeType: text("change_type")
      .notNull()
      .$type<"seed" | "create" | "update" | "rollback">(),
    actorLabel: text("actor_label").notNull(),
    definition: jsonb("definition").$type<Scenario>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    scenarioVersionUnique: uniqueIndex("scenario_versions_scenario_id_version_idx").on(
      table.scenarioId,
      table.version,
    ),
  }),
);

export const trainingConfigVersions = pgTable(
  "training_config_versions",
  {
    id: serial("id").primaryKey(),
    configId: integer("config_id").notNull(),
    version: integer("version").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    changeType: text("change_type")
      .notNull()
      .$type<"seed" | "create" | "update" | "rollback">(),
    actorLabel: text("actor_label").notNull(),
    definition: jsonb("definition").$type<TrainingConfig>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    trainingConfigVersionUnique: uniqueIndex("training_config_versions_config_id_version_idx").on(
      table.configId,
      table.version,
    ),
  }),
);

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  actorLabel: text("actor_label").notNull(),
  actorRole: text("actor_role").notNull().$type<AdminRole>(),
  action: text("action").notNull(),
  entityType: text("entity_type")
    .notNull()
    .$type<"scenario" | "training_config" | "auth">(),
  entityRef: text("entity_ref").notNull(),
  details: jsonb("details").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ScenarioRecord = typeof scenarios.$inferSelect;
export type InsertScenarioRecord = typeof scenarios.$inferInsert;
export type TrainingConfigRecord = typeof trainingConfigs.$inferSelect;
export type AdminApiKeyRecord = typeof adminApiKeys.$inferSelect;
export type ScenarioVersionRecord = typeof scenarioVersions.$inferSelect;
export type TrainingConfigVersionRecord = typeof trainingConfigVersions.$inferSelect;
export type AdminAuditLogRecord = typeof adminAuditLogs.$inferSelect;

export * from "./models/chat";
