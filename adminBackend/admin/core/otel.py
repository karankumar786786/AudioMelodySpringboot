import logging
import os
from typing import Any

from opentelemetry import _logs, metrics, trace
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.django import DjangoInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import DEPLOYMENT_ENVIRONMENT, SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

class OpenTelemetryContextFilter(logging.Filter):
    """Ensures otelServiceName, otelTraceID, and otelSpanID attributes are always present

    on every LogRecord to prevent formatting key errors.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "otelServiceName") or not record.otelServiceName:
            record.otelServiceName = "admin-backend"
        if not hasattr(record, "otelTraceID") or not record.otelTraceID:
            record.otelTraceID = "0"
        if not hasattr(record, "otelSpanID") or not record.otelSpanID:
            record.otelSpanID = "0"
        return True


logger = logging.getLogger(__name__)

_initialized = False


def setup_opentelemetry() -> bool:
    """Initializes OpenTelemetry traces, metrics, and logs export to the OTel collector

    and instruments Django, Psycopg2, Redis, and Requests.
    """
    global _initialized
    if _initialized:
        return True

    if os.getenv("OTEL_SDK_DISABLED", "").lower() in ("true", "1", "yes"):
        logger.info("[OTEL] OpenTelemetry is explicitly disabled via OTEL_SDK_DISABLED")
        return False

    service_name = os.getenv("OTEL_SERVICE_NAME", "admin-backend")
    environment = os.getenv("ENVIRONMENT", os.getenv("DJANGO_ENV", "production"))
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")

    # Format endpoint for gRPC client
    insecure = True
    clean_endpoint = endpoint
    if clean_endpoint.startswith("http://"):
        clean_endpoint = clean_endpoint[7:]
        insecure = True
    elif clean_endpoint.startswith("https://"):
        clean_endpoint = clean_endpoint[8:]
        insecure = False

    try:
        resource = Resource.create(
            {
                SERVICE_NAME: service_name,
                DEPLOYMENT_ENVIRONMENT: environment,
            }
        )

        # 1. Traces
        trace_provider = TracerProvider(resource=resource)
        span_exporter = OTLPSpanExporter(endpoint=clean_endpoint, insecure=insecure)
        trace_provider.add_span_processor(BatchSpanProcessor(span_exporter))
        trace.set_tracer_provider(trace_provider)

        # 2. Metrics
        metric_exporter = OTLPMetricExporter(endpoint=clean_endpoint, insecure=insecure)
        reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=15000)
        meter_provider = MeterProvider(resource=resource, metric_readers=[reader])
        metrics.set_meter_provider(meter_provider)

        # 3. Logs
        log_exporter = OTLPLogExporter(endpoint=clean_endpoint, insecure=insecure)
        logger_provider = LoggerProvider(resource=resource)
        logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
        _logs.set_logger_provider(logger_provider)

        # Attach handler to root logger
        handler = LoggingHandler(level=logging.NOTSET, logger_provider=logger_provider)
        logging.getLogger().addHandler(handler)

        # 4. Instrumentations
        LoggingInstrumentor().instrument(inject_trace_context=True, set_logging_format=False)
        DjangoInstrumentor().instrument(is_sql_commentor_enabled=True)
        Psycopg2Instrumentor().instrument(enable_commenter=True)
        RedisInstrumentor().instrument()
        RequestsInstrumentor().instrument()

        _initialized = True
        logger.info(
            "[OTEL] OpenTelemetry initialized successfully: service=%s, endpoint=%s",
            service_name,
            clean_endpoint,
        )
        return True
    except Exception as e:
        logger.warning("[OTEL WARN] Failed to initialize OpenTelemetry: %s", e)
        return False
