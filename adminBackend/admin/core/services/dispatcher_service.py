import logging
from typing import Optional
import requests
from django.conf import settings
from jobs.models import Job
from .redis_service import RedisService

logger = logging.getLogger(__name__)

class ExternalJobDispatcher:
    @classmethod
    def cancel_inngest_and_worker(cls, job_id: str, song_id: Optional[str] = None, job_obj: Optional[Job] = None) -> None:
        # A. Remove from Redis list
        RedisService.remove_job_from_audio_queue(job_id)

        # B. Push cancel to Redis
        RedisService.cancel_job(job_id)

        # C. HTTP cancel to audioProcessing worker
        if settings.AUDIO_PROCESSING_URL:
            try:
                headers = {}
                if settings.AUDIO_PROCESSING_API_KEY:
                    headers["X-API-KEY"] = settings.AUDIO_PROCESSING_API_KEY
                body = {
                    "songId": song_id,
                    "tempSongKey": job_obj.temp_song_key if job_obj else None,
                    "tempVideoKey": job_obj.temp_video_key if job_obj else None,
                    "songKey": job_obj.song_key if job_obj else None,
                    "fullVideoKey": job_obj.full_video_key if job_obj else None,
                }
                base_url = settings.AUDIO_PROCESSING_URL.strip().rstrip('/')
                if not base_url.startswith(("http://", "https://")):
                    base_url = f"https://{base_url}" if "one-org.me" in base_url else f"http://{base_url}"
                requests.post(
                    f"{base_url}/jobs/{job_id}/cleanup",
                    json=body,
                    headers=headers,
                    timeout=2,
                )
            except Exception as e:
                logger.warning("Failed to notify audioProcessing worker of job [%s] cleanup: %s", job_id, e)

        # D. Direct event to Inngest dev server
        if getattr(settings, "INNGEST_DEV_URL", None):
            try:
                payload = [{"name": "audio/job.cancel", "data": {"jobId": job_id}}]
                requests.post(
                    f"{settings.INNGEST_DEV_URL.rstrip('/')}/e/dev",
                    json=payload,
                    timeout=2,
                )
            except Exception as e:
                logger.warning("Failed to send cancellation event to Inngest dev server: %s", e)


