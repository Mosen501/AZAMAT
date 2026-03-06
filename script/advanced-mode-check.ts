import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import { setTimeout as delay } from "timers/promises";

type JsonRecord = Record<string, unknown>;
type MockMode =
  | "valid"
  | "invalid_then_repair"
  | "always_invalid"
  | "upstream_error"
  | "reject_response_format";

interface AdvancedResponse {
  assistantMessage: string;
  scoreDeltas: Record<string, number>;
  updatedScores: Record<string, number>;
  impactReason: string;
  source: "ai" | "local_recovery" | "local_fallback";
  failureCode?: "upstream_unavailable" | "invalid_model_json" | "policy_reprompt_needed";
}

interface DebriefResponse {
  summary: string[];
  wentWell: string[];
  toImprove: string[];
  missedSignals: string[];
  checklist: string[];
}

interface RequestResult<T> {
  status: number;
  data: T;
  text: string;
}

const host = "127.0.0.1";
const appPort = Number.parseInt(process.env.ADV_APP_PORT ?? "5071", 10);
const mockPort = Number.parseInt(process.env.ADV_MOCK_PORT ?? "5072", 10);
const baseUrl = `http://${host}:${appPort}`;
const advancedPath = "/api/advanced/chat";
const debriefPath = "/api/debrief";
const onlyStress = process.env.ADV_ONLY_STRESS === "1";
const skipStress = process.env.ADV_SKIP_STRESS === "1";
const verbose = process.env.ADV_TEST_VERBOSE === "1";

const stressDurationSeconds = Number.parseInt(process.env.ADV_STRESS_DURATION_SECONDS ?? "12", 10);
const stressConcurrency = Number.parseInt(process.env.ADV_STRESS_CONCURRENCY ?? "24", 10);
const mockLatencyMs = Number.parseInt(process.env.ADV_MOCK_LATENCY_MS ?? "280", 10);
const stressMode = (process.env.ADV_STRESS_MODE as MockMode | undefined) ?? "valid";

let currentMockMode: MockMode = "valid";

const rules = [
  "Escalate early when density is rising.",
  "Issue one multilingual advisory channel.",
  "Track one KPI target at every checkpoint.",
];

const defaultScores = {
  operationalControl: 50,
  responseTempo: 50,
  stakeholderTrust: 50,
  teamAlignment: 50,
  executiveComms: 50,
};

const directivePool = [
  "Regional command lead will deploy two cooling teams within 10 minutes, checkpoint at T+15m, KPI: average wait time under 8 minutes.",
  "Operations cell assigns transport agency to open alternate routes in 7 minutes, checkpoint at T+12m, KPI: crowd density below threshold 4.",
  "Health surge lead dispatches 3 triage units now, checkpoint in 15 minutes, KPI: ambulance turnaround below 12 minutes.",
  "Comms lead publishes one bilingual advisory in 5 minutes, checkpoint at T+10m, KPI: rumor correction rate above 90%.",
];

const wrappedArabicDirective = `المطلوب في الخطوة التالية

وجّه مسؤول التكامل التقني بوزارة الصحة لربط نظام حجز الحافلات بلوحة غرفة العمليات خلال 45 دقيقة، مع إلزام جميع المشغلين (كبار وصغار) بالتسجيل، وKPI: رفع نسبة الحافلات المبلغ عن وصولها مسبقا إلى 85% خلال الساعتين القادمتين.

• تم تحديد الجهة المسؤولة
• تم تحديد الإجراء
• تم تحديد التوقيت
• تم تحديد مؤشر الأداء`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function log(message: string): void {
  console.log(`[advanced-test] ${message}`);
}

function appArgs(): string[] {
  return ["server/index.ts"];
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function buildOpenAIEnvelope(content: string): JsonRecord {
  return {
    id: "chatcmpl-mock",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-5.1",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
        },
        finish_reason: "stop",
      },
    ],
  };
}

function buildAdvancedPayload(): JsonRecord {
  return {
    update:
      "Crowd density stabilized at two corridors after partial rerouting, but peripheral lanes remain near warning thresholds.",
    assessment:
      "Your directive improved command focus, but coordination load increased and needs tighter checkpoint ownership.",
    question:
      "State the command now: who owns execution, what exact action starts within 10 minutes, when the next checkpoint is, and which KPI target must be reached by then?",
    impactReason:
      "Operational control improved from clearer ownership while stakeholder trust dipped slightly due to slower public signal updates.",
    scoreDeltas: {
      operationalControl: 4,
      responseTempo: 2,
      stakeholderTrust: -2,
      teamAlignment: 3,
      executiveComms: 1,
    },
  };
}

function buildDebriefPayload(): DebriefResponse {
  return {
    summary: [
      "Decision cadence was stable and linked to explicit checkpoints.",
      "Operational control ended above baseline with manageable tradeoffs.",
      "Public-trust effects were mixed and should be addressed earlier next run.",
    ],
    wentWell: [
      "Commands included ownership and timing in most turns.",
      "Cross-agency alignment improved after clear role assignment.",
      "Metrics were monitored as part of command execution.",
    ],
    toImprove: [
      "Public communication should be synchronized sooner.",
      "Use one shared KPI dashboard before the second turn.",
      "Reduce yes/no replies by forcing executable directives.",
    ],
    missedSignals: [
      "Early public-trust dip was not countered with immediate messaging.",
      "Coordination burden increased before support allocation was adjusted.",
    ],
    checklist: [
      "Name an incident owner and deputy.",
      "Set one command cadence for all agencies.",
      "Tie each directive to one measurable KPI.",
      "Run a checkpoint every 10-15 minutes.",
      "Issue one verified public channel.",
      "Separate confirmed facts from assumptions.",
      "Escalate surge requests before visible strain.",
      "Document tradeoffs after each turn.",
      "Protect vulnerable populations first.",
      "Capture unresolved actions before closure.",
      "Run an after-action review within 48 hours.",
      "Track funded resilience follow-ups.",
    ],
  };
}

function parsePrompt(payload: JsonRecord): string {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  return messages
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return "";
      }
      const content = (entry as JsonRecord).content;
      return typeof content === "string" ? content : "";
    })
    .join("\n");
}

function looksLikeDebriefPrompt(prompt: string): boolean {
  return (
    prompt.includes("After-Action Report") ||
    prompt.includes("Generate an After-Action Report") ||
    prompt.includes("تقرير ما بعد الحدث")
  );
}

function isRepairPrompt(prompt: string): boolean {
  return prompt.includes("FORMAT CORRECTION") || prompt.includes("تصحيح التنسيق");
}

async function startMockServer(port: number): Promise<Server> {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") {
      writeJson(res, 404, { error: "not_found" });
      return;
    }

    const path = req.url?.split("?")[0] ?? "";
    if (path !== "/chat/completions" && path !== "/v1/chat/completions") {
      writeJson(res, 404, { error: "not_found" });
      return;
    }

    if (currentMockMode === "upstream_error") {
      writeJson(res, 503, { error: { message: "mock upstream unavailable" } });
      return;
    }

    const rawBody = await readBody(req);
    let payload: JsonRecord = {};
    try {
      payload = rawBody ? (JSON.parse(rawBody) as JsonRecord) : {};
    } catch {
      writeJson(res, 400, { error: { message: "invalid json" } });
      return;
    }

    const prompt = parsePrompt(payload);
    const debriefRequest = looksLikeDebriefPrompt(prompt);
    const repairAttempt = isRepairPrompt(prompt);
    const hasResponseFormat = typeof payload.response_format === "object" && payload.response_format !== null;

    if (currentMockMode === "reject_response_format" && hasResponseFormat) {
      writeJson(res, 400, {
        error: {
          message: "'messages' must contain the word 'json' in some form, to use 'response_format' of type 'json_object'.",
        },
      });
      return;
    }

    if (currentMockMode === "always_invalid") {
      if (mockLatencyMs > 0) {
        await delay(mockLatencyMs);
      }
      writeJson(res, 200, buildOpenAIEnvelope("This is not valid JSON and should trigger local recovery."));
      return;
    }

    if (currentMockMode === "invalid_then_repair" && !repairAttempt) {
      if (mockLatencyMs > 0) {
        await delay(mockLatencyMs);
      }
      writeJson(res, 200, buildOpenAIEnvelope("{ invalid-json"));
      return;
    }

    if (debriefRequest) {
      if (mockLatencyMs > 0) {
        await delay(mockLatencyMs);
      }
      writeJson(res, 200, buildOpenAIEnvelope(JSON.stringify(buildDebriefPayload())));
      return;
    }

    if (mockLatencyMs > 0) {
      await delay(mockLatencyMs);
    }
    writeJson(res, 200, buildOpenAIEnvelope(JSON.stringify(buildAdvancedPayload())));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return server;
}

function attachProcessLogs(processHandle: ChildProcessWithoutNullStreams): void {
  processHandle.stdout.on("data", (chunk) => {
    if (verbose) {
      process.stdout.write(`[app] ${chunk.toString()}`);
    }
  });
  processHandle.stderr.on("data", (chunk) => {
    if (verbose) {
      process.stderr.write(`[app:err] ${chunk.toString()}`);
    }
  });
}

async function waitForServerReady(timeoutMs = 25_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.status === 200) {
        return;
      }
    } catch {
      // Keep retrying until timeout.
    }
    await delay(250);
  }
  throw new Error("App server did not become ready within timeout.");
}

async function startAppServer(): Promise<ChildProcessWithoutNullStreams> {
  const app = spawn(`${process.cwd()}/node_modules/.bin/tsx`, appArgs(), {
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(appPort),
      AI_INTEGRATIONS_OPENAI_BASE_URL: `http://${host}:${mockPort}/v1`,
      AI_INTEGRATIONS_OPENAI_API_KEY: "test-key",
      RATE_LIMIT_AI_MAX: "1000000",
      RATE_LIMIT_GLOBAL_MAX: "1000000",
      RATE_LIMIT_ADMIN_MAX: "3000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  attachProcessLogs(app);

  app.once("exit", (code, signal) => {
    if (code !== 0 && code !== 143 && signal !== "SIGTERM") {
      console.error(`[advanced-test] App process exited unexpectedly (code=${code}, signal=${signal})`);
    }
  });

  await waitForServerReady();
  return app;
}

async function stopAppServer(app: ChildProcessWithoutNullStreams): Promise<void> {
  if (app.killed) {
    return;
  }
  app.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => {
      app.once("exit", () => resolve());
    }),
    delay(6_000).then(() => {
      if (!app.killed) {
        app.kill("SIGKILL");
      }
    }),
  ]);
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  expectedStatus = 200,
): Promise<RequestResult<T>> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  if (res.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus} for ${path}, got ${res.status}: ${text}`);
  }
  const data = (text ? JSON.parse(text) : null) as T;
  return { status: res.status, data, text };
}

async function loadScenarioId(): Promise<string> {
  const response = await requestJson<Array<{ id: string }>>("/api/scenarios");
  assert(response.data.length > 0, "No scenarios returned from /api/scenarios");
  return response.data[0].id;
}

function buildAdvancedBody(
  scenarioId: string,
  userContent: string,
  language: "en" | "ar" = "en",
): JsonRecord {
  return {
    scenarioId,
    language,
    sectorId: "crowdEvents",
    role: "Regional Crisis Coordination Lead",
    currentScores: defaultScores,
    responseRules: rules,
    history: [
      { role: "assistant", content: "Advanced simulation is live. Issue your first directive." },
      { role: "user", content: userContent },
    ],
  };
}

function buildDebriefBody(scenarioId: string): JsonRecord {
  return {
    scenarioId,
    language: "en",
    role: "Regional Crisis Coordination Lead",
    history: [
      {
        stepId: "advanced-turn-1",
        choiceId: "directive-1",
        timestamp: Date.now(),
        scoresAfter: {
          operationalControl: 57,
          responseTempo: 52,
          stakeholderTrust: 48,
          teamAlignment: 55,
          executiveComms: 51,
        },
      },
    ],
    chatHistory: [
      { role: "assistant", content: "Issue your directive." },
      { role: "user", content: directivePool[0] },
    ],
  };
}

async function runFunctionalChecks(scenarioId: string): Promise<void> {
  log("Running functional checks for Advanced mode");

  currentMockMode = "valid";
  const detailed = await requestJson<AdvancedResponse>(
    advancedPath,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildAdvancedBody(scenarioId, directivePool[0])),
    },
  );
  assert(detailed.data.source === "ai", "Expected AI source for valid advanced request");
  assert(detailed.data.assistantMessage.includes("Update:"), "Expected normalized Update section");
  assert(detailed.data.assistantMessage.includes("Question:"), "Expected normalized Question section");

  currentMockMode = "invalid_then_repair";
  const repaired = await requestJson<AdvancedResponse>(
    advancedPath,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildAdvancedBody(scenarioId, directivePool[1])),
    },
  );
  assert(repaired.data.source === "ai", "Expected AI source after repair retry");

  currentMockMode = "valid";
  const binary = await requestJson<AdvancedResponse>(
    advancedPath,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildAdvancedBody(scenarioId, "yes")),
    },
  );
  assert(binary.data.source === "local_recovery", "Expected local recovery for binary yes/no reply");
  assert(binary.data.failureCode === "policy_reprompt_needed", "Expected policy_reprompt_needed failureCode");

  currentMockMode = "always_invalid";
  const invalid = await requestJson<AdvancedResponse>(
    advancedPath,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildAdvancedBody(scenarioId, directivePool[2])),
    },
  );
  assert(invalid.data.source === "local_recovery", "Expected local recovery for invalid model JSON");
  assert(invalid.data.failureCode === "invalid_model_json", "Expected invalid_model_json failure code");

  currentMockMode = "upstream_error";
  const fallback = await requestJson<AdvancedResponse>(
    advancedPath,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildAdvancedBody(scenarioId, directivePool[3])),
    },
  );
  assert(fallback.data.source === "local_fallback", "Expected local fallback on upstream error");
  assert(fallback.data.failureCode === "upstream_unavailable", "Expected upstream_unavailable code");
  assert(
    fallback.data.scoreDeltas.responseTempo >= 0,
    "Detailed directive should not receive negative response-tempo delta in upstream fallback mode",
  );
  assert(
    !fallback.data.assistantMessage.includes("State the command now:"),
    "Detailed directive should continue scenario flow instead of forcing the generic command reprompt",
  );

  currentMockMode = "reject_response_format";
  const compatibilityRecovered = await requestJson<AdvancedResponse>(
    advancedPath,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildAdvancedBody(scenarioId, directivePool[0])),
    },
  );
  assert(
    compatibilityRecovered.data.source === "ai",
    "When response_format is rejected upstream, compatibility retry should still return AI source",
  );

  currentMockMode = "upstream_error";
  const wrappedFallback = await requestJson<AdvancedResponse>(
    advancedPath,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildAdvancedBody(scenarioId, wrappedArabicDirective, "ar")),
    },
  );
  assert(
    wrappedFallback.data.scoreDeltas.responseTempo >= 0,
    "Wrapped Arabic directive should not be penalized as missing execution detail in fallback",
  );
  assert(
    !wrappedFallback.data.assistantMessage.includes("حدّد الآن أمرا تنفيذيا واضحا"),
    "Wrapped Arabic directive should continue flow instead of resetting to generic command prompt",
  );

  currentMockMode = "valid";
  const debrief = await requestJson<DebriefResponse>(
    debriefPath,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildDebriefBody(scenarioId)),
    },
  );
  assert(Array.isArray(debrief.data.summary), "Expected debrief summary array");
  assert(debrief.data.checklist.length >= 10, "Expected checklist length >= 10");

  currentMockMode = "upstream_error";
  const debriefFallback = await requestJson<DebriefResponse>(
    debriefPath,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildDebriefBody(scenarioId)),
    },
  );
  assert(Array.isArray(debriefFallback.data.summary), "Expected fallback debrief summary");
  assert(debriefFallback.data.summary.length > 0, "Expected fallback summary content");
  assert(
    debriefFallback.data.checklist.length >= 10 && debriefFallback.data.checklist.length <= 15,
    "Fallback checklist should contain 10-15 items",
  );

  log("Functional checks passed");
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[index];
}

function buildStressBody(scenarioId: string, iteration: number): JsonRecord {
  const directive = directivePool[iteration % directivePool.length];
  return buildAdvancedBody(scenarioId, directive);
}

async function runStressCheck(scenarioId: string): Promise<void> {
  log(`Running stress check: ${stressDurationSeconds}s at concurrency ${stressConcurrency} in mode ${stressMode}`);
  currentMockMode = stressMode;

  const endAt = Date.now() + stressDurationSeconds * 1000;
  const latencies: number[] = [];
  const statusCounts = new Map<number, number>();
  const sourceCounts = new Map<string, number>();
  let total = 0;
  let failed = 0;
  let parseErrors = 0;

  async function worker(workerId: number): Promise<void> {
    let iteration = 0;
    while (Date.now() < endAt) {
      const started = Date.now();
      try {
        const res = await fetch(`${baseUrl}${advancedPath}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildStressBody(scenarioId, workerId * 10_000 + iteration)),
        });
        statusCounts.set(res.status, (statusCounts.get(res.status) ?? 0) + 1);
        const text = await res.text();
        if (!res.ok) {
          failed += 1;
        } else {
          try {
            const payload = JSON.parse(text) as AdvancedResponse;
            sourceCounts.set(payload.source, (sourceCounts.get(payload.source) ?? 0) + 1);
          } catch {
            parseErrors += 1;
            failed += 1;
          }
        }
      } catch {
        failed += 1;
      } finally {
        latencies.push(Date.now() - started);
        total += 1;
        iteration += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: stressConcurrency }, (_, index) => worker(index)));

  const throughput = total / stressDurationSeconds;
  const averageLatency = latencies.reduce((sum, value) => sum + value, 0) / Math.max(1, latencies.length);

  log(`Stress results: total=${total} failed=${failed} parseErrors=${parseErrors}`);
  log(`Stress status histogram: ${JSON.stringify(Object.fromEntries(statusCounts))}`);
  log(`Stress source histogram: ${JSON.stringify(Object.fromEntries(sourceCounts))}`);
  log(
    `Stress latency ms: avg=${averageLatency.toFixed(1)} p95=${percentile(latencies, 0.95).toFixed(1)} p99=${percentile(latencies, 0.99).toFixed(1)}`,
  );
  log(`Stress throughput req/s=${throughput.toFixed(2)}`);

  assert(failed === 0, `Expected zero failed requests in stress test, got ${failed}`);
  assert(parseErrors === 0, `Expected zero JSON parse errors in stress test, got ${parseErrors}`);
  assert((statusCounts.get(200) ?? 0) === total, "Expected all stress responses to be HTTP 200");
  if (
    stressMode === "valid" ||
    stressMode === "invalid_then_repair" ||
    stressMode === "reject_response_format"
  ) {
    assert((sourceCounts.get("ai") ?? 0) > 0, "Expected at least one AI-source response during stress test");
  }

  if (stressMode === "upstream_error") {
    assert(
      (sourceCounts.get("local_fallback") ?? 0) > 0,
      "Expected local_fallback responses in upstream_error stress mode",
    );
  }

  if (stressMode === "always_invalid") {
    assert(
      (sourceCounts.get("local_recovery") ?? 0) > 0,
      "Expected local_recovery responses in always_invalid stress mode",
    );
  }
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function main(): Promise<void> {
  assert(Number.isFinite(appPort), "ADV_APP_PORT must be a valid number");
  assert(Number.isFinite(mockPort), "ADV_MOCK_PORT must be a valid number");
  assert(stressDurationSeconds > 0, "ADV_STRESS_DURATION_SECONDS must be > 0");
  assert(stressConcurrency > 0, "ADV_STRESS_CONCURRENCY must be > 0");
  assert(mockLatencyMs >= 0, "ADV_MOCK_LATENCY_MS must be >= 0");
  assert(
    stressMode === "valid" ||
      stressMode === "invalid_then_repair" ||
      stressMode === "always_invalid" ||
      stressMode === "upstream_error" ||
      stressMode === "reject_response_format",
    "ADV_STRESS_MODE must be one of: valid, invalid_then_repair, always_invalid, upstream_error, reject_response_format",
  );

  const mockServer = await startMockServer(mockPort);
  let app: ChildProcessWithoutNullStreams | null = null;

  try {
    app = await startAppServer();
    const scenarioId = await loadScenarioId();
    log(`Using scenario ${scenarioId}`);

    if (!onlyStress) {
      await runFunctionalChecks(scenarioId);
    }

    if (!skipStress || onlyStress) {
      await runStressCheck(scenarioId);
    }

    log("Advanced mode checks completed successfully.");
  } finally {
    if (app) {
      await stopAppServer(app);
    }
    await closeServer(mockServer);
  }
}

main().catch((error) => {
  console.error("[advanced-test] Failed:", error);
  process.exitCode = 1;
});
