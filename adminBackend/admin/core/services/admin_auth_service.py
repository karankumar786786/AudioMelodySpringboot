import json
import logging
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from django.conf import settings
from accounts.models import Admin
from .redis_service import RedisService

logger = logging.getLogger(__name__)

class AdminAuthService:
    """Handles admin authentication, OTP generation/validation, and Redis session issuing."""
    _MEMORY_OTP_CACHE: Dict[str, Dict[str, Any]] = {}
    _MEMORY_TEMP_TOKENS: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def generate_otp() -> str:
        return f"{secrets.randbelow(1000000):06d}"

    @classmethod
    def create_temp_token(cls, email: str, purpose: str = "LOGIN") -> str:
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
        if not temp_token:
            return None
        try:
            r = RedisService.get_client()
            raw = r.get(f"admin:temp_token:{temp_token}")
            if raw:
                return json.loads(raw)
        except Exception:
            pass
        cached = cls._MEMORY_TEMP_TOKENS.get(temp_token)
        if cached and cached.get("expiresAt", 0) > time.time():
            return cached
        return None

    @classmethod
    def save_otp(cls, email: str, data: Dict[str, Any], ttl_seconds: int = 600) -> None:
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
    def issue_tokens_for_admin(cls, admin: Admin, request=None) -> Dict[str, Any]:
        """
        Creates a stateful Redis session bundle (access session + refresh session).
        Zero JWT. Pure Redis storage.
        """
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
            # Backward-compat aliases for clients expecting accessToken/refreshToken
            "accessToken": session_id,
            "refreshToken": refresh_session_id,
        }


