import { createHash, timingSafeEqual } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { BUILTIN_SCENARIOS, DEFAULT_SCENARIO } from "./scenarioSeed";
import { DEFAULT_TRAINING_CONFIG } from "./trainingConfigSeed";
import {
  adminApiKeys,
  adminAuditLogs,
  adminDataImportSchema,
  adminRoleSchema,
  adminTrainingConfigMutationSchema,
  trainingConfigSchema,
  trainingConfigVersions,
  trainingConfigs,
  adminScenarioMutationSchema,
  scenarioSchema,
  scenarioVersions,
  scenarios,
  type AdminAuditLog,
  type AdminDataExport,
  type AdminDataImport,
  type AdminAuditLogRecord,
  type AdminPermission,
  type PublicActivityItem,
  type AdminRole,
  type AdminScenario,
  type AdminScenarioMutation,
  type AdminSession,
  type AdminTrainingConfig,
  type AdminTrainingConfigMutation,
  type Scenario,
  type ScenarioRecord,
  type ScenarioSummary,
  type ScenarioVersion,
  type ScenarioVersionRecord,
  type TrainingConfig,
  type TrainingConfigRecord,
  type TrainingConfigVersion,
  type TrainingConfigVersionRecord,
} from "@shared/schema";

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  owner: [
    "scenario:read",
    "scenario:write",
    "scenario:rollback",
    "training-config:read",
    "training-config:write",
    "training-config:rollback",
    "audit:read",
  ],
  editor: [
    "scenario:read",
    "scenario:write",
    "scenario:rollback",
    "training-config:read",
    "training-config:write",
    "training-config:rollback",
    "audit:read",
  ],
  viewer: ["scenario:read", "training-config:read", "audit:read"],
};

const SYSTEM_ACTOR: Pick<AdminSession, "label" | "role" | "source"> = {
  label: "system",
  role: "owner",
  source: "env",
};

interface AuditActor {
  label: string;
  role: AdminRole;
  source: "db" | "env";
}

interface AuditLogFilter {
  entityType?: "scenario" | "training_config" | "auth";
  entityRef?: string;
  limit?: number;
}

export interface IStorage {
  getActiveScenario(): Promise<Scenario>;
  getScenarioById(scenarioId?: string): Promise<Scenario>;
  listPlayableScenarios(): Promise<ScenarioSummary[]>;
  getTrainingConfig(): Promise<TrainingConfig>;

  authenticateAdmin(rawApiKey: string): Promise<AdminSession | null>;
  listScenarios(): Promise<AdminScenario[]>;
  createScenario(input: AdminScenarioMutation, actor: AuditActor): Promise<AdminScenario>;
  updateScenario(existingScenarioId: string, input: AdminScenarioMutation, actor: AuditActor): Promise<AdminScenario | null>;
  listScenarioVersions(scenarioId: string): Promise<ScenarioVersion[]>;
  rollbackScenario(scenarioId: string, targetVersion: number, actor: AuditActor): Promise<AdminScenario | null>;

  listTrainingConfigs(): Promise<AdminTrainingConfig[]>;
  createTrainingConfig(input: AdminTrainingConfigMutation, actor: AuditActor): Promise<AdminTrainingConfig>;
  updateTrainingConfig(configId: number, input: AdminTrainingConfigMutation, actor: AuditActor): Promise<AdminTrainingConfig | null>;
  listTrainingConfigVersions(configId: number): Promise<TrainingConfigVersion[]>;
  rollbackTrainingConfig(configId: number, targetVersion: number, actor: AuditActor): Promise<AdminTrainingConfig | null>;

  listAuditLogs(filter?: AuditLogFilter): Promise<AdminAuditLog[]>;
  listPublicActivity(limit?: number): Promise<PublicActivityItem[]>;
  exportAdminData(): Promise<AdminDataExport>;
  importAdminData(input: AdminDataImport, actor: AuditActor): Promise<{ importedScenarios: number; importedTrainingConfigs: number }>;
  resetToDemo(actor: AuditActor): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private scenarioSeedPromise: Promise<void> | null = null;
  private trainingSeedPromise: Promise<void> | null = null;
  private adminSeedPromise: Promise<void> | null = null;
  private memoryTrainingConfigs: AdminTrainingConfig[] | null = null;

  async getActiveScenario(): Promise<Scenario> {
    return this.getScenarioById();
  }

  async getScenarioById(scenarioId?: string): Promise<Scenario> {
    try {
      await this.ensureScenarioSeed();

      if (scenarioId) {
        const [matchingScenario] = await db
          .select()
          .from(scenarios)
          .where(eq(scenarios.scenarioId, scenarioId))
          .limit(1);

        if (matchingScenario) {
          return scenarioSchema.parse(matchingScenario.definition);
        }

        return this.getBuiltinScenario(scenarioId);
      }

      const [activeScenario] = await db.select().from(scenarios).where(eq(scenarios.isActive, true)).limit(1);

      if (activeScenario) {
        return scenarioSchema.parse(activeScenario.definition);
      }

      const [latestScenario] = await db
        .select()
        .from(scenarios)
        .orderBy(desc(scenarios.updatedAt))
        .limit(1);

      if (latestScenario) {
        return scenarioSchema.parse(latestScenario.definition);
      }
    } catch (error) {
      console.error("Scenario storage unavailable, using seed scenario:", error);
    }

    return this.getBuiltinScenario(scenarioId);
  }

  async listPlayableScenarios(): Promise<ScenarioSummary[]> {
    const fallbackCatalog = BUILTIN_SCENARIOS.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      sectorId: scenario.metadata?.sectorId,
      roleIds: scenario.metadata?.roleIds,
    }));

    try {
      await this.ensureScenarioSeed();
      const records = await db.select().from(scenarios).orderBy(desc(scenarios.updatedAt));
      const mergedCatalog = new Map<string, ScenarioSummary>();

      for (const record of records) {
        const definition = scenarioSchema.parse(record.definition);
        mergedCatalog.set(record.scenarioId, {
          id: record.scenarioId,
          title: definition.title,
          description: definition.description,
          sectorId: definition.metadata?.sectorId,
          roleIds: definition.metadata?.roleIds,
        });
      }

      for (const builtInScenario of fallbackCatalog) {
        if (!mergedCatalog.has(builtInScenario.id)) {
          mergedCatalog.set(builtInScenario.id, builtInScenario);
        }
      }

      return Array.from(mergedCatalog.values());
    } catch (error) {
      console.error("Scenario catalog unavailable, using built-in scenarios:", error);
      return fallbackCatalog;
    }
  }

  async getTrainingConfig(): Promise<TrainingConfig> {
    try {
      await this.ensureTrainingConfigSeed();

      const [activeRecord] = await db
        .select()
        .from(trainingConfigs)
        .where(eq(trainingConfigs.isActive, true))
        .limit(1);

      if (activeRecord) {
        return trainingConfigSchema.parse(activeRecord.definition);
      }

      const [latestRecord] = await db
        .select()
        .from(trainingConfigs)
        .orderBy(desc(trainingConfigs.updatedAt))
        .limit(1);

      if (latestRecord) {
        return trainingConfigSchema.parse(latestRecord.definition);
      }
    } catch (error) {
      console.error("Training config storage unavailable, using default config:", error);
    }

    return this.getMemoryTrainingConfigs().find((record) => record.isActive)?.definition ?? DEFAULT_TRAINING_CONFIG;
  }

  async authenticateAdmin(rawApiKey: string): Promise<AdminSession | null> {
    const normalizedKey = rawApiKey.trim();
    if (!normalizedKey) {
      return null;
    }

    try {
      await this.ensureAdminSeed();
      const hashedKey = this.hashApiKey(normalizedKey);
      const keys = await db
        .select()
        .from(adminApiKeys)
        .where(eq(adminApiKeys.isActive, true));

      const matched = keys.find((keyRecord) => this.constantTimeCompare(keyRecord.keyHash, hashedKey));
      if (matched) {
        return {
          label: matched.label,
          role: matched.role,
          permissions: ROLE_PERMISSIONS[matched.role],
          source: "db",
        };
      }
    } catch (error) {
      console.error("DB admin authentication unavailable, falling back to environment keys:", error);
    }

    return this.authenticateAdminFromEnv(normalizedKey);
  }

  async listScenarios(): Promise<AdminScenario[]> {
    try {
      await this.ensureScenarioSeed();
      const records = await db.select().from(scenarios).orderBy(desc(scenarios.updatedAt));
      return records
        .map((record) => this.toAdminScenario(record))
        .sort((left, right) => Number(right.isActive) - Number(left.isActive));
    } catch (error) {
      console.error("Scenario admin storage unavailable, using built-in scenarios:", error);
      return this.getFallbackAdminScenarios();
    }
  }

  async createScenario(input: AdminScenarioMutation, actor: AuditActor): Promise<AdminScenario> {
    await this.ensureScenarioSeed();
    const { scenario, isActive } = adminScenarioMutationSchema.parse(input);

    return db.transaction(async (tx) => {
      if (isActive) {
        await tx.update(scenarios).set({ isActive: false });
      }

      const [created] = await tx
        .insert(scenarios)
        .values({
          scenarioId: scenario.id,
          title: scenario.title,
          isActive,
          version: 1,
          updatedBy: actor.label,
          definition: scenario,
        })
        .returning();

      await tx.insert(scenarioVersions).values({
        scenarioId: created.scenarioId,
        version: created.version,
        title: created.title,
        isActive: created.isActive,
        changeType: "create",
        actorLabel: actor.label,
        definition: scenarioSchema.parse(created.definition),
      });

      await this.writeAuditLogTx(tx, {
        actor,
        action: "scenario.create",
        entityType: "scenario",
        entityRef: created.scenarioId,
        details: {
          version: created.version,
          active: created.isActive,
        },
      });

      return this.toAdminScenario(created);
    });
  }

  async updateScenario(existingScenarioId: string, input: AdminScenarioMutation, actor: AuditActor): Promise<AdminScenario | null> {
    await this.ensureScenarioSeed();
    const { scenario, isActive } = adminScenarioMutationSchema.parse(input);

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(scenarios)
        .where(eq(scenarios.scenarioId, existingScenarioId))
        .limit(1);

      if (!existing) {
        return null;
      }

      if (scenario.id !== existingScenarioId) {
        throw new Error("Scenario id cannot be changed in update. Create a new scenario instead.");
      }

      if (isActive) {
        await tx.update(scenarios).set({ isActive: false });
      }

      const nextVersion = existing.version + 1;
      const [updated] = await tx
        .update(scenarios)
        .set({
          scenarioId: scenario.id,
          title: scenario.title,
          isActive,
          version: nextVersion,
          updatedBy: actor.label,
          definition: scenario,
          updatedAt: new Date(),
        })
        .where(eq(scenarios.scenarioId, existingScenarioId))
        .returning();

      await tx.insert(scenarioVersions).values({
        scenarioId: updated.scenarioId,
        version: updated.version,
        title: updated.title,
        isActive: updated.isActive,
        changeType: "update",
        actorLabel: actor.label,
        definition: scenarioSchema.parse(updated.definition),
      });

      await this.writeAuditLogTx(tx, {
        actor,
        action: "scenario.update",
        entityType: "scenario",
        entityRef: updated.scenarioId,
        details: {
          fromVersion: existing.version,
          toVersion: updated.version,
          active: updated.isActive,
        },
      });

      return this.toAdminScenario(updated);
    });
  }

  async listScenarioVersions(scenarioId: string): Promise<ScenarioVersion[]> {
    await this.ensureScenarioSeed();
    const records = await db
      .select()
      .from(scenarioVersions)
      .where(eq(scenarioVersions.scenarioId, scenarioId))
      .orderBy(desc(scenarioVersions.version));

    if (records.length === 0) {
      const [existing] = await db
        .select()
        .from(scenarios)
        .where(eq(scenarios.scenarioId, scenarioId))
        .limit(1);
      if (!existing) {
        return [];
      }

      return [
        {
          id: -1,
          scenarioId: existing.scenarioId,
          version: existing.version,
          title: existing.title,
          isActive: existing.isActive,
          changeType: "seed",
          actorLabel: existing.updatedBy,
          createdAt: existing.updatedAt.toISOString(),
        },
      ];
    }

    return records.map((record) => this.toScenarioVersion(record));
  }

  async rollbackScenario(scenarioId: string, targetVersion: number, actor: AuditActor): Promise<AdminScenario | null> {
    await this.ensureScenarioSeed();

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(scenarios)
        .where(eq(scenarios.scenarioId, scenarioId))
        .limit(1);
      if (!existing) {
        return null;
      }

      const [target] = await tx
        .select()
        .from(scenarioVersions)
        .where(and(eq(scenarioVersions.scenarioId, scenarioId), eq(scenarioVersions.version, targetVersion)))
        .limit(1);

      if (!target) {
        return null;
      }

      if (target.isActive) {
        await tx.update(scenarios).set({ isActive: false });
      }

      const nextVersion = existing.version + 1;
      const restoredScenario = scenarioSchema.parse(target.definition);
      const [updated] = await tx
        .update(scenarios)
        .set({
          title: target.title,
          isActive: target.isActive,
          version: nextVersion,
          updatedBy: actor.label,
          definition: restoredScenario,
          updatedAt: new Date(),
        })
        .where(eq(scenarios.scenarioId, scenarioId))
        .returning();

      await tx.insert(scenarioVersions).values({
        scenarioId: scenarioId,
        version: updated.version,
        title: updated.title,
        isActive: updated.isActive,
        changeType: "rollback",
        actorLabel: actor.label,
        definition: scenarioSchema.parse(updated.definition),
      });

      await this.writeAuditLogTx(tx, {
        actor,
        action: "scenario.rollback",
        entityType: "scenario",
        entityRef: scenarioId,
        details: {
          fromVersion: existing.version,
          restoredVersion: targetVersion,
          toVersion: updated.version,
          active: updated.isActive,
        },
      });

      return this.toAdminScenario(updated);
    });
  }

  async listTrainingConfigs(): Promise<AdminTrainingConfig[]> {
    try {
      await this.ensureTrainingConfigSeed();
      const records = await db
        .select()
        .from(trainingConfigs)
        .orderBy(desc(trainingConfigs.updatedAt));

      return records
        .map((record) => this.toAdminTrainingConfig(record))
        .sort((left, right) => Number(right.isActive) - Number(left.isActive));
    } catch (error) {
      console.error("Training config admin storage unavailable, using default config:", error);
      return this.getMemoryTrainingConfigs();
    }
  }

  async createTrainingConfig(input: AdminTrainingConfigMutation, actor: AuditActor): Promise<AdminTrainingConfig> {
    try {
      await this.ensureTrainingConfigSeed();
      const { config, isActive } = adminTrainingConfigMutationSchema.parse(input);

      return db.transaction(async (tx) => {
        if (isActive) {
          await tx.update(trainingConfigs).set({ isActive: false });
        }

        const [created] = await tx
          .insert(trainingConfigs)
          .values({
            isActive,
            version: 1,
            updatedBy: actor.label,
            definition: config,
          })
          .returning();

        await tx.insert(trainingConfigVersions).values({
          configId: created.id,
          version: created.version,
          isActive: created.isActive,
          changeType: "create",
          actorLabel: actor.label,
          definition: trainingConfigSchema.parse(created.definition),
        });

        await this.writeAuditLogTx(tx, {
          actor,
          action: "training-config.create",
          entityType: "training_config",
          entityRef: String(created.id),
          details: {
            version: created.version,
            active: created.isActive,
          },
        });

        return this.toAdminTrainingConfig(created);
      });
    } catch (error) {
      console.error("Training config create fallback to memory store:", error);
      const { config, isActive } = adminTrainingConfigMutationSchema.parse(input);
      const memory = this.getMemoryTrainingConfigs();

      if (isActive) {
        memory.forEach((record) => {
          record.isActive = false;
        });
      }

      const nowIso = new Date().toISOString();
      const nextId = memory.length > 0 ? Math.max(...memory.map((record) => record.id)) + 1 : 1;
      const created: AdminTrainingConfig = {
        id: nextId,
        isActive,
        version: 1,
        updatedBy: actor.label,
        definition: config,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      memory.push(created);
      return created;
    }
  }

  async updateTrainingConfig(configId: number, input: AdminTrainingConfigMutation, actor: AuditActor): Promise<AdminTrainingConfig | null> {
    try {
      await this.ensureTrainingConfigSeed();
      const { config, isActive } = adminTrainingConfigMutationSchema.parse(input);

      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(trainingConfigs)
          .where(eq(trainingConfigs.id, configId))
          .limit(1);

        if (!existing) {
          return null;
        }

        if (isActive) {
          await tx.update(trainingConfigs).set({ isActive: false });
        }

        const nextVersion = existing.version + 1;
        const [updated] = await tx
          .update(trainingConfigs)
          .set({
            isActive,
            version: nextVersion,
            updatedBy: actor.label,
            definition: config,
            updatedAt: new Date(),
          })
          .where(eq(trainingConfigs.id, configId))
          .returning();

        await tx.insert(trainingConfigVersions).values({
          configId: updated.id,
          version: updated.version,
          isActive: updated.isActive,
          changeType: "update",
          actorLabel: actor.label,
          definition: trainingConfigSchema.parse(updated.definition),
        });

        await this.writeAuditLogTx(tx, {
          actor,
          action: "training-config.update",
          entityType: "training_config",
          entityRef: String(updated.id),
          details: {
            fromVersion: existing.version,
            toVersion: updated.version,
            active: updated.isActive,
          },
        });

        return this.toAdminTrainingConfig(updated);
      });
    } catch (error) {
      console.error("Training config update fallback to memory store:", error);
      const { config, isActive } = adminTrainingConfigMutationSchema.parse(input);
      const memory = this.getMemoryTrainingConfigs();
      const existing = memory.find((record) => record.id === configId);
      if (!existing) {
        return null;
      }

      if (isActive) {
        memory.forEach((record) => {
          record.isActive = false;
        });
      }

      existing.isActive = isActive;
      existing.version += 1;
      existing.updatedBy = actor.label;
      existing.definition = config;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }
  }

  async listTrainingConfigVersions(configId: number): Promise<TrainingConfigVersion[]> {
    await this.ensureTrainingConfigSeed();
    const records = await db
      .select()
      .from(trainingConfigVersions)
      .where(eq(trainingConfigVersions.configId, configId))
      .orderBy(desc(trainingConfigVersions.version));

    return records.map((record) => this.toTrainingConfigVersion(record));
  }

  async rollbackTrainingConfig(configId: number, targetVersion: number, actor: AuditActor): Promise<AdminTrainingConfig | null> {
    await this.ensureTrainingConfigSeed();

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(trainingConfigs)
        .where(eq(trainingConfigs.id, configId))
        .limit(1);
      if (!existing) {
        return null;
      }

      const [target] = await tx
        .select()
        .from(trainingConfigVersions)
        .where(and(eq(trainingConfigVersions.configId, configId), eq(trainingConfigVersions.version, targetVersion)))
        .limit(1);
      if (!target) {
        return null;
      }

      if (target.isActive) {
        await tx.update(trainingConfigs).set({ isActive: false });
      }

      const nextVersion = existing.version + 1;
      const [updated] = await tx
        .update(trainingConfigs)
        .set({
          isActive: target.isActive,
          version: nextVersion,
          updatedBy: actor.label,
          definition: trainingConfigSchema.parse(target.definition),
          updatedAt: new Date(),
        })
        .where(eq(trainingConfigs.id, configId))
        .returning();

      await tx.insert(trainingConfigVersions).values({
        configId: updated.id,
        version: updated.version,
        isActive: updated.isActive,
        changeType: "rollback",
        actorLabel: actor.label,
        definition: trainingConfigSchema.parse(updated.definition),
      });

      await this.writeAuditLogTx(tx, {
        actor,
        action: "training-config.rollback",
        entityType: "training_config",
        entityRef: String(configId),
        details: {
          fromVersion: existing.version,
          restoredVersion: targetVersion,
          toVersion: updated.version,
          active: updated.isActive,
        },
      });

      return this.toAdminTrainingConfig(updated);
    });
  }

  async listAuditLogs(filter?: AuditLogFilter): Promise<AdminAuditLog[]> {
    await this.ensureAdminSeed();
    const limit = Math.min(Math.max(filter?.limit ?? 100, 1), 500);

    let records: AdminAuditLogRecord[] = [];
    if (filter?.entityType && filter?.entityRef) {
      records = await db
        .select()
        .from(adminAuditLogs)
        .where(
          and(
            eq(adminAuditLogs.entityType, filter.entityType),
            eq(adminAuditLogs.entityRef, filter.entityRef),
          ),
        )
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(limit);
    } else if (filter?.entityType) {
      records = await db
        .select()
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.entityType, filter.entityType))
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(limit);
    } else if (filter?.entityRef) {
      records = await db
        .select()
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.entityRef, filter.entityRef))
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(limit);
    } else {
      records = await db
        .select()
        .from(adminAuditLogs)
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(limit);
    }

    return records.map((record) => this.toAuditLog(record));
  }

  async listPublicActivity(limit = 8): Promise<PublicActivityItem[]> {
    const logs = await this.listAuditLogs({ limit });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityRef: log.entityRef,
      createdAt: log.createdAt,
    }));
  }

  async exportAdminData(): Promise<AdminDataExport> {
    const [scenarioRecords, trainingConfigRecords] = await Promise.all([
      this.listScenarios(),
      this.listTrainingConfigs(),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      scenarios: scenarioRecords,
      trainingConfigs: trainingConfigRecords,
    };
  }

  async importAdminData(
    input: AdminDataImport,
    actor: AuditActor,
  ): Promise<{ importedScenarios: number; importedTrainingConfigs: number }> {
    const parsed = adminDataImportSchema.parse(input);

    if (parsed.mode === "replace") {
      await db.transaction(async (tx) => {
        await tx.delete(scenarioVersions);
        await tx.delete(scenarios);
        await tx.delete(trainingConfigVersions);
        await tx.delete(trainingConfigs);
      });

      this.scenarioSeedPromise = Promise.resolve();
      this.trainingSeedPromise = Promise.resolve();
      this.memoryTrainingConfigs = null;
    }

    const existingScenarioIds = new Set((await this.listScenarios()).map((item) => item.scenarioId));
    let importedScenarios = 0;
    let importedTrainingConfigs = 0;

    for (const scenarioInput of parsed.scenarios) {
      const scenarioId = scenarioInput.scenario.id;
      if (existingScenarioIds.has(scenarioId)) {
        const updated = await this.updateScenario(scenarioId, scenarioInput, actor);
        if (updated) {
          importedScenarios += 1;
        }
      } else {
        await this.createScenario(scenarioInput, actor);
        existingScenarioIds.add(scenarioId);
        importedScenarios += 1;
      }
    }

    for (const configInput of parsed.trainingConfigs) {
      await this.createTrainingConfig(configInput, actor);
      importedTrainingConfigs += 1;
    }

    await db.insert(adminAuditLogs).values({
      actorLabel: actor.label,
      actorRole: actor.role,
      action: "admin.import",
      entityType: "auth",
      entityRef: parsed.mode,
      details: {
        importedScenarios,
        importedTrainingConfigs,
      },
    });

    return { importedScenarios, importedTrainingConfigs };
  }

  async resetToDemo(actor: AuditActor): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(scenarioVersions);
      await tx.delete(scenarios);
      await tx.delete(trainingConfigVersions);
      await tx.delete(trainingConfigs);

      const insertedScenarios = await tx
        .insert(scenarios)
        .values(
          BUILTIN_SCENARIOS.map((scenario, index) => ({
            scenarioId: scenario.id,
            title: scenario.title,
            isActive: index === 0,
            version: 1,
            updatedBy: actor.label,
            definition: scenario,
          })),
        )
        .returning();

      if (insertedScenarios.length > 0) {
        await tx.insert(scenarioVersions).values(
          insertedScenarios.map((record) => ({
            scenarioId: record.scenarioId,
            version: record.version,
            title: record.title,
            isActive: record.isActive,
            changeType: "seed" as const,
            actorLabel: actor.label,
            definition: scenarioSchema.parse(record.definition),
          })),
        );
      }

      const [createdTrainingConfig] = await tx
        .insert(trainingConfigs)
        .values({
          isActive: true,
          version: 1,
          updatedBy: actor.label,
          definition: DEFAULT_TRAINING_CONFIG,
        })
        .returning();

      if (createdTrainingConfig) {
        await tx.insert(trainingConfigVersions).values({
          configId: createdTrainingConfig.id,
          version: createdTrainingConfig.version,
          isActive: createdTrainingConfig.isActive,
          changeType: "seed",
          actorLabel: actor.label,
          definition: DEFAULT_TRAINING_CONFIG,
        });
      }

      await tx.insert(adminAuditLogs).values({
        actorLabel: actor.label,
        actorRole: actor.role,
        action: "admin.demo-reset",
        entityType: "auth",
        entityRef: "all",
        details: {
          scenarios: BUILTIN_SCENARIOS.length,
          trainingConfigs: 1,
        },
      });
    });

    this.scenarioSeedPromise = Promise.resolve();
    this.trainingSeedPromise = Promise.resolve();
    this.memoryTrainingConfigs = null;
  }

  private async ensureScenarioSeed(): Promise<void> {
    if (!this.scenarioSeedPromise) {
      this.scenarioSeedPromise = this.seedScenarioIfEmpty().catch((error) => {
        this.scenarioSeedPromise = null;
        throw error;
      });
    }

    await this.scenarioSeedPromise;
  }

  private async ensureTrainingConfigSeed(): Promise<void> {
    if (!this.trainingSeedPromise) {
      this.trainingSeedPromise = this.seedTrainingConfigIfEmpty().catch((error) => {
        this.trainingSeedPromise = null;
        throw error;
      });
    }

    await this.trainingSeedPromise;
  }

  private async ensureAdminSeed(): Promise<void> {
    if (!this.adminSeedPromise) {
      this.adminSeedPromise = this.seedAdminIfEmpty().catch((error) => {
        this.adminSeedPromise = null;
        throw error;
      });
    }

    await this.adminSeedPromise;
  }

  private async seedScenarioIfEmpty(): Promise<void> {
    const [existingScenario] = await db.select({ id: scenarios.id }).from(scenarios).limit(1);

    if (!existingScenario) {
      await db
        .insert(scenarios)
        .values(
          BUILTIN_SCENARIOS.map((scenario, index) => ({
            scenarioId: scenario.id,
            title: scenario.title,
            isActive: index === 0,
            version: 1,
            updatedBy: SYSTEM_ACTOR.label,
            definition: scenario,
          })),
        )
        .onConflictDoNothing({ target: scenarios.scenarioId });
    }

    const currentScenarios = await db.select().from(scenarios);
    const existingVersions = await db.select().from(scenarioVersions);
    const versionLookup = new Set(existingVersions.map((record) => `${record.scenarioId}:${record.version}`));

    const missingVersions = currentScenarios
      .filter((record) => !versionLookup.has(`${record.scenarioId}:${record.version}`))
      .map((record) => ({
        scenarioId: record.scenarioId,
        version: record.version,
        title: record.title,
        isActive: record.isActive,
        changeType: "seed" as const,
        actorLabel: record.updatedBy,
        definition: scenarioSchema.parse(record.definition),
      }));

    if (missingVersions.length > 0) {
      await db.insert(scenarioVersions).values(missingVersions);
    }
  }

  private async seedTrainingConfigIfEmpty(): Promise<void> {
    const [existingConfig] = await db.select({ id: trainingConfigs.id }).from(trainingConfigs).limit(1);

    if (!existingConfig) {
      const [created] = await db
        .insert(trainingConfigs)
        .values({
          isActive: true,
          version: 1,
          updatedBy: SYSTEM_ACTOR.label,
          definition: DEFAULT_TRAINING_CONFIG,
        })
        .returning();

      if (created) {
        await db.insert(trainingConfigVersions).values({
          configId: created.id,
          version: created.version,
          isActive: created.isActive,
          changeType: "seed",
          actorLabel: SYSTEM_ACTOR.label,
          definition: DEFAULT_TRAINING_CONFIG,
        });
      }
      return;
    }

    const records = await db.select().from(trainingConfigs);
    const existingVersions = await db.select().from(trainingConfigVersions);
    const versionLookup = new Set(existingVersions.map((record) => `${record.configId}:${record.version}`));

    const missingVersions = records
      .filter((record) => !versionLookup.has(`${record.id}:${record.version}`))
      .map((record) => ({
        configId: record.id,
        version: record.version,
        isActive: record.isActive,
        changeType: "seed" as const,
        actorLabel: record.updatedBy,
        definition: trainingConfigSchema.parse(record.definition),
      }));

    if (missingVersions.length > 0) {
      await db.insert(trainingConfigVersions).values(missingVersions);
    }
  }

  private async seedAdminIfEmpty(): Promise<void> {
    const [existing] = await db.select({ id: adminApiKeys.id }).from(adminApiKeys).limit(1);
    if (existing) {
      return;
    }

    const seedInputs = [
      { key: process.env.ADMIN_API_KEY, label: "owner-default", role: "owner" as const },
      { key: process.env.ADMIN_EDITOR_API_KEY, label: "editor-default", role: "editor" as const },
      { key: process.env.ADMIN_VIEWER_API_KEY, label: "viewer-default", role: "viewer" as const },
    ].filter((entry) => Boolean(entry.key && entry.key.trim().length > 0));

    if (seedInputs.length === 0) {
      return;
    }

    await db.insert(adminApiKeys).values(
      seedInputs.map((entry) => ({
        label: entry.label,
        role: entry.role,
        keyHash: this.hashApiKey(entry.key ?? ""),
      })),
    );
  }

  private authenticateAdminFromEnv(rawApiKey: string): AdminSession | null {
    const envMappings = [
      { key: process.env.ADMIN_API_KEY, label: "owner-env", role: "owner" as const },
      { key: process.env.ADMIN_EDITOR_API_KEY, label: "editor-env", role: "editor" as const },
      { key: process.env.ADMIN_VIEWER_API_KEY, label: "viewer-env", role: "viewer" as const },
    ];

    for (const mapping of envMappings) {
      if (!mapping.key) {
        continue;
      }

      if (this.constantTimeCompare(this.hashApiKey(mapping.key), this.hashApiKey(rawApiKey))) {
        return {
          label: mapping.label,
          role: mapping.role,
          permissions: ROLE_PERMISSIONS[mapping.role],
          source: "env",
        };
      }
    }

    return null;
  }

  private getBuiltinScenario(scenarioId?: string): Scenario {
    if (scenarioId) {
      return BUILTIN_SCENARIOS.find((scenario) => scenario.id === scenarioId) ?? DEFAULT_SCENARIO;
    }

    return DEFAULT_SCENARIO;
  }

  private getFallbackAdminScenarios(): AdminScenario[] {
    const nowIso = new Date().toISOString();
    return BUILTIN_SCENARIOS.map((scenario, index) => ({
      id: -(index + 1),
      scenarioId: scenario.id,
      title: scenario.title,
      isActive: scenario.id === DEFAULT_SCENARIO.id,
      version: 1,
      updatedBy: SYSTEM_ACTOR.label,
      definition: scenario,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));
  }

  private toAdminScenario(record: ScenarioRecord): AdminScenario {
    return {
      id: record.id,
      scenarioId: record.scenarioId,
      title: record.title,
      isActive: record.isActive,
      version: record.version,
      updatedBy: record.updatedBy,
      definition: scenarioSchema.parse(record.definition),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toScenarioVersion(record: ScenarioVersionRecord): ScenarioVersion {
    return {
      id: record.id,
      scenarioId: record.scenarioId,
      version: record.version,
      title: record.title,
      isActive: record.isActive,
      changeType: record.changeType,
      actorLabel: record.actorLabel,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private toAdminTrainingConfig(record: TrainingConfigRecord): AdminTrainingConfig {
    return {
      id: record.id,
      isActive: record.isActive,
      version: record.version,
      updatedBy: record.updatedBy,
      definition: trainingConfigSchema.parse(record.definition),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toTrainingConfigVersion(record: TrainingConfigVersionRecord): TrainingConfigVersion {
    return {
      id: record.id,
      configId: record.configId,
      version: record.version,
      isActive: record.isActive,
      changeType: record.changeType,
      actorLabel: record.actorLabel,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private toAuditLog(record: AdminAuditLogRecord): AdminAuditLog {
    return {
      id: record.id,
      actorLabel: record.actorLabel,
      actorRole: adminRoleSchema.parse(record.actorRole),
      action: record.action,
      entityType: record.entityType,
      entityRef: record.entityRef,
      details: record.details ?? null,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private async writeAuditLogTx(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    input: {
      actor: AuditActor;
      action: string;
      entityType: "scenario" | "training_config" | "auth";
      entityRef: string;
      details?: Record<string, unknown>;
    },
  ): Promise<void> {
    await tx.insert(adminAuditLogs).values({
      actorLabel: input.actor.label,
      actorRole: input.actor.role,
      action: input.action,
      entityType: input.entityType,
      entityRef: input.entityRef,
      details: input.details ?? null,
    });
  }

  private getMemoryTrainingConfigs(): AdminTrainingConfig[] {
    if (this.memoryTrainingConfigs) {
      return this.memoryTrainingConfigs;
    }

    const nowIso = new Date().toISOString();
    this.memoryTrainingConfigs = [
      {
        id: 1,
        isActive: true,
        version: 1,
        updatedBy: SYSTEM_ACTOR.label,
        definition: DEFAULT_TRAINING_CONFIG,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    return this.memoryTrainingConfigs;
  }

  private hashApiKey(rawKey: string): string {
    return createHash("sha256").update(rawKey).digest("hex");
  }

  private constantTimeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}

export const storage = new DatabaseStorage();
