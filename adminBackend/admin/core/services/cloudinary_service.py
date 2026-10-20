import logging
import time
import uuid
from typing import Optional, Dict, Any
from django.conf import settings
import cloudinary
import cloudinary.uploader
import cloudinary.api
import cloudinary.utils

logger = logging.getLogger(__name__)

class CloudinaryService:
    @classmethod
    def is_configured(cls) -> bool:
        return bool(
            settings.CLOUDINARY_CLOUD_NAME
            and settings.CLOUDINARY_API_KEY
            and settings.CLOUDINARY_API_SECRET
        )

    @classmethod
    def generate_upload_signature(
        cls,
        folder: str = "audios",
        resource_type: str = "video",
        eager: Optional[str] = None,
        public_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates signed parameters and an HMAC-SHA signature for direct client-to-Cloudinary uploads.
        Follows the asset/songId path rule when public_id is provided, otherwise generates {folder}/{uuid}.
        """
        timestamp = int(time.time())
        target_public_id = public_id if (public_id and str(public_id).strip()) else f"{folder}/{uuid.uuid4()}"

        params_to_sign: Dict[str, Any] = {
            "public_id": target_public_id,
            "timestamp": timestamp,
        }
        if eager:
            params_to_sign["eager"] = eager

        signature = cloudinary.utils.api_sign_request(
            params_to_sign,
            settings.CLOUDINARY_API_SECRET or ""
        )

        upload_url = (
            f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/{resource_type}/upload"
        )

        return {
            "cloudName": settings.CLOUDINARY_CLOUD_NAME,
            "apiKey": settings.CLOUDINARY_API_KEY,
            "timestamp": timestamp,
            "folder": folder,
            "publicId": target_public_id,
            "signature": signature,
            "uploadUrl": upload_url,
            "resourceType": resource_type,
        }

    @classmethod
    def destroy_media(cls, public_id: str, resource_type: str = "video") -> Dict[str, Any]:
        """
        Permanently purges a media file and all derived streaming representations from Cloudinary.
        """
        if not public_id or not isinstance(public_id, str) or not cls.is_configured():
            logger.warning("Cloudinary not configured or invalid public_id: '%s'", public_id)
            return {"result": "skipped"}

        try:
            result = cloudinary.uploader.destroy(
                public_id,
                resource_type=resource_type,
                invalidate=True,
            )
            logger.info("Purged Cloudinary asset '%s' (type: %s): %s", public_id, resource_type, result)
            return result
        except Exception as e:
            logger.warning("Failed to delete Cloudinary asset '%s': %s", public_id, e)
            return {"error": str(e)}

    @classmethod
    def get_media_info(cls, public_id: str, resource_type: str = "video") -> Optional[Dict[str, Any]]:
        """
        Retrieves technical metadata (duration, format, codecs, dimensions) for an uploaded asset.
        """
        if not public_id or not cls.is_configured():
            return None

        try:
            return cloudinary.api.resource(public_id, resource_type=resource_type)
        except Exception as e:
            logger.warning("Failed to fetch Cloudinary media info for '%s': %s", public_id, e)
            return None

    @classmethod
    def get_streaming_urls(cls, public_id: str, streaming_profile: Optional[str] = None) -> Dict[str, str]:
        """
        Constructs adaptive bitrate streaming URLs (HLS and MPEG-DASH) for a given public ID.
        Uses sp_auto for video assets and f_m3u8 for audio assets (since sp_auto is video-only on Cloudinary).
        """
        cloud_name = settings.CLOUDINARY_CLOUD_NAME
        base = f"https://res.cloudinary.com/{cloud_name}/video/upload"
        profile = streaming_profile or ("sp_auto" if public_id.startswith("videos/") else "f_m3u8")
        return {
            "hlsUrl": f"{base}/{profile}/{public_id}.m3u8",
            "dashUrl": f"{base}/{profile}/{public_id}.mpd",
        }
