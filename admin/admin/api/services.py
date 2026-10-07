import hashlib
import hmac
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import secrets
import jwt
import boto3
import redis
import requests
from django.conf import settings
from django.db import connection, transaction
from django.db.models import Q

from .models import (
    Admin,
    Artist,
    DeleteJob,
    Job,
    PaginationMetadata,
    Playlist,
    PlaylistSong,
    Song,
    User,
)

logger = logging.getLogger(__name__)


# ==============================================================================
# 1. Redis Service & Queue Monitoring
# ==============================================================================

class RedisService:
    _client: Optional[redis.Redis] = None

    @classmethod
    def get_client(cls) -> redis.Redis:
        if cls._client is None:
            cls._client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                ssl=settings.REDIS_SSL,
                decode_responses=True,
            )
        return cls._client

    @classmethod
    def get_queue_size(cls, queue_key: str) -> int:
        if not queue_key:
            return 0
        try:
            r = cls.get_client()
            size = r.llen(queue_key)
            return size or 0
        except Exception as e:
            logger.warning("Failed to query Redis queue size for '%s': %s", queue_key, e)
            return 0

    @classmethod
    def get_queue_backpressure_summary(cls) -> Dict[str, Any]:
        audio_key = settings.REDIS_AUDIO_PROCESSING_QUEUE
        mail_key = settings.REDIS_MAIL_QUEUE
        delete_key = settings.REDIS_DELETE_QUEUE
        mail_dlq_key = f"{mail_key}_dlq"

        audio_size = cls.get_queue_size(audio_key)
        mail_size = cls.get_queue_size(mail_key)
        delete_size = cls.get_queue_size(delete_key)
        mail_dlq_size = cls.get_queue_size(mail_dlq_key)

        def eval_status(sz: int) -> str:
            if sz >= 50:
                return "HIGH"
            if sz >= 10:
                return "ELEVATED"
            return "HEALTHY"

        queues = [
            {
                "queueName": "Audio Processing Queue",
                "queueKey": audio_key,
                "size": audio_size,
                "backpressureStatus": eval_status(audio_size),
                "type": "STANDARD",
                "description": "Ingestion & transcoding jobs pending worker pickup",
                "safeThreshold": 10,
                "highThreshold": 50,
            },
            {
                "queueName": "Mail Dispatch Queue",
                "queueKey": mail_key,
                "size": mail_size,
                "backpressureStatus": eval_status(mail_size),
                "type": "STANDARD",
                "description": "Pending verification codes, password resets & OTP emails",
                "safeThreshold": 10,
                "highThreshold": 50,
            },
            {
                "queueName": "Delete Cascade Queue",
                "queueKey": delete_key,
                "size": delete_size,
                "backpressureStatus": eval_status(delete_size),
                "type": "STANDARD",
                "description": "Cloud resource cleanup events (Algolia, Recombee, ImageKit, S3)",
                "safeThreshold": 10,
                "highThreshold": 50,
            },
            {
                "queueName": "Mail Dead-Letter Queue",
                "queueKey": mail_dlq_key,
                "size": mail_dlq_size,
                "backpressureStatus": "ALERT" if mail_dlq_size > 0 else "HEALTHY",
                "type": "DLQ",
                "description": "Failed email jobs requiring inspection (SMTP rate-limit or bad recipient)",
                "safeThreshold": 0,
                "highThreshold": 5,
            },
        ]

        total_queued = audio_size + mail_size + delete_size + mail_dlq_size
        if mail_dlq_size > 0:
            overall_status = "DLQ_ALERT"
        elif audio_size >= 50 or mail_size >= 50 or delete_size >= 50:
            overall_status = "HIGH"
        elif audio_size >= 10 or mail_size >= 10 or delete_size >= 10:
            overall_status = "MODERATE"
        else:
            overall_status = "HEALTHY"

        return {
            "totalQueued": total_queued,
            "overallStatus": overall_status,
            "audioProcessingQueueSize": audio_size,
            "mailQueueSize": mail_size,
            "deleteQueueSize": delete_size,
            "mailDlqSize": mail_dlq_size,
            "queues": queues,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @classmethod
    def queue_audio_processing(cls, job_id: str) -> None:
        try:
            r = cls.get_client()
            payload = json.dumps({"jobId": job_id})
            r.rpush(settings.REDIS_AUDIO_PROCESSING_QUEUE, payload)
            logger.info("Queued audio processing job [%s] in Redis list '%s'", job_id, settings.REDIS_AUDIO_PROCESSING_QUEUE)
        except Exception as e:
            logger.error("Failed to push audio processing job [%s] to Redis: %s", job_id, e)
            raise

    @classmethod
    def remove_job_from_audio_queue(cls, job_id: str) -> None:
        try:
            r = cls.get_client()
            payload = json.dumps({"jobId": job_id})
            removed = r.lrem(settings.REDIS_AUDIO_PROCESSING_QUEUE, 0, payload)
            logger.info("Removed %s occurrences of job [%s] from Redis queue", removed, job_id)
        except Exception as e:
            logger.warning("Failed to remove job [%s] from Redis queue: %s", job_id, e)

    @classmethod
    def cancel_job(cls, job_id: str) -> None:
        try:
            r = cls.get_client()
            payload = json.dumps({"jobId": job_id})
            r.rpush(settings.REDIS_CANCEL_QUEUE, payload)
            logger.info("Pushed cancel event for job [%s] to Redis queue '%s'", job_id, settings.REDIS_CANCEL_QUEUE)
        except Exception as e:
            logger.warning("Failed to push cancellation event for job [%s]: %s", job_id, e)

    @classmethod
    def queue_delete_event(cls, data: Dict[str, Any]) -> str:
        job_id = data.get("deleteJobId") or str(uuid.uuid4())
        is_new = not DeleteJob.objects.filter(id=job_id).exists()
        old_status = None

        if is_new:
            job = DeleteJob.objects.create(
                id=job_id,
                entity_type=data.get("entityType"),
                entity_id=data.get("entityId"),
                entity_title=data.get("entityTitle"),
                song_key=data.get("songKey"),
                image_key=data.get("imageKey"),
                cover_image_key=data.get("coverImageKey"),
                video_key=data.get("videoKey"),
                full_video_key=data.get("fullVideoKey"),
                status="PENDING",
                current_stage="QUEUED",
                attempt_count=1,
                max_attempts=3,
            )
            PaginationMetadataService.increment_delete_job()
        else:
            job = DeleteJob.objects.get(id=job_id)
            old_status = job.status
            job.status = "PENDING"
            job.current_stage = "QUEUED"
            job.attempt_count = (job.attempt_count or 0) + 1
            job.failure_reason = None
            job.failed_at = None
            job.save()
            PaginationMetadataService.transition_delete_job(old_status, "PENDING")

        payload = {
            "deleteJobId": job_id,
            "entityType": data.get("entityType"),
            "entityId": data.get("entityId"),
            "entityTitle": data.get("entityTitle"),
            "songKey": data.get("songKey"),
            "imageKey": data.get("imageKey"),
            "coverImageKey": data.get("coverImageKey"),
            "videoKey": data.get("videoKey"),
            "fullVideoKey": data.get("fullVideoKey"),
        }

        try:
            r = cls.get_client()
            r.rpush(settings.REDIS_DELETE_QUEUE, json.dumps(payload))
            logger.info("Queued delete event for %s:%s (job [%s]) to Redis", data.get("entityType"), data.get("entityId"), job_id)
        except Exception as e:
            logger.error("Failed to push delete event to Redis: %s", e)
            raise

        return job_id

    @classmethod
    def block_user_in_redis(cls, user_id: str) -> None:
        if not user_id:
            return
        try:
            r = cls.get_client()
            r.setex(f"blocked_user:{user_id}", 7 * 86400, "blocked")
            logger.info("User [%s] marked blocked in Redis cache", user_id)
        except Exception as e:
            logger.warning("Failed to set blocked user in Redis: %s", e)

    @classmethod
    def unblock_user_in_redis(cls, user_id: str) -> None:
        if not user_id:
            return
        try:
            r = cls.get_client()
            r.delete(f"blocked_user:{user_id}")
            logger.info("User [%s] unblocked in Redis cache", user_id)
        except Exception as e:
            logger.warning("Failed to delete blocked user in Redis: %s", e)

    @classmethod
    def is_user_blocked(cls, user_id: str) -> bool:
        if not user_id:
            return False
        try:
            r = cls.get_client()
            return bool(r.exists(f"blocked_user:{user_id}"))
        except Exception as e:
            logger.warning("Failed to check blocked user status in Redis: %s", e)
            return False

    @classmethod
    def evict_pagination_cache(cls, entity_name: str) -> None:
        """
        Evicts the Spring Boot / CoreEngine Redis cache entry for the specified pagination metadata entity.
        Spring Data Redis cache key default format: 'paginationMetaData::<entityName>'
        """
        if not entity_name:
            return
        try:
            r = cls.get_client()
            r.delete(f"paginationMetaData::{entity_name}")
            logger.info("Evicted Redis pagination cache for '%s'", entity_name)
        except Exception as e:
            logger.warning("Failed to evict Redis pagination cache for '%s': %s", entity_name, e)

    @classmethod
    def evict_all_pagination_cache(cls) -> None:
        """
        Evicts all Spring Boot / CoreEngine Redis cache entries for pagination metadata.
        """
        try:
            r = cls.get_client()
            cursor = 0
            keys_to_del = []
            while True:
                cursor, keys = r.scan(cursor=cursor, match="paginationMetaData::*", count=100)
                if keys:
                    keys_to_del.extend(keys)
                if cursor == 0:
                    break
            if keys_to_del:
                r.delete(*keys_to_del)
                logger.info("Evicted %d pagination metadata keys from Redis cache", len(keys_to_del))
        except Exception as e:
            logger.warning("Failed to evict all Redis pagination cache: %s", e)


# ==============================================================================
# 2. S3 Blob Storage Service
# ==============================================================================

class S3Service:
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            kwargs = {
                "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
                "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
                "region_name": settings.AWS_REGION,
            }
            if getattr(settings, "AWS_ENDPOINT", None):
                kwargs["endpoint_url"] = settings.AWS_ENDPOINT
            cls._client = boto3.client("s3", **kwargs)
        return cls._client

    @classmethod
    def generate_presigned_upload_url(cls, key: str, bucket: Optional[str] = None, expires_in_minutes: int = 30) -> str:
        b = bucket or settings.S3_TEMP_BUCKET
        client = cls.get_client()
        url = client.generate_presigned_url(
            "put_object",
            Params={"Bucket": b, "Key": key},
            ExpiresIn=expires_in_minutes * 60,
        )
        return url

    @classmethod
    def delete_object(cls, key: str, bucket: Optional[str] = None) -> None:
        if not key:
            return
        b = bucket or settings.S3_PRODUCTION_BUCKET
        try:
            client = cls.get_client()
            client.delete_object(Bucket=b, Key=key)
            logger.info("Deleted S3 object '%s' from bucket '%s'", key, b)
        except Exception as e:
            logger.warning("Failed to delete S3 object '%s' from bucket '%s': %s", key, b, e)

    @classmethod
    def delete_prefix(cls, prefix: str, bucket: Optional[str] = None) -> None:
        if not prefix:
            return
        b = bucket or settings.S3_PRODUCTION_BUCKET
        try:
            client = cls.get_client()
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=b, Prefix=prefix):
                contents = page.get("Contents", [])
                if not contents:
                    continue
                to_delete = [{"Key": obj["Key"]} for obj in contents]
                client.delete_objects(Bucket=b, Delete={"Objects": to_delete})
                logger.info("Deleted %d objects under prefix '%s' from bucket '%s'", len(to_delete), prefix, b)
        except Exception as e:
            logger.warning("Failed to delete S3 prefix '%s' from bucket '%s': %s", prefix, b, e)


# ==============================================================================
# 3. ImageKit Storage Service
# ==============================================================================

class ImageKitService:
    @classmethod
    def generate_upload_params(cls) -> Dict[str, Any]:
        key = str(uuid.uuid4())
        token = str(uuid.uuid4())
        expire = int(time.time()) + 1800
        private_key = settings.IMAGEKIT_PRIVATE_KEY

        signature = hmac.new(
            private_key.encode("utf-8"),
            f"{token}{expire}".encode("utf-8"),
            hashlib.sha1,
        ).hexdigest()

        return {
            "key": key,
            "param": {
                "token": token,
                "expire": expire,
                "signature": signature,
            },
        }

    @classmethod
    def delete_by_key(cls, key: str) -> None:
        if not key or not settings.IMAGEKIT_PRIVATE_KEY:
            return
        try:
            file_name = key.split("/")[-1] if "/" in key else key
            auth = (settings.IMAGEKIT_PRIVATE_KEY, "")

            # Search by fileName
            res = requests.get(
                "https://api.imagekit.io/v1/files",
                params={"searchQuery": f'name = "{file_name}"'},
                auth=auth,
                timeout=5,
            )
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, list) and len(data) > 0:
                    for item in data:
                        file_id = item.get("fileId")
                        if file_id:
                            requests.delete(f"https://api.imagekit.io/v1/files/{file_id}", auth=auth, timeout=5)
                            logger.info("Deleted ImageKit file ID '%s' for key '%s'", file_id, key)
                    return

            # Direct fallback deletion
            requests.delete(f"https://api.imagekit.io/v1/files/{key}", auth=auth, timeout=5)
        except Exception as e:
            logger.warning("Failed to delete ImageKit asset for key '%s': %s", key, e)


# ==============================================================================
# 4. Algolia Search Service
# ==============================================================================

class AlgoliaService:
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None and settings.ALGOLIA_APP_ID and settings.ALGOLIA_API_KEY:
            from algoliasearch.search.client import SearchClientSync
            cls._client = SearchClientSync(settings.ALGOLIA_APP_ID, settings.ALGOLIA_API_KEY)
        return cls._client

    @classmethod
    def save_song(
        cls,
        song: Optional[Song] = None,
        song_id: Optional[str] = None,
        title: Optional[str] = None,
        artist_name: Optional[str] = None,
        language: Optional[str] = None,
        duration: Optional[int] = None,
        image_key: Optional[str] = None,
        video_key: Optional[str] = None,
        full_video_key: Optional[str] = None,
        song_key: Optional[str] = None,
        job_id: Optional[str] = None,
        preview_start_time: Optional[int] = None,
        preview_end_time: Optional[int] = None,
        lrclib_id: Optional[str] = None,
    ) -> None:
        client = cls.get_client()
        if not client:
            return
        try:
            s_id = song.id if song else song_id
            s_title = song.title if song else title
            s_artist = song.artist_name if song else artist_name
            s_lang = song.language if song else language
            s_dur = song.duration if song else duration
            s_img = song.image_key if song else image_key
            s_vid = song.video_key if song else video_key
            s_full_vid = song.full_video_key if song else full_video_key
            s_skey = song.song_key if song else song_key
            s_jid = song.job_id if song else job_id

            record = {
                "objectID": s_id,
                "type": "song",
                "title": s_title,
                "artistName": s_artist,
                "duration": s_dur,
                "songKey": s_skey or "",
                "imageKey": s_img,
                "videoKey": s_vid,
                "fullVideoKey": s_full_vid,
                "previewStartTime": preview_start_time,
                "previewEndTime": preview_end_time,
                "language": s_lang or "unknown",
                "lrclibId": lrclib_id,
                "jobId": s_jid,
            }
            client.save_object(index_name=settings.ALGOLIA_INDEX_NAME, body=record)
            logger.info("Saved song [%s] to Algolia index", s_id)
        except Exception as e:
            logger.warning("Algolia save song [%s] failed: %s", s_id if 's_id' in locals() else 'unknown', e)

    @classmethod
    def save_artist(cls, artist: Artist) -> None:
        client = cls.get_client()
        if not client:
            return
        try:
            record = {
                "objectID": artist.id,
                "type": "artist",
                "name": artist.name,
            }
            client.save_object(index_name=settings.ALGOLIA_INDEX_NAME, body=record)
            logger.info("Saved artist [%s] to Algolia index", artist.id)
        except Exception as e:
            logger.warning("Algolia save artist [%s] failed: %s", artist.id, e)

    @classmethod
    def save_playlist(cls, playlist: Playlist) -> None:
        client = cls.get_client()
        if not client:
            return
        try:
            record = {
                "objectID": playlist.id,
                "type": "playlist",
                "name": playlist.name,
            }
            client.save_object(index_name=settings.ALGOLIA_INDEX_NAME, body=record)
            logger.info("Saved playlist [%s] to Algolia index", playlist.id)
        except Exception as e:
            logger.warning("Algolia save playlist [%s] failed: %s", playlist.id, e)

    @classmethod
    def delete_object(cls, object_id: str) -> None:
        client = cls.get_client()
        if not client or not object_id:
            return
        try:
            client.delete_object(index_name=settings.ALGOLIA_INDEX_NAME, object_id=object_id)
            logger.info("Deleted object [%s] from Algolia index", object_id)
        except Exception as e:
            logger.warning("Algolia delete object [%s] failed: %s", object_id, e)

    @classmethod
    def delete_record(cls, object_id: str) -> None:
        cls.delete_object(object_id)


# ==============================================================================
# 5. Recombee Recommendation Service
# ==============================================================================

class RecombeeService:
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None and settings.RECOMBEE_DATABASE_ID and settings.RECOMBEE_DATABASE_SECRET:
            from recombee_api_client.api_client import RecombeeClient, Region
            region_str = getattr(settings, "RECOMBEE_DATABASE_REGION", "EU_WEST").upper()
            region = Region.EU_WEST if "EU" in region_str else Region.US_WEST
            cls._client = RecombeeClient(settings.RECOMBEE_DATABASE_ID, settings.RECOMBEE_DATABASE_SECRET, region=region)
        return cls._client

    @classmethod
    def save_song(cls, song_id: str, title: str, artist_name: str, language: str, genre: Optional[str] = None, duration: Optional[int] = None) -> None:
        client = cls.get_client()
        if not client:
            return
        from recombee_api_client.api_requests import SetItemValues
        values = {
            "title": title,
            "artistName": artist_name,
            "language": language,
        }
        if genre and genre.strip():
            values["genre"] = genre.strip()
        if duration and duration > 0:
            values["duration"] = duration
        try:
            client.send(SetItemValues(song_id, values, cascade_create=True))
            logger.info("Saved song [%s] to Recombee catalogue", song_id)
        except Exception as e:
            logger.warning("Recombee save song [%s] failed: %s", song_id, e)

    @classmethod
    def delete_song(cls, song_id: str) -> None:
        client = cls.get_client()
        if not client or not song_id:
            return
        from recombee_api_client.api_requests import DeleteItem
        try:
            client.send(DeleteItem(song_id))
            logger.info("Deleted song [%s] from Recombee catalogue", song_id)
        except Exception as e:
            logger.warning("Recombee delete song [%s] failed: %s", song_id, e)

    @classmethod
    def delete_user(cls, user_id: str) -> None:
        client = cls.get_client()
        if not client or not user_id:
            return
        from recombee_api_client.api_requests import DeleteUser
        try:
            client.send(DeleteUser(user_id))
            logger.info("Deleted user [%s] from Recombee database", user_id)
        except Exception as e:
            logger.warning("Recombee delete user [%s] failed: %s", user_id, e)

    @classmethod
    def reindex_all_active_songs(cls, songs: List[Song]) -> int:
        client = cls.get_client()
        if not client or not songs:
            return 0
        from recombee_api_client.api_requests import Batch, SetItemValues
        requests_list = []
        for s in songs:
            vals = {
                "title": s.title,
                "artistName": s.artist_name,
                "language": s.language,
            }
            if s.genre and s.genre.strip():
                vals["genre"] = s.genre.strip()
            if s.duration and s.duration > 0:
                vals["duration"] = s.duration
            requests_list.append(SetItemValues(s.id, vals, cascade_create=True))

        try:
            client.send(Batch(requests_list))
            logger.info("Re-indexed %d songs in Recombee", len(requests_list))
            return len(requests_list)
        except Exception as e:
            logger.error("Failed batch reindex in Recombee: %s", e)
            raise


# ==============================================================================
# 6. External Job Notification & Cancellation
# ==============================================================================

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
                requests.post(
                    f"{settings.AUDIO_PROCESSING_URL.rstrip('/')}/jobs/{job_id}/cleanup",
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


# ==============================================================================
# 7. Pagination Metadata Service
# ==============================================================================

class PaginationMetadataService:
    @classmethod
    def get_metadata(cls, entity_name: str) -> Optional[PaginationMetadata]:
        try:
            return PaginationMetadata.objects.filter(entity_name=entity_name).first()
        except Exception as e:
            logger.warning("Error fetching pagination metadata for '%s': %s", entity_name, e)
            return None

    @classmethod
    def increment_status(cls, entity_name: str, status: str) -> None:
        try:
            meta = PaginationMetadata.objects.filter(entity_name=entity_name).first()
            if not meta:
                meta = PaginationMetadata(
                    id=str(uuid.uuid4()),
                    entity_name=entity_name,
                    total_count=0,
                    active_count=0,
                    blocked_count=0,
                    deleted_count=0,
                )
            meta.total_count += 1
            st = (status or "").upper()
            if st == "ACTIVE":
                meta.active_count += 1
            elif st == "BLOCKED":
                meta.blocked_count += 1
            elif st == "DELETED":
                meta.deleted_count += 1
            meta.save()
            RedisService.evict_pagination_cache(entity_name)
        except Exception as e:
            logger.warning("Failed to increment status for '%s': %s", entity_name, e)

    @classmethod
    def decrement_status(cls, entity_name: str, status: str) -> None:
        try:
            meta = PaginationMetadata.objects.filter(entity_name=entity_name).first()
            if not meta:
                return
            meta.total_count = max(0, meta.total_count - 1)
            st = (status or "").upper()
            if st == "ACTIVE":
                meta.active_count = max(0, meta.active_count - 1)
            elif st == "BLOCKED":
                meta.blocked_count = max(0, meta.blocked_count - 1)
            elif st == "DELETED":
                meta.deleted_count = max(0, meta.deleted_count - 1)
            meta.save()
            RedisService.evict_pagination_cache(entity_name)
        except Exception as e:
            logger.warning("Failed to decrement status for '%s': %s", entity_name, e)

    @classmethod
    def transition_status(cls, entity_name: str, old_status: str, new_status: str) -> None:
        try:
            if (old_status or "").upper() == (new_status or "").upper():
                return
            meta = PaginationMetadata.objects.filter(entity_name=entity_name).first()
            if not meta:
                meta = PaginationMetadata(
                    id=str(uuid.uuid4()),
                    entity_name=entity_name,
                    total_count=0,
                    active_count=0,
                    blocked_count=0,
                    deleted_count=0,
                )
            old_st = (old_status or "").upper()
            new_st = (new_status or "").upper()
            if old_st == "ACTIVE":
                meta.active_count = max(0, meta.active_count - 1)
            elif old_st == "BLOCKED":
                meta.blocked_count = max(0, meta.blocked_count - 1)
            elif old_st == "DELETED":
                meta.deleted_count = max(0, meta.deleted_count - 1)

            if new_st == "ACTIVE":
                meta.active_count += 1
            elif new_st == "BLOCKED":
                meta.blocked_count += 1
            elif new_st == "DELETED":
                meta.deleted_count += 1
            meta.save()
            RedisService.evict_pagination_cache(entity_name)
        except Exception as e:
            logger.warning("Failed to transition status for '%s': %s", entity_name, e)

    @classmethod
    def increment_job(cls) -> None:
        cls.increment_status("JobsEntity", "ACTIVE")

    @classmethod
    def decrement_job(cls, status: Optional[str]) -> None:
        cls.decrement_status("JobsEntity", status or "ACTIVE")

    @classmethod
    def transition_job(cls, old_status: Optional[str], new_status: str) -> None:
        cls.transition_status("JobsEntity", old_status or "PENDING", new_status)

    @classmethod
    def increment_delete_job(cls) -> None:
        cls.increment_status("DeleteJobsEntity", "ACTIVE")

    @classmethod
    def decrement_delete_job(cls, status: Optional[str]) -> None:
        cls.decrement_status("DeleteJobsEntity", status or "ACTIVE")

    @classmethod
    def transition_delete_job(cls, old_status: Optional[str], new_status: str) -> None:
        cls.transition_status("DeleteJobsEntity", old_status or "PENDING", new_status)

    @classmethod
    def _save_or_update(cls, entity_name: str, total: int, active: int, blocked: int, deleted: int) -> PaginationMetadata:
        meta = PaginationMetadata.objects.filter(entity_name=entity_name).first()
        if meta:
            meta.total_count = total
            meta.active_count = active
            meta.blocked_count = blocked
            meta.deleted_count = deleted
            meta.save()
        else:
            meta = PaginationMetadata.objects.create(
                id=str(uuid.uuid4()),
                entity_name=entity_name,
                total_count=total,
                active_count=active,
                blocked_count=blocked,
                deleted_count=deleted,
            )
        RedisService.evict_pagination_cache(entity_name)
        return meta

    @classmethod
    def sync_all_metadata(cls) -> Dict[str, Any]:
        """
        Reconciles actual DB table counts with pagination_metadata rows and flushes Redis cache.
        """
        results = {}

        # 1. UsersEntity
        users_total = User.objects.count()
        users_active = User.objects.filter(status="ACTIVE").count()
        users_blocked = User.objects.filter(status="BLOCKED").count()
        users_deleted = User.objects.filter(status="DELETED").count()
        u_meta = cls._save_or_update("UsersEntity", users_total, users_active, users_blocked, users_deleted)
        results["UsersEntity"] = {
            "id": u_meta.id,
            "entityName": u_meta.entity_name,
            "totalCount": u_meta.total_count,
            "activeCount": u_meta.active_count,
            "blockedCount": u_meta.blocked_count,
            "deletedCount": u_meta.deleted_count,
        }

        # 2. SongsEntity
        songs_total = Song.objects.count()
        songs_active = Song.objects.filter(status="ACTIVE").count()
        songs_blocked = Song.objects.filter(status="BLOCKED").count()
        songs_deleted = Song.objects.filter(status="DELETED").count()
        s_meta = cls._save_or_update("SongsEntity", songs_total, songs_active, songs_blocked, songs_deleted)
        results["SongsEntity"] = {
            "id": s_meta.id,
            "entityName": s_meta.entity_name,
            "totalCount": s_meta.total_count,
            "activeCount": s_meta.active_count,
            "blockedCount": s_meta.blocked_count,
            "deletedCount": s_meta.deleted_count,
        }

        # 3. ArtistsEntity
        artists_total = Artist.objects.count()
        artists_active = Artist.objects.filter(status="ACTIVE").count()
        artists_blocked = Artist.objects.filter(status="BLOCKED").count()
        artists_deleted = Artist.objects.filter(status="DELETED").count()
        a_meta = cls._save_or_update("ArtistsEntity", artists_total, artists_active, artists_blocked, artists_deleted)
        results["ArtistsEntity"] = {
            "id": a_meta.id,
            "entityName": a_meta.entity_name,
            "totalCount": a_meta.total_count,
            "activeCount": a_meta.active_count,
            "blockedCount": a_meta.blocked_count,
            "deletedCount": a_meta.deleted_count,
        }

        # 4. PlaylistsEntity
        playlists_total = Playlist.objects.count()
        playlists_active = Playlist.objects.filter(status="ACTIVE").count()
        playlists_blocked = Playlist.objects.filter(status="BLOCKED").count()
        playlists_deleted = Playlist.objects.filter(status="DELETED").count()
        p_meta = cls._save_or_update("PlaylistsEntity", playlists_total, playlists_active, playlists_blocked, playlists_deleted)
        results["PlaylistsEntity"] = {
            "id": p_meta.id,
            "entityName": p_meta.entity_name,
            "totalCount": p_meta.total_count,
            "activeCount": p_meta.active_count,
            "blockedCount": p_meta.blocked_count,
            "deletedCount": p_meta.deleted_count,
        }

        # 5. JobsEntity
        jobs_total = Job.objects.count()
        jobs_active = Job.objects.filter(status__in=["PENDING", "PROCESSING", "QUEUED"]).count()
        jobs_failed = Job.objects.filter(status="FAILED").count()
        jobs_completed = Job.objects.filter(status="COMPLETED").count()
        j_meta = cls._save_or_update("JobsEntity", jobs_total, jobs_active, jobs_failed, jobs_completed)
        results["JobsEntity"] = {
            "id": j_meta.id,
            "entityName": j_meta.entity_name,
            "totalCount": j_meta.total_count,
            "activeCount": j_meta.active_count,
            "blockedCount": j_meta.blocked_count,
            "deletedCount": j_meta.deleted_count,
        }

        # 6. DeleteJobsEntity
        del_jobs_total = DeleteJob.objects.count()
        del_jobs_active = DeleteJob.objects.filter(status__in=["PENDING", "IN_PROGRESS"]).count()
        del_jobs_failed = DeleteJob.objects.filter(status="FAILED").count()
        del_jobs_completed = DeleteJob.objects.filter(status="COMPLETED").count()
        dj_meta = cls._save_or_update("DeleteJobsEntity", del_jobs_total, del_jobs_active, del_jobs_failed, del_jobs_completed)
        results["DeleteJobsEntity"] = {
            "id": dj_meta.id,
            "entityName": dj_meta.entity_name,
            "totalCount": dj_meta.total_count,
            "activeCount": dj_meta.active_count,
            "blockedCount": dj_meta.blocked_count,
            "deletedCount": dj_meta.deleted_count,
        }

        # 7. Reconcile PlaylistSongs metadata for all playlists
        for pl in Playlist.objects.all():
            count = PlaylistSong.objects.filter(playlist=pl).count()
            cls._save_or_update(f"PlaylistSongs_{pl.id}", count, count, 0, 0)

        # 8. Reconcile ArtistSongs metadata for all artists
        for art in Artist.objects.all():
            count = Song.objects.filter(
                Q(artist_name__iexact=art.name) | Q(artist_name__icontains=art.name),
                status="ACTIVE",
            ).count()
            cls._save_or_update(f"ArtistSongs_{art.id}", count, count, 0, 0)

        # Evict all Spring Boot / CoreEngine Redis cache entries
        RedisService.evict_all_pagination_cache()

        logger.info("Pagination metadata reconciliation complete: %s", results)
        return results



# ==============================================================================
# 8. Admin Authentication & OTP Service
# ==============================================================================

class AdminAuthService:
    """Handles admin authentication, OTP generation/validation, and JWT issuing."""
    _MEMORY_OTP_CACHE: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def generate_otp() -> str:
        return f"{secrets.randbelow(1000000):06d}"

    @classmethod
    def create_temp_token(cls, email: str, purpose: str = "LOGIN") -> str:
        payload = {
            "email": email.strip().lower(),
            "purpose": purpose,
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,  # 10 minutes validity
        }
        return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

    @classmethod
    def decode_temp_token(cls, temp_token: str) -> Optional[Dict[str, Any]]:
        if not temp_token:
            return None
        try:
            return jwt.decode(
                temp_token,
                settings.JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_signature": True, "verify_exp": True},
            )
        except Exception as e:
            logger.warning("Failed to decode admin temp token: %s", e)
            return None

    @classmethod
    def save_otp(cls, email: str, data: Dict[str, Any], ttl_seconds: int = 600) -> None:
        norm_email = email.strip().lower()
        key = f"admin:otp:{norm_email}"
        data["expires_at"] = time.time() + ttl_seconds
        try:
            r = RedisService.get_client()
            r.setex(key, ttl_seconds, json.dumps(data))
        except Exception as e:
            logger.debug("Redis unavailable for OTP, falling back to memory: %s", e)
        cls._MEMORY_OTP_CACHE[norm_email] = data

    @classmethod
    def get_otp(cls, email: str) -> Optional[Dict[str, Any]]:
        norm_email = email.strip().lower()
        key = f"admin:otp:{norm_email}"
        try:
            r = RedisService.get_client()
            raw = r.get(key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
        cached = cls._MEMORY_OTP_CACHE.get(norm_email)
        if cached:
            if cached.get("expires_at", 0) > time.time():
                return cached
            del cls._MEMORY_OTP_CACHE[norm_email]
        return None

    @classmethod
    def delete_otp(cls, email: str) -> None:
        norm_email = email.strip().lower()
        key = f"admin:otp:{norm_email}"
        try:
            r = RedisService.get_client()
            r.delete(key)
        except Exception:
            pass
        cls._MEMORY_OTP_CACHE.pop(norm_email, None)

    @classmethod
    def notify_otp(cls, email: str, purpose: str, otp: str) -> None:
        # 1. Output clearly in console for instant developer feedback
        print("\n" + "=" * 60)
        print(f" [ADMIN AUTH OTP] Purpose: {purpose} | Email: {email}")
        print(f" >>> VERIFICATION OTP CODE: {otp} <<< (Valid 10 mins)")
        print("=" * 60 + "\n")
        logger.info("[ADMIN AUTH] Generated OTP for %s (%s): %s", email, purpose, otp)

        # 2. Push to Redis mail queue if running
        # Payload must match MailQueueDto format expected by mailEvents worker:
        # { "to": email, "subject": purpose, "otp": code }
        try:
            r = RedisService.get_client()
            payload = {
                "to": email,
                "subject": purpose,
                "otp": otp,
            }
            r.rpush(settings.REDIS_MAIL_QUEUE, json.dumps(payload))
        except Exception as e:
            logger.warning("Failed to push OTP to mail queue: %s", e)
            print(f" [WARN] Could not push OTP to Redis mail queue: {e}")

    @classmethod
    def issue_tokens_for_admin(cls, admin: Admin) -> Dict[str, str]:
        now = int(time.time())
        payload = {
            "id": admin.id,
            "sub": admin.id,
            "email": admin.email,
            "userName": admin.name or admin.email.split("@")[0],
            "name": admin.name or admin.email.split("@")[0],
            "role": admin.role,
            "status": admin.status,
            "iat": now,
            "exp": now + 86400,  # 24 hours access token
        }
        refresh_payload = {
            "id": admin.id,
            "sub": admin.id,
            "email": admin.email,
            "userName": admin.name or admin.email.split("@")[0],
            "name": admin.name or admin.email.split("@")[0],
            "role": admin.role,
            "status": admin.status,
            "iat": now,
            "exp": now + (30 * 86400),  # 30 days refresh token
        }
        access_token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
        refresh_token = jwt.encode(refresh_payload, settings.JWT_SECRET, algorithm="HS256")
        return {
            "accessToken": access_token,
            "refreshToken": refresh_token,
        }


