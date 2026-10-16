import logging
from typing import Optional, List, Dict, Any
from django.conf import settings
# pyrefly: ignore[missing-import]
from catalog.models import Song

logger = logging.getLogger(__name__)

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
    def save_song(
        cls,
        song_id: str,
        title: str,
        artist_name: str,
        language: str,
        genre: Optional[str] = None,
        duration: Optional[int] = None,
        album: Optional[str] = None,
        image_key: Optional[str] = None,
        total_streams: Optional[int] = 0,
    ) -> None:
        client = cls.get_client()
        if not client:
            return
        from recombee_api_client.api_requests import SetItemValues
        values = {
            "title": title,
            "artistName": artist_name,
            "language": language or "",
        }
        if genre and genre.strip():
            values["genre"] = genre.strip()
        if album and album.strip():
            values["album"] = album.strip()
        if image_key and image_key.strip():
            values["imageKey"] = image_key.strip()
        if duration and duration > 0:
            values["duration"] = int(duration)
        if total_streams is not None:
            values["totalStreams"] = int(total_streams)
            values["listenCount"] = int(total_streams)
        try:
            client.send(SetItemValues(song_id, values, cascade_create=True))
            logger.info("Saved song [%s] to Recombee catalogue with full metadata", song_id)
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
                "language": s.language or "",
            }
            if s.genre and s.genre.strip():
                vals["genre"] = s.genre.strip()
            if s.album and s.album.strip():
                vals["album"] = s.album.strip()
            if s.image_key and s.image_key.strip():
                vals["imageKey"] = s.image_key.strip()
            if s.duration and s.duration > 0:
                vals["duration"] = int(s.duration)
            streams = int(getattr(s, "total_streams", 0) or 0)
            vals["totalStreams"] = streams
            vals["listenCount"] = streams
            requests_list.append(SetItemValues(s.id, vals, cascade_create=True))

        try:
            chunk_size = 100
            for i in range(0, len(requests_list), chunk_size):
                chunk = requests_list[i : i + chunk_size]
                client.send(Batch(chunk))
            logger.info("Re-indexed %d songs in Recombee with full metadata", len(requests_list))
            return len(requests_list)
        except Exception as e:
            logger.error("Failed batch reindex in Recombee: %s", e)
            raise


