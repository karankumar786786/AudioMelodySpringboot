import json
import logging
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

import redis
from django.conf import settings

logger = logging.getLogger(__name__)

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
        from jobs.models import DeleteJob
        from .pagination_metadata_service import PaginationMetadataService

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

    # In-memory session fallbacks
    _MEMORY_SESSIONS: Dict[str, Dict[str, Any]] = {}
    _MEMORY_USER_SESSIONS: Dict[str, set] = {}
    _MEMORY_REFRESH_SESSIONS: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def create_admin_session(
        cls,
        admin: Any,
        ip_address: str = "127.0.0.1",
        user_agent: str = "Unknown",
        ttl_seconds: int = 7 * 86400,
    ) -> str:
        """
        Creates a stateful admin session in Redis with 7-day TTL.
        Returns the unique session_id.
        """
        session_id = str(uuid.uuid4())
        norm_email = admin.email.strip().lower()
        now_iso = datetime.now(timezone.utc).isoformat()

        session_data = {
            "sessionId": session_id,
            "userId": admin.id,
            "email": norm_email,
            "userName": getattr(admin, "name", None) or getattr(admin, "user_name", "") or norm_email.split("@")[0],
            "role": admin.role,
            "status": admin.status,
            "ipAddress": ip_address,
            "userAgent": user_agent,
            "createdAt": now_iso,
            "lastActivityAt": now_iso,
            "expiresAt": time.time() + ttl_seconds,
        }

        try:
            r = cls.get_client()
            r.setex(f"admin:session:{session_id}", ttl_seconds, json.dumps(session_data))
            r.sadd(f"admin:user_sessions:{norm_email}", session_id)
            # Store last login summary for audit
            r.set(f"admin:last_login:{norm_email}", json.dumps({"at": now_iso, "ip": ip_address, "ua": user_agent}))
            logger.info("Created Redis admin session [%s] for %s (%s)", session_id, norm_email, admin.role)
        except Exception as e:
            logger.warning("Redis unavailable for session creation, using in-memory: %s", e)

        cls._MEMORY_SESSIONS[session_id] = session_data
        cls._MEMORY_USER_SESSIONS.setdefault(norm_email, set()).add(session_id)
        return session_id

    @classmethod
    def get_admin_session(cls, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves active admin session from Redis. Returns None if revoked or expired.
        """
        if not session_id:
            return None

        # Check in-memory sessions first (fast path for test suites and memory cache)
        cached = cls._MEMORY_SESSIONS.get(session_id)
        if cached:
            if cached.get("expiresAt", 0) > time.time():
                return cached
            cls.revoke_admin_session(session_id)
            return None

        try:
            r = cls.get_client()
            raw = r.get(f"admin:session:{session_id}")
            if raw and isinstance(raw, (str, bytes, bytearray)):
                return json.loads(raw)
        except Exception as e:
            logger.debug("Redis error retrieving session: %s", e)

        return None

    @classmethod
    def touch_admin_session(cls, session_id: str, sliding_window_ttl: int = 7 * 86400) -> None:
        """
        Refreshes the session's lastActivityAt timestamp and resets its TTL in Redis.
        """
        if not session_id:
            return
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            r = cls.get_client()
            raw = r.get(f"admin:session:{session_id}")
            if raw and isinstance(raw, (str, bytes, bytearray)):
                data = json.loads(raw)
                data["lastActivityAt"] = now_iso
                data["expiresAt"] = time.time() + sliding_window_ttl
                r.setex(f"admin:session:{session_id}", sliding_window_ttl, json.dumps(data))
                return
        except Exception:
            pass

        if session_id in cls._MEMORY_SESSIONS:
            cls._MEMORY_SESSIONS[session_id]["lastActivityAt"] = now_iso
            cls._MEMORY_SESSIONS[session_id]["expiresAt"] = time.time() + sliding_window_ttl

    @classmethod
    def revoke_admin_session(cls, session_id: str) -> bool:
        """
        Instantly revokes a specific admin session.
        """
        if not session_id:
            return False
        email = None
        try:
            r = cls.get_client()
            raw = r.get(f"admin:session:{session_id}")
            if raw and isinstance(raw, (str, bytes, bytearray)):
                data = json.loads(raw)
                email = data.get("email", "").lower()
                if email:
                    r.srem(f"admin:user_sessions:{email}", session_id)
            r.delete(f"admin:session:{session_id}")
            logger.info("Revoked Redis admin session [%s]", session_id)
        except Exception as e:
            logger.warning("Failed to revoke session in Redis: %s", e)

        cached = cls._MEMORY_SESSIONS.pop(session_id, None)
        if cached and not email:
            email = cached.get("email", "").lower()
        if email and email in cls._MEMORY_USER_SESSIONS:
            cls._MEMORY_USER_SESSIONS[email].discard(session_id)
        return True

    @classmethod
    def revoke_all_admin_sessions(cls, email: str, except_session_id: Optional[str] = None) -> int:
        """
        Revokes all active sessions for an admin user (e.g. on logout all devices or block).
        Optionally preserves except_session_id.
        """
        norm_email = email.strip().lower()
        count = 0
        try:
            r = cls.get_client()
            session_ids = r.smembers(f"admin:user_sessions:{norm_email}")
            for sid in session_ids:
                sid_str = sid.decode() if isinstance(sid, bytes) else str(sid)
                if except_session_id and sid_str == except_session_id:
                    continue
                r.delete(f"admin:session:{sid_str}")
                r.srem(f"admin:user_sessions:{norm_email}", sid_str)
                count += 1
            if not except_session_id:
                r.delete(f"admin:user_sessions:{norm_email}")
        except Exception as e:
            logger.warning("Failed to revoke all sessions in Redis: %s", e)

        mem_sids = list(cls._MEMORY_USER_SESSIONS.get(norm_email, set()))
        for sid in mem_sids:
            if except_session_id and sid == except_session_id:
                continue
            cls._MEMORY_SESSIONS.pop(sid, None)
            cls._MEMORY_USER_SESSIONS[norm_email].discard(sid)
            count += 1
        return count

    @classmethod
    def create_refresh_session(
        cls,
        session_id: str,
        admin: Any,
        ttl_seconds: int = 30 * 86400,
    ) -> str:
        """
        Creates a stateful refresh session in Redis with 30-day TTL.
        Tied to the access session_id and admin user.
        """
        refresh_id = f"ref_{secrets.token_urlsafe(32)}"
        norm_email = admin.email.strip().lower()
        now_iso = datetime.now(timezone.utc).isoformat()

        refresh_data = {
            "refreshSessionId": refresh_id,
            "sessionId": session_id,
            "userId": admin.id,
            "email": norm_email,
            "role": admin.role,
            "createdAt": now_iso,
            "expiresAt": time.time() + ttl_seconds,
        }

        try:
            r = cls.get_client()
            r.setex(f"admin:refresh:{refresh_id}", ttl_seconds, json.dumps(refresh_data))
            logger.info("Created Redis refresh session [%s] for %s", refresh_id, norm_email)
        except Exception as e:
            logger.warning("Redis unavailable for refresh session creation, using in-memory: %s", e)

        cls._MEMORY_REFRESH_SESSIONS[refresh_id] = refresh_data
        return refresh_id

    @classmethod
    def get_refresh_session(cls, refresh_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves active refresh session from Redis. Returns None if revoked or expired.
        """
        if not refresh_id:
            return None
        try:
            r = cls.get_client()
            raw = r.get(f"admin:refresh:{refresh_id}")
            if raw and isinstance(raw, (str, bytes, bytearray)):
                return json.loads(raw)
        except Exception as e:
            logger.debug("Redis error retrieving refresh session: %s", e)

        cached = cls._MEMORY_REFRESH_SESSIONS.get(refresh_id)
        if cached:
            if cached.get("expiresAt", 0) > time.time():
                return cached
            cls.revoke_refresh_session(refresh_id)
        return None

    @classmethod
    def revoke_refresh_session(cls, refresh_id: str) -> bool:
        """
        Revokes a refresh session in Redis.
        """
        if not refresh_id:
            return False
        try:
            r = cls.get_client()
            r.delete(f"admin:refresh:{refresh_id}")
            logger.info("Revoked Redis refresh session [%s]", refresh_id)
        except Exception as e:
            logger.warning("Failed to revoke refresh session in Redis: %s", e)

        cls._MEMORY_REFRESH_SESSIONS.pop(refresh_id, None)
        return True

    @classmethod
    def list_user_sessions(cls, email: str, current_session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Returns all active sessions for an administrator.
        """
        norm_email = email.strip().lower()
        sessions = []
        try:
            r = cls.get_client()
            session_ids = r.smembers(f"admin:user_sessions:{norm_email}")
            for sid in session_ids:
                sid_str = sid.decode() if isinstance(sid, bytes) else str(sid)
                raw = r.get(f"admin:session:{sid_str}")
                if raw:
                    sess = json.loads(raw)
                    sess["isCurrent"] = bool(current_session_id and sess.get("sessionId") == current_session_id)
                    sessions.append(sess)
                else:
                    r.srem(f"admin:user_sessions:{norm_email}", sid)
        except Exception:
            for sid in cls._MEMORY_USER_SESSIONS.get(norm_email, set()):
                if sid in cls._MEMORY_SESSIONS:
                    sess = dict(cls._MEMORY_SESSIONS[sid])
                    sess["isCurrent"] = bool(current_session_id and sess.get("sessionId") == current_session_id)
                    sessions.append(sess)

        sessions.sort(key=lambda s: s.get("createdAt", ""), reverse=True)
        return sessions

    @classmethod
    def update_session_user_name(cls, session_id: str, new_name: str) -> None:
        """
        Updates display name in an active session.
        """
        if not session_id:
            return
        try:
            r = cls.get_client()
            raw = r.get(f"admin:session:{session_id}")
            if raw:
                data = json.loads(raw)
                data["userName"] = new_name
                ttl = r.ttl(f"admin:session:{session_id}")
                if ttl > 0:
                    r.setex(f"admin:session:{session_id}", ttl, json.dumps(data))
        except Exception:
            pass
        if session_id in cls._MEMORY_SESSIONS:
            cls._MEMORY_SESSIONS[session_id]["userName"] = new_name


