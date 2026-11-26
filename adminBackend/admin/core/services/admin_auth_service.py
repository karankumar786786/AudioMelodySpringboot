"""Admin ka OTP login logic."""
import json
import logging
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from django.conf import settings
# pyrefly: ignore[missing-import]
from accounts.models import Admin
from .redis_service import RedisService

logger = logging.getLogger(__name__)

class AdminAuthService:
    """Admin login: OTP banana/check karna aur Redis session dena."""
    _MEMORY_OTP_CACHE: Dict[str, Dict[str, Any]] = {}
    _MEMORY_TEMP_TOKENS: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def generate_otp() -> str:
        """6 digit OTP banao (secure random)."""
        return f"{secrets.randbelow(1000000):06d}"

    @classmethod
    def create_temp_token(cls, email: str, purpose: str = "LOGIN") -> str:
        """Login ke beech ka temp token banao (email se juda)."""
        temp_token = f"tmp_{secrets.token_urlsafe(32)}"
        norm_email = email.strip().lower()
        payload = {
            "email": norm_email,
            "purpose": purpose,
            "createdAt": time.time(),
            "expiresAt": time.time() + 600,
        }
        try:
            r = RedisService.get_client()
            r.setex(f"admin:temp_token:{temp_token}", 600, json.dumps(payload))
        except Exception:
            pass
        cls._MEMORY_TEMP_TOKENS[temp_token] = payload
        return temp_token

    @classmethod
    def decode_temp_token(cls, temp_token: str) -> Optional[Dict[str, Any]]:
        """Temp token se email nikalo; galat/expire ho to None."""
        if not temp_token:
            return None
        if not RedisService._memory_store_only():
            # Redis hi asli source hai; is worker ki apni copy sirf tab ke liye hai jab Redis down ho.
            # Warna doosre worker pe use ho chuka token yahan phir bhi chal jaata.
            try:
                raw = RedisService.get_client().get(f"admin:temp_token:{temp_token}")
            except Exception:
                pass
            else:
                if raw:
                    return json.loads(raw)
                cls._MEMORY_TEMP_TOKENS.pop(temp_token, None)
                return None
        cached = cls._MEMORY_TEMP_TOKENS.get(temp_token)
        if cached and cached.get("expiresAt", 0) > time.time():
            return cached
        return None

    @classmethod
    def save_otp(cls, email: str, data: Dict[str, Any], ttl_seconds: int = 600) -> None:
        """OTP Redis me rakho (expiry ke saath); Redis down ho to memory copy."""
        norm_email = email.strip().lower()
        key = f"admin:otp:{norm_email}"
        data["expires_at"] = time.time() + ttl_seconds
        data.setdefault("failed_attempts", 0)
        data.setdefault("max_attempts", 5)
        try:
            r = RedisService.get_client()
            r.setex(key, ttl_seconds, json.dumps(data))
        except Exception as e:
            logger.debug("Redis unavailable for OTP, falling back to memory: %s", e)
        cls._MEMORY_OTP_CACHE[norm_email] = data

    @classmethod
    def get_otp(cls, email: str) -> Optional[Dict[str, Any]]:
        """OTP data lao (pehle Redis, Redis down ho tabhi memory)."""
        norm_email = email.strip().lower()
        key = f"admin:otp:{norm_email}"
        if not RedisService._memory_store_only():
            # Redis hi asli source hai. Key gayab hone pe is worker ki copy use karte
            # to use ho chuka ya lock hua OTP yahan dobara chal jaata, aur galat
            # attempts bhi 0 ho jaate. Copy sirf Redis down hone ke liye hai.
            try:
                raw = RedisService.get_client().get(key)
            except Exception:
                pass
            else:
                if raw:
                    return json.loads(raw)
                cls._MEMORY_OTP_CACHE.pop(norm_email, None)
                return None
        cached = cls._MEMORY_OTP_CACHE.get(norm_email)
        if cached:
            if cached.get("expires_at", 0) > time.time():
                return cached
            del cls._MEMORY_OTP_CACHE[norm_email]
        return None

    @classmethod
    def delete_otp(cls, email: str) -> None:
        """OTP hatao (use ho gaya ya lock)."""
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
        # 1. OTP login ki chaabi hai: kabhi log mat karo. Sirf local development me
        #    (DJANGO_DEBUG=true) aasani ke liye console pe print karo.
        """OTP email bhejo: event pipeline on ho to outbox se (30 sec fallback Redis), warna seedha Redis mail queue."""
        if settings.DEBUG:
            print("\n" + "=" * 60)
            print(f" [ADMIN AUTH OTP] Purpose: {purpose} | Email: {email}")
            print(f" >>> VERIFICATION OTP CODE: {otp} <<< (Valid 10 mins) [DEBUG only]")
            print("=" * 60 + "\n")
        logger.info("[ADMIN AUTH] Generated OTP for %s (%s)", email, purpose)

        # 2. Bhejo: event pipeline on ho to usse, warna Redis mail queue se.
        def push_to_redis_queue():
            """Email job ko Redis mail_queue me daalo."""
            r = RedisService.get_client()
            payload = {
                "to": email,
                "subject": purpose,
                "otp": otp,
            }
            r.rpush(settings.REDIS_MAIL_QUEUE, json.dumps(payload))

        try:
            from core.services.outbox_service import OutboxService, events_enabled

            if events_enabled():
                # Wahi subject aur body jo mail worker bhejta hai. Relay 30 second me publish
                # na kare to Redis queue bhejegi (dono kabhi nahi).
                OutboxService.write_email(email, purpose, purpose, otp, fallback=push_to_redis_queue)
            else:
                push_to_redis_queue()
        except Exception as e:
            logger.warning("Failed to queue OTP email: %s", e)
            print(f" [WARN] Could not queue OTP email: {e}")

    @classmethod
    def issue_tokens_for_admin(cls, admin: Admin, request=None) -> Dict[str, Any]:
        """Admin ke liye Redis session bundle banao: access session + refresh session (JWT nahi)."""
        ip_address = "127.0.0.1"
        user_agent = "Unknown"
        if request:
            xff = request.META.get("HTTP_X_FORWARDED_FOR")
            if xff:
                ip_address = xff.split(",")[0].strip()
            else:
                ip_address = request.META.get("REMOTE_ADDR", "127.0.0.1")
            user_agent = request.META.get("HTTP_USER_AGENT", "Unknown")[:255]

        session_id = RedisService.create_admin_session(admin, ip_address, user_agent)
        refresh_session_id = RedisService.create_refresh_session(session_id, admin)

        return {
            "sessionId": session_id,
            "refreshSessionId": refresh_session_id,
            # Purane clients jo accessToken/refreshToken naam maangte hain unke liye
            "accessToken": session_id,
            "refreshToken": refresh_session_id,
        }


