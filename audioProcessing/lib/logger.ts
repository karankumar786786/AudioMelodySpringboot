/**
 * Logger: har log line me time, level aur trace id jodo, aur saath me OpenTelemetry (Uptrace) ko bhi bhejo.
 * setupConsoleLogger() global console.* ko badal deta hai, taaki libraries ke logs bhi isi format me aayein.
 */
import { trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "audio-processing";

/** Abhi chal rahe span ka traceId / spanId; koi span na ho to "0". Isse ek request ke saare logs jod sakte hain. */
function getTraceContext(): { traceId: string; spanId: string } {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    const ctx = activeSpan.spanContext();
    if (ctx && ctx.traceId) {
      return { traceId: ctx.traceId, spanId: ctx.spanId };
    }
  }
  return { traceId: "0", spanId: "0" };
}

/** Ek argument ko text banao: Error = stack trace, object = JSON (fail ho to String), baaki = String. */
function stringifyArg(arg: any): string {
  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`;
  }
  if (typeof arg === "object" && arg !== null) {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

/** Saare arguments ko space se jod ke ek message. */
function formatArgs(args: any[]): string {
  return args.map(stringifyArg).join(" ");
}

// Asli console methods sambhal ke rakho - patch ke baad bhi inhi se terminal pe likhenge (warna infinite loop)
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

/** Ek log line likho: terminal pe "time [LEVEL] [service,trace,span] message" aur OTel ko bhi. */
function logRecord(
  level: "INFO" | "WARN" | "ERROR" | "DEBUG",
  severityNumber: SeverityNumber,
  args: any[]
) {
  const message = formatArgs(args);
  const { traceId, spanId } = getTraceContext();
  const timestamp = new Date().toISOString();

  // Terminal (stdout / stderr) pe likho - Docker logs yahin se padhta hai
  const prefix = `${timestamp} [${level}] [${SERVICE_NAME},${traceId},${spanId}]`;
  if (level === "ERROR") {
    originalConsole.error(`${prefix} ${message}`);
  } else if (level === "WARN") {
    originalConsole.warn(`${prefix} ${message}`);
  } else {
    originalConsole.log(`${prefix} ${message}`);
  }

  // OpenTelemetry logger ko bhejo (Uptrace tak jaata hai)
  try {
    const otelLogger = logs.getLogger(SERVICE_NAME);
    otelLogger.emit({
      severityNumber,
      severityText: level,
      body: message,
      attributes: {
        "service.name": SERVICE_NAME,
        "log.level": level,
      },
    });
  } catch {
    // OTel SDK abhi tak shuru nahi hua ho to chup chap chhod do
  }
}

/** Seedha use karne wala logger: logger.info(...), logger.warn(...), wagairah. */
export const logger = {
  info(...args: any[]) {
    logRecord("INFO", SeverityNumber.INFO, args);
  },
  warn(...args: any[]) {
    logRecord("WARN", SeverityNumber.WARN, args);
  },
  error(...args: any[]) {
    logRecord("ERROR", SeverityNumber.ERROR, args);
  },
  debug(...args: any[]) {
    logRecord("DEBUG", SeverityNumber.DEBUG, args);
  },
};

let isPatched = false;

/**
 * Global console.* methods ko logger se badal do, taaki saari libraries aur purana code bhi
 * apne aap formatted (OTel context wale) logs likhe. Do baar call karne par bhi ek hi baar patch hota hai.
 */
export function setupConsoleLogger() {
  if (isPatched) return;
  isPatched = true;

  console.log = (...args: any[]) => logger.info(...args);
  console.info = (...args: any[]) => logger.info(...args);
  console.warn = (...args: any[]) => logger.warn(...args);
  console.error = (...args: any[]) => logger.error(...args);
  console.debug = (...args: any[]) => logger.debug(...args);
}
