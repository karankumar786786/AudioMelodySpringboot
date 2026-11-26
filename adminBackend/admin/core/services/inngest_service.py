"""Inngest (background jobs) ko events bhejna."""
import logging
import time
from typing import Any, Dict, Optional
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class InngestService:
    """Inngest ko seedha events bhejne wali service. Pehle Redis queue poll hoti thi; ab durable function
    triggers seedha Inngest Cloud (ya local Inngest dev server) ko jaate hain.
    """

    @classmethod
    def get_inngest_endpoint(cls) -> str:
        """Environment ke hisaab se Inngest URL: event key ho to Cloud, warna local dev server."""
        is_dev = getattr(settings, "INNGEST_DEV", False)
        dev_url = getattr(settings, "INNGEST_DEV_URL", None)
        event_key = getattr(settings, "INNGEST_EVENT_KEY", "").strip()

        if is_dev and dev_url:
            return f"{dev_url.rstrip('/')}/e/{event_key or 'dev'}"

        if event_key:
            return f"https://inn.gs/e/{event_key}"

        # Cloud key na ho to local dev server ka URL
        if dev_url:
            return f"{dev_url.rstrip('/')}/e/dev"

        return "https://inn.gs/e/"

    @classmethod
    def send_event(cls, name: str, data: Dict[str, Any], event_id: Optional[str] = None) -> bool:
        """Inngest REST API ko ek event bhejo. Fail ho to False (exception nahi)."""
        endpoint = cls.get_inngest_endpoint()
        event_key = getattr(settings, "INNGEST_EVENT_KEY", "").strip()

        payload: Dict[str, Any] = {
            "name": name,
            "data": data,
        }
        if event_id:
            payload["id"] = event_id

        headers = {
            "Content-Type": "application/json",
        }
        if event_key:
            headers["Authorization"] = f"Bearer {event_key}"

        try:
            response = requests.post(
                endpoint,
                json=payload,
                headers=headers,
                timeout=10,
            )
            if response.status_code in (200, 201, 202):
                logger.info("[INNGEST] Successfully dispatched event '%s' directly to Inngest (%s, event_id=%s)", name, endpoint, event_id)
                return True
            else:
                logger.error("[INNGEST] Inngest returned error status %d for event '%s': %s", response.status_code, name, response.text)
                return False
        except Exception as e:
            logger.error("[INNGEST] Failed to send event '%s' to Inngest (%s): %s", name, endpoint, e)
            return False

    @classmethod
    def trigger_audio_job(cls, job_id: str, attempt: Optional[int] = None) -> bool:
        """'audio/fetchjob' bhejo - transcoding pipeline shuru. event_id me attempt number ya time daalte hain,
        warna Inngest ka 24 ghante ka dedupe retry ko chupchaap drop kar deta.
        """
        if attempt is None:
            try:
                from jobs.models import Job
                job = Job.objects.filter(pk=job_id).first()
                if job and job.transcoding_attempt is not None:
                    attempt = job.transcoding_attempt
            except Exception as e:
                logger.warning("Could not query transcoding_attempt for job [%s]: %s", job_id, e)

        attempt_str = str(attempt) if attempt is not None else str(int(time.time()))
        event_id = f"job-{job_id}-{attempt_str}"
        logger.info("[INNGEST] Directly dispatching audio/fetchjob for job [%s] (event_id=%s)", job_id, event_id)
        return cls.send_event(
            name="audio/fetchjob",
            data={"jobId": job_id, "attempt": attempt},
            event_id=event_id,
        )

    @classmethod
    def trigger_delete_event(cls, data: Dict[str, Any], attempt: Optional[int] = None) -> bool:
        """'audio/delete.algolia' bhejo - delete wali chain shuru. event_id me attempt / time, taaki retry drop na ho."""
        entity_id = data.get("entityId", "")
        delete_job_id = data.get("deleteJobId", "")
        event_key = delete_job_id or entity_id
        attempt_str = str(attempt) if attempt is not None else str(int(time.time()))
        event_id = f"del-{event_key}-{attempt_str}"
        logger.info("[INNGEST] Directly dispatching audio/delete.algolia for delete job [%s] entity [%s] (event_id=%s)", delete_job_id, entity_id, event_id)
        return cls.send_event(
            name="audio/delete.algolia",
            data=data,
            event_id=event_id,
        )

    @classmethod
    def trigger_cancel_job(cls, job_id: str) -> bool:
        """'audio/job.cancel' bhejo - chal rahe Inngest steps rok do."""
        logger.info("[INNGEST] Directly dispatching audio/job.cancel for job [%s]", job_id)
        return cls.send_event(
            name="audio/job.cancel",
            data={"jobId": job_id},
        )
