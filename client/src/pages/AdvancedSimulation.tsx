import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { CyberButton } from "@/components/CyberButton";
import { ScoreGauge } from "@/components/ScoreGauge";
import { useAdvancedChatTurn, useGenerateDebrief, useScenario, useTrainingConfig } from "@/hooks/use-api";
import { useSimulation } from "@/hooks/use-simulation";
import { useLanguage } from "@/lib/language";
import { METRIC_CONFIG } from "@/lib/metric-config";
import { localizeRole } from "@/lib/role-copy";
import { localizeScenario } from "@/lib/scenario-copy";
import { getRulesForSelection } from "@/lib/training-config";
import type { AdvancedChatMessage, RunHistoryItem, ScoreSet } from "@shared/schema";
import { Bot, Send, User, AlertTriangle, Clock } from "lucide-react";

interface TurnImpact {
  scoreDeltas: ScoreSet;
  updatedScores: ScoreSet;
  reason: string;
}

interface ChatTurnMessage extends AdvancedChatMessage {
  impact?: TurnImpact;
}

interface CommandHintStatus {
  hasOwner: boolean;
  hasAction: boolean;
  hasTiming: boolean;
  hasKpi: boolean;
}

function extractQuestionLine(message: string, isArabic: boolean): string {
  const label = isArabic ? "سؤال:" : "Question:";
  const lines = message.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const index = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
  if (index >= 0) {
    return lines.slice(index + 1).join(" ").trim();
  }
  return "";
}

function evaluateCommandHint(input: string): CommandHintStatus {
  const normalized = input.trim().toLowerCase();
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
  const timingPattern = /(خلال|بعد|قبل|الآن|فور[اًا]?|دقيقة|دقائق|ساعة|ساعات|within|in the next|by|minute|minutes|hour|hours)/i;
  const kpiPattern = /(kpi|مؤشر|نسبة|%|زمن|وقت|إشغال|اشغال|انتظار|رضا|معدل|occupancy|wait|target|sla)/i;

  return {
    hasOwner: ownerPattern.test(normalized),
    hasAction: actionPattern.test(normalized),
    hasTiming: timingPattern.test(normalized),
    hasKpi: kpiPattern.test(normalized),
  };
}

function buildRunHistoryFromAdvancedChat(
  messages: ChatTurnMessage[],
  scores: ScoreSet,
): RunHistoryItem[] {
  const userMessages = messages.filter((message) => message.role === "user");

  return userMessages.map((_, index) => ({
    stepId: `advanced-turn-${index + 1}`,
    choiceId: `directive-${index + 1}`,
    timestamp: 1_700_000_000_000 + index * 1000,
    scoresAfter: scores,
  }));
}

export default function AdvancedSimulation() {
  const [, setLocation] = useLocation();
  const {
    state,
    resetSimulation,
    setAdvancedChatHistory,
    setPreloadedDebrief,
    recordChoice,
  } = useSimulation();
  const { text, isArabic } = useLanguage();
  const { data: scenario, isLoading, isError } = useScenario(state.scenarioId);
  const { data: trainingConfig } = useTrainingConfig();
  const chatTurn = useAdvancedChatTurn();
  const debrief = useGenerateDebrief();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatTurnMessage[]>([]);
  const [isOfflineFallbackMode, setIsOfflineFallbackMode] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      state.level !== "advanced" ||
      !state.scenarioId ||
      !state.role ||
      !state.sectorId
    ) {
      setLocation("/");
    }
  }, [state.level, state.role, state.scenarioId, state.sectorId, setLocation]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    setAdvancedChatHistory(
      messages
        .slice(-24)
        .map((message) => ({ role: message.role, content: message.content })),
    );
  }, [messages, setAdvancedChatHistory]);

  const localizedScenario = scenario ? localizeScenario(scenario, isArabic) : null;
  const selectedRules = useMemo(() => {
    if (!state.sectorId) {
      return [];
    }

    if (!trainingConfig) {
      return getRulesForSelection(state.sectorId, state.role);
    }

    const matches = trainingConfig.rules.filter((rule) => {
      if (!rule.isActive) {
        return false;
      }
      const sectorMatch = Boolean(rule.sectorId && rule.sectorId === state.sectorId);
      const roleMatch = Boolean(state.role && rule.roleId && rule.roleId === state.role);
      return sectorMatch || roleMatch;
    });

    const seen = new Set<string>();
    return matches
      .map((rule) => rule.text)
      .filter((rule) => {
        if (seen.has(rule.en)) {
          return false;
        }
        seen.add(rule.en);
        return true;
      });
  }, [state.sectorId, state.role, trainingConfig]);
  const requestLanguage = isArabic ? "ar" : "en";
  const hasUserDirective = messages.some((message) => message.role === "user");
  const userTurnCount = messages.filter((message) => message.role === "user").length;
  const timelineLabel = `T+${userTurnCount * 5}m`;
  const lastAssistantQuestion = extractQuestionLine(
    [...messages].reverse().find((entry) => entry.role === "assistant")?.content ?? "",
    isArabic,
  );
  const commandHint = evaluateCommandHint(draft);
  const draftTemplate = isArabic
    ? "يوجّه [الجهة المسؤولة] لتنفيذ [الإجراء المحدد] خلال [الوقت المحدد]، مع نقطة تحقق عند [الوقت]، وKPI: [المؤشر المستهدف] إلى [القيمة]."
    : "Direct [owner] to execute [specific action] within [time], with a checkpoint at [time], and KPI: [target metric] to [value].";

  const localizedRules = useMemo(
    () => selectedRules.map((rule) => (isArabic ? rule.ar : rule.en)),
    [isArabic, selectedRules],
  );
  const initialAssistantMessage = useMemo(() => {
    if (!state.role || !localizedScenario) {
      return "";
    }

    const roleLabel = localizeRole(state.role, isArabic);
    if (isArabic) {
      return `تم تفعيل المحاكاة المتقدمة. دورك هو ${roleLabel}. السيناريو هو "${localizedScenario.title}". ابدأ بإصدار أول توجيه تشغيلي.`;
    }

    return `Advanced simulation is live. Your role is ${roleLabel}. The scenario is "${localizedScenario.title}". Issue your first operational directive.`;
  }, [isArabic, localizedScenario, state.role]);

  useEffect(() => {
    setMessages([]);
    setIsOfflineFallbackMode(false);
  }, [requestLanguage, state.role, state.scenarioId]);

  useEffect(() => {
    if (!localizedScenario || !initialAssistantMessage || messages.length > 0) {
      return;
    }

    setMessages([
      {
        role: "assistant",
        content: initialAssistantMessage,
      },
    ]);
  }, [initialAssistantMessage, localizedScenario, messages.length]);

  const handleSend = () => {
    const content = draft.trim();

    if (!content || !state.scenarioId || !state.role || !state.sectorId || chatTurn.isPending) {
      return;
    }

    const userMessage: AdvancedChatMessage = { role: "user", content };
    const nextHistory = [
      ...messages.map((message) => ({ role: message.role, content: message.content })),
      userMessage,
    ].slice(-24);

    setMessages((current) => [...current, userMessage]);
    setDraft("");

    chatTurn.mutate(
      {
        scenarioId: state.scenarioId,
        language: requestLanguage,
        sectorId: state.sectorId,
        role: state.role,
        currentScores: state.scores,
        responseRules: localizedRules,
        history: nextHistory,
      },
      {
        onSuccess: (response) => {
          const fallbackDetected = response.source === "local_fallback";
          if (fallbackDetected) {
            setIsOfflineFallbackMode(true);
          }
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: response.assistantMessage,
              impact: {
                scoreDeltas: response.scoreDeltas,
                updatedScores: response.updatedScores,
                reason: response.impactReason,
              },
            },
          ]);
          const turnNumber = nextHistory.filter((entry) => entry.role === "user").length;
          recordChoice(
            `advanced-turn-${turnNumber}`,
            `directive-${turnNumber}`,
            response.scoreDeltas,
          );
        },
        onError: () => {
          setIsOfflineFallbackMode(true);
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: text(
                "AI coaching is temporarily unavailable. Continue with your next decision and I will keep evaluating your approach.",
                "خدمة التوجيه الذكي غير متاحة مؤقتا. واصل قرارك التالي وسأستمر في تقييم أسلوب استجابتك.",
              ),
            },
          ]);
        },
      },
    );
  };

  const handleCloseIncidentAndDebrief = () => {
    if (!state.scenarioId || !state.role || debrief.isPending) {
      return;
    }

    const chatHistory = messages.slice(-24);
    const historyForDebrief =
      state.history.length > 0
        ? state.history
        : buildRunHistoryFromAdvancedChat(chatHistory, state.scores);

    debrief.mutate(
      {
        scenarioId: state.scenarioId,
        language: requestLanguage,
        role: state.role,
        history: historyForDebrief,
        chatHistory,
      },
      {
        onSuccess: (report) => {
          setPreloadedDebrief(report);
          setLocation("/debrief");
        },
        onError: () => {
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: text(
                "Unable to generate the After-Action Report right now. Please retry in a moment.",
                "تعذر إنشاء تقرير ما بعد الحدث حاليا. حاول مرة أخرى بعد قليل.",
              ),
            },
          ]);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Layout className="items-center justify-center">
        <div className="text-center">
          <p className="font-display uppercase text-primary tracking-widest">
            {text("Loading advanced simulation...", "جار تحميل المحاكاة المتقدمة...")}
          </p>
        </div>
      </Layout>
    );
  }

  if (isError || !localizedScenario) {
    return (
      <Layout className="items-center justify-center">
        <div className="glass-panel p-8 text-center max-w-xl">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {text("Scenario load failed", "تعذر تحميل السيناريو")}
          </h2>
          <p className="text-muted-foreground mb-6">
            {text(
              "Return to setup and choose another scenario.",
              "ارجع إلى صفحة الإعداد واختر سيناريو آخر.",
            )}
          </p>
          <CyberButton onClick={() => setLocation("/")}>
            {text("Back to Setup", "العودة إلى الإعداد")}
          </CyberButton>
        </div>
      </Layout>
    );
  }

  return (
    <Layout className="py-6 flex flex-col gap-6">
      <div className="grid grid-cols-1 xl:grid-cols-6 gap-4">
        <div className="glass-panel p-4 flex flex-col justify-center items-center border-l-4 border-l-primary bg-primary/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-20"><Clock className="w-16 h-16" /></div>
          <span className="text-xs text-primary font-display tracking-widest uppercase mb-1 z-10">
            {text("Current Timeline", "التوقيت الحالي")}
          </span>
          <span className="text-3xl font-black font-display text-glow z-10">{timelineLabel}</span>
        </div>

        <div className="col-span-1 xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {METRIC_CONFIG.map((metric) => {
            const MetricIcon = metric.icon;
            return (
              <ScoreGauge
                key={metric.key}
                label={text(metric.labelEn, metric.labelAr)}
                value={state.scores[metric.key]}
                icon={<MetricIcon className="w-4 h-4" />}
                isArabic={isArabic}
              />
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] max-w-6xl mx-auto w-full">
        <aside className="glass-panel p-5 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary mb-2">
              {text("Mode", "المستوى")}
            </p>
            <p className="font-semibold">
              {text("Advanced Interactive Simulation", "محاكاة تفاعلية متقدمة")}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-primary mb-2">
              {text("Role", "الدور")}
            </p>
            <p className="font-semibold">{localizeRole(state.role, isArabic)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-primary mb-2">
              {text("Scenario", "السيناريو")}
            </p>
            <p className="font-semibold mb-2">{localizedScenario.title}</p>
            <p className="text-sm text-muted-foreground leading-6">
              {localizedScenario.description}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-primary mb-2">
              {text("Sector Rules", "قواعد القطاع")}
            </p>
            <ul className="space-y-2">
              {localizedRules.map((rule, index) => (
                <li
                  key={`advanced-rule-${index}`}
                  className="rounded border border-primary/20 bg-secondary/30 px-3 py-2 text-xs leading-5 text-muted-foreground"
                >
                  {rule}
                </li>
              ))}
            </ul>
          </div>
          <CyberButton
            variant="secondary"
            onClick={() => {
              resetSimulation();
              setLocation("/");
            }}
          >
            {text("Reset Setup", "إعادة الإعداد")}
          </CyberButton>
        </aside>

        <section className="glass-panel p-5 flex flex-col min-h-[680px]">
          {isOfflineFallbackMode && (
            <div className="mb-4 rounded border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              {text(
                "Offline AI fallback mode is active. You can continue the simulation with local guidance.",
                "تم تفعيل الوضع البديل بدون ذكاء مباشر. يمكنك متابعة المحاكاة بتوجيه محلي.",
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-4 border-b border-primary/20 pb-4 mb-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-primary tracking-wide">
                {text("AI Crisis Command", "قيادة الأزمة بالذكاء الاصطناعي")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {text(
                  "Issue directives, ask for updates, and test your command decisions in real time.",
                  "أصدر التوجيهات واطلب التحديثات واختبر قرارات القيادة بشكل لحظي.",
                )}
              </p>
            </div>
          </div>

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto rounded border border-primary/15 bg-secondary/20 p-4 space-y-4"
          >
            {messages.map((message, index) => {
              const isAssistant = message.role === "assistant";
              return (
                <div
                  key={`msg-${index}`}
                  className={`flex gap-3 ${isAssistant ? "" : "justify-end"}`}
                >
                  {isAssistant && (
                    <div className="h-8 w-8 rounded-full bg-primary/15 border border-primary/35 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded border px-4 py-3 text-sm leading-6 ${
                      isAssistant
                        ? "border-primary/20 bg-background/70 text-foreground"
                        : "border-primary/30 bg-primary/10 text-foreground"
                    } whitespace-pre-line`}
                  >
                    {!isAssistant && <User className="w-4 h-4 text-primary mb-1" />}
                    {message.content}
                    {isAssistant && message.impact && (
                      <div className="mt-3 rounded border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                        <p className="mb-2 font-semibold text-primary">
                          {text("Turn Impact", "أثر الجولة")}
                        </p>
                        <p className="mb-2 text-muted-foreground leading-5">
                          {message.impact.reason}
                        </p>
                        <div className="space-y-1">
                          {METRIC_CONFIG.map((metric) => {
                            const delta = message.impact?.scoreDeltas[metric.key] ?? 0;
                            const updated = message.impact?.updatedScores[metric.key] ?? state.scores[metric.key];
                            const deltaText = `${delta >= 0 ? "+" : ""}${delta}`;
                            return (
                              <div
                                key={`impact-${index}-${metric.key}`}
                                className="flex items-center justify-between gap-3 text-[11px]"
                              >
                                <span className="text-muted-foreground">
                                  {text(metric.labelEn, metric.labelAr)}
                                </span>
                                <span className="font-medium text-foreground">
                                  {deltaText} | {updated}/100
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              <p className="font-semibold text-primary mb-1">
                {text("Next Action Required", "المطلوب في الخطوة التالية")}
              </p>
              <p className="text-muted-foreground leading-6">
                {lastAssistantQuestion || text(
                  "Write one executable command with owner, timing, and KPI target.",
                  "اكتب أمرا تنفيذيا واحدا يتضمن الجهة المسؤولة والتوقيت ومؤشر KPI مستهدف.",
                )}
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className={commandHint.hasOwner ? "text-success" : "text-warning"}>
                  {commandHint.hasOwner ? "✓ " : "• "}
                  {text("Owner specified", "تم تحديد الجهة المسؤولة")}
                </div>
                <div className={commandHint.hasAction ? "text-success" : "text-warning"}>
                  {commandHint.hasAction ? "✓ " : "• "}
                  {text("Action specified", "تم تحديد الإجراء")}
                </div>
                <div className={commandHint.hasTiming ? "text-success" : "text-warning"}>
                  {commandHint.hasTiming ? "✓ " : "• "}
                  {text("Timing specified", "تم تحديد التوقيت")}
                </div>
                <div className={commandHint.hasKpi ? "text-success" : "text-warning"}>
                  {commandHint.hasKpi ? "✓ " : "• "}
                  {text("KPI specified", "تم تحديد مؤشر الأداء")}
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <CyberButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setDraft(draftTemplate)}
                  disabled={chatTurn.isPending || debrief.isPending}
                >
                  {text("Use Reply Template", "استخدم قالب الرد")}
                </CyberButton>
              </div>
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              className="min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm leading-6"
              placeholder={text(
                "Type one executable command with owner, timing, and KPI. Press Enter to send, Shift+Enter for a new line.",
                "اكتب أمرا تنفيذيا واحدا يتضمن الجهة المسؤولة والتوقيت وKPI. اضغط Enter للإرسال وShift+Enter لسطر جديد.",
              )}
            />
            <div className="flex justify-end">
              <div className="flex gap-3">
                <CyberButton
                  variant="secondary"
                  onClick={handleCloseIncidentAndDebrief}
                  disabled={!hasUserDirective || chatTurn.isPending || debrief.isPending}
                >
                  {debrief.isPending
                    ? text("Generating AAR...", "جار إعداد تقرير ما بعد الحدث...")
                    : text("Close Incident & AAR", "إغلاق الحادثة وتقرير ما بعد الحدث")}
                </CyberButton>
                <CyberButton onClick={handleSend} disabled={!draft.trim() || chatTurn.isPending || debrief.isPending}>
                <Send className="w-4 h-4" />
                {chatTurn.isPending
                  ? text("Analyzing...", "جار التحليل...")
                  : text("Send Command", "إرسال التوجيه")}
                </CyberButton>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
