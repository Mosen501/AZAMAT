import { z } from "zod";
import {
  advancedChatRequestSchema,
  advancedChatResponseSchema,
  adminAuditLogSchema,
  adminDataExportSchema,
  adminDataImportSchema,
  adminRollbackSchema,
  adminScenarioMutationSchema,
  adminScenarioSchema,
  adminSessionSchema,
  adminTrainingConfigMutationSchema,
  adminTrainingConfigSchema,
  debriefRequestSchema,
  debriefResponseSchema,
  scenarioSchema,
  scenarioVersionSchema,
  scenarioSummarySchema,
  publicActivityItemSchema,
  trainingConfigVersionSchema,
  trainingConfigSchema,
} from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  scenario: {
    list: {
      method: "GET" as const,
      path: "/api/scenarios" as const,
      responses: {
        200: z.array(scenarioSummarySchema),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/scenario" as const,
      responses: {
        200: scenarioSchema
      }
    }
  },
  activity: {
    recent: {
      method: "GET" as const,
      path: "/api/activity" as const,
      responses: {
        200: z.array(publicActivityItemSchema),
      },
    },
  },
  training: {
    config: {
      method: "GET" as const,
      path: "/api/training-config" as const,
      responses: {
        200: trainingConfigSchema,
      },
    },
  },
  debrief: {
    generate: {
      method: "POST" as const,
      path: "/api/debrief" as const,
      input: debriefRequestSchema,
      responses: {
        200: debriefResponseSchema,
        500: errorSchemas.internal
      }
    }
  },
  advanced: {
    chat: {
      method: "POST" as const,
      path: "/api/advanced/chat" as const,
      input: advancedChatRequestSchema,
      responses: {
        200: advancedChatResponseSchema,
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
  },
  admin: {
    session: {
      me: {
        method: "GET" as const,
        path: "/api/admin/me" as const,
        responses: {
          200: adminSessionSchema,
          401: errorSchemas.internal,
        },
      },
    },
    scenarios: {
      list: {
        method: "GET" as const,
        path: "/api/admin/scenarios" as const,
        responses: {
          200: z.array(adminScenarioSchema),
          401: errorSchemas.internal,
        },
      },
      create: {
        method: "POST" as const,
        path: "/api/admin/scenarios" as const,
        input: adminScenarioMutationSchema,
        responses: {
          201: adminScenarioSchema,
          400: errorSchemas.validation,
          401: errorSchemas.internal,
          409: errorSchemas.internal,
        },
      },
      update: {
        method: "PUT" as const,
        path: "/api/admin/scenarios/:scenarioId" as const,
        input: adminScenarioMutationSchema,
        responses: {
          200: adminScenarioSchema,
          400: errorSchemas.validation,
          401: errorSchemas.internal,
          404: errorSchemas.internal,
          409: errorSchemas.internal,
        },
      },
      versions: {
        method: "GET" as const,
        path: "/api/admin/scenarios/:scenarioId/versions" as const,
        responses: {
          200: z.array(scenarioVersionSchema),
          401: errorSchemas.internal,
          404: errorSchemas.internal,
        },
      },
      rollback: {
        method: "POST" as const,
        path: "/api/admin/scenarios/:scenarioId/rollback" as const,
        input: adminRollbackSchema,
        responses: {
          200: adminScenarioSchema,
          400: errorSchemas.validation,
          401: errorSchemas.internal,
          404: errorSchemas.internal,
        },
      },
    },
    trainingConfigs: {
      list: {
        method: "GET" as const,
        path: "/api/admin/training-configs" as const,
        responses: {
          200: z.array(adminTrainingConfigSchema),
          401: errorSchemas.internal,
        },
      },
      create: {
        method: "POST" as const,
        path: "/api/admin/training-configs" as const,
        input: adminTrainingConfigMutationSchema,
        responses: {
          201: adminTrainingConfigSchema,
          400: errorSchemas.validation,
          401: errorSchemas.internal,
        },
      },
      update: {
        method: "PUT" as const,
        path: "/api/admin/training-configs/:configId" as const,
        input: adminTrainingConfigMutationSchema,
        responses: {
          200: adminTrainingConfigSchema,
          400: errorSchemas.validation,
          401: errorSchemas.internal,
          404: errorSchemas.internal,
        },
      },
      versions: {
        method: "GET" as const,
        path: "/api/admin/training-configs/:configId/versions" as const,
        responses: {
          200: z.array(trainingConfigVersionSchema),
          401: errorSchemas.internal,
          404: errorSchemas.internal,
        },
      },
      rollback: {
        method: "POST" as const,
        path: "/api/admin/training-configs/:configId/rollback" as const,
        input: adminRollbackSchema,
        responses: {
          200: adminTrainingConfigSchema,
          400: errorSchemas.validation,
          401: errorSchemas.internal,
          404: errorSchemas.internal,
        },
      },
    },
    audit: {
      list: {
        method: "GET" as const,
        path: "/api/admin/audit" as const,
        responses: {
          200: z.array(adminAuditLogSchema),
          401: errorSchemas.internal,
        },
      },
    },
    data: {
      export: {
        method: "GET" as const,
        path: "/api/admin/export" as const,
        responses: {
          200: adminDataExportSchema,
          401: errorSchemas.internal,
        },
      },
      import: {
        method: "POST" as const,
        path: "/api/admin/import" as const,
        input: adminDataImportSchema,
        responses: {
          200: z.object({ importedScenarios: z.number(), importedTrainingConfigs: z.number() }),
          400: errorSchemas.validation,
          401: errorSchemas.internal,
        },
      },
      demoReset: {
        method: "POST" as const,
        path: "/api/admin/demo-reset" as const,
        responses: {
          200: z.object({ message: z.string() }),
          401: errorSchemas.internal,
        },
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
