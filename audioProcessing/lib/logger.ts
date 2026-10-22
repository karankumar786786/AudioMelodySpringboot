import { trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "audio-processing";

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

function formatArgs(args: any[]): string {
  return args.map(stringifyArg).join(" ");
}

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

function logRecord(
  level: "INFO" | "WARN" | "ERROR" | "DEBUG",
  severityNumber: SeverityNumber,
  args: any[]
) {
  const message = formatArgs(args);
  const { traceId, spanId } = getTraceContext();
  const timestamp = new Date().toISOString();

  // Print structured log to stdout / stderr for container runtime & Docker logs
  const prefix = `${timestamp} [${level}] [${SERVICE_NAME},${traceId},${spanId}]`;
  if (level === "ERROR") {
    originalConsole.error(`${prefix} ${message}`);
  } else if (level === "WARN") {
    originalConsole.warn(`${prefix} ${message}`);
  } else {
    originalConsole.log(`${prefix} ${message}`);
  }

  // Dispatch to OpenTelemetry Logger Provider for Uptrace ingestion
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
    // Failsafe in case OpenTelemetry SDK has not finished initializing yet
  }
}

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

/**
 * Patch global console methods so that all third-party libraries and
 * existing functions automatically output formatted logs with OTel context.
 */
let isPatched = false;

export function setupConsoleLogger() {
  if (isPatched) return;
  isPatched = true;

  console.log = (...args: any[]) => logger.info(...args);
  console.info = (...args: any[]) => logger.info(...args);
  console.warn = (...args: any[]) => logger.warn(...args);
  console.error = (...args: any[]) => logger.error(...args);
  console.debug = (...args: any[]) => logger.debug(...args);
}
