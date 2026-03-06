const baseUrl = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? "5000"}`;
const path = process.env.LOAD_PATH ?? "/api/scenarios";
const concurrency = Number.parseInt(process.env.LOAD_CONCURRENCY ?? "20", 10);
const durationSeconds = Number.parseInt(process.env.LOAD_DURATION_SECONDS ?? "20", 10);

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[index];
}

async function worker(
  endAt: number,
  latencies: number[],
  failures: { count: number },
  statusCounts: Map<number, number>,
): Promise<number> {
  let completed = 0;
  while (Date.now() < endAt) {
    const started = Date.now();
    try {
      const res = await fetch(`${baseUrl}${path}`);
      statusCounts.set(res.status, (statusCounts.get(res.status) ?? 0) + 1);
      if (!res.ok) {
        failures.count += 1;
      }
      await res.arrayBuffer();
    } catch {
      failures.count += 1;
    } finally {
      latencies.push(Date.now() - started);
      completed += 1;
    }
  }
  return completed;
}

async function run(): Promise<void> {
  if (!Number.isFinite(concurrency) || concurrency <= 0) {
    throw new Error("LOAD_CONCURRENCY must be a positive number.");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("LOAD_DURATION_SECONDS must be a positive number.");
  }

  const endAt = Date.now() + durationSeconds * 1000;
  const latencies: number[] = [];
  const failures = { count: 0 };
  const statusCounts = new Map<number, number>();

  const workers = Array.from({ length: concurrency }, () =>
    worker(endAt, latencies, failures, statusCounts),
  );
  const results = await Promise.all(workers);
  const totalRequests = results.reduce((sum, value) => sum + value, 0);
  const nonRateLimitedFailures = failures.count - (statusCounts.get(429) ?? 0);
  const successRequests = totalRequests - failures.count;
  const throughput = totalRequests / durationSeconds;

  console.log(`[load] target=${baseUrl}${path}`);
  console.log(`[load] duration=${durationSeconds}s concurrency=${concurrency}`);
  console.log(
    `[load] requests total=${totalRequests} success=${successRequests} failed=${failures.count} rate_limited=${statusCounts.get(429) ?? 0} non_rate_limited_failures=${Math.max(0, nonRateLimitedFailures)}`,
  );
  console.log(
    `[load] status histogram ${JSON.stringify(Object.fromEntries(Array.from(statusCounts.entries()).sort((a, b) => a[0] - b[0])))}`,
  );
  console.log(
    `[load] latency ms avg=${(latencies.reduce((sum, v) => sum + v, 0) / Math.max(1, latencies.length)).toFixed(1)} p95=${percentile(latencies, 0.95).toFixed(1)} p99=${percentile(latencies, 0.99).toFixed(1)}`,
  );
  console.log(`[load] throughput req/s=${throughput.toFixed(2)}`);
}

run().catch((error) => {
  console.error("[load] Failed:", error);
  process.exitCode = 1;
});
