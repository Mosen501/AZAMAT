import { useQuery, useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import {
  type AdvancedChatRequest,
  type AdvancedChatResponse,
  type AdminAuditLog,
  type AdminDataExport,
  type AdminDataImport,
  type AdminRollbackInput,
  type AdminScenario,
  type AdminScenarioMutation,
  type AdminSession,
  type AdminTrainingConfig,
  type AdminTrainingConfigMutation,
  type DebriefRequest,
  type DebriefResponse,
  type PublicActivityItem,
  type Scenario,
  type ScenarioSummary,
  type ScenarioVersion,
  type TrainingConfig,
  type TrainingConfigVersion,
} from "@shared/schema";

async function parseApiResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  if (!res.ok) {
    let message = text || res.statusText;

    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.message === "string") {
        message = parsed.message;
      }
    } catch {
      // Keep the raw response text when the body is not JSON.
    }

    throw new Error(message);
  }

  return (text ? JSON.parse(text) : null) as T;
}

export function useScenarioCatalog() {
  return useQuery<ScenarioSummary[]>({
    queryKey: [api.scenario.list.path],
    queryFn: async () => {
      const res = await fetch(api.scenario.list.path, {
        headers: { "Accept": "application/json" },
      });

      return parseApiResponse<ScenarioSummary[]>(res);
    },
    staleTime: Infinity,
  });
}

export function useTrainingConfig() {
  return useQuery<TrainingConfig>({
    queryKey: [api.training.config.path],
    queryFn: async () => {
      const res = await fetch(api.training.config.path, {
        headers: { "Accept": "application/json" },
      });

      return parseApiResponse<TrainingConfig>(res);
    },
    staleTime: Infinity,
  });
}

export function usePublicActivity(limit = 8) {
  return useQuery<PublicActivityItem[]>({
    queryKey: [api.activity.recent.path, limit],
    queryFn: async () => {
      const res = await fetch(`${api.activity.recent.path}?limit=${encodeURIComponent(String(limit))}`, {
        headers: { "Accept": "application/json" },
      });

      return parseApiResponse<PublicActivityItem[]>(res);
    },
    staleTime: 15_000,
  });
}

function buildAdminHeaders(adminKey: string | null, includeJson = false): HeadersInit {
  const headers: HeadersInit = {
    "Accept": "application/json",
    "x-admin-key": adminKey ?? "",
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

export function useScenario(scenarioId?: string | null) {
  return useQuery<Scenario>({
    queryKey: [api.scenario.get.path, scenarioId ?? ""],
    queryFn: async () => {
      const url = scenarioId
        ? `${api.scenario.get.path}?id=${encodeURIComponent(scenarioId)}`
        : api.scenario.get.path;
      const res = await fetch(url, {
        headers: { "Accept": "application/json" }
      });
      return parseApiResponse<Scenario>(res);
    },
    staleTime: Infinity, // Scenario rarely changes during a session
  });
}

export function useGenerateDebrief() {
  return useMutation<DebriefResponse, Error, DebriefRequest>({
    mutationFn: async (data) => {
      const res = await fetch(api.debrief.generate.path, {
        method: api.debrief.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      return parseApiResponse<DebriefResponse>(res);
    }
  });
}

export function useAdminScenarios(adminKey: string | null) {
  return useQuery<AdminScenario[]>({
    queryKey: [api.admin.scenarios.list.path, adminKey ?? ""],
    enabled: Boolean(adminKey),
    queryFn: async () => {
      const res = await fetch(api.admin.scenarios.list.path, {
        headers: buildAdminHeaders(adminKey),
      });

      return parseApiResponse<AdminScenario[]>(res);
    },
    staleTime: 0,
  });
}

export function useAdminTrainingConfigs(adminKey: string | null) {
  return useQuery<AdminTrainingConfig[]>({
    queryKey: [api.admin.trainingConfigs.list.path, adminKey ?? ""],
    enabled: Boolean(adminKey),
    queryFn: async () => {
      const res = await fetch(api.admin.trainingConfigs.list.path, {
        headers: buildAdminHeaders(adminKey),
      });

      return parseApiResponse<AdminTrainingConfig[]>(res);
    },
    staleTime: 0,
  });
}

export function useAdminSession(adminKey: string | null) {
  return useQuery<AdminSession>({
    queryKey: [api.admin.session.me.path, adminKey ?? ""],
    enabled: Boolean(adminKey),
    queryFn: async () => {
      const res = await fetch(api.admin.session.me.path, {
        headers: buildAdminHeaders(adminKey),
      });
      return parseApiResponse<AdminSession>(res);
    },
    staleTime: 0,
  });
}

export function useScenarioVersions(adminKey: string | null, scenarioId: string | null) {
  return useQuery<ScenarioVersion[]>({
    queryKey: [api.admin.scenarios.versions.path, adminKey ?? "", scenarioId ?? ""],
    enabled: Boolean(adminKey && scenarioId),
    queryFn: async () => {
      const res = await fetch(
        buildUrl(api.admin.scenarios.versions.path, { scenarioId: scenarioId ?? "" }),
        { headers: buildAdminHeaders(adminKey) },
      );
      return parseApiResponse<ScenarioVersion[]>(res);
    },
    staleTime: 0,
  });
}

export function useTrainingConfigVersions(adminKey: string | null, configId: number | null) {
  return useQuery<TrainingConfigVersion[]>({
    queryKey: [api.admin.trainingConfigs.versions.path, adminKey ?? "", configId ?? -1],
    enabled: Boolean(adminKey) && Number.isFinite(configId),
    queryFn: async () => {
      const res = await fetch(
        buildUrl(api.admin.trainingConfigs.versions.path, { configId: configId ?? -1 }),
        { headers: buildAdminHeaders(adminKey) },
      );
      return parseApiResponse<TrainingConfigVersion[]>(res);
    },
    staleTime: 0,
  });
}

export function useAdminAuditLogs(
  adminKey: string | null,
  filter?: { entityType?: "scenario" | "training_config" | "auth"; entityRef?: string; limit?: number },
) {
  return useQuery<AdminAuditLog[]>({
    queryKey: [api.admin.audit.list.path, adminKey ?? "", filter?.entityType ?? "", filter?.entityRef ?? "", filter?.limit ?? 0],
    enabled: Boolean(adminKey),
    queryFn: async () => {
      const query = new URLSearchParams();
      if (filter?.entityType) {
        query.set("entityType", filter.entityType);
      }
      if (filter?.entityRef) {
        query.set("entityRef", filter.entityRef);
      }
      if (filter?.limit) {
        query.set("limit", String(filter.limit));
      }
      const url = query.toString() ? `${api.admin.audit.list.path}?${query.toString()}` : api.admin.audit.list.path;
      const res = await fetch(url, { headers: buildAdminHeaders(adminKey) });
      return parseApiResponse<AdminAuditLog[]>(res);
    },
    staleTime: 0,
  });
}

export function useAdvancedChatTurn() {
  return useMutation<AdvancedChatResponse, Error, AdvancedChatRequest>({
    mutationFn: async (data) => {
      const res = await fetch(api.advanced.chat.path, {
        method: api.advanced.chat.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      return parseApiResponse<AdvancedChatResponse>(res);
    },
  });
}

export function useCreateScenario(adminKey: string | null) {
  return useMutation<AdminScenario, Error, AdminScenarioMutation>({
    mutationFn: async (data) => {
      if (!adminKey) {
        throw new Error("Admin API key is required.");
      }

      const res = await fetch(api.admin.scenarios.create.path, {
        method: api.admin.scenarios.create.method,
        headers: buildAdminHeaders(adminKey, true),
        body: JSON.stringify(data),
      });

      return parseApiResponse<AdminScenario>(res);
    },
  });
}

export function useUpdateScenario(adminKey: string | null) {
  return useMutation<AdminScenario, Error, { scenarioId: string; data: AdminScenarioMutation }>({
    mutationFn: async ({ scenarioId, data }) => {
      if (!adminKey) {
        throw new Error("Admin API key is required.");
      }

      const res = await fetch(
        buildUrl(api.admin.scenarios.update.path, { scenarioId }),
        {
          method: api.admin.scenarios.update.method,
          headers: buildAdminHeaders(adminKey, true),
          body: JSON.stringify(data),
        },
      );

      return parseApiResponse<AdminScenario>(res);
    },
  });
}

export function useCreateTrainingConfig(adminKey: string | null) {
  return useMutation<AdminTrainingConfig, Error, AdminTrainingConfigMutation>({
    mutationFn: async (data) => {
      if (!adminKey) {
        throw new Error("Admin API key is required.");
      }

      const res = await fetch(api.admin.trainingConfigs.create.path, {
        method: api.admin.trainingConfigs.create.method,
        headers: buildAdminHeaders(adminKey, true),
        body: JSON.stringify(data),
      });

      return parseApiResponse<AdminTrainingConfig>(res);
    },
  });
}

export function useUpdateTrainingConfig(adminKey: string | null) {
  return useMutation<
    AdminTrainingConfig,
    Error,
    { configId: number; data: AdminTrainingConfigMutation }
  >({
    mutationFn: async ({ configId, data }) => {
      if (!adminKey) {
        throw new Error("Admin API key is required.");
      }

      const res = await fetch(
        buildUrl(api.admin.trainingConfigs.update.path, { configId }),
        {
          method: api.admin.trainingConfigs.update.method,
          headers: buildAdminHeaders(adminKey, true),
          body: JSON.stringify(data),
        },
      );

      return parseApiResponse<AdminTrainingConfig>(res);
    },
  });
}

export function useRollbackScenario(adminKey: string | null) {
  return useMutation<AdminScenario, Error, { scenarioId: string; data: AdminRollbackInput }>({
    mutationFn: async ({ scenarioId, data }) => {
      if (!adminKey) {
        throw new Error("Admin API key is required.");
      }
      const res = await fetch(buildUrl(api.admin.scenarios.rollback.path, { scenarioId }), {
        method: api.admin.scenarios.rollback.method,
        headers: buildAdminHeaders(adminKey, true),
        body: JSON.stringify(data),
      });
      return parseApiResponse<AdminScenario>(res);
    },
  });
}

export function useRollbackTrainingConfig(adminKey: string | null) {
  return useMutation<AdminTrainingConfig, Error, { configId: number; data: AdminRollbackInput }>({
    mutationFn: async ({ configId, data }) => {
      if (!adminKey) {
        throw new Error("Admin API key is required.");
      }
      const res = await fetch(buildUrl(api.admin.trainingConfigs.rollback.path, { configId }), {
        method: api.admin.trainingConfigs.rollback.method,
        headers: buildAdminHeaders(adminKey, true),
        body: JSON.stringify(data),
      });
      return parseApiResponse<AdminTrainingConfig>(res);
    },
  });
}

export function useExportAdminData(adminKey: string | null) {
  return useMutation<AdminDataExport, Error>({
    mutationFn: async () => {
      if (!adminKey) {
        throw new Error("Admin API key is required.");
      }
      const res = await fetch(api.admin.data.export.path, {
        method: api.admin.data.export.method,
        headers: buildAdminHeaders(adminKey),
      });
      return parseApiResponse<AdminDataExport>(res);
    },
  });
}

export function useImportAdminData(adminKey: string | null) {
  return useMutation<{ importedScenarios: number; importedTrainingConfigs: number }, Error, AdminDataImport>({
    mutationFn: async (data) => {
      if (!adminKey) {
        throw new Error("Admin API key is required.");
      }
      const res = await fetch(api.admin.data.import.path, {
        method: api.admin.data.import.method,
        headers: buildAdminHeaders(adminKey, true),
        body: JSON.stringify(data),
      });
      return parseApiResponse<{ importedScenarios: number; importedTrainingConfigs: number }>(res);
    },
  });
}

export function useDemoReset(adminKey: string | null) {
  return useMutation<{ message: string }, Error>({
    mutationFn: async () => {
      if (!adminKey) {
        throw new Error("Admin API key is required.");
      }
      const res = await fetch(api.admin.data.demoReset.path, {
        method: api.admin.data.demoReset.method,
        headers: buildAdminHeaders(adminKey, true),
      });
      return parseApiResponse<{ message: string }>(res);
    },
  });
}
