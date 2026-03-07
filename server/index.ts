import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

interface OperationalMetrics {
  startedAt: string;
  requestsTotal: number;
  rateLimitedTotal: number;
  statusBuckets: Record<"2xx" | "3xx" | "4xx" | "5xx", number>;
  routeCounts: Map<string, number>;
}

const metrics: OperationalMetrics = {
  startedAt: new Date().toISOString(),
  requestsTotal: 0,
  rateLimitedTotal: 0,
  statusBuckets: {
    "2xx": 0,
    "3xx": 0,
    "4xx": 0,
    "5xx": 0,
  },
  routeCounts: new Map<string, number>(),
};

function getBucketForStatus(statusCode: number): keyof OperationalMetrics["statusBuckets"] {
  if (statusCode >= 500) {
    return "5xx";
  }
  if (statusCode >= 400) {
    return "4xx";
  }
  if (statusCode >= 300) {
    return "3xx";
  }
  return "2xx";
}

function createSlidingWindowLimiter(options: {
  id: string;
  max: number;
  windowMs: number;
  match: (req: Request) => boolean;
}) {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!options.match(req)) {
      next();
      return;
    }

    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.id}:${ip}`;
    const currentHits = hits.get(key) ?? [];
    const cutoff = now - options.windowMs;
    const recentHits = currentHits.filter((timestamp) => timestamp > cutoff);

    if (recentHits.length >= options.max) {
      metrics.rateLimitedTotal += 1;
      res.setHeader("Retry-After", Math.ceil(options.windowMs / 1000));
      res.status(429).json({
        message: "Too many requests. Please retry shortly.",
      });
      return;
    }

    recentHits.push(now);
    hits.set(key, recentHits);

    if (hits.size > 5000) {
      hits.forEach((timestamps, mapKey) => {
        const stillRecent = timestamps.filter((timestamp: number) => timestamp > cutoff);
        if (stillRecent.length === 0) {
          hits.delete(mapKey);
        } else {
          hits.set(mapKey, stillRecent);
        }
      });
    }

    next();
  };
}

function getEnvInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(
  createSlidingWindowLimiter({
    id: "api-admin",
    max: getEnvInt("RATE_LIMIT_ADMIN_MAX", 120),
    windowMs: getEnvInt("RATE_LIMIT_ADMIN_WINDOW_MS", 60_000),
    match: (req) => req.path.startsWith("/api/admin"),
  }),
);

app.use(
  createSlidingWindowLimiter({
    id: "api-ai",
    max: getEnvInt("RATE_LIMIT_AI_MAX", 24),
    windowMs: getEnvInt("RATE_LIMIT_AI_WINDOW_MS", 60_000),
    match: (req) => req.path === "/api/debrief" || req.path === "/api/advanced/chat",
  }),
);

app.use(
  createSlidingWindowLimiter({
    id: "api-global",
    max: getEnvInt("RATE_LIMIT_GLOBAL_MAX", 600),
    windowMs: getEnvInt("RATE_LIMIT_GLOBAL_WINDOW_MS", 60_000),
    match: (req) => req.path.startsWith("/api"),
  }),
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.get("/api/health", async (_req, res) => {
  const startedAt = Date.parse(metrics.startedAt);
  const uptimeSeconds = Number.isFinite(startedAt) ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  let database = "up";

  try {
    await pool.query("select 1");
  } catch {
    database = "down";
  }

  res.json({
    ok: database === "up",
    service: "crisisim-ai",
    startedAt: metrics.startedAt,
    uptimeSeconds,
    database,
    memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
  });
});

app.get("/api/metrics", (_req, res) => {
  const topRoutes = Array.from(metrics.routeCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 25)
    .map(([route, count]) => ({ route, count }));

  res.json({
    startedAt: metrics.startedAt,
    requestsTotal: metrics.requestsTotal,
    rateLimitedTotal: metrics.rateLimitedTotal,
    statusBuckets: metrics.statusBuckets,
    topRoutes,
  });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    metrics.requestsTotal += 1;
    metrics.statusBuckets[getBucketForStatus(res.statusCode)] += 1;
    metrics.routeCounts.set(path, (metrics.routeCounts.get(path) ?? 0) + 1);

    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
