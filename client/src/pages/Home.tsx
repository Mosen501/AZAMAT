import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { CyberButton } from "@/components/CyberButton";
import { usePublicActivity, useScenarioCatalog, useTrainingConfig } from "@/hooks/use-api";
import { useSimulation } from "@/hooks/use-simulation";
import { useLanguage } from "@/lib/language";
import { localizeScenarioSummary } from "@/lib/scenario-copy";
import {
  getRulesForSelection,
  getScenariosForSelection,
  LEVEL_OPTIONS,
  ROLE_OPTIONS,
  SECTOR_OPTIONS,
} from "@/lib/training-config";
import { useLocation } from "wouter";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { LocalizedCopy } from "@shared/schema";

const HOME_ACTIVITY_STORAGE_KEY = "crisisim_home_activity_visible";
const HOME_ACTIVITY_LEGACY_STORAGE_KEYS = ["azamat_home_activity_visible"] as const;

type DisplaySector = {
  id: string;
  label: LocalizedCopy;
  description: LocalizedCopy;
};

type DisplayRole = {
  id: string;
  title: LocalizedCopy;
  description: LocalizedCopy;
  icon: (typeof ROLE_OPTIONS)[number]["icon"];
};

export default function Home() {
  const { state, setLevel, setSector, setRole, setScenario } = useSimulation();
  const { data: scenarios, isLoading: isLoadingScenarios, isError: isScenarioError } = useScenarioCatalog();
  const { data: trainingConfig } = useTrainingConfig();
  const { data: activity = [] } = usePublicActivity(6);
  const { text, isArabic } = useLanguage();
  const [, setLocation] = useLocation();
  const [showActivity, setShowActivity] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(HOME_ACTIVITY_STORAGE_KEY);
      const legacy = HOME_ACTIVITY_LEGACY_STORAGE_KEYS
        .map((key) => localStorage.getItem(key))
        .find(Boolean);
      const value = stored ?? legacy;
      return value !== "0";
    } catch {
      return true;
    }
  });

  const roleIconMap = useMemo(
    () => new Map(ROLE_OPTIONS.map((role) => [role.id, role.icon])),
    [],
  );

  const availableSectors = useMemo<DisplaySector[]>(
    () =>
      trainingConfig?.sectors
        .filter((sector) => sector.isActive)
        .map((sector) => ({
          id: sector.id,
          label: sector.label,
          description: sector.description,
        })) ?? SECTOR_OPTIONS,
    [trainingConfig],
  );

  const availableRoles = useMemo(
    (): DisplayRole[] => {
      if (!state.sectorId) {
        return [];
      }
      const selectedSector = state.sectorId;

      if (!trainingConfig) {
        return ROLE_OPTIONS.filter((role) => role.sectors.includes(selectedSector));
      }

      return trainingConfig.roles
        .filter((role) => role.isActive && role.sectorIds.includes(selectedSector))
        .map((role) => ({
          id: role.id,
          title: role.title,
          description: role.description,
          icon: roleIconMap.get(role.id) ?? ROLE_OPTIONS[0]!.icon,
        }));
    },
    [state.sectorId, trainingConfig, roleIconMap],
  );

  const availableScenarios = useMemo(
    () => {
      if (!state.sectorId || !state.role) {
        return [];
      }
      const selectedRole = state.role;

      if (!trainingConfig) {
        return getScenariosForSelection(scenarios ?? [], state.sectorId, selectedRole);
      }

      const linkedScenarioIds = new Set(
        trainingConfig.scenarioLinks
          .filter((link) => link.sectorId === state.sectorId && link.roleIds.includes(selectedRole))
          .map((link) => link.scenarioId),
      );

      return (scenarios ?? []).filter((scenario) => linkedScenarioIds.has(scenario.id));
    },
    [scenarios, state.sectorId, state.role, trainingConfig],
  );

  const alignedRules = useMemo(
    () => {
      if (!state.sectorId) {
        return [];
      }

      if (!trainingConfig) {
        return getRulesForSelection(state.sectorId, state.role);
      }

      const rules = trainingConfig.rules.filter((rule) => {
        if (!rule.isActive) {
          return false;
        }

        const sectorMatch = Boolean(rule.sectorId && rule.sectorId === state.sectorId);
        const roleMatch = Boolean(state.role && rule.roleId && rule.roleId === state.role);
        return sectorMatch || roleMatch;
      });

      const seen = new Set<string>();
      return rules
        .map((rule) => rule.text)
        .filter((rule) => {
          if (seen.has(rule.en)) {
            return false;
          }

          seen.add(rule.en);
          return true;
        });
    },
    [state.sectorId, state.role, trainingConfig],
  );

  useEffect(() => {
    if (state.role && !availableRoles.some((role) => role.id === state.role)) {
      setRole(null);
    }
  }, [availableRoles, state.role, setRole]);

  useEffect(() => {
    if (state.scenarioId && !availableScenarios.some((scenario) => scenario.id === state.scenarioId)) {
      setScenario(null);
    }
  }, [availableScenarios, state.scenarioId, setScenario]);

  useEffect(() => {
    try {
      localStorage.setItem(HOME_ACTIVITY_STORAGE_KEY, showActivity ? "1" : "0");
    } catch {
      // Ignore persistence issues in restricted environments.
    }
  }, [showActivity]);

  const readyToStart = Boolean(
    state.level && state.sectorId && state.role && state.scenarioId,
  );

  const handleStart = () => {
    if (!readyToStart) {
      return;
    }

    setLocation(state.level === "advanced" ? "/advanced" : "/sim");
  };

  return (
    <Layout className="justify-center items-center">
      <motion.div
        className="w-full max-w-5xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-primary/5 border border-primary/20 mb-4 box-glow">
            <AlertTriangle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-3 text-glow tracking-tight text-primary uppercase">
            {text("Rare Crisis Simulation", "محاكاة الأزمات النادرة")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {text(
              "Choose your training level first, then select sector-specific roles, scenarios, and response rules.",
              "ابدأ باختيار مستوى التدريب، ثم اختر القطاع والأدوار والسيناريوهات وقواعد الاستجابة المرتبطة به.",
            )}
          </p>
        </div>

        <div className="glass-panel p-6 md:p-8 flex flex-col gap-8">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-display uppercase tracking-widest text-muted-foreground">
                {text("Recent Activity", "آخر النشاطات")}
              </h2>
              <button
                type="button"
                className="rounded border border-primary/25 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                onClick={() => setShowActivity((current) => !current)}
                aria-expanded={showActivity}
              >
                {showActivity
                  ? text("Hide Activity", "إخفاء النشاطات")
                  : text("Show Activity", "إظهار النشاطات")}
              </button>
            </div>
            <AnimatePresence initial={false}>
              {showActivity && (
                <motion.div
                  key="activity-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="pt-1">
                    {activity.length === 0 ? (
                      <div className="rounded border border-primary/15 bg-secondary/25 p-4 text-sm text-muted-foreground">
                        {text("No recent platform activity yet.", "لا توجد نشاطات حديثة على المنصة حتى الآن.")}
                      </div>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        {activity.map((item) => (
                          <div key={item.id} className="rounded border border-primary/15 bg-secondary/25 p-3 text-xs">
                            <div className="font-semibold text-foreground">
                              {item.action}
                            </div>
                            <div className="text-muted-foreground mt-1">
                              {item.entityType}:{item.entityRef}
                            </div>
                            <div className="text-muted-foreground mt-1">
                              {new Date(item.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="h-7 w-7 rounded border border-primary/40 bg-primary/10 text-primary font-display text-sm flex items-center justify-center">
                1
              </span>
              <h2 className="text-xl font-semibold">
                {text("Choose Level", "اختر المستوى")}
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {LEVEL_OPTIONS.map((level) => (
                <button
                  key={level.id}
                  onClick={() => {
                    setLevel(level.id);
                    setRole(null);
                    setScenario(null);
                  }}
                  className={`rounded border p-5 transition-all ${
                    state.level === level.id
                      ? "border-primary bg-primary/10 shadow-[0_0_16px_rgba(0,240,255,0.12)]"
                      : "border-primary/15 bg-secondary/25 hover:border-primary/40"
                  } ${isArabic ? "text-right" : "text-left"}`}
                >
                  <h3 className="text-lg font-semibold text-foreground">
                    {text(level.label.en, level.label.ar)}
                  </h3>
                  <p className="text-sm mt-2 text-muted-foreground leading-6">
                    {text(level.description.en, level.description.ar)}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {state.level && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <span className="h-7 w-7 rounded border border-primary/40 bg-primary/10 text-primary font-display text-sm flex items-center justify-center">
                  2
                </span>
                <h2 className="text-xl font-semibold">
                  {text("Choose Sector", "اختر القطاع")}
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {availableSectors.map((sector) => (
                  <button
                    key={sector.id}
                    onClick={() => {
                      setSector(sector.id);
                      setRole(null);
                      setScenario(null);
                    }}
                    className={`rounded border p-5 transition-all ${
                      state.sectorId === sector.id
                        ? "border-primary bg-primary/10 shadow-[0_0_16px_rgba(0,240,255,0.12)]"
                        : "border-primary/15 bg-secondary/25 hover:border-primary/40"
                    } ${isArabic ? "text-right" : "text-left"}`}
                  >
                    <h3 className="text-base font-semibold text-foreground">
                      {text(sector.label.en, sector.label.ar)}
                    </h3>
                    <p className="text-sm mt-2 text-muted-foreground leading-6">
                      {text(sector.description.en, sector.description.ar)}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {state.sectorId && (
            <>
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-7 w-7 rounded border border-primary/40 bg-primary/10 text-primary font-display text-sm flex items-center justify-center">
                    3
                  </span>
                  <h2 className="text-xl font-semibold">
                    {text("Choose Response Role", "اختر دور الاستجابة")}
                  </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {availableRoles.map((roleOption) => {
                    const RoleIcon = roleOption.icon;
                    return (
                      <button
                        key={roleOption.id}
                        onClick={() => setRole(roleOption.id)}
                        className={`rounded border p-5 transition-all ${
                          state.role === roleOption.id
                            ? "border-primary bg-primary/10 shadow-[0_0_16px_rgba(0,240,255,0.12)]"
                            : "border-primary/15 bg-secondary/25 hover:border-primary/40"
                        } ${isArabic ? "text-right" : "text-left"}`}
                      >
                        <RoleIcon className="w-6 h-6 text-primary mb-3" />
                        <h3 className="text-base font-semibold text-foreground">
                          {text(roleOption.title.en, roleOption.title.ar)}
                        </h3>
                        <p className="text-sm mt-2 text-muted-foreground leading-6">
                          {text(roleOption.description.en, roleOption.description.ar)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-7 w-7 rounded border border-primary/40 bg-primary/10 text-primary font-display text-sm flex items-center justify-center">
                    4
                  </span>
                  <h2 className="text-xl font-semibold">
                    {text("Choose Scenario", "اختر السيناريو")}
                  </h2>
                </div>

                {!state.role ? (
                  <div className="rounded border border-primary/15 bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
                    {text(
                      "Choose a response role first to load role-linked scenarios.",
                      "اختر دور الاستجابة أولا لتحميل السيناريوهات المرتبطة بالدور.",
                    )}
                  </div>
                ) : isLoadingScenarios ? (
                  <div className="rounded border border-primary/15 bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
                    {text("Loading scenario library...", "يتم تحميل مكتبة السيناريوهات...")}
                  </div>
                ) : isScenarioError ? (
                  <div className="rounded border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-muted-foreground">
                    {text(
                      "Scenario library is unavailable right now.",
                      "مكتبة السيناريوهات غير متاحة حاليا.",
                    )}
                  </div>
                ) : availableScenarios.length === 0 ? (
                  <div className="rounded border border-warning/30 bg-warning/5 p-6 text-center text-sm text-muted-foreground">
                    {text(
                      "No scenarios are currently mapped to this role within the selected sector. Add one in Admin or select another role.",
                      "لا توجد سيناريوهات مرتبطة بهذا الدور داخل القطاع المحدد حاليا. أضف سيناريو من صفحة الإدارة أو اختر دورا آخر.",
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {availableScenarios.map((scenario) => {
                      const localized = localizeScenarioSummary(scenario, isArabic);
                      return (
                        <button
                          key={scenario.id}
                          onClick={() => setScenario(scenario.id)}
                          className={`rounded border p-5 transition-all ${
                            state.scenarioId === scenario.id
                              ? "border-primary bg-primary/10 shadow-[0_0_16px_rgba(0,240,255,0.12)]"
                              : "border-primary/15 bg-secondary/25 hover:border-primary/40"
                          } ${isArabic ? "text-right" : "text-left"}`}
                        >
                          <h3 className="text-base font-semibold text-foreground">
                            {localized.title}
                          </h3>
                          <p className="text-sm mt-2 text-muted-foreground leading-6">
                            {localized.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-7 w-7 rounded border border-primary/40 bg-primary/10 text-primary font-display text-sm flex items-center justify-center">
                    5
                  </span>
                  <h2 className="text-xl font-semibold">
                    {text("Aligned Response Rules", "قواعد الاستجابة المرتبطة بالاختيار")}
                  </h2>
                </div>
                {!state.role ? (
                  <div className="rounded border border-primary/15 bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
                    {text(
                      "Choose a response role first to load role-aligned rules.",
                      "اختر دور الاستجابة أولا لتحميل القواعد المرتبطة بالدور.",
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {alignedRules.map((rule, index) => (
                      <div
                        key={`${state.sectorId ?? "none"}-${state.role ?? "none"}-rule-${index}`}
                        className="rounded border border-primary/15 bg-secondary/30 p-4 flex gap-3"
                      >
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground leading-6">
                          {text(rule.en, rule.ar)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between border-t border-primary/15 pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              {readyToStart
                ? text("Configuration complete. You can begin now.", "اكتمل الإعداد. يمكنك البدء الآن.")
                : text("Complete all selections to begin.", "أكمل جميع الاختيارات لبدء التمرين.")}
            </div>
            <CyberButton size="lg" onClick={handleStart} disabled={!readyToStart}>
              {state.level === "advanced"
                ? text("Begin Advanced AI Simulation", "ابدأ المحاكاة التفاعلية المتقدمة")
                : text("Begin Beginner Simulation", "ابدأ محاكاة المستوى المبتدئ")}
            </CyberButton>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
