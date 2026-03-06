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
const ADVANCED_MODEL_PRIMARY = process.env.AI_INTEGRATIONS_ADVANCED_MODEL?.trim() || "gpt-5.1";
const ADVANCED_MODEL_FALLBACK = process.env.AI_INTEGRATIONS_ADVANCED_FALLBACK_MODEL?.trim() || "";
const DEBRIEF_MODEL = process.env.AI_INTEGRATIONS_DEBRIEF_MODEL?.trim() || ADVANCED_MODEL_PRIMARY;

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

function summarizeUpstreamError(error: unknown): {
  status?: number;
  code?: string;
  type?: string;
  message: string;
} {
  const candidate = error as {
    status?: number;
    code?: string;
    type?: string;
    error?: { message?: string };
    message?: string;
  };

  return {
    status: candidate?.status,
    code: candidate?.code,
    type: candidate?.type,
    message: candidate?.error?.message || candidate?.message || "unknown upstream error",
  };
}

function buildDecisionInsights(history: RunHistoryItem[], scenario: Scenario): DecisionInsight[] {
  return history
    .map((item, index) => {
      const step = scenario.steps[item.stepId];
      const choice = step?.choices.find((candidate) => candidate.id === item.choiceId);
      const previousScores = index > 0 ? history[index - 1].scoresAfter : scenario.initialScores;
      const derivedDeltas: ScoreSet = {
        operationalControl: item.scoresAfter.operationalControl - previousScores.operationalControl,
        responseTempo: item.scoresAfter.responseTempo - previousScores.responseTempo,
        stakeholderTrust: item.scoresAfter.stakeholderTrust - previousScores.stakeholderTrust,
        teamAlignment: item.scoresAfter.teamAlignment - previousScores.teamAlignment,
        executiveComms: item.scoresAfter.executiveComms - previousScores.executiveComms,
      };

      if (!step || !choice) {
        const totalDelta =
          derivedDeltas.operationalControl +
          derivedDeltas.responseTempo +
          derivedDeltas.stakeholderTrust +
          derivedDeltas.teamAlignment +
          derivedDeltas.executiveComms;
        const turnNumber = index + 1;
        return {
          stepId: item.stepId,
          stepTimeLabel: `T+${turnNumber * 5}m`,
          stepDescription: `Advanced simulation turn ${turnNumber}`,
          choiceId: item.choiceId,
          choiceText: item.choiceId.replace(/[-_]/g, " "),
          scoreDeltas: derivedDeltas,
          totalDelta,
        };
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
        scoreDeltas: choice.scoreDeltas ?? derivedDeltas,
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

function normalizeAdvancedScoreDeltas(raw: unknown): ScoreSet {
  const source =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};
  const clampDelta = (value: unknown): number => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return 0;
    }
    const rounded = Math.round(value);
    return Math.max(-12, Math.min(12, rounded));
  };

  return {
    operationalControl: clampDelta(source.operationalControl),
    responseTempo: clampDelta(source.responseTempo),
    stakeholderTrust: clampDelta(source.stakeholderTrust),
    teamAlignment: clampDelta(source.teamAlignment),
    executiveComms: clampDelta(source.executiveComms),
  };
}

function applyScoreDeltas(current: ScoreSet, deltas: ScoreSet): ScoreSet {
  const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

  return {
    operationalControl: clampScore(current.operationalControl + deltas.operationalControl),
    responseTempo: clampScore(current.responseTempo + deltas.responseTempo),
    stakeholderTrust: clampScore(current.stakeholderTrust + deltas.stakeholderTrust),
    teamAlignment: clampScore(current.teamAlignment + deltas.teamAlignment),
    executiveComms: clampScore(current.executiveComms + deltas.executiveComms),
  };
}

function isBinaryReply(raw: string | undefined, language: Language): boolean {
  if (!raw) {
    return false;
  }

  const normalized = raw.trim().toLowerCase().replace(/[.!?؟،,:;"'`]/g, "");
  if (!normalized) {
    return false;
  }

  const englishBinary = new Set(["yes", "no", "y", "n", "ok", "okay", "sure", "done"]);
  const arabicBinary = new Set(["نعم", "لا", "اي", "أجل", "اجل", "موافق", "تم"]);
  const words = normalized.split(/\s+/);

  if (words.length > 2) {
    return false;
  }

  if (language === "ar") {
    return words.every((word) => arabicBinary.has(word));
  }

  return words.every((word) => englishBinary.has(word));
}

function extractDirectiveCandidate(raw: string | undefined): string {
  const text = raw?.trim() ?? "";
  if (!text) {
    return "";
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const isChecklistLine = (line: string): boolean => /^[-•*]\s*/.test(line);
  const hasDirectiveSignal = (line: string): boolean =>
    /(يوجّه|وجّه|وجّهوا|فعّل|نفّذ|حدّد|أصدر|direct|issue|activate|deploy|dispatch|enforce|start)\b/i.test(line);
  const hasKpiSignal = (line: string): boolean =>
    /(kpi|مؤشر|%|<=|>=|≤|≥|target|sla)/i.test(line);
  const hasTimingSignal = (line: string): boolean =>
    /(خلال|دقيقة|دقائق|ساعة|ساعات|within|minute|minutes|hour|hours|t\+\d+)/i.test(line);

  const ranked = lines
    .filter((line) => !isChecklistLine(line))
    .map((line) => ({
      line,
      score:
        Number(hasDirectiveSignal(line)) * 3 +
        Number(hasTimingSignal(line)) * 2 +
        Number(hasKpiSignal(line)) * 2,
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best || best.score <= 0) {
    return text;
  }

  return best.line;
}

interface CommandDirectiveSignals {
  hasOwner: boolean;
  hasAction: boolean;
  hasTiming: boolean;
  hasKpi: boolean;
}

function evaluateDirectiveSignals(raw: string | undefined): CommandDirectiveSignals {
  const normalized = raw?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return {
      hasOwner: false,
      hasAction: false,
      hasTiming: false,
      hasKpi: false,
    };
  }

  const ownerPattern = /(قائد|مدير|فريق|خلية|مركز|وزارة|مستشفى|جهة|agency|team|lead|command|ops|operations|hospital|ministry)/i;
  const actionPattern = /(فعّل|وجّه|نفّذ|انشر|أرسل|حوّل|فعِّل|activate|deploy|route|dispatch|issue|publish|enforce|start)/i;
  const timingPattern = /(خلال|بعد|قبل|الآن|فور[اًا]?|دقيقة|دقائق|ساعة|ساعات|within|in the next|by|minute|minutes|hour|hours|t\+\d+)/i;
  const kpiPattern = /(kpi|مؤشر|نسبة|%|زمن|وقت|إشغال|اشغال|انتظار|رضا|معدل|occupancy|wait|target|sla|<=|>=|≤|≥)/i;

  return {
    hasOwner: ownerPattern.test(normalized),
    hasAction: actionPattern.test(normalized),
    hasTiming: timingPattern.test(normalized),
    hasKpi: kpiPattern.test(normalized),
  };
}

function countDirectiveSignals(signals: CommandDirectiveSignals): number {
  return Number(signals.hasOwner) + Number(signals.hasAction) + Number(signals.hasTiming) + Number(signals.hasKpi);
}

function listMissingDirectiveSignals(
  signals: CommandDirectiveSignals,
  language: Language,
): string[] {
  const labels =
    language === "ar"
      ? {
          owner: "الجهة المسؤولة",
          action: "الإجراء التنفيذي",
          timing: "توقيت البداية ونقطة التحقق",
          kpi: "مؤشر KPI المستهدف",
        }
      : {
          owner: "responsible owner",
          action: "specific action",
          timing: "start timing and checkpoint",
          kpi: "target KPI",
        };

  const missing: string[] = [];
  if (!signals.hasOwner) {
    missing.push(labels.owner);
  }
  if (!signals.hasAction) {
    missing.push(labels.action);
  }
  if (!signals.hasTiming) {
    missing.push(labels.timing);
  }
  if (!signals.hasKpi) {
    missing.push(labels.kpi);
  }
  return missing;
}

function weakestMetricKey(scores: ScoreSet): MetricKey {
  return [...METRIC_DEFS]
    .map((metric) => ({ key: metric.key, value: scores[metric.key] }))
    .sort((left, right) => left.value - right.value)[0]?.key ?? "teamAlignment";
}

function buildContinuationCommandQuestion(language: Language, weakestMetric: MetricKey): string {
  if (language === "ar") {
    return `أصدر الآن أمر المتابعة لحماية ${metricLabel(weakestMetric, "ar")}: من المسؤول خلال 10 دقائق، ما الإجراء الذي يبدأ فورا، متى نقطة التحقق التالية، وما KPI المستهدف قبل تلك النقطة؟`;
  }

  return `Issue the next command to protect ${metricLabel(weakestMetric, "en")}: who owns execution in the next 10 minutes, what exact action starts now, when is the next checkpoint, and which KPI target must be met by then?`;
}

function deriveOfflineFallbackDeltas(
  completeness: number,
  binaryReply: boolean,
): ScoreSet {
  if (binaryReply || completeness <= 1) {
    return {
      operationalControl: 0,
      responseTempo: -2,
      stakeholderTrust: -1,
      teamAlignment: -2,
      executiveComms: 0,
    };
  }

  if (completeness === 2) {
    return {
      operationalControl: 0,
      responseTempo: 0,
      stakeholderTrust: -1,
      teamAlignment: 0,
      executiveComms: 0,
    };
  }

  if (completeness === 3) {
    return {
      operationalControl: 1,
      responseTempo: 1,
      stakeholderTrust: 0,
      teamAlignment: 1,
      executiveComms: 0,
    };
  }

  return {
    operationalControl: 2,
    responseTempo: 2,
    stakeholderTrust: 0,
    teamAlignment: 2,
    executiveComms: 1,
  };
}

function enforceDeltaTension(deltas: ScoreSet, binaryReply: boolean): ScoreSet {
  const next = { ...deltas };
  const values = Object.values(next);
  const hasPositive = values.some((value) => value > 0);
  const hasNegative = values.some((value) => value < 0);

  if (binaryReply) {
    (Object.keys(next) as MetricKey[]).forEach((key) => {
      if (next[key] > 0) {
        next[key] = 0;
      }
    });
    if ((Object.values(next) as number[]).every((value) => value === 0)) {
      next.responseTempo = -3;
      next.teamAlignment = -2;
    }
    return next;
  }

  if (!hasPositive && !hasNegative) {
    next.operationalControl = 2;
    next.stakeholderTrust = -2;
    return next;
  }

  if (!hasPositive) {
    next.operationalControl = 1;
  }

  if (!hasNegative) {
    next.stakeholderTrust = -1;
  }

  return next;
}

function sanitizeAdvancedSection(text: string): string {
  return text
    .replace(/\.{3,}/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function buildConcreteCommandQuestion(language: Language): string {
  if (language === "ar") {
    return "حدّد الآن أمرا تنفيذيا واضحا: من المسؤول، ما الإجراء الذي يبدأ خلال 10 دقائق، متى نقطة التحقق التالية، وما مؤشر الأداء المستهدف قبل تلك النقطة؟";
  }
  return "State the command now: who owns execution, what exact action starts within 10 minutes, when the next checkpoint is, and which KPI target must be reached by then?";
}

function enforceConcreteCommandQuestion(
  question: string,
  language: Language,
  forceConcrete: boolean,
): string {
  const cleaned = sanitizeAdvancedSection(question);
  const yesNoPattern = language === "ar"
    ? /^هل\b/
    : /^(do|would|will|can|could|should|is|are)\b/i;

  if (forceConcrete || !cleaned || yesNoPattern.test(cleaned)) {
    return buildConcreteCommandQuestion(language);
  }

  return cleaned;
}

function buildImpactReason(deltas: ScoreSet, language: Language): string {
  const positives = METRIC_DEFS
    .map((metric) => ({ key: metric.key, value: deltas[metric.key] }))
    .filter((entry) => entry.value > 0)
    .sort((left, right) => right.value - left.value);
  const negatives = METRIC_DEFS
    .map((metric) => ({ key: metric.key, value: deltas[metric.key] }))
    .filter((entry) => entry.value < 0)
    .sort((left, right) => left.value - right.value);

  const topPositive = positives[0];
  const topNegative = negatives[0];

  if (language === "ar") {
    if (topPositive && topNegative) {
      return `تحسن ${metricLabel(topPositive.key, "ar")} (+${topPositive.value}) نتيجة وضوح التوجيه، لكن ${metricLabel(topNegative.key, "ar")} (${topNegative.value}) تراجع بسبب كلفة التنسيق والاتصال.`;
    }
    if (topPositive) {
      return `الأثر الإيجابي الأبرز كان على ${metricLabel(topPositive.key, "ar")} (+${topPositive.value}) مع تأثيرات جانبية محدودة.`;
    }
    if (topNegative) {
      return `الأثر السلبي الأبرز كان على ${metricLabel(topNegative.key, "ar")} (${topNegative.value}) بسبب غياب تفاصيل تنفيذية كافية.`;
    }
    return "الأثر التشغيلي محدود في هذه الجولة، لأن القرار لم يضف تفاصيل تنفيذية قابلة للقياس.";
  }

  if (topPositive && topNegative) {
    return `${metricLabel(topPositive.key, "en")} improved (+${topPositive.value}) from clearer execution focus, but ${metricLabel(topNegative.key, "en")} dropped (${topNegative.value}) due to coordination/communication cost.`;
  }
  if (topPositive) {
    return `Primary gain was in ${metricLabel(topPositive.key, "en")} (+${topPositive.value}) with limited side effects.`;
  }
  if (topNegative) {
    return `Primary loss was in ${metricLabel(topNegative.key, "en")} (${topNegative.value}) due to missing execution detail.`;
  }
  return "Operational impact stayed limited this turn because the directive lacked measurable execution detail.";
}

type AdvancedTurnSource = "ai" | "local_recovery" | "local_fallback";
type AdvancedFailureCode = "upstream_unavailable" | "invalid_model_json" | "policy_reprompt_needed";

interface AdvancedTurnResult {
  assistantMessage: string;
  scoreDeltas: ScoreSet;
  updatedScores: ScoreSet;
  impactReason: string;
  source: AdvancedTurnSource;
  failureCode?: AdvancedFailureCode;
}

interface AdvancedTurnSections {
  update: string;
  assessment: string;
  question: string;
}

function composeAdvancedTurnMessage(sections: AdvancedTurnSections, language: Language): string {
  const labels =
    language === "ar"
      ? { update: "تحديث", assessment: "تقييم", question: "سؤال" }
      : { update: "Update", assessment: "Assessment", question: "Question" };

  return `${labels.update}:
${sections.update}
${labels.assessment}:
${sections.assessment}
${labels.question}:
${sections.question}`;
}

function parseLikelyJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const candidates = [trimmed];
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    candidates.push(fenceMatch[1].trim());
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function extractSectionsFromNormalizedMessage(
  normalized: string,
  language: Language,
): AdvancedTurnSections | null {
  const labels =
    language === "ar"
      ? { update: "تحديث", assessment: "تقييم", question: "سؤال" }
      : { update: "Update", assessment: "Assessment", question: "Question" };
  const lines = normalized.split(/\r?\n/).map((line) => line.trim());

  const readBody = (label: string): string => {
    const headerIndex = lines.findIndex((line) => line.toLowerCase() === `${label.toLowerCase()}:`);
    if (headerIndex < 0) {
      return "";
    }
    const body: string[] = [];
    for (let index = headerIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line) {
        continue;
      }
      if (line.endsWith(":")) {
        break;
      }
      body.push(line);
    }
    return sanitizeAdvancedSection(body.join(" "));
  };

  const update = readBody(labels.update);
  const assessment = readBody(labels.assessment);
  const question = readBody(labels.question);
  if (!update || !assessment || !question) {
    return null;
  }

  return { update, assessment, question };
}

function buildAdvancedLocalRecovery(
  input: z.infer<typeof api.advanced.chat.input>,
  options: {
    sections?: AdvancedTurnSections | null;
    scoreDeltas?: ScoreSet;
    impactReason?: string;
    failureCode: AdvancedFailureCode;
  },
): AdvancedTurnResult {
  const scoreDeltas = enforceDeltaTension(
    options.scoreDeltas ?? {
      operationalControl: 0,
      responseTempo: 0,
      stakeholderTrust: 0,
      teamAlignment: 0,
      executiveComms: 0,
    },
    options.failureCode === "policy_reprompt_needed",
  );
  const updatedScores = applyScoreDeltas(input.currentScores, scoreDeltas);
  const impactReason = options.impactReason?.trim()
    ? sanitizeAdvancedSection(options.impactReason)
    : buildImpactReason(scoreDeltas, input.language);

  const fallbackSections: AdvancedTurnSections = input.language === "en"
    ? {
        update: "The model response format was invalid this turn, so local simulation logic generated a safe continuation.",
        assessment: "Your command can still be processed, but the next directive must remain explicit with owner, timing, and KPI.",
        question: buildConcreteCommandQuestion("en"),
      }
    : {
        update: "تنسيق استجابة النموذج كان غير صالح في هذه الجولة، لذلك تم توليد متابعة محلية بشكل آمن.",
        assessment: "لا يزال بالإمكان متابعة القرار، لكن يجب أن يكون التوجيه التالي صريحا بالمالك والتوقيت ومؤشر الأداء.",
        question: buildConcreteCommandQuestion("ar"),
      };

  const assistantMessage = normalizeAdvancedTurnResponse(
    composeAdvancedTurnMessage(options.sections ?? fallbackSections, input.language),
    input.language,
    options.failureCode === "policy_reprompt_needed",
  );

  return {
    assistantMessage,
    scoreDeltas,
    updatedScores,
    impactReason,
    source: "local_recovery",
    failureCode: options.failureCode,
  };
}

function buildAdvancedFallback(
  input: z.infer<typeof api.advanced.chat.input>,
): AdvancedTurnResult {
  const lastUserMessage = [...input.history].reverse().find((entry) => entry.role === "user");
  const lastDirective = extractDirectiveCandidate(lastUserMessage?.content);
  const binaryReply = isBinaryReply(lastDirective, input.language);
  const directiveSignals = evaluateDirectiveSignals(lastDirective);
  const completeness = countDirectiveSignals(directiveSignals);
  const missingSignals = listMissingDirectiveSignals(directiveSignals, input.language);
  const weakestMetric = weakestMetricKey(input.currentScores);
  const requiresDirectiveReset = binaryReply || completeness <= 2;

  const scoreDeltas = enforceDeltaTension(
    deriveOfflineFallbackDeltas(completeness, binaryReply),
    binaryReply,
  );
  const updatedScores = applyScoreDeltas(input.currentScores, scoreDeltas);
  const impactReason = buildImpactReason(scoreDeltas, input.language);
  const sections: AdvancedTurnSections =
    input.language === "en"
      ? {
          update:
            "Live AI service is temporarily unavailable. Local continuity mode evaluated your latest directive to keep the simulation moving.",
          assessment:
            completeness >= 4
              ? "Your directive was executable (owner/action/timing/KPI). Maintain this cadence while tightening cross-agency synchronization."
              : `Your directive is not yet fully executable. Complete these missing parts: ${missingSignals.join(", ")}.`,
          question:
            completeness >= 4
              ? buildContinuationCommandQuestion("en", weakestMetric)
              : `${buildConcreteCommandQuestion("en")} Missing now: ${missingSignals.join(", ")}.`,
        }
      : {
          update:
            "خدمة الذكاء الاصطناعي غير متاحة مؤقتا. تم تفعيل وضع الاستمرارية المحلي وتقييم آخر توجيه للحفاظ على تسلسل المحاكاة.",
          assessment:
            completeness >= 4
              ? "توجيهك كان قابلا للتنفيذ (مسؤول/إجراء/توقيت/KPI). حافظ على هذا النسق مع تشديد التنسيق بين الجهات."
              : `التوجيه الحالي غير مكتمل تنفيذيا. العناصر الناقصة: ${missingSignals.join("، ")}.`,
          question:
            completeness >= 4
              ? buildContinuationCommandQuestion("ar", weakestMetric)
              : `${buildConcreteCommandQuestion("ar")} العناصر الناقصة الآن: ${missingSignals.join("، ")}.`,
        };

  const assistantMessage = normalizeAdvancedTurnResponse(
    composeAdvancedTurnMessage(sections, input.language),
    input.language,
    requiresDirectiveReset,
  );

  return {
    assistantMessage,
    scoreDeltas,
    updatedScores,
    impactReason,
    source: "local_fallback",
    failureCode: "upstream_unavailable",
  };
}

function normalizeAdvancedTurnResponse(
  raw: string,
  language: Language,
  forceConcreteQuestion = false,
): string {
  const labels =
    language === "ar"
      ? { update: "تحديث", assessment: "تقييم", question: "سؤال" }
      : { update: "Update", assessment: "Assessment", question: "Question" };
  const aliases = {
    update: language === "ar" ? ["تحديث", "Update"] : ["Update", "تحديث"],
    assessment: language === "ar" ? ["تقييم", "Assessment"] : ["Assessment", "تقييم"],
    question: language === "ar" ? ["سؤال", "Question"] : ["Question", "سؤال"],
  };

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim());
  const nonEmptyLines = lines.filter(Boolean);

  const allAliases = [...aliases.update, ...aliases.assessment, ...aliases.question];
  const isHeaderLine = (line: string): boolean =>
    allAliases.some((alias) => line.toLowerCase().startsWith(`${alias.toLowerCase()}:`));

  const readSection = (sectionAliases: string[]): string | null => {
    for (let index = 0; index < lines.length; index += 1) {
      const currentLine = lines[index];
      const matchedAlias = sectionAliases.find((alias) =>
        currentLine.toLowerCase().startsWith(`${alias.toLowerCase()}:`),
      );
      if (!matchedAlias) {
        continue;
      }

      const afterColon = currentLine.slice(currentLine.indexOf(":") + 1).trim();
      if (afterColon) {
        return afterColon;
      }

      const sectionBody: string[] = [];
      for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
        const candidate = lines[innerIndex];
        if (!candidate) {
          continue;
        }
        if (isHeaderLine(candidate)) {
          break;
        }
        sectionBody.push(candidate);
      }

      if (sectionBody.length > 0) {
        return sectionBody.join(" ");
      }
      return null;
    }

    return null;
  };

  let update = readSection(aliases.update);
  let assessment = readSection(aliases.assessment);
  let question = readSection(aliases.question);

  if (!update || !assessment || !question) {
    const sentences = nonEmptyLines
      .join(" ")
      .replace(/\s+/g, " ")
      .split(/(?<=[.!؟])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    update = update ?? sentences[0] ?? "";
    assessment = assessment ?? sentences[1] ?? sentences[0] ?? "";
    question =
      question ??
      sentences.find((sentence) => sentence.includes("?") || sentence.includes("؟")) ??
      sentences[2] ??
      (language === "ar" ? "ما القرار التنفيذي التالي الذي ستعتمده الآن؟" : "What is your next execution decision now?");
  }

  update = sanitizeAdvancedSection(update);
  assessment = sanitizeAdvancedSection(assessment);
  question = enforceConcreteCommandQuestion(question, language, forceConcreteQuestion);

  return `${labels.update}:\n${update}\n${labels.assessment}:\n${assessment}\n${labels.question}:\n${question}`;
}

interface ParsedAdvancedTurnPayload {
  sections: AdvancedTurnSections | null;
  scoreDeltas: ScoreSet;
  impactReason: string | null;
  mode: "json" | "recovered_text" | "failed";
}

function parseAdvancedTurnPayload(
  raw: string,
  language: Language,
  forceConcreteQuestion: boolean,
): ParsedAdvancedTurnPayload {
  const emptyDeltas: ScoreSet = {
    operationalControl: 0,
    responseTempo: 0,
    stakeholderTrust: 0,
    teamAlignment: 0,
    executiveComms: 0,
  };

  const parsedObject = parseLikelyJsonObject(raw);
  if (parsedObject) {
    const assistantMessageText = typeof parsedObject.assistantMessage === "string"
      ? parsedObject.assistantMessage
      : null;
    const directSections =
      typeof parsedObject.update === "string" &&
      typeof parsedObject.assessment === "string" &&
      typeof parsedObject.question === "string"
        ? {
            update: sanitizeAdvancedSection(parsedObject.update),
            assessment: sanitizeAdvancedSection(parsedObject.assessment),
            question: enforceConcreteCommandQuestion(parsedObject.question, language, forceConcreteQuestion),
          }
        : null;
    const normalizedSections = assistantMessageText
      ? extractSectionsFromNormalizedMessage(
          normalizeAdvancedTurnResponse(assistantMessageText, language, forceConcreteQuestion),
          language,
        )
      : null;
    const sections = directSections ?? normalizedSections;

    return {
      sections,
      scoreDeltas: normalizeAdvancedScoreDeltas(parsedObject.scoreDeltas),
      impactReason: typeof parsedObject.impactReason === "string"
        ? sanitizeAdvancedSection(parsedObject.impactReason)
        : null,
      mode: sections ? "json" : "failed",
    };
  }

  const recoveredSections = extractSectionsFromNormalizedMessage(
    normalizeAdvancedTurnResponse(raw, language, forceConcreteQuestion),
    language,
  );

  if (!recoveredSections) {
    return {
      sections: null,
      scoreDeltas: emptyDeltas,
      impactReason: null,
      mode: "failed",
    };
  }

  return {
    sections: recoveredSections,
    scoreDeltas: emptyDeltas,
    impactReason: null,
    mode: "recovered_text",
  };
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
      const lastUserMessage = [...parsedInput.history].reverse().find((entry) => entry.role === "user");
      const binaryReply = isBinaryReply(lastUserMessage?.content, parsedInput.language);
      const responseRules = parsedInput.responseRules.map((rule, index) => `${index + 1}. ${rule}`).join("\n");
      const currentScoresContext = METRIC_DEFS.map((metric) =>
        `${parsedInput.language === "ar" ? metric.ar : metric.en}: ${parsedInput.currentScores[metric.key]}/100`,
      ).join("\n");
      const weakestMetric = [...METRIC_DEFS]
        .map((metric) => ({ key: metric.key, value: parsedInput.currentScores[metric.key] }))
        .sort((left, right) => left.value - right.value)[0]?.key ?? "teamAlignment";
      const branchFocus =
        parsedInput.language === "ar"
          ? (binaryReply
            ? "فجوة تنفيذية: آخر رد كان نعم/لا دون تفاصيل تشغيلية."
            : `بؤرة التشعب الحالية: عالج الضغط المتصاعد المرتبط بمؤشر ${metricLabel(weakestMetric, "ar")}.`)
          : (binaryReply
            ? "Execution gap branch: the latest trainee reply was yes/no without operational detail."
            : `Current branch focus: escalate consequences around the weakest metric (${metricLabel(weakestMetric, "en")}).`);
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

وضع المؤشرات الحالي:
${currentScoresContext}

تعليمات التفاعل الإلزامية:
- يجب أن يكون السؤال الأخير أمرا تنفيذيا ملموسا يتضمن: من/ماذا/متى/مؤشر KPI.
- إذا كان رد المتدرب الأخير نعم/لا فقط، فلا تنتقل للأمام في القصة: اطلب تفاصيل تنفيذ محددة مباشرة.
- أظهر أثرا واضحا لكل جولة عبر scoreDeltas مع مفاضلة حقيقية بين مؤشرات مختلفة.
- اجعل التشعب مبنيا على القرارات السابقة، ولا تكرر نفس النمط السردي.

إشارة التشعب الحالية:
${branchFocus}

قدّم الجولة التالية بصيغة JSON صالحة فقط وبهذا الشكل:
{
  "update": "جملة أو جملتان عن تحديث ميداني جديد",
  "assessment": "جملة أو جملتان لتقييم القرار السابق بشكل مباشر",
  "question": "سؤال تنفيذي واحد واضح بصيغة أمر عمليات (من/ماذا/متى/KPI)",
  "impactReason": "سبب مختصر من جملة واحدة يبرر أثر المؤشرات في هذه الجولة",
  "scoreDeltas": {
    "operationalControl": 0,
    "responseTempo": 0,
    "stakeholderTrust": 0,
    "teamAlignment": 0,
    "executiveComms": 0
  }
}

قواعد الأوزان:
- scoreDeltas تمثل أثر توجيه المتدرب الأخير بعد التقييم الميداني.
- كل قيمة عدد صحيح بين -12 و +12.
- اجعل الأوزان واقعية ومتوازنة، ولا تجعل كل القيم صفرا إلا إذا كان القرار محايدا فعلا.
- القيّم المفاضلات بوضوح: قد يتحسن مؤشر مقابل تراجع آخر.

القيود:
- update + assessment + question لا تتجاوز 120 كلمة إجمالا.
- لا تستخدم Markdown أو أي نص خارج JSON.
- لا تكرر نص السيناريو أو القواعد حرفيا.`
          : `
You are an interactive crisis simulation engine for the ${localizedSector} sector.
Current trainee role: ${localizedRole}.
Scenario: ${scenario.title} - ${scenario.description}

Response rules:
${responseRules}

Conversation transcript:
${transcript}

Current score state:
${currentScoresContext}

Mandatory interaction rules:
- The final question must demand a concrete command with who/what/when/KPI.
- If the trainee's latest reply is only yes/no, do not advance the storyline; request execution specifics first.
- Every turn must include explicit score impact with real metric tradeoffs (not generic neutrality).
- Branching must depend on prior decisions and avoid repeating the same narrative pattern.

Current branch signal:
${branchFocus}

Provide the next turn as valid JSON only using this exact shape:
{
  "update": "1-2 sentence field update",
  "assessment": "1-2 sentence critique of the trainee's previous directive",
  "question": "one execution command prompt requiring who/what/when/KPI",
  "impactReason": "one short reason justifying this turn's metric impact",
  "scoreDeltas": {
    "operationalControl": 0,
    "responseTempo": 0,
    "stakeholderTrust": 0,
    "teamAlignment": 0,
    "executiveComms": 0
  }
}

Scoring rules:
- scoreDeltas are the dynamic impact of the trainee's latest directive after this field update.
- Each delta must be an integer between -12 and +12.
- Keep scoring realistic and mixed; avoid all zeros unless the directive was genuinely neutral.
- Reflect tradeoffs (some metrics can improve while others worsen).

Constraints:
- update + assessment + question must stay under 110 words total.
- No markdown or prose outside JSON.
- Do not repeat scenario/rules verbatim.`;

      const modelCandidates = Array.from(
        new Set([ADVANCED_MODEL_PRIMARY, ADVANCED_MODEL_FALLBACK].filter(Boolean)),
      );

      const requestModelTurn = async (model: string, strictRepair: boolean): Promise<string> => {
        const repairInstruction =
          parsedInput.language === "ar"
            ? "تصحيح التنسيق: أعد JSON صالحا فقط بالمفاتيح: update, assessment, question, impactReason, scoreDeltas. لا تضف أي نص خارج JSON."
            : "FORMAT CORRECTION: Return valid JSON only with keys update, assessment, question, impactReason, scoreDeltas. No prose outside JSON.";

        const aiResponse = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content:
                parsedInput.language === "ar"
                  ? "أنت محاكي أزمات تدريبي. أعد JSON صالحا فقط. قيّم القرار السابق وولّد أوزان مؤشرات واقعية قابلة للتنفيذ."
                  : "You are a crisis simulation trainer. Return valid JSON only and assign realistic metric deltas.",
            },
            { role: "user", content: prompt },
            ...(strictRepair ? [{ role: "user" as const, content: repairInstruction }] : []),
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 320,
        });

        const raw = aiResponse.choices[0]?.message?.content?.trim();
        if (!raw) {
          throw new Error("Empty assistant response.");
        }
        return raw;
      };

      const requestModelTurnCompatibility = async (model: string): Promise<string> => {
        const lastDirective = extractDirectiveCandidate(lastUserMessage?.content);
        const weakestMetricForRetry = [...METRIC_DEFS]
          .map((metric) => ({ key: metric.key, value: parsedInput.currentScores[metric.key] }))
          .sort((left, right) => left.value - right.value)[0]?.key ?? "teamAlignment";
        const compactPrompt =
          parsedInput.language === "ar"
            ? `
أعد JSON صالحا فقط بدون Markdown لهذا الدور: ${localizedRole} ضمن سيناريو ${scenario.title}.
آخر توجيه للمتدرب: ${lastDirective || "غير متاح"}.
أضعف مؤشر حاليا: ${metricLabel(weakestMetricForRetry, "ar")}.
المطلوب JSON بهذه المفاتيح فقط: update, assessment, question, impactReason, scoreDeltas.
قواعد scoreDeltas: أعداد صحيحة بين -12 و +12 مع مفاضلة واقعية.
            `
            : `
Return valid JSON only (no markdown) for role ${localizedRole} in scenario ${scenario.title}.
Latest trainee directive: ${lastDirective || "N/A"}.
Current weakest metric: ${metricLabel(weakestMetricForRetry, "en")}.
Required JSON keys only: update, assessment, question, impactReason, scoreDeltas.
scoreDeltas must be integers in [-12, 12] with realistic tradeoffs.
            `;

        const aiResponse = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content:
                parsedInput.language === "ar"
                  ? "أنت محاكي أزمات تدريبي. أعد json صالحا فقط."
                  : "You are a crisis simulation trainer. Return valid json only.",
            },
            { role: "user", content: compactPrompt },
          ],
          max_completion_tokens: 320,
        });

        const raw = aiResponse.choices[0]?.message?.content?.trim();
        if (!raw) {
          throw new Error("Empty assistant response from compatibility retry.");
        }
        return raw;
      };

      const tryModel = async (model: string): Promise<ParsedAdvancedTurnPayload | null> => {
        try {
          const firstRawResponse = await requestModelTurn(model, false);
          let parsedTurn = parseAdvancedTurnPayload(firstRawResponse, parsedInput.language, binaryReply);

          if (parsedTurn.mode === "json") {
            return parsedTurn;
          }

          const retryRawResponse = await requestModelTurn(model, true);
          parsedTurn = parseAdvancedTurnPayload(retryRawResponse, parsedInput.language, binaryReply);
          if (parsedTurn.mode !== "failed") {
            return parsedTurn;
          }
        } catch (retryError) {
          const errorInfo = summarizeUpstreamError(retryError);
          console.warn(
            `Advanced chat model attempt failed (model=${model}, status=${errorInfo.status ?? "n/a"}, code=${errorInfo.code ?? "n/a"}): ${errorInfo.message}`,
          );
        }

        try {
          const compatibilityRaw = await requestModelTurnCompatibility(model);
          const compatibilityParsed = parseAdvancedTurnPayload(
            compatibilityRaw,
            parsedInput.language,
            binaryReply,
          );
          if (compatibilityParsed.mode !== "failed") {
            return compatibilityParsed;
          }
        } catch (compatibilityError) {
          const errorInfo = summarizeUpstreamError(compatibilityError);
          console.warn(
            `Advanced chat compatibility attempt failed (model=${model}, status=${errorInfo.status ?? "n/a"}, code=${errorInfo.code ?? "n/a"}): ${errorInfo.message}`,
          );
        }

        return null;
      };

      let parsedTurn: ParsedAdvancedTurnPayload | null = null;
      for (const model of modelCandidates) {
        parsedTurn = await tryModel(model);
        if (parsedTurn) {
          break;
        }
      }

      if (!parsedTurn) {
        res.json(buildAdvancedFallback(parsedInput));
        return;
      }

      if (!parsedTurn || parsedTurn.mode === "failed") {
        res.json(buildAdvancedLocalRecovery(parsedInput, {
          failureCode: "invalid_model_json",
        }));
        return;
      }

      if (binaryReply) {
        const policySections: AdvancedTurnSections = parsedInput.language === "ar"
          ? {
              update: "لم يتم اعتماد أي تنفيذ ميداني جديد لأن ردك الأخير كان نعم/لا بدون تفاصيل تشغيلية.",
              assessment: "لا يمكن تحسين الأداء دون أمر تنفيذي واضح يحدد المالك والتوقيت ومؤشر القياس.",
              question: buildConcreteCommandQuestion("ar"),
            }
          : {
              update: "No new field action was authorized because your last reply was yes/no without execution detail.",
              assessment: "Performance cannot improve until you issue one concrete command with owner, timing, and measurable KPI.",
              question: buildConcreteCommandQuestion("en"),
            };

        res.json(buildAdvancedLocalRecovery(parsedInput, {
          failureCode: "policy_reprompt_needed",
          sections: policySections,
          scoreDeltas: parsedTurn.scoreDeltas,
          impactReason: parsedTurn.impactReason ?? undefined,
        }));
        return;
      }

      if (parsedTurn.mode === "recovered_text") {
        res.json(buildAdvancedLocalRecovery(parsedInput, {
          failureCode: "invalid_model_json",
          sections: parsedTurn.sections,
          scoreDeltas: parsedTurn.scoreDeltas,
          impactReason: parsedTurn.impactReason ?? undefined,
        }));
        return;
      }

      if (!parsedTurn.sections) {
        res.json(buildAdvancedLocalRecovery(parsedInput, {
          failureCode: "invalid_model_json",
        }));
        return;
      }

      const assistantMessage = normalizeAdvancedTurnResponse(
        composeAdvancedTurnMessage(parsedTurn.sections, parsedInput.language),
        parsedInput.language,
        false,
      );
      const scoreDeltas = enforceDeltaTension(parsedTurn.scoreDeltas, false);
      const updatedScores = applyScoreDeltas(parsedInput.currentScores, scoreDeltas);
      const impactReason = parsedTurn.impactReason ?? buildImpactReason(scoreDeltas, parsedInput.language);

      res.json({
        assistantMessage,
        scoreDeltas,
        updatedScores,
        impactReason,
        source: "ai",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0]?.message || "Validation Error" });
        return;
      }

      console.error("Advanced chat error:", error);

      if (input) {
        res.json(buildAdvancedLocalRecovery(input, {
          failureCode: "invalid_model_json",
        }));
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
      const chatHistoryContext = (input.chatHistory ?? [])
        .map((entry) => {
          if (requestLanguage === "ar") {
            return `- ${entry.role === "assistant" ? "المحاكي" : "المتدرب"}: ${entry.content}`;
          }
          return `- ${entry.role === "assistant" ? "Simulator" : "Trainee"}: ${entry.content}`;
        })
        .join("\n");
      const safeHistoryContext = historyContext || (requestLanguage === "ar"
        ? "- لا توجد قرارات اختيار متعدد مسجلة لهذه الجولة."
        : "- No structured multiple-choice decisions were recorded for this run.");
      const chatHistoryBlock = chatHistoryContext
        ? requestLanguage === "ar"
          ? `\nسجل المحادثة المتقدمة:\n${chatHistoryContext}\n`
          : `\nAdvanced chat transcript:\n${chatHistoryContext}\n`
        : "";

      const prompt =
        requestLanguage === "ar"
          ? `
أنت مقيم خبير في إدارة الأزمات، وتقوم بتقييم أداء مستخدم داخل محاكاة أزمة.
السيناريو هو: ${activeScenario.title} - ${activeScenario.description}
الدور الذي لعبه المستخدم: ${localizedRole}

النتائج النهائية للمؤشرات:
${scoreContext}

سجل قراراته:
${safeHistoryContext}
${chatHistoryBlock}

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
${safeHistoryContext}
${chatHistoryBlock}

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
        model: DEBRIEF_MODEL,
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
