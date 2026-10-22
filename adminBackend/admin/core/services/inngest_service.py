import logging
from typing import Any, Dict, Optional
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class InngestService:
    """
    Direct Inngest Event Dispatcher service.
    Replaces Redis polling queues by dispatching durable function triggers directly
    to Inngest Cloud (or Inngest local dev server).
    """

    @classmethod
    def get_inngest_endpoint(cls) -> str:
        """
        Determines the appropriate Inngest endpoint based on environment.
        """
        is_dev = getattr(settings, "INNGEST_DEV", False)
        dev_url = getattr(settings, "INNGEST_DEV_URL", None)
        event_key = getattr(settings, "INNGEST_EVENT_KEY", "").strip()

        if is_dev and dev_url:
            return f"{dev_url.rstrip('/')}/e/{event_key or 'dev'}"

        if event_key:
            return f"https://inn.gs/e/{event_key}"

        # Fallback to dev url if no cloud key configured
        if dev_url:
            return f"{dev_url.rstrip('/')}/e/dev"

        return "https://inn.gs/e/"

    @classmethod
    def send_event(cls, name: str, data: Dict[str, Any], event_id: Optional[str] = None) -> bool:
        """
        Sends an event directly to Inngest REST API.
        """
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
                timeout=5,
            )
            if response.status_code in (200, 201, 202):
                logger.info("[INNGEST] Successfully dispatched event '%s' directly to Inngest (%s)", name, endpoint)
                return True
            else:
                logger.error("[INNGEST] Inngest returned error status %d for event '%s': %s", response.status_code, name, response.text)
                return False
        except Exception as e:
            logger.error("[INNGEST] Failed to send event '%s' to Inngest (%s): %s", name, endpoint, e)
            return False

    @classmethod
    def trigger_audio_job(cls, job_id: str) -> bool:
        """
        Dispatches 'audio/fetchjob' directly to Inngest to begin transcoding pipeline.
        """
        logger.info("[INNGEST] Directly dispatching audio/fetchjob for job [%s]", job_id)
        return cls.send_event(
            name="audio/fetchjob",
            data={"jobId": job_id},
            event_id=f"job-{job_id}",
        )

    @classmethod
    def trigger_delete_event(cls, data: Dict[str, Any]) -> bool:
        """
        Dispatches 'audio/delete.algolia' directly to Inngest for deletion workflow.
        """
        entity_id = data.get("entityId", "")
        delete_job_id = data.get("deleteJobId", "")
        logger.info("[INNGEST] Directly dispatching audio/delete.algolia for delete job [%s] entity [%s]", delete_job_id, entity_id)
        return cls.send_event(
            name="audio/delete.algolia",
            data=data,
            event_id=f"del-{delete_job_id or entity_id}",
        )

    @classmethod
    def trigger_cancel_job(cls, job_id: str) -> bool:
        """
        Dispatches 'audio/job.cancel' directly to Inngest to halt in-flight step functions.
        """
        logger.info("[INNGEST] Directly dispatching audio/job.cancel for job [%s]", job_id)
        return cls.send_event(
            name="audio/job.cancel",
            data={"jobId": job_id},
        )
