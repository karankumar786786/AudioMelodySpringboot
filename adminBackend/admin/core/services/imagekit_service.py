import hmac
import hashlib
import logging
import time
import uuid
from typing import Any, Dict, Optional
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

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


