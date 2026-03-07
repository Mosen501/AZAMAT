import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Layout } from "@/components/Layout";
import { CyberButton } from "@/components/CyberButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminAuditLogs,
  useAdminScenarios,
  useAdminSession,
  useAdminTrainingConfigs,
  useCreateScenario,
  useCreateTrainingConfig,
  useDemoReset,
  useExportAdminData,
  useImportAdminData,
  useRollbackScenario,
  useRollbackTrainingConfig,
  useScenarioVersions,
  useTrainingConfigVersions,
  useUpdateScenario,
  useUpdateTrainingConfig,
} from "@/hooks/use-api";
import { DEFAULT_SCORES, EMPTY_SCORE_DELTAS } from "@/lib/metric-config";
import { useLanguage } from "@/lib/language";
import { queryClient } from "@/lib/queryClient";
import { localizeScenario } from "@/lib/scenario-copy";
import type {
  AdminDataImport,
  AdminScenario,
  AdminTrainingConfig,
  LocalizedScenarioContent,
  Scenario,
  TrainingConfig,
} from "@shared/schema";
import { api } from "@shared/routes";
import { AlertCircle, Database, Download, History, KeyRound, RefreshCcw, Save, Shield, Undo2, Upload, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

type EditorMode = "create" | "update";

function createEmptyScenario(isArabic: boolean): Scenario {
  if (isArabic) {
    return {
      id: "new-scenario",
      title: "سيناريو جديد",
      description: "أدخل وصفا واقعيا لسيناريو أزمة مركب في المملكة.",
      metadata: {
        sectorId: "crowdEvents",
        roleIds: ["Regional Crisis Coordination Lead"],
      },
      startStepId: "step1",
      initialScores: { ...DEFAULT_SCORES },
      steps: {
        step1: {
          id: "step1",
          timeLabel: "T+0m",
          description: "الإشارة الافتتاحية للحادثة.",
          choices: [
            {
              id: "1a",
              text: "قرار أولي للاستجابة.",
              scoreDeltas: { ...EMPTY_SCORE_DELTAS },
              nextStepId: null,
            },
          ],
        },
      },
    };
  }

  return {
    id: "new-scenario",
    title: "New Scenario",
    description: "Describe a realistic multi-agency crisis scenario.",
    metadata: {
      sectorId: "crowdEvents",
      roleIds: ["Regional Crisis Coordination Lead"],
    },
    startStepId: "step1",
    initialScores: { ...DEFAULT_SCORES },
    steps: {
      step1: {
        id: "step1",
        timeLabel: "T+0m",
        description: "Opening signal for the incident.",
        choices: [
          {
            id: "1a",
            text: "Initial response decision.",
            scoreDeltas: { ...EMPTY_SCORE_DELTAS },
            nextStepId: null,
          },
        ],
      },
    },
  };
}

function createEmptyTrainingConfig(): TrainingConfig {
  return { sectors: [], roles: [], rules: [], scenarioLinks: [] };
}

function cloneScenario(source: Scenario): Scenario {
  return JSON.parse(JSON.stringify(source)) as Scenario;
}

function toLocalizedContent(source: Scenario): LocalizedScenarioContent {
  return {
    title: source.title,
    description: source.description,
    steps: Object.fromEntries(
      Object.entries(source.steps).map(([stepId, step]) => [
        stepId,
        {
          description: step.description,
          choices: Object.fromEntries(step.choices.map((choice) => [choice.id, choice.text])),
        },
      ]),
    ),
  };
}

function mergeArabicDraftWithBase(arabicDraft: Scenario, baseScenario: Scenario | null): Scenario {
  const base = baseScenario ? cloneScenario(baseScenario) : cloneScenario(arabicDraft);
  const mergedSteps = Object.fromEntries(
    Object.entries(arabicDraft.steps).map(([stepId, draftStep]) => {
      const baseStep = base.steps[stepId];
      return [
        stepId,
        {
          ...draftStep,
          description: baseStep?.description ?? draftStep.description,
          choices: draftStep.choices.map((draftChoice) => {
            const baseChoice = baseStep?.choices.find((choice) => choice.id === draftChoice.id);
            return {
              ...draftChoice,
              text: baseChoice?.text ?? draftChoice.text,
            };
          }),
        },
      ];
    }),
  );

  return {
    ...base,
    id: arabicDraft.id,
    startStepId: arabicDraft.startStepId,
    initialScores: arabicDraft.initialScores,
    steps: mergedSteps,
    translations: {
      ...(base.translations ?? {}),
      ar: toLocalizedContent(arabicDraft),
    },
  };
}

function mergeEnglishDraftWithBase(englishDraft: Scenario, baseScenario: Scenario | null): Scenario {
  const merged = cloneScenario(englishDraft);
  const preservedArabic = baseScenario?.translations?.ar;

  if (preservedArabic && !merged.translations?.ar) {
    merged.translations = {
      ...(merged.translations ?? {}),
      ar: preservedArabic,
    };
  }

  return merged;
}

function formatScenario(record: AdminScenario, isArabic: boolean): string {
  return JSON.stringify(localizeScenario(record.definition, isArabic), null, 2);
}

function formatTrainingConfig(record: AdminTrainingConfig): string {
  return JSON.stringify(record.definition, null, 2);
}

export default function Admin() {
  const { toast } = useToast();
  const { text, isArabic } = useLanguage();

  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [draftBaseScenario, setDraftBaseScenario] = useState<Scenario | null>(() => createEmptyScenario(false));
  const [draft, setDraft] = useState(() => JSON.stringify(createEmptyScenario(false), null, 2));
  const [scenarioIsActive, setScenarioIsActive] = useState(false);
  const [scenarioMode, setScenarioMode] = useState<EditorMode>("update");
  const [rollbackScenarioVersion, setRollbackScenarioVersion] = useState<number | null>(null);

  const [selectedTrainingConfigId, setSelectedTrainingConfigId] = useState<number | null>(null);
  const [trainingDraft, setTrainingDraft] = useState(() => JSON.stringify(createEmptyTrainingConfig(), null, 2));
  const [trainingIsActive, setTrainingIsActive] = useState(true);
  const [trainingMode, setTrainingMode] = useState<EditorMode>("update");
  const [rollbackTrainingVersion, setRollbackTrainingVersion] = useState<number | null>(null);

  const sessionQuery = useAdminSession(adminKey);
  const scenariosQuery = useAdminScenarios(adminKey);
  const trainingConfigsQuery = useAdminTrainingConfigs(adminKey);
  const scenarioVersionsQuery = useScenarioVersions(adminKey, selectedScenarioId || null);
  const trainingConfigVersionsQuery = useTrainingConfigVersions(adminKey, selectedTrainingConfigId);
  const auditLogsQuery = useAdminAuditLogs(adminKey, { limit: 20 });

  const createScenario = useCreateScenario(adminKey);
  const updateScenario = useUpdateScenario(adminKey);
  const rollbackScenario = useRollbackScenario(adminKey);
  const exportAdminData = useExportAdminData(adminKey);
  const importAdminData = useImportAdminData(adminKey);
  const demoReset = useDemoReset(adminKey);

  const createTrainingConfig = useCreateTrainingConfig(adminKey);
  const updateTrainingConfig = useUpdateTrainingConfig(adminKey);
  const rollbackTrainingConfig = useRollbackTrainingConfig(adminKey);

  const scenarios = scenariosQuery.data ?? [];
  const trainingConfigs = trainingConfigsQuery.data ?? [];
  const scenarioVersions = scenarioVersionsQuery.data ?? [];
  const trainingConfigVersions = trainingConfigVersionsQuery.data ?? [];
  const auditLogs = auditLogsQuery.data ?? [];

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.scenarioId === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId],
  );

  const selectedTrainingConfig = useMemo(
    () => trainingConfigs.find((config) => config.id === selectedTrainingConfigId) ?? null,
    [trainingConfigs, selectedTrainingConfigId],
  );

  const permissions = sessionQuery.data?.permissions ?? [];
  const canWriteScenario = permissions.includes("scenario:write");
  const canRollbackScenario = permissions.includes("scenario:rollback");
  const canWriteTraining = permissions.includes("training-config:write");
  const canRollbackTraining = permissions.includes("training-config:rollback");

  useEffect(() => {
    if (!adminKey || scenarios.length === 0 || scenarioMode === "create") {
      return;
    }

    const current = selectedScenarioId
      ? scenarios.find((scenario) => scenario.scenarioId === selectedScenarioId)
      : null;

    if (current) {
      return;
    }

    const preferred = scenarios.find((scenario) => scenario.isActive) ?? scenarios[0];
    setSelectedScenarioId(preferred.scenarioId);
    setDraftBaseScenario(preferred.definition);
    setDraft(formatScenario(preferred, isArabic));
    setScenarioIsActive(preferred.isActive);
    setScenarioMode("update");
  }, [adminKey, scenarios, selectedScenarioId, scenarioMode, isArabic]);

  useEffect(() => {
    if (!adminKey || trainingConfigs.length === 0 || trainingMode === "create") {
      return;
    }

    const current = selectedTrainingConfigId
      ? trainingConfigs.find((config) => config.id === selectedTrainingConfigId)
      : null;

    if (current) {
      return;
    }

    const preferred = trainingConfigs.find((config) => config.isActive) ?? trainingConfigs[0];
    setSelectedTrainingConfigId(preferred.id);
    setTrainingDraft(formatTrainingConfig(preferred));
    setTrainingIsActive(preferred.isActive);
    setTrainingMode("update");
  }, [adminKey, trainingConfigs, selectedTrainingConfigId, trainingMode]);

  const handleUnlock = () => {
    const normalized = adminKeyInput.trim().replace(/^['"]|['"]$/g, "");
    if (!normalized) {
      toast({
        title: text("Admin key required", "مفتاح الإدارة مطلوب"),
        description: text(
          "Enter the admin API key from server configuration.",
          "أدخل مفتاح واجهة الإدارة من إعدادات الخادم.",
        ),
        variant: "destructive",
      });
      return;
    }
    setAdminKey(normalized);
  };

  const handleLoadScenario = (scenarioId: string) => {
    const record = scenarios.find((scenario) => scenario.scenarioId === scenarioId);
    if (!record) {
      return;
    }
    setSelectedScenarioId(record.scenarioId);
    setDraftBaseScenario(record.definition);
    setDraft(formatScenario(record, isArabic));
    setScenarioIsActive(record.isActive);
    setScenarioMode("update");
    setRollbackScenarioVersion(null);
  };

  const handleNewScenarioDraft = () => {
    const source = selectedScenario?.definition ?? scenarios[0]?.definition ?? createEmptyScenario(false);
    const cloned = cloneScenario(source);
    cloned.id = `${cloned.id}-copy`;
    cloned.title = `${cloned.title} Copy`;
    setSelectedScenarioId("");
    setDraftBaseScenario(cloned);
    setDraft(JSON.stringify(localizeScenario(cloned, isArabic), null, 2));
    setScenarioIsActive(false);
    setScenarioMode("create");
  };

  const handleSaveScenario = async () => {
    if (!canWriteScenario) {
      toast({
        title: text("Permission denied", "صلاحية غير كافية"),
        description: text("This key cannot modify scenarios.", "هذا المفتاح لا يملك صلاحية تعديل السيناريوهات."),
        variant: "destructive",
      });
      return;
    }

    let parsedScenario: Scenario;
    try {
      parsedScenario = JSON.parse(draft) as Scenario;
    } catch {
      toast({
        title: text("Invalid JSON format", "تنسيق JSON غير صالح"),
        description: text("Scenario editor has invalid JSON.", "محرر السيناريو يحتوي على JSON غير صالح."),
        variant: "destructive",
      });
      return;
    }

    try {
      const normalizedScenario = isArabic
        ? mergeArabicDraftWithBase(parsedScenario, draftBaseScenario)
        : mergeEnglishDraftWithBase(parsedScenario, draftBaseScenario);

      const payload = { scenario: normalizedScenario, isActive: scenarioIsActive };
      const saved =
        scenarioMode === "create"
          ? await createScenario.mutateAsync(payload)
          : await updateScenario.mutateAsync({ scenarioId: selectedScenarioId, data: payload });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [api.admin.scenarios.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.scenarios.versions.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.audit.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.scenario.get.path] }),
      ]);

      setSelectedScenarioId(saved.scenarioId);
      setDraftBaseScenario(saved.definition);
      setDraft(formatScenario(saved, isArabic));
      setScenarioIsActive(saved.isActive);
      setScenarioMode("update");
      toast({
        title: scenarioMode === "create" ? text("Scenario created", "تم إنشاء السيناريو") : text("Scenario saved", "تم حفظ السيناريو"),
      });
    } catch (error) {
      toast({
        title: text("Save failed", "فشل الحفظ"),
        description: error instanceof Error ? error.message : text("Failed to save scenario.", "تعذر حفظ السيناريو."),
        variant: "destructive",
      });
    }
  };

  const handleRollbackScenario = async () => {
    if (!selectedScenarioId || !rollbackScenarioVersion) {
      return;
    }
    if (!canRollbackScenario) {
      toast({
        title: text("Permission denied", "صلاحية غير كافية"),
        description: text("This key cannot rollback scenarios.", "هذا المفتاح لا يملك صلاحية استرجاع السيناريوهات."),
        variant: "destructive",
      });
      return;
    }

    try {
      const rolledBack = await rollbackScenario.mutateAsync({
        scenarioId: selectedScenarioId,
        data: { targetVersion: rollbackScenarioVersion },
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [api.admin.scenarios.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.scenarios.versions.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.audit.list.path] }),
      ]);

      setDraftBaseScenario(rolledBack.definition);
      setDraft(formatScenario(rolledBack, isArabic));
      setScenarioIsActive(rolledBack.isActive);
      toast({ title: text("Scenario rolled back", "تم استرجاع السيناريو") });
    } catch (error) {
      toast({
        title: text("Rollback failed", "فشل الاسترجاع"),
        description: error instanceof Error ? error.message : text("Failed to rollback scenario.", "تعذر استرجاع السيناريو."),
        variant: "destructive",
      });
    }
  };

  const handleLoadTrainingConfig = (value: string) => {
    const configId = Number.parseInt(value, 10);
    if (!Number.isFinite(configId)) {
      return;
    }
    const config = trainingConfigs.find((item) => item.id === configId);
    if (!config) {
      return;
    }
    setSelectedTrainingConfigId(config.id);
    setTrainingDraft(formatTrainingConfig(config));
    setTrainingIsActive(config.isActive);
    setTrainingMode("update");
    setRollbackTrainingVersion(null);
  };

  const handleNewTrainingDraft = () => {
    const source = selectedTrainingConfig?.definition ?? trainingConfigs[0]?.definition ?? createEmptyTrainingConfig();
    setSelectedTrainingConfigId(null);
    setTrainingDraft(JSON.stringify(source, null, 2));
    setTrainingIsActive(true);
    setTrainingMode("create");
  };

  const handleSaveTrainingConfig = async () => {
    if (!canWriteTraining) {
      toast({
        title: text("Permission denied", "صلاحية غير كافية"),
        description: text("This key cannot modify training configs.", "هذا المفتاح لا يملك صلاحية تعديل إعدادات التدريب."),
        variant: "destructive",
      });
      return;
    }

    let parsedConfig: TrainingConfig;
    try {
      parsedConfig = JSON.parse(trainingDraft) as TrainingConfig;
    } catch {
      toast({
        title: text("Invalid JSON format", "تنسيق JSON غير صالح"),
        description: text("Training config editor has invalid JSON.", "محرر إعدادات التدريب يحتوي على JSON غير صالح."),
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = { config: parsedConfig, isActive: trainingIsActive };
      const saved =
        trainingMode === "create"
          ? await createTrainingConfig.mutateAsync(payload)
          : await updateTrainingConfig.mutateAsync({
              configId: selectedTrainingConfigId as number,
              data: payload,
            });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [api.admin.trainingConfigs.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.trainingConfigs.versions.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.audit.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.training.config.path] }),
      ]);

      setSelectedTrainingConfigId(saved.id);
      setTrainingDraft(formatTrainingConfig(saved));
      setTrainingIsActive(saved.isActive);
      setTrainingMode("update");
      toast({
        title:
          trainingMode === "create"
            ? text("Training config created", "تم إنشاء إعدادات التدريب")
            : text("Training config saved", "تم حفظ إعدادات التدريب"),
      });
    } catch (error) {
      toast({
        title: text("Save failed", "فشل الحفظ"),
        description:
          error instanceof Error
            ? error.message
            : text("Failed to save training configuration.", "تعذر حفظ إعدادات التدريب."),
        variant: "destructive",
      });
    }
  };

  const handleRollbackTrainingConfig = async () => {
    if (!selectedTrainingConfigId || !rollbackTrainingVersion) {
      return;
    }
    if (!canRollbackTraining) {
      toast({
        title: text("Permission denied", "صلاحية غير كافية"),
        description: text("This key cannot rollback training configs.", "هذا المفتاح لا يملك صلاحية استرجاع إعدادات التدريب."),
        variant: "destructive",
      });
      return;
    }

    try {
      const rolledBack = await rollbackTrainingConfig.mutateAsync({
        configId: selectedTrainingConfigId,
        data: { targetVersion: rollbackTrainingVersion },
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [api.admin.trainingConfigs.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.trainingConfigs.versions.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.audit.list.path] }),
      ]);

      setTrainingDraft(formatTrainingConfig(rolledBack));
      setTrainingIsActive(rolledBack.isActive);
      toast({ title: text("Training config rolled back", "تم استرجاع إعدادات التدريب") });
    } catch (error) {
      toast({
        title: text("Rollback failed", "فشل الاسترجاع"),
        description:
          error instanceof Error
            ? error.message
            : text("Failed to rollback training configuration.", "تعذر استرجاع إعدادات التدريب."),
        variant: "destructive",
      });
    }
  };

  const handleExportData = async () => {
    try {
      const payload = await exportAdminData.mutateAsync();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `crisisim-admin-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      toast({ title: text("Export complete", "اكتمل التصدير") });
    } catch (error) {
      toast({
        title: text("Export failed", "فشل التصدير"),
        description: error instanceof Error ? error.message : text("Failed to export data.", "تعذر تصدير البيانات."),
        variant: "destructive",
      });
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as {
        scenarios?: Array<{ definition: Scenario; isActive?: boolean }>;
        trainingConfigs?: Array<{ definition: TrainingConfig; isActive?: boolean }>;
      };

      const payload: AdminDataImport = {
        mode: "merge",
        scenarios: (parsed.scenarios ?? []).map((item) => ({
          scenario: item.definition,
          isActive: item.isActive ?? false,
        })),
        trainingConfigs: (parsed.trainingConfigs ?? []).map((item) => ({
          config: item.definition,
          isActive: item.isActive ?? false,
        })),
      };

      const result = await importAdminData.mutateAsync(payload);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [api.admin.scenarios.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.trainingConfigs.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.audit.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.activity.recent.path] }),
      ]);

      toast({
        title: text("Import complete", "اكتمل الاستيراد"),
        description: text(
          `Imported ${result.importedScenarios} scenarios and ${result.importedTrainingConfigs} training configs.`,
          `تم استيراد ${result.importedScenarios} سيناريو و${result.importedTrainingConfigs} إعداد تدريب.`,
        ),
      });
    } catch (error) {
      toast({
        title: text("Import failed", "فشل الاستيراد"),
        description: error instanceof Error ? error.message : text("Failed to import data.", "تعذر استيراد البيانات."),
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleDemoReset = async () => {
    const confirmed = window.confirm(
      text(
        "Reset all scenarios and training configs to the built-in demo defaults?",
        "هل تريد إعادة ضبط جميع السيناريوهات وإعدادات التدريب إلى بيانات العرض الافتراضية؟",
      ),
    );
    if (!confirmed) {
      return;
    }

    try {
      await demoReset.mutateAsync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [api.admin.scenarios.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.trainingConfigs.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.scenarios.versions.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.trainingConfigs.versions.path] }),
        queryClient.invalidateQueries({ queryKey: [api.admin.audit.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.scenario.list.path] }),
        queryClient.invalidateQueries({ queryKey: [api.training.config.path] }),
        queryClient.invalidateQueries({ queryKey: [api.activity.recent.path] }),
      ]);
      toast({ title: text("Demo reset complete", "اكتملت إعادة ضبط العرض") });
    } catch (error) {
      toast({
        title: text("Demo reset failed", "فشلت إعادة الضبط"),
        description: error instanceof Error ? error.message : text("Failed to reset demo data.", "تعذر إعادة ضبط بيانات العرض."),
        variant: "destructive",
      });
    }
  };

  return (
    <Layout className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wider text-glow">
              {text("Admin Control", "لوحة الإدارة")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {text(
                "RBAC-protected scenario and training configuration management.",
                "إدارة السيناريوهات والإعدادات بصلاحيات RBAC.",
              )}
            </p>
          </div>
        </div>

        <div className="flex w-full max-w-xl gap-3">
          <div className="relative flex-1">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              value={adminKeyInput}
              onChange={(event) => setAdminKeyInput(event.target.value)}
              placeholder={text("Enter admin API key", "أدخل مفتاح واجهة الإدارة")}
              className="pl-9"
            />
          </div>
          <CyberButton onClick={handleUnlock}>{text("Unlock", "فتح")}</CyberButton>
        </div>
      </div>

      {!adminKey ? (
        <div className="glass-panel p-8 text-center text-muted-foreground">
          {text("Enter admin key to load protected endpoints.", "أدخل مفتاح الإدارة لتحميل الواجهات المحمية.")}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="glass-panel flex flex-wrap items-center gap-3 p-4 text-sm">
            <Shield className="h-4 w-4 text-primary" />
            {sessionQuery.isLoading ? (
              <span>{text("Verifying key...", "جار التحقق من المفتاح...")}</span>
            ) : sessionQuery.isError ? (
              <span className="text-destructive">
                {(sessionQuery.error as Error)?.message ?? text("Invalid key", "مفتاح غير صالح")}
              </span>
            ) : (
              <>
                <span>
                  {text("Role:", "الدور:")}{" "}
                  <strong>{sessionQuery.data?.role ?? "-"}</strong>
                </span>
                <span>
                  {text("Identity:", "الهوية:")}{" "}
                  <strong>{sessionQuery.data?.label ?? "-"}</strong>
                </span>
                <span className="text-muted-foreground">
                  {text("Permissions:", "الصلاحيات:")} {permissions.join(", ")}
                </span>
              </>
            )}
          </div>

          <div className="glass-panel flex flex-wrap items-center gap-3 p-4">
            <input
              ref={importFileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => void handleImportFile(event)}
            />
            <CyberButton
              variant="secondary"
              onClick={() => void handleExportData()}
              disabled={exportAdminData.isPending}
            >
              <Download className="h-4 w-4" />
              {exportAdminData.isPending
                ? text("Exporting...", "جار التصدير...")
                : text("Export JSON", "تصدير JSON")}
            </CyberButton>
            <CyberButton
              variant="secondary"
              onClick={() => importFileRef.current?.click()}
              disabled={importAdminData.isPending}
            >
              <Upload className="h-4 w-4" />
              {importAdminData.isPending
                ? text("Importing...", "جار الاستيراد...")
                : text("Import JSON", "استيراد JSON")}
            </CyberButton>
            <CyberButton
              variant="secondary"
              onClick={() => void handleDemoReset()}
              disabled={demoReset.isPending}
            >
              <RotateCcw className="h-4 w-4" />
              {demoReset.isPending
                ? text("Resetting...", "جار إعادة الضبط...")
                : text("Demo Reset", "إعادة ضبط العرض")}
            </CyberButton>
            <span className="text-xs text-muted-foreground">
              {text(
                "Import uses merge mode and preserves existing records.",
                "الاستيراد يستخدم وضع الدمج ويحافظ على السجلات الحالية.",
              )}
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="glass-panel space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                  {text("Stored Scenarios", "السيناريوهات المخزنة")}
                </h2>
                <button
                  type="button"
                  onClick={() => void scenariosQuery.refetch()}
                  className="rounded border border-primary/30 p-2 text-primary transition-colors hover:bg-primary/10"
                  aria-label={text("Refresh scenarios", "تحديث السيناريوهات")}
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>

              {scenariosQuery.isLoading ? (
                <div className="text-sm text-primary/70">{text("Loading...", "جار التحميل...")}</div>
              ) : scenariosQuery.isError ? (
                <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <div className="mb-1 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {text("Access failed", "فشل الوصول")}
                  </div>
                  {(scenariosQuery.error as Error)?.message}
                </div>
              ) : (
                <>
                  <select
                    value={selectedScenarioId}
                    onChange={(event) => handleLoadScenario(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    dir={isArabic ? "rtl" : "ltr"}
                  >
                    {scenarios.map((scenario) => (
                      <option key={scenario.scenarioId} value={scenario.scenarioId}>
                        {scenario.isActive ? `${text("[Active]", "[نشط]")} ` : ""}
                        {localizeScenario(scenario.definition, isArabic).title}
                      </option>
                    ))}
                  </select>

                  <div className="max-h-[300px] space-y-2 overflow-auto">
                    {scenarios.map((scenario) => (
                      <div
                        key={scenario.scenarioId}
                        className={`rounded border p-3 text-xs ${
                          scenario.scenarioId === selectedScenarioId ? "border-primary/40 bg-primary/5" : "border-border/50"
                        }`}
                      >
                        <div className="font-medium">
                          {localizeScenario(scenario.definition, isArabic).title}
                        </div>
                        <div className="text-muted-foreground">{scenario.scenarioId}</div>
                        <div className="mt-1 text-muted-foreground">
                          {text("v", "إصدار ")}
                          {scenario.version} | {scenario.updatedBy}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 rounded border border-border/60 p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                      <History className="h-3.5 w-3.5" />
                      {text("Scenario History", "سجل السيناريو")}
                    </div>
                    <select
                      value={rollbackScenarioVersion ?? ""}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        setRollbackScenarioVersion(Number.isFinite(parsed) ? parsed : null);
                      }}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">{text("Select version to rollback", "اختر إصدارا للاسترجاع")}</option>
                      {scenarioVersions.map((versionItem) => (
                        <option key={versionItem.id} value={versionItem.version}>
                          v{versionItem.version} - {versionItem.changeType} - {versionItem.actorLabel}
                        </option>
                      ))}
                    </select>
                    <CyberButton
                      variant="secondary"
                      onClick={() => void handleRollbackScenario()}
                      disabled={!canRollbackScenario || !rollbackScenarioVersion || rollbackScenario.isPending}
                    >
                      <Undo2 className="h-4 w-4" />
                      {rollbackScenario.isPending
                        ? text("Rolling back...", "جار الاسترجاع...")
                        : text("Rollback Scenario", "استرجاع السيناريو")}
                    </CyberButton>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-6">
              <div className="glass-panel space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                      {text("Scenario JSON Editor", "محرر JSON للسيناريو")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {scenarioMode === "create"
                        ? text("Create a new stored scenario.", "إنشاء سيناريو مخزن جديد.")
                        : text("Edit the selected stored scenario.", "تعديل السيناريو المخزن المحدد.")}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={scenarioIsActive}
                      onChange={(event) => setScenarioIsActive(event.target.checked)}
                      className="h-4 w-4"
                    />
                    {text("Set active on save", "تعيين كنشط عند الحفظ")}
                  </label>
                </div>

                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  spellCheck={false}
                  className="min-h-[420px] font-mono text-sm leading-6"
                />

                <div className="flex flex-wrap justify-end gap-3">
                  <CyberButton variant="secondary" onClick={handleNewScenarioDraft}>
                    {text("New Draft", "مسودة جديدة")}
                  </CyberButton>
                  <CyberButton
                    onClick={() => void handleSaveScenario()}
                    disabled={!canWriteScenario || createScenario.isPending || updateScenario.isPending}
                  >
                    <Save className="h-4 w-4" />
                    {createScenario.isPending || updateScenario.isPending
                      ? text("Saving...", "جار الحفظ...")
                      : scenarioMode === "create"
                        ? text("Create Scenario", "إنشاء السيناريو")
                        : text("Save Scenario", "حفظ السيناريو")}
                  </CyberButton>
                </div>
              </div>

              <div className="glass-panel space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                      {text("Training Config JSON Editor", "محرر JSON لإعدادات التدريب")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {text(
                        "Edit sectors, roles, rules, and scenario links.",
                        "تعديل القطاعات والأدوار والقواعد وروابط السيناريوهات.",
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void trainingConfigsQuery.refetch()}
                    className="rounded border border-primary/30 p-2 text-primary transition-colors hover:bg-primary/10"
                    aria-label={text("Refresh training configs", "تحديث إعدادات التدريب")}
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                </div>

                {trainingConfigsQuery.isError ? (
                  <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {(trainingConfigsQuery.error as Error)?.message}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                      <select
                        value={selectedTrainingConfigId ?? ""}
                        onChange={(event) => handleLoadTrainingConfig(event.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {trainingConfigs.map((config) => (
                          <option key={config.id} value={config.id}>
                            {config.isActive ? `${text("[Active]", "[نشط]")} ` : ""}#{config.id} v{config.version}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={trainingIsActive}
                          onChange={(event) => setTrainingIsActive(event.target.checked)}
                          className="h-4 w-4"
                        />
                        {text("Set active on save", "تعيين كنشط عند الحفظ")}
                      </label>
                      <CyberButton variant="secondary" onClick={handleNewTrainingDraft}>
                        {text("New Draft", "مسودة جديدة")}
                      </CyberButton>
                    </div>

                    <div className="space-y-2 rounded border border-border/60 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                        <History className="h-3.5 w-3.5" />
                        {text("Config History", "سجل الإعدادات")}
                      </div>
                      <select
                        value={rollbackTrainingVersion ?? ""}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          setRollbackTrainingVersion(Number.isFinite(parsed) ? parsed : null);
                        }}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="">{text("Select version to rollback", "اختر إصدارا للاسترجاع")}</option>
                        {trainingConfigVersions.map((versionItem) => (
                          <option key={versionItem.id} value={versionItem.version}>
                            v{versionItem.version} - {versionItem.changeType} - {versionItem.actorLabel}
                          </option>
                        ))}
                      </select>
                      <CyberButton
                        variant="secondary"
                        onClick={() => void handleRollbackTrainingConfig()}
                        disabled={!canRollbackTraining || !rollbackTrainingVersion || rollbackTrainingConfig.isPending}
                      >
                        <Undo2 className="h-4 w-4" />
                        {rollbackTrainingConfig.isPending
                          ? text("Rolling back...", "جار الاسترجاع...")
                          : text("Rollback Config", "استرجاع الإعدادات")}
                      </CyberButton>
                    </div>

                    <Textarea
                      value={trainingDraft}
                      onChange={(event) => setTrainingDraft(event.target.value)}
                      spellCheck={false}
                      className="min-h-[300px] font-mono text-sm leading-6"
                    />

                    <div className="flex justify-end">
                      <CyberButton
                        onClick={() => void handleSaveTrainingConfig()}
                        disabled={
                          !canWriteTraining ||
                          createTrainingConfig.isPending ||
                          updateTrainingConfig.isPending ||
                          (trainingMode === "update" && !selectedTrainingConfigId)
                        }
                      >
                        <Save className="h-4 w-4" />
                        {createTrainingConfig.isPending || updateTrainingConfig.isPending
                          ? text("Saving...", "جار الحفظ...")
                          : trainingMode === "create"
                            ? text("Create Training Config", "إنشاء إعدادات التدريب")
                            : text("Save Training Config", "حفظ إعدادات التدريب")}
                      </CyberButton>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="glass-panel p-5">
            <h2 className="mb-3 font-display text-xs uppercase tracking-widest text-muted-foreground">
              {text("Recent Audit Log", "سجل التدقيق الأخير")}
            </h2>
            {auditLogsQuery.isLoading ? (
              <div className="text-sm text-primary/70">{text("Loading...", "جار التحميل...")}</div>
            ) : auditLogsQuery.isError ? (
              <div className="text-sm text-destructive">{(auditLogsQuery.error as Error)?.message}</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-sm text-muted-foreground">{text("No audit events yet.", "لا توجد أحداث تدقيق حتى الآن.")}</div>
            ) : (
              <div className="max-h-[260px] space-y-2 overflow-auto text-xs">
                {auditLogs.map((log) => (
                  <div key={log.id} className="rounded border border-border/60 p-3">
                    <div className="font-medium">
                      {log.action} · {log.entityType}:{log.entityRef}
                    </div>
                    <div className="text-muted-foreground">
                      {log.actorLabel} ({log.actorRole}) · {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </Layout>
  );
}
