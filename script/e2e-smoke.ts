type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

const baseUrl = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? "5000"}`;
const adminKey = process.env.ADMIN_API_KEY?.trim() || "";

async function request<T extends JsonValue>(
  path: string,
  init?: RequestInit,
  expectedStatus?: number,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  const payload = text ? (JSON.parse(text) as T) : (null as T);

  if (expectedStatus && res.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus} for ${path}, got ${res.status}: ${text}`);
  }

  if (!expectedStatus && !res.ok) {
    throw new Error(`Request failed for ${path}: ${res.status} ${text}`);
  }

  return payload;
}

async function run(): Promise<void> {
  console.log(`[e2e] Target: ${baseUrl}`);

  await request("/api/health", undefined, 200);
  const trainingConfig = await request<{ sectors: unknown[] }>("/api/training-config", undefined, 200);
  if (!Array.isArray(trainingConfig.sectors)) {
    throw new Error("Training config payload is invalid.");
  }

  const scenarios = await request<Array<{ id: string }>>("/api/scenarios", undefined, 200);
  if (scenarios.length === 0) {
    throw new Error("No scenarios returned.");
  }

  const scenario = await request<{
    id: string;
    steps: Record<string, { id: string; choices: Array<{ id: string; scoreDeltas: Record<string, number> }> }>;
    initialScores: Record<string, number>;
  }>(`/api/scenario?id=${encodeURIComponent(scenarios[0].id)}&lang=en`, undefined, 200);

  const firstStep = Object.values(scenario.steps)[0];
  if (!firstStep || firstStep.choices.length === 0) {
    throw new Error("Scenario has no playable choices.");
  }
  const firstChoice = firstStep.choices[0];
  const finalScores = {
    ...scenario.initialScores,
    operationalControl: scenario.initialScores.operationalControl + (firstChoice.scoreDeltas.operationalControl ?? 0),
    responseTempo: scenario.initialScores.responseTempo + (firstChoice.scoreDeltas.responseTempo ?? 0),
    stakeholderTrust: scenario.initialScores.stakeholderTrust + (firstChoice.scoreDeltas.stakeholderTrust ?? 0),
    teamAlignment: scenario.initialScores.teamAlignment + (firstChoice.scoreDeltas.teamAlignment ?? 0),
    executiveComms: scenario.initialScores.executiveComms + (firstChoice.scoreDeltas.executiveComms ?? 0),
  };

  const debrief = await request<{ summary: unknown[]; checklist: unknown[] }>(
    "/api/debrief",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: scenario.id,
        language: "en",
        role: "Regional Crisis Coordination Lead",
        history: [
          {
            stepId: firstStep.id,
            choiceId: firstChoice.id,
            timestamp: Date.now(),
            scoresAfter: finalScores,
          },
        ],
      }),
    },
    200,
  );
  if (!Array.isArray(debrief.summary) || !Array.isArray(debrief.checklist)) {
    throw new Error("Debrief payload is invalid.");
  }

  if (!adminKey) {
    console.log("[e2e] ADMIN_API_KEY not set; skipping protected admin smoke tests.");
    return;
  }

  const adminHeaders = {
    "x-admin-key": adminKey,
    "Content-Type": "application/json",
  };

  const me = await request<{ role: string; permissions: string[] }>(
    "/api/admin/me",
    { headers: adminHeaders },
    200,
  );
  if (!Array.isArray(me.permissions)) {
    throw new Error("Invalid /api/admin/me response.");
  }

  const adminScenarios = await request<Array<{ scenarioId: string; definition: unknown; isActive: boolean; version: number }>>(
    "/api/admin/scenarios",
    { headers: adminHeaders },
    200,
  );
  if (adminScenarios.length === 0) {
    throw new Error("No admin scenarios available.");
  }

  const scenarioTarget = adminScenarios[0];
  await request(
    `/api/admin/scenarios/${encodeURIComponent(scenarioTarget.scenarioId)}`,
    {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        scenario: scenarioTarget.definition,
        isActive: scenarioTarget.isActive,
      }),
    },
    200,
  );

  const scenarioVersions = await request<Array<{ version: number }>>(
    `/api/admin/scenarios/${encodeURIComponent(scenarioTarget.scenarioId)}/versions`,
    { headers: adminHeaders },
    200,
  );
  if (scenarioVersions.length === 0) {
    throw new Error("Scenario versions should not be empty.");
  }

  await request(
    `/api/admin/scenarios/${encodeURIComponent(scenarioTarget.scenarioId)}/rollback`,
    {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ targetVersion: scenarioVersions[0].version }),
    },
    200,
  );

  const adminConfigs = await request<Array<{ id: number; definition: unknown; isActive: boolean }>>(
    "/api/admin/training-configs",
    { headers: adminHeaders },
    200,
  );
  if (adminConfigs.length === 0) {
    throw new Error("No training configs available.");
  }

  const configTarget = adminConfigs[0];
  await request(
    `/api/admin/training-configs/${configTarget.id}`,
    {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        config: configTarget.definition,
        isActive: configTarget.isActive,
      }),
    },
    200,
  );

  const configVersions = await request<Array<{ version: number }>>(
    `/api/admin/training-configs/${configTarget.id}/versions`,
    { headers: adminHeaders },
    200,
  );
  if (configVersions.length === 0) {
    throw new Error("Training config versions should not be empty.");
  }

  await request(
    `/api/admin/training-configs/${configTarget.id}/rollback`,
    {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ targetVersion: configVersions[0].version }),
    },
    200,
  );

  await request("/api/admin/audit?limit=10", { headers: adminHeaders }, 200);
  console.log("[e2e] Smoke checks passed.");
}

run().catch((error) => {
  console.error("[e2e] Failed:", error);
  process.exitCode = 1;
});
