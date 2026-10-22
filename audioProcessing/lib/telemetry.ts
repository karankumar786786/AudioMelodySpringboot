import os from "os";
import axios from "axios";
import { config } from "dotenv";
import { globalTranscodeLimiter, CONCURRENT_TRANSCODING_LIMIT } from "./transcode/limiter";

config();

export interface TelemetryPayload {
  service: string;
  status: "UP" | "DOWN" | "DEGRADED";
  cpuUtilization: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  memoryUsagePercent: number;
  activeJobs: number;
  concurrencyLimit: number;
  uptimeSeconds: number;
  timestamp: string;
}

export interface AdminHealthAck {
  status?: string;
  ack?: boolean;
  serverTime?: string;
  adminStatus?: string;
  latencyMs?: number;
}

interface CpuSnapshot {
  idle: number;
  total: number;
}

function getCpuSnapshot(): CpuSnapshot {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += (cpu.times as Record<string, number>)[type] || 0;
    }
    idle += cpu.times.idle;
  }

  return { idle, total };
}

let lastSnapshot: CpuSnapshot = getCpuSnapshot();
let lastCpuUtilization = 0;

/**
 * Calculates CPU utilization (%) based on ticks elapsed between sampling intervals.
 */
export function sampleCpuUtilization(): number {
  const currentSnapshot = getCpuSnapshot();
  const idleDelta = currentSnapshot.idle - lastSnapshot.idle;
  const totalDelta = currentSnapshot.total - lastSnapshot.total;

  if (totalDelta > 0) {
    const usage = (1 - idleDelta / totalDelta) * 100;
    lastCpuUtilization = Math.min(100, Math.max(0, Math.round(usage * 10) / 10));
  }

  lastSnapshot = currentSnapshot;
  return lastCpuUtilization;
}

// Continuous background CPU ticker every 3 seconds for smooth, accurate sampling
setInterval(() => {
  sampleCpuUtilization();
}, 3000);

/**
 * Gathers complete runtime telemetry including CPU utilization, memory, active transcode jobs, and uptime.
 */
export function getSystemTelemetry(): TelemetryPayload {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const processMem = process.memoryUsage().rss;

  return {
    service: "audioProcessing",
    status: "UP",
    cpuUtilization: lastCpuUtilization,
    memoryUsedMb: Math.round(processMem / (1024 * 1024)),
    memoryTotalMb: Math.round(totalMem / (1024 * 1024)),
    memoryUsagePercent: Math.round((usedMem / totalMem) * 1000) / 10,
    activeJobs: globalTranscodeLimiter.activeCount,
    concurrencyLimit: CONCURRENT_TRANSCODING_LIMIT,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

let lastAdminAck: AdminHealthAck = {
  adminStatus: "UNKNOWN",
};

export function getLastAdminAck(): AdminHealthAck {
  return lastAdminAck;
}

/**
 * Resolves the admin backend endpoint for dispatching telemetry heartbeats.
 */
export function getAdminTelemetryUrl(): string {
  if (process.env.ADMIN_TELEMETRY_URL) {
    return process.env.ADMIN_TELEMETRY_URL;
  }

  const appUrl = process.env.APPLICATION_URL || "http://localhost:8000/webhook/job";
  try {
    const parsed = new URL(appUrl);
    return `${parsed.origin}/api/telemetry/heartbeat`;
  } catch {
    const withoutWebhook = appUrl.split("/webhook")[0] ?? appUrl;
    const base = (withoutWebhook.split("/api")[0] ?? withoutWebhook).replace(/\/+$/, "");
    return `${base}/api/telemetry/heartbeat`;
  }
}

/**
 * Starts background heartbeat worker that regularly reports CPU and worker telemetry
 * to the admin backend, establishing bidirectional health verification.
 */
export function startHeartbeatWorker(intervalMs: number = 10000) {
  const targetUrl = getAdminTelemetryUrl();
  const apiKey =
    process.env.AUDIO_PROCESSING_API_KEY ||
    process.env.APPLICATION_API_KEY ||
    "";

  console.log(
    `[TELEMETRY] Starting heartbeat worker -> ${targetUrl} (interval: ${intervalMs}ms)`
  );

  const sendHeartbeat = async () => {
    const payload = getSystemTelemetry();
    const startTime = Date.now();

    try {
      const response = await axios.post(targetUrl, payload, {
        timeout: 4000,
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
      });

      const latencyMs = Date.now() - startTime;
      lastAdminAck = {
        ...response.data,
        latencyMs,
      };

      // Periodic debug logging
      if (Math.random() < 0.2) {
        console.log(
          `[TELEMETRY HEARTBEAT] Sent: CPU=${payload.cpuUtilization}%, activeJobs=${payload.activeJobs}/${payload.concurrencyLimit} -> Admin ack (${latencyMs}ms, adminStatus=${lastAdminAck.adminStatus})`
        );
      }
    } catch (err: any) {
      lastAdminAck = {
        adminStatus: "DOWN",
        latencyMs: Date.now() - startTime,
      };
      console.warn(
        `[TELEMETRY WARN] Heartbeat to adminBackend failed (${targetUrl}): ${err.message || err}`
      );
    }
  };

  // Immediate initial heartbeat after 1 second
  setTimeout(sendHeartbeat, 1000);

  // Periodic heartbeat loop
  return setInterval(sendHeartbeat, intervalMs);
}
