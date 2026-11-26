"""Redis ke saare kaam: admin sessions, block list, mail queue, pagination cache, Inngest dispatch."""
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
    """Redis helper (1 second timeouts; Redis down ho to kuch cheezein memory me)."""
    _client: Optional[redis.Redis] = None

    @classmethod
    def get_client(cls) -> redis.Redis:
        """Redis client (ek baar banta hai)."""
        if cls._client is None:
            cls._client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                ssl=settings.REDIS_SSL,
                decode_responses=True,
                socket_connect_timeout=1.0,
                socket_timeout=1.0,
            )
        return cls._client

    @classmethod
    def get_queue_size(cls, queue_key: str) -> int:
        """Ek list (queue) ki length."""
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
        """Mail queue aur DLQ ka size aur halat (HEALTHY / ELEVATED / HIGH) dashboard ke liye."""
        mail_key = settings.REDIS_MAIL_QUEUE
        mail_dlq_key = f"{mail_key}_dlq"

        mail_size = cls.get_queue_size(mail_key)
        mail_dlq_size = cls.get_queue_size(mail_dlq_key)

        def eval_status(sz: int) -> str:
            """Size se halat: 50+ = HIGH, 10+ = ELEVATED, warna HEALTHY."""
            if sz >= 50:
                return "HIGH"
            if sz >= 10:
                return "ELEVATED"
            return "HEALTHY"

        queues = [
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

        total_queued = mail_size + mail_dlq_size
        if mail_dlq_size > 0:
            overall_status = "DLQ_ALERT"
        elif mail_size >= 50:
            overall_status = "HIGH"
        elif mail_size >= 10:
            overall_status = "MODERATE"
        else:
            overall_status = "HEALTHY"

        return {
            "totalQueued": total_queued,
            "overallStatus": overall_status,
            "audioProcessingQueueSize": 0,
            "mailQueueSize": mail_size,
            "deleteQueueSize": 0,
            "mailDlqSize": mail_dlq_size,
            "queues": queues,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @classmethod
    def queue_audio_processing(cls, job_id: str, attempt: Optional[int] = None) -> bool:
        """Upload job shuru: Inngest ko 'audio/fetchjob'."""
        from .inngest_service import InngestService
        # Seedha Inngest (Cloud/Dev) ko durable event
        try:
            success = InngestService.trigger_audio_job(job_id, attempt=attempt)
            if success:
                logger.info("Dispatched audio processing job [%s] directly to Inngest (attempt=%s)", job_id, attempt)
                return True
            else:
                logger.error("Failed to directly trigger Inngest for job [%s]", job_id)
                return False
        except Exception as e:
            logger.error("Failed to directly trigger Inngest for job [%s]: %s", job_id, e)
            return False

    @classmethod
    def remove_job_from_audio_queue(cls, job_id: str) -> None:
        """Ab kuch nahi karta: Redis wali audio queue hata di gayi, ab seedha Inngest chalta hai."""
        pass

    @classmethod
    def cancel_job(cls, job_id: str) -> None:
        """Job cancel event bhejo."""
        from .inngest_service import InngestService
        try:
            InngestService.trigger_cancel_job(job_id)
            logger.info("Dispatched Inngest cancellation event for [%s]", job_id)
        except Exception as e:
            logger.warning("Failed to dispatch Inngest cancellation event for [%s]: %s", job_id, e)

    @classmethod
    def queue_delete_event(cls, data: Dict[str, Any]) -> str:
        """Delete chain shuru: Inngest ko 'audio/delete.algolia'."""
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

        # Seedha Inngest (Cloud/Dev) ko durable event
        from .inngest_service import InngestService
        try:
            InngestService.trigger_delete_event(payload, attempt=job.attempt_count)
            logger.info("Dispatched delete event for %s:%s (job [%s], attempt=%s) to Inngest", data.get("entityType"), data.get("entityId"), job_id, job.attempt_count)
        except Exception as e:
            logger.error("Failed to directly trigger Inngest delete event for job [%s]: %s", job_id, e)

        return job_id

    @classmethod
    def block_user_in_redis(cls, user_id: str) -> None:
        """User ko block list me daalo (7 din)."""
        if not user_id:
            return
        cls._MEMORY_BLOCKED_USERS.add(user_id)
        try:
            r = cls.get_client()
            r.setex(f"blocked_user:{user_id}", 7 * 86400, "blocked")
            logger.info("User [%s] marked blocked in Redis cache", user_id)
        except Exception as e:
            logger.warning("Failed to set blocked user in Redis: %s", e)

    @classmethod
    def unblock_user_in_redis(cls, user_id: str) -> None:
        """Block list se hatao."""
        if not user_id:
            return
        cls._MEMORY_BLOCKED_USERS.discard(user_id)
        try:
            r = cls.get_client()
            r.delete(f"blocked_user:{user_id}")
            logger.info("User [%s] unblocked in Redis cache", user_id)
        except Exception as e:
            logger.warning("Failed to delete blocked user in Redis: %s", e)

    @classmethod
    def _memory_store_only(cls) -> bool:
        """Sessions sirf is process ki memory me hain? (tests) ADMIN_SESSION_STORE dekho."""
        return getattr(settings, "ADMIN_SESSION_STORE", "redis") == "memory"

    @classmethod
    def is_user_blocked(cls, user_id: str) -> bool:
        """User blocked hai?"""
        if not user_id:
            return False
        if cls._memory_store_only():
            return user_id in cls._MEMORY_BLOCKED_USERS
        # Redis hi asli source hai: doosre worker ne block/unblock kiya ho to wo
        # yahan bhi maanna chahiye. Is worker ka set sirf Redis down hone par backup hai.
        try:
            r = cls.get_client()
            return bool(r.exists(f"blocked_user:{user_id}"))
        except Exception as e:
            logger.warning("Failed to check blocked user status in Redis: %s", e)
            return user_id in cls._MEMORY_BLOCKED_USERS

    @classmethod
    def evict_pagination_cache(cls, entity_name: str) -> None:
        """Core API (Spring Boot) ke Redis cache se ek entity ki pagination entry hatao.
        Spring ki cache key ka format: 'paginationMetaData::<entityName>'.
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
        """Core API ke saare pagination cache entries hatao."""
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

    # Memory wale session aur blacklist backups (Redis down ho to)
    _MEMORY_SESSIONS: Dict[str, Dict[str, Any]] = {}
    _MEMORY_USER_SESSIONS: Dict[str, set] = {}
    _MEMORY_REFRESH_SESSIONS: Dict[str, Dict[str, Any]] = {}
    _MEMORY_BLOCKED_USERS: Set[str] = set()

    @classmethod
    def create_admin_session(
        cls,
        admin: Any,
        ip_address: str = "127.0.0.1",
        user_agent: str = "Unknown",
        ttl_seconds: int = 7 * 86400,
    ) -> str:
        """Redis me admin session banao (7 din TTL). Session id lautata hai."""
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
            # Audit ke liye aakhri login ki summary rakho
            r.set(f"admin:last_login:{norm_email}", json.dumps({"at": now_iso, "ip": ip_address, "ua": user_agent}))
            logger.info("Created Redis admin session [%s] for %s (%s)", session_id, norm_email, admin.role)
        except Exception as e:
            logger.warning("Redis unavailable for session creation, using in-memory: %s", e)

        cls._MEMORY_SESSIONS[session_id] = session_data
        cls._MEMORY_USER_SESSIONS.setdefault(norm_email, set()).add(session_id)
        return session_id

    @classmethod
    def get_admin_session(cls, session_id: str) -> Optional[Dict[str, Any]]:
        """Redis se admin session lao. Revoke ya expire ho gaya ho to None."""
        if not session_id:
            return None
        if cls._memory_store_only():
            return cls._get_memory_session(session_id)

        # Redis hi asli source hai. Har gunicorn worker apne banaye sessions ki memory copy rakhta hai;
        # pehle wo copy padhne se, doosre worker se revoke ya logout hua session
        # yahan expire hone tak chalta rehta.
        try:
            raw = cls.get_client().get(f"admin:session:{session_id}")
        except Exception as e:
            logger.warning("Redis unavailable reading admin session; using this worker's copy: %s", e)
            return cls._get_memory_session(session_id)

        if raw and isinstance(raw, (str, bytes, bytearray)):
            return json.loads(raw)
        # Redis me nahi hai = revoke ya expire ho gaya, kisi bhi worker ne kiya ho.
        cls._forget_memory_session(session_id)
        return None

    @classmethod
    def _get_memory_session(cls, session_id: str) -> Optional[Dict[str, Any]]:
        """Memory wali session copy (Redis down ho to)."""
        cached = cls._MEMORY_SESSIONS.get(session_id)
        if not cached:
            return None
        if cached.get("expiresAt", 0) > time.time():
            return cached
        cls.revoke_admin_session(session_id)
        return None

    @classmethod
    def _forget_memory_session(cls, session_id: str) -> None:
        """Memory copy hatao."""
        cached = cls._MEMORY_SESSIONS.pop(session_id, None)
        if cached:
            email = (cached.get("email") or "").lower()
            if email in cls._MEMORY_USER_SESSIONS:
                cls._MEMORY_USER_SESSIONS[email].discard(session_id)

    # Session ko max itni baar renew karo. Pehle har admin request pe renew hota tha (ek GET
    # aur ek SETEX), aur Upstash har command ka paisa leta hai; 7 din ki window 10 minute me
    # renew ho to kuch nahi bigadta, aur lastActivityAt 10 minute tak sahi rehta hai.
    SESSION_TOUCH_INTERVAL_SECONDS = 600

    @classmethod
    def touch_admin_session(
        cls,
        session_id: str,
        sliding_window_ttl: int = 7 * 86400,
        session: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Session ka lastActivityAt update karo aur TTL dobara shuru karo.

        Is request me pehle padha session pass karo to doosra GET bach jaata hai. Session pichle
        SESSION_TOUCH_INTERVAL_SECONDS me renew hua ho to write skip.
        """
        if not session_id:
            return
        now = time.time()
        if session is not None:
            expires_at = session.get("expiresAt")
            if isinstance(expires_at, (int, float)) and (
                expires_at - now > sliding_window_ttl - cls.SESSION_TOUCH_INTERVAL_SECONDS
            ):
                return
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            r = cls.get_client()
            data = session
            if data is None:
                raw = r.get(f"admin:session:{session_id}")
                if raw and isinstance(raw, (str, bytes, bytearray)):
                    data = json.loads(raw)
            if data is not None:
                data = {**data, "lastActivityAt": now_iso, "expiresAt": now + sliding_window_ttl}
                r.setex(f"admin:session:{session_id}", sliding_window_ttl, json.dumps(data))
                # Is worker ki memory copy bhi update karo, warna purana expiresAt
                # har agli request pe renew write karwata.
                if session_id in cls._MEMORY_SESSIONS:
                    cls._MEMORY_SESSIONS[session_id]["lastActivityAt"] = now_iso
                    cls._MEMORY_SESSIONS[session_id]["expiresAt"] = data["expiresAt"]
                return
        except Exception:
            pass

        if session_id in cls._MEMORY_SESSIONS:
            cls._MEMORY_SESSIONS[session_id]["lastActivityAt"] = now_iso
            cls._MEMORY_SESSIONS[session_id]["expiresAt"] = time.time() + sliding_window_ttl

    @classmethod
    def revoke_admin_session(cls, session_id: str) -> bool:
        """Ek admin session turant band karo."""
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
        """Admin ke saare sessions band karo (jaise sab devices se logout ya block). except_session_id ko chhod sakte hain."""
        norm_email = email.strip().lower()
        count = 0
        try:
            r = cls.get_client()
            session_ids = r.smembers(f"admin:user_sessions:{norm_email}")
            for sid in session_ids:
                sid_str = sid.decode() if isinstance(sid, bytes) else sid
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
        """Redis me refresh session banao (30 din TTL), access session aur admin se juda."""
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
        """Redis se refresh session lao. Revoke ya expire ho to None."""
        if not refresh_id:
            return None
        if not cls._memory_store_only():
            # Redis hi asli source hai: doosre worker se revoke hua refresh token
            # is worker ki memory copy me zinda nahi rehna chahiye.
            try:
                raw = cls.get_client().get(f"admin:refresh:{refresh_id}")
            except Exception as e:
                logger.warning("Redis unavailable reading refresh session; using this worker's copy: %s", e)
            else:
                if raw and isinstance(raw, (str, bytes, bytearray)):
                    return json.loads(raw)
                cls._MEMORY_REFRESH_SESSIONS.pop(refresh_id, None)
                return None

        cached = cls._MEMORY_REFRESH_SESSIONS.get(refresh_id)
        if cached:
            if cached.get("expiresAt", 0) > time.time():
                return cached
            cls.revoke_refresh_session(refresh_id)
        return None

    @classmethod
    def revoke_refresh_session(cls, refresh_id: str) -> bool:
        """Refresh session band karo."""
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
        """Admin ke saare active sessions."""
        norm_email = email.strip().lower()
        sessions = []
        try:
            r = cls.get_client()
            session_ids = r.smembers(f"admin:user_sessions:{norm_email}")
            for sid in session_ids:
                sid_str = sid.decode() if isinstance(sid, bytes) else sid
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
        """Active session me dikhne wala naam update karo."""
        if not session_id:
            return
        # Memory copy ho tab bhi Redis update karo, warna doosre workers
        # purana naam dikhate rahenge.
        if not cls._memory_store_only():
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


