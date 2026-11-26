/**
 * Telemetry: is worker ki CPU, memory aur chal rahe jobs ki jaankari jama karo, aur har 10 second
 * admin API ko "heartbeat" bhejo (POST /api/telemetry/heartbeat). Admin dashboard isse dikhata hai ki
 * media pipeline zinda hai ya nahi; admin ka jawab (ack) bhi yahan yaad rakhte hain.
 */
import os from "os";
import axios from "axios";
import { config } from "dotenv";
import { globalTranscodeLimiter, CONCURRENT_TRANSCODING_LIMIT } from "./transcode/limiter";

config();

/** Heartbeat me jaane wala data. */
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

/** Admin API ka jawab (aur kitni der me aaya). */
export interface AdminHealthAck {
  status?: string;
  ack?: boolean;
  serverTime?: string;
  adminStatus?: string;
  latencyMs?: number;
}

/** Ek pal pe saare CPU cores ka idle aur total time (ticks). */
interface CpuSnapshot {
  idle: number;
  total: number;
}

/** Abhi ka CPU snapshot lo: saare cores ka idle time aur total time jodo. */
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
 * CPU kitna % busy hai: pichhle snapshot se ab tak jitna time beeta, usme idle kitna tha.
 * usage = 1 - (idle ka badlav / total ka badlav). 0-100 ke beech, ek decimal tak.
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

// Har 3 second background me CPU naapo, taaki heartbeat ke waqt taaza aur smooth value mile
setInterval(() => {
  sampleCpuUtilization();
}, 3000);

/**
 * Poori telemetry ek object me: CPU %, memory (process ki aur machine ki), active jobs, limit aur uptime.
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

/** Admin API ka pichhla jawab (koi na aaya ho to adminStatus "UNKNOWN"). */
export function getLastAdminAck(): AdminHealthAck {
  return lastAdminAck;
}

/**
 * Heartbeat kahan bhejna hai: ADMIN_TELEMETRY_URL ho to wahi, warna APPLICATION_URL ke origin pe
 * /api/telemetry/heartbeat. URL parse na ho to "/webhook" aur "/api" se pehle ka hissa le lete hain.
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
 * Background heartbeat shuru karo: har intervalMs (default 10s) admin API ko telemetry bhejo.
 * Admin jawab de to uska ack yaad rakho; fail ho to adminStatus "DOWN" aur warning - kabhi crash nahi.
 * Output: setInterval ka handle (band karne ke liye).
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

  /** Ek heartbeat bhejo (4 second timeout) aur admin ka jawab sambhalo. */
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

      // Har baar log karne se logs bhar jaate, isliye ~20% heartbeats pe hi log karo
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

  // Start ke 1 second baad pehla heartbeat (poora interval intezaar mat karo)
  setTimeout(sendHeartbeat, 1000);

  // Phir har intervalMs pe
  return setInterval(sendHeartbeat, intervalMs);
}
