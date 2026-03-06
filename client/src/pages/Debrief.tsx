import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { CyberButton } from "@/components/CyberButton";
import { ScoreGauge } from "@/components/ScoreGauge";
import { useSimulation } from "@/hooks/use-simulation";
import { useGenerateDebrief } from "@/hooks/use-api";
import { useLanguage } from "@/lib/language";
import { METRIC_CONFIG } from "@/lib/metric-config";
import { localizeRole } from "@/lib/role-copy";
import type { AdvancedChatMessage, RunHistoryItem, ScoreSet } from "@shared/schema";
import { FileText, CheckCircle2, AlertTriangle, Target, ListChecks, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

function buildRunHistoryFromAdvancedChat(
  messages: AdvancedChatMessage[],
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

export default function Debrief() {
  const [, setLocation] = useLocation();
  const { state, resetSimulation, restartRun, setPreloadedDebrief } = useSimulation();
  const { text, isArabic } = useLanguage();
  const [requestedLanguage, setRequestedLanguage] = useState<"en" | "ar" | null>(null);
  const targetLanguage = isArabic ? "ar" : "en";
  const historyForDebrief = useMemo(
    () =>
      state.level === "advanced"
        ? (state.history.length > 0
          ? state.history
          : buildRunHistoryFromAdvancedChat(state.advancedChatHistory, state.scores))
        : state.history,
    [state.level, state.advancedChatHistory, state.scores, state.history],
  );
  const hasAdvancedUserMessages = state.advancedChatHistory.some((entry) => entry.role === "user");
  
  const {
    mutate: generateDebrief,
    data: debrief,
    isPending,
    isError,
    error,
    reset: resetDebrief,
  } = useGenerateDebrief();
  const activeDebrief = state.preloadedDebrief ?? debrief;

  useEffect(() => {
    if (!state.role || !state.scenarioId || (state.level !== "beginner" && state.level !== "advanced")) {
      setLocation("/");
      return;
    }

    if (state.level === "beginner" && historyForDebrief.length === 0) {
      setLocation("/");
      return;
    }

    if (state.level === "advanced" && !hasAdvancedUserMessages) {
      setLocation("/");
      return;
    }

    // Trigger debrief generation if we don't have it yet
    if (!activeDebrief && !isPending && !isError) {
      setRequestedLanguage(targetLanguage);
      generateDebrief({
        scenarioId: state.scenarioId,
        language: targetLanguage,
        role: state.role,
        history: historyForDebrief,
        chatHistory: state.level === "advanced" ? state.advancedChatHistory : undefined,
      });
    }
  }, [
    state,
    activeDebrief,
    isPending,
    isError,
    generateDebrief,
    setLocation,
    targetLanguage,
    historyForDebrief,
    hasAdvancedUserMessages,
  ]);

  useEffect(() => {
    if (!activeDebrief || isPending || isError || !state.role || !state.scenarioId) {
      return;
    }

    if (requestedLanguage === targetLanguage) {
      return;
    }

    setPreloadedDebrief(null);
    resetDebrief();
    setRequestedLanguage(targetLanguage);
    generateDebrief({
      scenarioId: state.scenarioId,
      language: targetLanguage,
      role: state.role,
      history: historyForDebrief,
      chatHistory: state.level === "advanced" ? state.advancedChatHistory : undefined,
    });
  }, [
    activeDebrief,
    isPending,
    isError,
    state.role,
    state.scenarioId,
    state.level,
    state.advancedChatHistory,
    historyForDebrief,
    requestedLanguage,
    targetLanguage,
    setPreloadedDebrief,
    resetDebrief,
    generateDebrief,
  ]);

  const handleRestartSameSetup = () => {
    setPreloadedDebrief(null);
    resetDebrief();
    setRequestedLanguage(null);
    restartRun();
    setLocation(state.level === "advanced" ? "/advanced" : "/sim");
  };

  const handleReturnHome = () => {
    setPreloadedDebrief(null);
    resetDebrief();
    setRequestedLanguage(null);
    resetSimulation();
    setLocation("/");
  };

  if (isError) {
    return (
      <Layout className="items-center justify-center">
        <div className="glass-panel p-8 text-center max-w-lg">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-display text-destructive mb-2 uppercase">
            {text("Report Generation Failed", "فشل توليد التقرير")}
          </h2>
          <p className="text-muted-foreground mb-6">
            {error?.message ||
              text(
                "The AI subsystem encountered an error processing your results.",
                "واجه النظام الذكي خطأ أثناء معالجة نتائجك.",
              )}
          </p>
          <CyberButton onClick={handleReturnHome} variant="secondary">
            {text("Return Home", "العودة للرئيسية")}
          </CyberButton>
        </div>
      </Layout>
    );
  }

  if (isPending || !activeDebrief) {
    return (
      <Layout className="items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-6 glass-panel p-12 max-w-md w-full text-center"
        >
          <div className="relative">
            <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <FileText className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold uppercase text-glow tracking-widest mb-2">
              {text("Compiling A.A.R.", "جار إعداد التقرير")}
            </h2>
            <p className="text-muted-foreground">
              {text(
                "AI is analyzing your decision matrix and generating the After-Action Report...",
                "يقوم النظام بتحليل قراراتك وإعداد تقرير ما بعد الحدث...",
              )}
            </p>
          </div>
        </motion.div>
      </Layout>
    );
  }

  const isOfflineFallback = activeDebrief.summary.some(
    (line) =>
      line.includes("Live AI was unavailable") ||
      line.includes("تعذر الوصول إلى OpenAI") ||
      line.includes("تحليل محلي محدد"),
  );

  const Section = ({ title, icon, items, type }: { title: string, icon: ReactNode, items: string[], type: "success" | "warning" | "danger" | "info" }) => {
    const colors = {
      success: "border-success/30 bg-success/5 text-success",
      warning: "border-warning/30 bg-warning/5 text-warning",
      danger: "border-destructive/30 bg-destructive/5 text-destructive",
      info: "border-primary/30 bg-primary/5 text-primary"
    };

    return (
      <div className={`p-6 border clip-chamfer-sm ${colors[type]}`}>
        <div className="flex items-center gap-3 mb-4 border-b border-current/20 pb-3">
          <div className="opacity-80">{icon}</div>
          <h3 className="font-display font-bold uppercase tracking-wider text-lg">{title}</h3>
        </div>
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3 text-foreground/90 leading-relaxed">
              <span className="opacity-50 mt-1">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Layout className="py-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto w-full flex flex-col gap-8"
      >
        <div className="text-center mb-4">
          <h1 className="text-3xl md:text-4xl font-black font-display text-glow uppercase tracking-widest mb-2">
            {text("After-Action Report", "تقرير ما بعد الحدث")}
          </h1>
          <p className="text-muted-foreground text-lg">
            {text("Role:", "الدور:")}{" "}
            <span className="text-primary font-bold">{localizeRole(state.role, isArabic)}</span>
          </p>
        </div>

        {isOfflineFallback && (
          <div className="rounded border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            {text(
              "Offline AI fallback mode: this report was generated from deterministic local analysis.",
              "وضع بديل بدون ذكاء مباشر: تم توليد هذا التقرير من تحليل محلي حتمي.",
            )}
          </div>
        )}

        {/* Final Scores */}
        <div className="glass-panel p-6">
          <h2 className="font-display uppercase tracking-widest text-muted-foreground mb-4 text-sm text-center">
            {text("Final Metrics", "المؤشرات النهائية")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
            {METRIC_CONFIG.map((metric) => {
              const MetricIcon = metric.icon;

              return (
                <ScoreGauge
                  key={metric.key}
                  label={text(metric.labelEn, metric.labelAr)}
                  value={state.scores[metric.key]}
                  icon={<MetricIcon className="w-5 h-5" />}
                  className="bg-transparent border-none p-0"
                  isArabic={isArabic}
                />
              );
            })}
          </div>
        </div>

        {/* Debrief Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <Section
              title={text("Executive Summary", "الملخص التنفيذي")}
              icon={<FileText />}
              items={activeDebrief.summary}
              type="info"
            />
          </div>
          
          <Section
            title={text("What Went Well", "ما سار بشكل جيد")}
            icon={<CheckCircle2 />}
            items={activeDebrief.wentWell}
            type="success"
          />
          <Section
            title={text("What To Improve", "ما يجب تحسينه")}
            icon={<Target />}
            items={activeDebrief.toImprove}
            type="warning"
          />
          
          <div className="md:col-span-2">
            <Section
              title={text("Missed Signals", "الإشارات التي فاتت")}
              icon={<AlertTriangle />}
              items={activeDebrief.missedSignals}
              type="danger"
            />
          </div>
          
          <div className="md:col-span-2">
            <Section
              title={text("Next-Time Checklist", "قائمة المراجعة للمرة القادمة")}
              icon={<ListChecks />}
              items={activeDebrief.checklist}
              type="info"
            />
          </div>
        </div>

        <div className="flex justify-center mt-8 pb-12">
          <CyberButton size="lg" onClick={handleRestartSameSetup} className="min-w-[200px]">
            <RotateCcw className="w-5 h-5" />
            {text("Restart Simulation", "إعادة المحاكاة")}
          </CyberButton>
        </div>
      </motion.div>
    </Layout>
  );
}
