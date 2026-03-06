const baseUrl = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? "5000"}`;

async function expectStatus(path: string, expected: number, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${baseUrl}${path}`, init);
  if (res.status !== expected) {
    const body = await res.text();
    throw new Error(`Expected ${expected} for ${path}, got ${res.status}: ${body}`);
  }
  return res;
}

async function run(): Promise<void> {
  console.log(`[security] Target: ${baseUrl}`);

  const healthRes = await expectStatus("/api/health", 200);
  const requiredHeaders = [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "x-xss-protection",
    "permissions-policy",
  ];
  for (const header of requiredHeaders) {
    if (!healthRes.headers.get(header)) {
      throw new Error(`Missing security header: ${header}`);
    }
  }

  await expectStatus("/api/admin/me", 401);
  await expectStatus("/api/admin/me", 401, {
    headers: {
      "x-admin-key": "invalid-key-for-check",
    },
  });

  const attempts = 30;
  const rateStatuses = await Promise.all(
    Array.from({ length: attempts }, () =>
      fetch(`${baseUrl}/api/advanced/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).then((res) => res.status),
    ),
  );

  if (!rateStatuses.includes(429)) {
    throw new Error(`Expected rate-limited response (429) but got statuses: ${rateStatuses.join(", ")}`);
  }

  console.log("[security] Security checks passed.");
}

run().catch((error) => {
  console.error("[security] Failed:", error);
  process.exitCode = 1;
});
