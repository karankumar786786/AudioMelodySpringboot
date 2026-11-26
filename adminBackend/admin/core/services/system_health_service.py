"""System health: media pipeline ke heartbeats aur health page."""
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import requests
from django.conf import settings
from django.db import connection
from opentelemetry import metrics

logger = logging.getLogger(__name__)

# Alert ke liye signal: media pipeline ka har heartbeat aane pe +1.
# Minute ka rate 0 ho jaaye to Uptrace alert deta hai (infra/observability/alerts.yml).
# Global (proxy) meter use karta hai, to core.otel MeterProvider set kare tab tak kuch nahi karta.
HEARTBEAT_COUNTER = metrics.get_meter("admin-backend.telemetry").create_counter(
    "audio_processing.heartbeats_received",
    unit="{heartbeat}",
    description="Heartbeats received from the audioProcessing worker",
)

REDIS_TELEMETRY_KEY = "system:telemetry:audio_processing"
# Media pipeline har 60 second heartbeat bhejta hai; har ek 2.5 intervals tak rakho taaki
# ek late heartbeat se service down na dikhe.
TELEMETRY_TTL_SECONDS = 150


class SystemHealthService:
    """Admin API aur media pipeline ke beech health ping aur CPU telemetry."""

    @classmethod
    def record_audio_processing_heartbeat(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """Media pipeline ka heartbeat (aur CPU info) lo aur Redis me TTL ke saath rakho."""
        from .redis_service import RedisService

        telemetry = {
            "service": "audioProcessing",
            "status": data.get("status", "UP"),
            "cpuUtilization": float(data.get("cpuUtilization", 0.0)),
            "memoryUsedMb": data.get("memoryUsedMb", 0),
            "memoryTotalMb": data.get("memoryTotalMb", 0),
            "memoryUsagePercent": float(data.get("memoryUsagePercent", 0.0)),
            "activeJobs": int(data.get("activeJobs", 0)),
            "concurrencyLimit": int(data.get("concurrencyLimit", 2)),
            "uptimeSeconds": int(data.get("uptimeSeconds", 0)),
            "receivedAt": datetime.now(timezone.utc).isoformat(),
            "timestamp": data.get("timestamp", datetime.now(timezone.utc).isoformat()),
        }
        HEARTBEAT_COUNTER.add(1, {"status": str(telemetry["status"])})

        try:
            r = RedisService.get_client()
            r.set(REDIS_TELEMETRY_KEY, json.dumps(telemetry), ex=TELEMETRY_TTL_SECONDS)
            logger.debug("[HEARTBEAT] Stored audioProcessing heartbeat: CPU=%.1f%%, active=%d", telemetry["cpuUtilization"], telemetry["activeJobs"])
        except Exception as e:
            logger.warning("[HEARTBEAT] Failed to store heartbeat in Redis: %s", e)

        return {
            "status": "PONG",
            "ack": True,
            "serverTime": datetime.now(timezone.utc).isoformat(),
            "adminStatus": "UP",
        }

    @classmethod
    def ping_audio_processing(cls) -> Dict[str, Any]:
        """Admin API se media pipeline ko khud ping bhejo."""
        base_url = getattr(settings, "AUDIO_PROCESSING_URL", "http://localhost:5010").strip().rstrip('/')
        if not base_url.startswith(("http://", "https://")):
            base_url = f"https://{base_url}" if "one-org.me" in base_url else f"http://{base_url}"

        url = f"{base_url}/health"
        headers = {}
        api_key = getattr(settings, "AUDIO_PROCESSING_API_KEY", None)
        if api_key:
            headers["X-API-KEY"] = api_key

        start_time = time.time()
        try:
            res = requests.get(url, headers=headers, timeout=2.5)
            latency_ms = round((time.time() - start_time) * 1000, 1)
            if res.status_code == 200:
                payload = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                return {
                    "status": "UP",
                    "latencyMs": latency_ms,
                    "payload": payload,
                }
            return {
                "status": "DEGRADED",
                "statusCode": res.status_code,
                "latencyMs": latency_ms,
            }
        except Exception as e:
            return {
                "status": "DOWN",
                "error": str(e),
                "latencyMs": round((time.time() - start_time) * 1000, 1),
            }

    @classmethod
    def get_system_health(cls) -> Dict[str, Any]:
        """Admin dashboard ke liye health aur CPU info jodo."""
        from .redis_service import RedisService

        # 1. Admin API ki health
        db_connected = False
        try:
            connection.ensure_connection()
            db_connected = True
        except Exception as e:
            logger.error("DB health check failed: %s", e)

        redis_connected = False
        try:
            r = RedisService.get_client()
            r.ping()
            redis_connected = True
        except Exception as e:
            logger.error("Redis health check failed: %s", e)

        admin_status = "UP" if (db_connected and redis_connected) else ("DEGRADED" if (db_connected or redis_connected) else "DOWN")

        # 2. Media pipeline ki telemetry (Redis heartbeat se)
        audio_telemetry: Optional[Dict[str, Any]] = None
        try:
            r = RedisService.get_client()
            cached = r.get(REDIS_TELEMETRY_KEY)
            if cached:
                audio_telemetry = json.loads(cached)
        except Exception as e:
            logger.warning("Failed to read audioProcessing telemetry from Redis: %s", e)

        # Redis me heartbeat nahi to khud ping karke dekho
        if not audio_telemetry:
            ping_res = cls.ping_audio_processing()
            if ping_res.get("status") == "UP":
                payload = ping_res.get("payload", {})
                audio_telemetry = {
                    "service": "audioProcessing",
                    "status": "UP",
                    "cpuUtilization": float(payload.get("cpuUtilization", 0.0)),
                    "memoryUsedMb": payload.get("memoryUsedMb", 0),
                    "memoryTotalMb": payload.get("memoryTotalMb", 0),
                    "memoryUsagePercent": float(payload.get("memoryUsagePercent", 0.0)),
                    "activeJobs": int(payload.get("activeJobs", 0)),
                    "concurrencyLimit": int(payload.get("concurrencyLimit", 2)),
                    "lastHeartbeat": payload.get("timestamp", datetime.now(timezone.utc).isoformat()),
                    "latencyMs": ping_res.get("latencyMs", 0),
                }
            else:
                audio_telemetry = {
                    "service": "audioProcessing",
                    "status": "DOWN",
                    "cpuUtilization": 0.0,
                    "memoryUsedMb": 0,
                    "activeJobs": 0,
                    "concurrencyLimit": 2,
                    "error": ping_res.get("error", f"No heartbeat received in the last {TELEMETRY_TTL_SECONDS} seconds"),
                }

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "adminBackend": {
                "status": admin_status,
                "dbConnected": db_connected,
                "redisConnected": redis_connected,
            },
            "audioProcessing": audio_telemetry,
        }
