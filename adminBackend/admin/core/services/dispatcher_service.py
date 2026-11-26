"""Chal rahe media jobs ko cancel karna."""
import logging
from typing import Optional
import requests
from django.conf import settings
from jobs.models import Job
from .redis_service import RedisService

logger = logging.getLogger(__name__)

class ExternalJobDispatcher:
    """Job cancel karne ka helper."""
    @classmethod
    def cancel_inngest_and_worker(cls, job_id: str, song_id: Optional[str] = None, job_obj: Optional[Job] = None) -> None:
        # A. Redis list se hatao
        """Job har jagah cancel: Inngest ko cancel event aur media pipeline ko HTTP cleanup."""
        RedisService.remove_job_from_audio_queue(job_id)

        # B. Redis me cancel daalo
        RedisService.cancel_job(job_id)

        # C. Media pipeline ko HTTP se cancel bhejo
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

        # D. Inngest (Cloud/Dev) ko seedha cancel event
        try:
            from .inngest_service import InngestService
            InngestService.trigger_cancel_job(job_id)
        except Exception as e:
            logger.warning("Failed to send cancellation event to Inngest: %s", e)



