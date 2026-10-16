import logging
from typing import Optional, Dict, Any, List
import boto3
from django.conf import settings

logger = logging.getLogger(__name__)

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


