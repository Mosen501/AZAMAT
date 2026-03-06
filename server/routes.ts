import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { api, buildUrl } from "@shared/routes";
import type {
  AdminPermission,
  AdminSession,
  DebriefResponse,
  Language,
  LocalizedScenarioContent,
  RunHistoryItem,
  Scenario,
  ScoreSet,
} from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import { storage } from "./storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const METRIC_DEFS = [
  { key: "operationalControl", en: "operational control", ar: "التحكم التشغيلي" },
  { key: "responseTempo", en: "response tempo", ar: "سرعة الاستجابة" },
  { key: "stakeholderTrust", en: "public trust", ar: "الثقة العامة" },
  { key: "teamAlignment", en: "interagency coordination", ar: "التنسيق بين الجهات" },
  { key: "executiveComms", en: "leadership briefing", ar: "إحاطة القيادة" },
] as const;

type MetricKey = typeof METRIC_DEFS[number]["key"];

interface DecisionInsight {
  stepId: string;
  stepTimeLabel: string;
  stepDescription: string;
  choiceId: string;
  choiceText: string;
  scoreDeltas: ScoreSet;
  totalDelta: number;
}

function metricLabel(metricKey: MetricKey, language: Language): string {
  const metric = METRIC_DEFS.find((candidate) => candidate.key === metricKey);
  if (!metric) {
    return metricKey;
  }

  return language === "ar" ? metric.ar : metric.en;
}

function buildDecisionInsights(history: RunHistoryItem[], scenario: Scenario): DecisionInsight[] {
  return history
    .map((item) => {
      const step = scenario.steps[item.stepId];
      const choice = step?.choices.find((candidate) => candidate.id === item.choiceId);

      if (!step || !choice) {
        return null;
      }

      const totalDelta =
        choice.scoreDeltas.operationalControl +
        choice.scoreDeltas.responseTempo +
        choice.scoreDeltas.stakeholderTrust +
        choice.scoreDeltas.teamAlignment +
        choice.scoreDeltas.executiveComms;

      return {
        stepId: step.id,
        stepTimeLabel: step.timeLabel,
        stepDescription: step.description,
        choiceId: choice.id,
        choiceText: choice.text,
        scoreDeltas: choice.scoreDeltas,
        totalDelta,
      };
    })
    .filter((insight): insight is DecisionInsight => Boolean(insight));
}

function topMetricFromDelta(
  deltas: ScoreSet,
  direction: "positive" | "negative",
): MetricKey | null {
  const sorted = [...METRIC_DEFS]
    .map((metric) => ({
      key: metric.key,
      value: deltas[metric.key],
    }))
    .sort((left, right) => {
      if (direction === "positive") {
        return right.value - left.value;
      }

      return left.value - right.value;
    });

  if (!sorted.length) {
    return null;
  }

  const best = sorted[0];
  if (direction === "positive" && best.value <= 0) {
    return null;
  }

  if (direction === "negative" && best.value >= 0) {
    return null;
  }

  return best.key;
}

function localizeRoleLabel(role: string, language: Language): string {
  if (language === "en") {
    return role;
  }

  const labels: Record<string, string> = {
    "Regional Crisis Coordination Lead": "قائد إدارة الحدث والتنسيق بين الجهات",
    "Government Communications Lead": "قائد الاتصال الحكومي والمتحدث الرسمي",
    "Field Operations and Service Continuity Lead": "قائد العمليات الميدانية واستمرارية الخدمة",
    "Logistics and Resource Support Lead": "قائد إدارة الموارد والإسناد اللوجستي",
    "Early Warning and Risk Assessment Lead": "قائد التقييم المبكر للمخاطر والإنذار",
    "Health and Medical Surge Lead": "قائد التنسيق الصحي والاستجابة الطبية",
    "Critical Infrastructure and Utilities Lead": "قائد حماية البنية التحتية والخدمات الحرجة",
    "Recovery and Essential Services Restoration Lead": "قائد التعافي واستعادة الخدمات الأساسية",
    "Cybersecurity and Digital Continuity Lead": "قائد أمن المعلومات واستمرارية الأنظمة",
  };

  return labels[role] ?? role;
}

function applyLocalizedScenarioContent(
  scenario: Scenario,
  content: LocalizedScenarioContent,
): Scenario {
  return {
    ...scenario,
    title: content.title,
    description: content.description,
    steps: Object.fromEntries(
      Object.entries(scenario.steps).map(([stepId, step]) => {
        const stepContent = content.steps[stepId];

        if (!stepContent) {
          return [stepId, step];
        }

        return [
          stepId,
          {
            ...step,
            description: stepContent.description,
            choices: step.choices.map((choice) => ({
              ...choice,
              text: stepContent.choices[choice.id] ?? choice.text,
            })),
          },
        ];
      }),
    ),
  };
}

function localizeScenarioForLanguage(
  scenario: Scenario,
  language?: Language,
): Scenario {
  if (!language) {
    return scenario;
  }

  const localizedContent = language === "ar"
    ? scenario.translations?.ar
    : scenario.translations?.en;

  if (!localizedContent) {
    return scenario;
  }

  return applyLocalizedScenarioContent(scenario, localizedContent);
}

async function requireAdminSession(req: Request, res: Response): Promise<AdminSession | null> {
  const providedKey = req.header("x-admin-key")?.trim();
  if (!providedKey) {
    res.status(401).json({ message: "Missing admin API key." });
    return null;
  }

  const session = await storage.authenticateAdmin(providedKey);
  if (!session) {
    res.status(401).json({ message: "Invalid admin API key." });
    return null;
  }

  return session;
}

async function requirePermission(
  req: Request,
  res: Response,
  permission: AdminPermission,
): Promise<AdminSession | null> {
  const session = await requireAdminSession(req, res);
  if (!session) {
    return null;
  }

  if (!session.permissions.includes(permission)) {
    res.status(403).json({
      message: `Permission denied. Required permission: ${permission}.`,
    });
    return null;
  }

  return session;
}

function buildFallbackDebrief(
  input: { role: string; history: RunHistoryItem[]; language: Language },
  scenario: Scenario,
  reason: string,
): DebriefResponse {
  const localizedRole = localizeRoleLabel(input.role, input.language);
  const finalScores =
    input.history[input.history.length - 1]?.scoresAfter ?? scenario.initialScores;
  const scoreEntries = METRIC_DEFS.map((metric) => ({
    key: metric.key,
    label: input.language === "ar" ? metric.ar : metric.en,
    value: finalScores[metric.key],
  }));
  const strongestArea = [...scoreEntries].sort((left, right) => right.value - left.value)[0];
  const weakestArea = [...scoreEntries].sort((left, right) => left.value - right.value)[0];
  const insights = buildDecisionInsights(input.history, scenario);
  const positiveInsights = [...insights]
    .filter((insight) => insight.totalDelta > 0)
    .sort((left, right) => right.totalDelta - left.totalDelta)
    .slice(0, 3);
  const negativeInsights = [...insights]
    .filter((insight) => insight.totalDelta <= 0)
    .sort((left, right) => left.totalDelta - right.totalDelta)
    .slice(0, 3);
  const firstNegativeSignal = negativeInsights[0];

  if (input.language === "en") {
    const wentWell =
      positiveInsights.length > 0
        ? positiveInsights.map((insight) => {
            const boostedMetric = topMetricFromDelta(insight.scoreDeltas, "positive");
            const metricText = boostedMetric
              ? `${metricLabel(boostedMetric, "en")} (+${insight.scoreDeltas[boostedMetric]})`
              : "overall balance";

            return `At ${insight.stepTimeLabel}, your decision "${insight.choiceText}" improved ${metricText} and stabilized the response posture.`;
          })
        : [
            `You maintained the best relative performance in ${strongestArea.label}.`,
            "Decision cadence stayed consistent, preventing a full response stall.",
            "Your actions created a usable baseline for operational learning.",
          ];

    const toImprove =
      negativeInsights.length > 0
        ? negativeInsights.map((insight) => {
            const damagedMetric = topMetricFromDelta(insight.scoreDeltas, "negative");
            const metricText = damagedMetric
              ? `${metricLabel(damagedMetric, "en")} (${insight.scoreDeltas[damagedMetric]})`
              : "multi-metric balance";

            return `At ${insight.stepTimeLabel}, the choice "${insight.choiceText}" reduced ${metricText}. Add a cross-agency check before repeating this decision pattern.`;
          })
        : [
            `Raise ${weakestArea.label} by choosing options that avoid short-term wins with hidden downstream cost.`,
            "Use explicit check-ins after each major decision so the next move reflects the latest field picture.",
            "Favor actions that balance control, trust, coordination, and communication instead of over-optimizing one axis.",
          ];

    const missedSignals =
      firstNegativeSignal
        ? [
            `The early warning signal around ${firstNegativeSignal.stepTimeLabel} was underweighted before choosing "${firstNegativeSignal.choiceText}".`,
            `Your lowest ending metric was ${weakestArea.label} (${weakestArea.value}/100), indicating unresolved pressure in that domain.`,
          ]
        : [
            "No catastrophic misses were detected, but lower metrics suggest early stress signals needed stronger prioritization.",
            `The weakest area (${weakestArea.label}) still required earlier intervention before incident closure.`,
          ];

    return {
      summary: [
        `Live AI was unavailable, so this report uses deterministic run analysis (${reason}).`,
        `You completed ${input.history.length} decision points as ${localizedRole} in scenario "${scenario.title}".`,
        `Final score spread: strongest ${strongestArea.label} (${strongestArea.value}/100), weakest ${weakestArea.label} (${weakestArea.value}/100).`,
      ],
      wentWell,
      toImprove,
      missedSignals,
      checklist: [
        "Name an incident lead and decision owner early.",
        "Create one shared operating picture across all agencies.",
        "Log each key decision with its expected tradeoff.",
        "Separate verified facts from assumptions in every leadership brief.",
        "Set a short and fixed cadence for status reviews.",
        "Issue bilingual public guidance when both Arabic and English audiences are affected.",
        "Prioritize vulnerable populations and critical public services first.",
        "Request surge support before local capacity strain is visible.",
        "Re-check community impact before declaring recovery.",
        "Restore services in phases with explicit safety guardrails.",
        "Keep one verified public information channel active throughout the incident.",
        "Capture unresolved follow-up items before the incident closes.",
        "Tie the after-action review to funded resilience improvements.",
        "Run a post-incident review within 48 hours.",
      ],
    };
  }

  const wentWellAr =
    positiveInsights.length > 0
      ? positiveInsights.map((insight) => {
          const boostedMetric = topMetricFromDelta(insight.scoreDeltas, "positive");
          const metricText = boostedMetric
            ? `${metricLabel(boostedMetric, "ar")} (+${insight.scoreDeltas[boostedMetric]})`
            : "التوازن التشغيلي العام";

          return `عند ${insight.stepTimeLabel} ساهم هذا القرار في رفع ${metricText} وتحسين استقرار الاستجابة.`;
        })
      : [
          `حافظت على أفضل أداء نسبي في ${strongestArea.label}.`,
          "استمر تسلسل اتخاذ القرار دون تعثر تشغيلي حاد.",
          "ولّدت قراراتك أساسا عمليا صالحا للتعلم اللاحق.",
        ];

  const toImproveAr =
    negativeInsights.length > 0
      ? negativeInsights.map((insight) => {
          const damagedMetric = topMetricFromDelta(insight.scoreDeltas, "negative");
          const metricText = damagedMetric
            ? `${metricLabel(damagedMetric, "ar")} (${insight.scoreDeltas[damagedMetric]})`
            : "توازن المؤشرات";

          return `عند ${insight.stepTimeLabel} خفّض هذا القرار مستوى ${metricText}. أضف نقطة مراجعة مشتركة قبل تكرار هذا النمط.`;
        })
      : [
          `ارفع مستوى ${weakestArea.label} عبر اختيار قرارات لا تمنح مكاسب قصيرة المدى على حساب آثار لاحقة خفية.`,
          "اعتمد نقاط مراجعة واضحة بعد كل قرار رئيسي حتى تستند الخطوة التالية إلى أحدث وضع ميداني.",
          "فضّل القرارات التي توازن بين التحكم والثقة والتنسيق والاتصال بدلا من المبالغة في تحسين محور واحد.",
        ];

  const missedSignalsAr =
    firstNegativeSignal
      ? [
          `لم يُعطَ إنذار مبكر حول توقيت ${firstNegativeSignal.stepTimeLabel} وزنا كافيا قبل اتخاذ قرار التصعيد المقابل.`,
          `انتهت الجولة بأضعف مؤشر في ${weakestArea.label} (${weakestArea.value}/100)، ما يدل على ضغط غير محسوم في هذا الجانب.`,
        ]
      : [
          "لم تظهر إخفاقات كارثية مباشرة، لكن بعض المؤشرات المنخفضة توحي بأن إشارات إجهاد مبكرة لم تُعالج مبكرا بما يكفي.",
          `المجال الأضعف (${weakestArea.label}) ظل بحاجة إلى تدخل أسرع قبل إغلاق الحادثة.`,
        ];

  return {
    summary: [
      `تعذر الوصول إلى OpenAI، لذلك يعتمد هذا التقرير على تحليل محلي محدد لمسار الجولة (${reason}).`,
      `أكملت ${input.history.length} نقاط قرار أثناء أداء دور ${localizedRole} ضمن السيناريو المحدد.`,
      `توزيع النتائج النهائية: أقوى مؤشر ${strongestArea.label} (${strongestArea.value}/100)، وأضعف مؤشر ${weakestArea.label} (${weakestArea.value}/100).`,
    ],
    wentWell: wentWellAr,
    toImprove: toImproveAr,
    missedSignals: missedSignalsAr,
    checklist: [
      "سمِّ قائدا للحادثة وصاحب قرار واضحا منذ البداية.",
      "أنشئ صورة تشغيلية مشتركة واحدة بين جميع الجهات.",
      "سجّل كل قرار رئيسي مع المفاضلة المتوقعة وراءه.",
      "افصل بين الحقائق المؤكدة والافتراضات في كل إحاطة قيادية.",
      "حدّد وتيرة قصيرة وثابتة لمراجعة المستجدات.",
      "أصدر إرشادات عامة باللغتين عندما يتأثر جمهور عربي وإنجليزي.",
      "قدّم الفئات الهشة والخدمات العامة الحرجة في سلم الأولويات.",
      "اطلب الدعم الإسنادي قبل أن يظهر الضغط على القدرة التشغيلية بوضوح.",
      "أعد تقييم الأثر المجتمعي قبل إعلان التعافي.",
      "أعد الخدمات على مراحل مع ضوابط سلامة واضحة.",
      "حافظ على قناة معلومات عامة موثقة وموحدة طوال الحادثة.",
      "وثّق عناصر المتابعة غير المحسومة قبل إغلاق الحادثة.",
      "اربط مراجعة ما بعد الحدث بتحسينات ممولة في الجاهزية والمرونة.",
      "أجرِ مراجعة ما بعد الحادث خلال 48 ساعة.",
    ],
  };
}

function localizeSectorLabel(sectorId: z.infer<typeof api.advanced.chat.input>["sectorId"], language: Language): string {
  const labels = {
    crowdEvents: { en: "Mass Gatherings and Public Safety", ar: "الحشود والفعاليات والسلامة العامة" },
    healthSurge: { en: "Health Surge and Emergency Care", ar: "الضغط الصحي والرعاية الطارئة" },
    infrastructure: { en: "Critical Infrastructure and Utilities", ar: "البنية التحتية والخدمات الحرجة" },
    cyber: { en: "Cyber and Digital Continuity", ar: "الأمن السيبراني واستمرارية الأنظمة الرقمية" },
  } as const;

  const entry = labels[sectorId as keyof typeof labels];
  if (!entry) {
    return sectorId;
  }

  return language === "ar" ? entry.ar : entry.en;
}

function buildAdvancedFallback(
  input: z.infer<typeof api.advanced.chat.input>,
): string {
  const lastUserMessage = [...input.history].reverse().find((entry) => entry.role === "user");

  if (input.language === "en") {
    return `AI live analysis is unavailable right now. Continue as ${input.role}. Prioritize one immediate action, one coordination action, and one public communication action. Then report your expected tradeoffs and timing. Last directive noted: "${lastUserMessage?.content ?? "N/A"}".`;
  }

  return `التحليل الذكي المباشر غير متاح حاليا. واصل بدور ${localizeRoleLabel(input.role, "ar")}. حدّد إجراء فوريا واحدا، وإجراء تنسيق واحدا، وإجراء اتصال عام واحدا، ثم وضّح المفاضلات والتوقيت المتوقع لكل إجراء. آخر توجيه مسجل: "${lastUserMessage?.content ?? "غير متاح"}".`;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get(api.activity.recent.path, async (req, res) => {
    try {
      const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
      const parsedLimit = typeof rawLimit === "string" ? Number.parseInt(rawLimit, 10) : undefined;
      const activity = await storage.listPublicActivity(
        Number.isFinite(parsedLimit) ? parsedLimit : 8,
      );
      res.json(activity);
    } catch (error) {
      console.error("Public activity retrieval error:", error);
      res.status(500).json({ message: "Failed to load activity." });
    }
  });

  app.get(api.training.config.path, async (_req, res) => {
    try {
      const config = await storage.getTrainingConfig();
      res.json(config);
    } catch (error) {
      console.error("Training config retrieval error:", error);
      res.status(500).json({ message: "Failed to load training configuration." });
    }
  });

  app.get(api.scenario.list.path, async (_req, res) => {
    try {
      const scenarios = await storage.listPlayableScenarios();
      res.json(scenarios);
    } catch (error) {
      console.error("Scenario catalog retrieval error:", error);
      res.status(500).json({ message: "Failed to load scenarios." });
    }
  });

  app.get(api.scenario.get.path, async (req, res) => {
    try {
      const requestedId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
      const requestedLanguage = Array.isArray(req.query.lang) ? req.query.lang[0] : req.query.lang;
      const scenario = await storage.getScenarioById(
        typeof requestedId === "string" && requestedId.length > 0 ? requestedId : undefined,
      );
      const language = requestedLanguage === "en" || requestedLanguage === "ar"
        ? requestedLanguage
        : undefined;
      res.json(localizeScenarioForLanguage(scenario, language));
    } catch (error) {
      console.error("Scenario retrieval error:", error);
      res.status(500).json({ message: "Failed to load scenario." });
    }
  });

  app.get(api.admin.session.me.path, async (req, res) => {
    const session = await requireAdminSession(req, res);
    if (!session) {
      return;
    }

    res.json(session);
  });

  app.get(api.admin.scenarios.list.path, async (req, res) => {
    const session = await requirePermission(req, res, "scenario:read");
    if (!session) {
      return;
    }

    try {
      const scenarioRecords = await storage.listScenarios();
      res.json(scenarioRecords);
    } catch (error) {
      console.error("Scenario list error:", error);
      res.status(500).json({ message: "Failed to load scenarios." });
    }
  });

  app.post(api.admin.scenarios.create.path, async (req, res) => {
    const session = await requirePermission(req, res, "scenario:write");
    if (!session) {
      return;
    }

    try {
      const createdScenario = await storage.createScenario(
        api.admin.scenarios.create.input.parse(req.body),
        session,
      );
      res.status(201).json(createdScenario);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0]?.message || "Validation Error" });
        return;
      }

      if ((error as { code?: string }).code === "23505") {
        res.status(409).json({ message: "A scenario with that id already exists." });
        return;
      }

      if (error instanceof Error && error.message.includes("cannot be changed")) {
        res.status(400).json({ message: error.message });
        return;
      }

      console.error("Scenario create error:", error);
      res.status(500).json({ message: "Failed to create scenario." });
    }
  });

  app.put(buildUrl(api.admin.scenarios.update.path, { scenarioId: ":scenarioId" }), async (req, res) => {
    const session = await requirePermission(req, res, "scenario:write");
    if (!session) {
      return;
    }

    try {
      const currentScenarioId = Array.isArray(req.params.scenarioId)
        ? req.params.scenarioId[0]
        : req.params.scenarioId;

      if (!currentScenarioId) {
        res.status(400).json({ message: "Scenario id is required." });
        return;
      }

      const updatedScenario = await storage.updateScenario(
        currentScenarioId,
        api.admin.scenarios.update.input.parse(req.body),
        session,
      );

      if (!updatedScenario) {
        res.status(404).json({ message: "Scenario not found." });
        return;
      }

      res.json(updatedScenario);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0]?.message || "Validation Error" });
        return;
      }

      if ((error as { code?: string }).code === "23505") {
        res.status(409).json({ message: "A scenario with that id already exists." });
        return;
      }

      if (error instanceof Error && error.message.includes("cannot be changed")) {
        res.status(400).json({ message: error.message });
        return;
      }

      console.error("Scenario update error:", error);
      res.status(500).json({ message: "Failed to update scenario." });
    }
  });

  app.get(buildUrl(api.admin.scenarios.versions.path, { scenarioId: ":scenarioId" }), async (req, res) => {
    const session = await requirePermission(req, res, "scenario:read");
    if (!session) {
      return;
    }

    try {
      const scenarioId = Array.isArray(req.params.scenarioId) ? req.params.scenarioId[0] : req.params.scenarioId;
      if (!scenarioId) {
        res.status(400).json({ message: "Scenario id is required." });
        return;
      }
      const versions = await storage.listScenarioVersions(scenarioId);
      if (versions.length === 0) {
        res.status(404).json({ message: "Scenario history not found." });
        return;
      }
      res.json(versions);
    } catch (error) {
      console.error("Scenario version list error:", error);
      res.status(500).json({ message: "Failed to load scenario history." });
    }
  });

  app.post(buildUrl(api.admin.scenarios.rollback.path, { scenarioId: ":scenarioId" }), async (req, res) => {
    const session = await requirePermission(req, res, "scenario:rollback");
    if (!session) {
      return;
    }

    try {
      const scenarioId = Array.isArray(req.params.scenarioId) ? req.params.scenarioId[0] : req.params.scenarioId;
      if (!scenarioId) {
        res.status(400).json({ message: "Scenario id is required." });
        return;
      }
      const { targetVersion } = api.admin.scenarios.rollback.input.parse(req.body);
      const rolledBack = await storage.rollbackScenario(scenarioId, targetVersion, session);
      if (!rolledBack) {
        res.status(404).json({ message: "Target scenario version not found." });
        return;
      }
      res.json(rolledBack);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0]?.message || "Validation Error" });
        return;
      }
      console.error("Scenario rollback error:", error);
      res.status(500).json({ message: "Failed to rollback scenario." });
    }
  });

  app.get(api.admin.trainingConfigs.list.path, async (req, res) => {
    const session = await requirePermission(req, res, "training-config:read");
    if (!session) {
      return;
    }

    try {
      const configs = await storage.listTrainingConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Training config list error:", error);
      res.status(500).json({ message: "Failed to load training configurations." });
    }
  });

  app.post(api.admin.trainingConfigs.create.path, async (req, res) => {
    const session = await requirePermission(req, res, "training-config:write");
    if (!session) {
      return;
    }

    try {
      const created = await storage.createTrainingConfig(
        api.admin.trainingConfigs.create.input.parse(req.body),
        session,
      );
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0]?.message || "Validation Error" });
        return;
      }

      console.error("Training config create error:", error);
      res.status(500).json({ message: "Failed to create training configuration." });
    }
  });

  app.put(buildUrl(api.admin.trainingConfigs.update.path, { configId: ":configId" }), async (req, res) => {
    const session = await requirePermission(req, res, "training-config:write");
    if (!session) {
      return;
    }

    try {
      const rawConfigId = Array.isArray(req.params.configId) ? req.params.configId[0] : req.params.configId;
      const configId = Number.parseInt(rawConfigId ?? "", 10);

      if (!Number.isFinite(configId)) {
        res.status(400).json({ message: "Training config id is required." });
        return;
      }

      const updated = await storage.updateTrainingConfig(
        configId,
        api.admin.trainingConfigs.update.input.parse(req.body),
        session,
      );

      if (!updated) {
        res.status(404).json({ message: "Training configuration not found." });
        return;
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0]?.message || "Validation Error" });
        return;
      }

      console.error("Training config update error:", error);
      res.status(500).json({ message: "Failed to update training configuration." });
    }
  });

  app.get(buildUrl(api.admin.trainingConfigs.versions.path, { configId: ":configId" }), async (req, res) => {
    const session = await requirePermission(req, res, "training-config:read");
    if (!session) {
      return;
    }

    try {
      const rawConfigId = Array.isArray(req.params.configId) ? req.params.configId[0] : req.params.configId;
      const configId = Number.parseInt(rawConfigId ?? "", 10);
      if (!Number.isFinite(configId)) {
        res.status(400).json({ message: "Training config id is required." });
        return;
      }
      const versions = await storage.listTrainingConfigVersions(configId);
      if (versions.length === 0) {
        res.status(404).json({ message: "Training configuration history not found." });
        return;
      }
      res.json(versions);
    } catch (error) {
      console.error("Training config version list error:", error);
      res.status(500).json({ message: "Failed to load training configuration history." });
    }
  });

  app.post(buildUrl(api.admin.trainingConfigs.rollback.path, { configId: ":configId" }), async (req, res) => {
    const session = await requirePermission(req, res, "training-config:rollback");
    if (!session) {
      return;
    }

    try {
      const rawConfigId = Array.isArray(req.params.configId) ? req.params.configId[0] : req.params.configId;
      const configId = Number.parseInt(rawConfigId ?? "", 10);
      if (!Number.isFinite(configId)) {
        res.status(400).json({ message: "Training config id is required." });
        return;
      }
      const { targetVersion } = api.admin.trainingConfigs.rollback.input.parse(req.body);
      const rolledBack = await storage.rollbackTrainingConfig(configId, targetVersion, session);
      if (!rolledBack) {
        res.status(404).json({ message: "Target training configuration version not found." });
        return;
      }
      res.json(rolledBack);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0]?.message || "Validation Error" });
        return;
      }
      console.error("Training config rollback error:", error);
      res.status(500).json({ message: "Failed to rollback training configuration." });
    }
  });

  app.get(api.admin.audit.list.path, async (req, res) => {
    const session = await requirePermission(req, res, "audit:read");
    if (!session) {
      return;
    }

    try {
      const entityTypeRaw = Array.isArray(req.query.entityType) ? req.query.entityType[0] : req.query.entityType;
      const entityRefRaw = Array.isArray(req.query.entityRef) ? req.query.entityRef[0] : req.query.entityRef;
      const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
      const limit = typeof limitRaw === "string" ? Number.parseInt(limitRaw, 10) : undefined;

      const entityType =
        entityTypeRaw === "scenario" || entityTypeRaw === "training_config" || entityTypeRaw === "auth"
          ? entityTypeRaw
          : undefined;

      const logs = await storage.listAuditLogs({
        entityType,
        entityRef: typeof entityRefRaw === "string" ? entityRefRaw : undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
      });

      res.json(logs);
    } catch (error) {
      console.error("Audit log list error:", error);
      res.status(500).json({ message: "Failed to load audit logs." });
    }
  });

  app.get(api.admin.data.export.path, async (req, res) => {
    const session = await requireAdminSession(req, res);
    if (!session) {
      return;
    }

    if (
      !session.permissions.includes("scenario:read") ||
      !session.permissions.includes("training-config:read")
    ) {
      res.status(403).json({
        message: "Permission denied. Export requires scenario:read and training-config:read.",
      });
      return;
    }

    try {
      const payload = await storage.exportAdminData();
      res.json(payload);
    } catch (error) {
      console.error("Admin export error:", error);
      res.status(500).json({ message: "Failed to export admin data." });
    }
  });

  app.post(api.admin.data.import.path, async (req, res) => {
    const session = await requireAdminSession(req, res);
    if (!session) {
      return;
    }

    if (
      !session.permissions.includes("scenario:write") ||
      !session.permissions.includes("training-config:write")
    ) {
      res.status(403).json({
        message: "Permission denied. Import requires scenario:write and training-config:write.",
      });
      return;
    }

    try {
      const result = await storage.importAdminData(
        api.admin.data.import.input.parse(req.body),
        session,
      );
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0]?.message || "Validation Error" });
        return;
      }

      console.error("Admin import error:", error);
      res.status(500).json({ message: "Failed to import admin data." });
    }
  });

  app.post(api.admin.data.demoReset.path, async (req, res) => {
    const session = await requireAdminSession(req, res);
    if (!session) {
      return;
    }

    if (
      !session.permissions.includes("scenario:write") ||
      !session.permissions.includes("training-config:write")
    ) {
      res.status(403).json({
        message: "Permission denied. Demo reset requires scenario:write and training-config:write.",
      });
      return;
    }

    try {
      await storage.resetToDemo(session);
      res.json({ message: "Demo data has been reset." });
    } catch (error) {
      console.error("Demo reset error:", error);
      res.status(500).json({ message: "Failed to reset demo data." });
    }
  });

  app.post(api.advanced.chat.path, async (req, res) => {
    let input: z.infer<typeof api.advanced.chat.input> | null = null;

    try {
      const parsedInput = api.advanced.chat.input.parse(req.body);
      input = parsedInput;
      const scenario = localizeScenarioForLanguage(
        await storage.getScenarioById(parsedInput.scenarioId),
        parsedInput.language,
      );
      const localizedRole = localizeRoleLabel(parsedInput.role, parsedInput.language);
      const localizedSector = localizeSectorLabel(parsedInput.sectorId, parsedInput.language);
      const responseRules = parsedInput.responseRules.map((rule, index) => `${index + 1}. ${rule}`).join("\n");
      const transcript = parsedInput.history
        .slice(-16)
        .map((entry) =>
          `${entry.role === "assistant"
            ? parsedInput.language === "ar"
              ? "المحاكي"
              : "Simulator"
            : parsedInput.language === "ar"
              ? "المتدرب"
              : "Trainee"}: ${entry.content}`,
        )
        .join("\n");

      const prompt =
        parsedInput.language === "ar"
          ? `
أنت محاكي أزمات تفاعلي لقطاع ${localizedSector}. 
الدور الحالي للمتدرب: ${localizedRole}.
السيناريو: ${scenario.title} - ${scenario.description}

قواعد الاستجابة المعتمدة:
${responseRules}

سجل المحادثة:
${transcript}

قدّم الرسالة التالية للمحاكاة بشكل واقعي ومباشر باللغة العربية.
المطلوب في الرسالة:
1) تحديث ميداني جديد يزيد الضغط التشغيلي.
2) تقييم سريع للقرار السابق (ما الذي كان صحيحا وما المخاطر المتبقية).
3) سؤال تنفيذي واضح يدفع المتدرب لاتخاذ قرار تالٍ.
لا تستخدم Markdown أو JSON.`
          : `
You are an interactive crisis simulation engine for the ${localizedSector} sector.
Current trainee role: ${localizedRole}.
Scenario: ${scenario.title} - ${scenario.description}

Response rules:
${responseRules}

Conversation transcript:
${transcript}

Provide the next simulation turn in direct professional English.
Your response must include:
1) A realistic field update that increases operational pressure.
2) A short critique of the previous decision (what worked, what remains risky).
3) One execution-focused question that forces the next decision.
Do not use markdown or JSON.`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content:
              parsedInput.language === "ar"
                ? "أنت محاكي أزمات تدريبي. كن عمليًا ومحددًا وركز على القرار التنفيذي التالي."
                : "You are a crisis simulation trainer. Be concrete, realistic, and decision-focused.",
          },
          { role: "user", content: prompt },
        ],
      });

      const assistantMessage = aiResponse.choices[0]?.message?.content?.trim();

      if (!assistantMessage) {
        throw new Error("Empty assistant response.");
      }

      res.json({ assistantMessage });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0]?.message || "Validation Error" });
        return;
      }

      console.error("Advanced chat error:", error);

      if (input) {
        res.json({ assistantMessage: buildAdvancedFallback(input) });
        return;
      }

      res.status(500).json({
        message: "Failed to generate advanced simulation response.",
      });
    }
  });

  app.post(api.debrief.generate.path, async (req, res) => {
    let input: z.infer<typeof api.debrief.generate.input> | null = null;
    let scenario: Scenario | null = null;

    try {
      input = api.debrief.generate.input.parse(req.body);
      const requestLanguage = input.language;
      scenario = localizeScenarioForLanguage(
        await storage.getScenarioById(input.scenarioId),
        requestLanguage,
      );
      const activeScenario = scenario;
      const localizedRole = localizeRoleLabel(input.role, requestLanguage);
      const insights = buildDecisionInsights(input.history, activeScenario);
      const finalScores = input.history[input.history.length - 1]?.scoresAfter ?? activeScenario.initialScores;
      const scoreContext = METRIC_DEFS.map(
        (metric) =>
          `${requestLanguage === "ar" ? metric.ar : metric.en}: ${finalScores[metric.key]}/100`,
      ).join("\n");
      const historyContext = insights
        .map((insight) => {
          const deltaContext = METRIC_DEFS.map(
            (metric) =>
              `${requestLanguage === "ar" ? metric.ar : metric.en} ${insight.scoreDeltas[metric.key] >= 0 ? "+" : ""}${insight.scoreDeltas[metric.key]}`,
          ).join(", ");

          if (requestLanguage === "ar") {
            return `- ${insight.stepTimeLabel}: القرار ${insight.choiceId} في المرحلة ${insight.stepId} | أثر القرار: ${deltaContext}`;
          }

          return `- ${insight.stepTimeLabel}: "${insight.choiceText}" | Decision impact: ${deltaContext}`;
        })
        .join("\n");

      const prompt =
        requestLanguage === "ar"
          ? `
أنت مقيم خبير في إدارة الأزمات، وتقوم بتقييم أداء مستخدم داخل محاكاة أزمة.
السيناريو هو: ${activeScenario.title} - ${activeScenario.description}
الدور الذي لعبه المستخدم: ${localizedRole}

النتائج النهائية للمؤشرات:
${scoreContext}

سجل قراراته:
${historyContext}

أنشئ تقرير ما بعد الحدث بصيغة JSON وباللغة العربية فقط، ويجب أن يطابق هذا الهيكل تماما:
{
  "summary": ["نقطة 1", "نقطة 2", "نقطة 3"],
  "wentWell": ["نقطة 1", "نقطة 2", "نقطة 3"],
  "toImprove": ["نقطة 1", "نقطة 2", "نقطة 3"],
  "missedSignals": ["نقطة 1", "نقطة 2"],
  "checklist": ["عنصر 1", "عنصر 2", "عنصر 3", "عنصر 4", "عنصر 5", "عنصر 6", "عنصر 7", "عنصر 8", "عنصر 9", "عنصر 10", "عنصر 11", "عنصر 12"]
}

اجعل التقييم مباشرا وبنّاء وناقدا عند الحاجة. اجعل النقاط مختصرة. يجب أن تحتوي القائمة على 10 إلى 15 قاعدة استجابة عملية. لا تستخدم أي تنسيق Markdown ولا علامات backticks، وأعد JSON صالحا فقط.`
          : `
You are an expert crisis management evaluator reviewing a user's performance in a crisis simulation.
The scenario is: ${activeScenario.title} - ${activeScenario.description}
The user's role was: ${localizedRole}

Final metric outcomes:
${scoreContext}

Their decision history:
${historyContext}

Generate an After-Action Report in JSON, in English only, matching this structure exactly:
{
  "summary": ["point 1", "point 2", "point 3"],
  "wentWell": ["point 1", "point 2", "point 3"],
  "toImprove": ["point 1", "point 2", "point 3"],
  "missedSignals": ["point 1", "point 2"],
  "checklist": ["item 1", "item 2", "item 3", "item 4", "item 5", "item 6", "item 7", "item 8", "item 9", "item 10", "item 11", "item 12"]
}

Be direct, constructive, and critical when needed. Keep the points concise. The checklist must contain 10 to 15 actionable response rules. Do not use markdown or backticks. Return valid JSON only.`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are an AI that only outputs valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const responseContent = aiResponse.choices[0]?.message?.content || "{}";
      const parsedData = JSON.parse(responseContent);

      res.json(parsedData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0]?.message || "Validation Error",
        });
      } else {
        console.error("Debrief generation error:", err);
        if (input && scenario) {
          const errorDetails = err as {
            status?: number;
            code?: string;
            type?: string;
            error?: { message?: string };
            message?: string;
          };

          const reason =
            errorDetails.code === "insufficient_quota"
              ? input.language === "ar"
                ? "تم تجاوز الحصة المتاحة في OpenAI"
                : "OpenAI quota exceeded"
              : errorDetails.status === 401
                ? input.language === "ar"
                  ? "رفض OpenAI مفتاح الواجهة"
                  : "OpenAI rejected the API key"
                : errorDetails.error?.message ||
                  errorDetails.message ||
                  (input.language === "ar" ? "خطأ من خدمة الذكاء الاصطناعي" : "upstream AI error");

          res.json(buildFallbackDebrief(input, scenario, reason));
          return;
        }

        res.status(500).json({
          message:
            input?.language === "en"
              ? "Failed to generate the after-action report."
              : "تعذر إنشاء تقرير ما بعد الحدث.",
        });
      }
    }
  });

  return httpServer;
}
