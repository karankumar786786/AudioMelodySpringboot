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
        song_id: Optional[str] = None,
        title: Optional[str] = None,
        artist_name: Optional[str] = None,
        language: Optional[str] = None,
        genre: Optional[str] = None,
        duration: Optional[int] = None,
        album: Optional[str] = None,
        image_key: Optional[str] = None,
        total_streams: Optional[int] = 0,
        song: Any = None,
    ) -> None:
        client = cls.get_client()
        if not client:
            return

        if song is not None:
            if isinstance(song, dict):
                s_id = str(song.get("id") or song_id or "")
                s_title = song.get("title") or title or ""
                s_artist = song.get("artist_name") or song.get("artistName") or song.get("artist") or artist_name or ""
                s_lang = song.get("language") or language or ""
                s_genre = song.get("genre") or genre
                s_dur = song.get("duration") if song.get("duration") is not None else duration
                s_album = song.get("album") or album
                s_img = song.get("image_key") or song.get("imageKey") or image_key
                s_streams = song.get("total_streams") if song.get("total_streams") is not None else (song.get("totalStreams") or total_streams or 0)
                s_status = song.get("status") or "ACTIVE"
            else:
                s_id = str(getattr(song, "id", None) or song_id or "")
                s_title = getattr(song, "title", None) or title or ""
                s_artist = getattr(song, "artist_name", None) or artist_name or ""
                s_lang = getattr(song, "language", None) or language or ""
                s_genre = getattr(song, "genre", None) or genre
                s_dur = getattr(song, "duration", None) if getattr(song, "duration", None) is not None else duration
                s_album = getattr(song, "album", None) or album
                s_img = getattr(song, "image_key", None) or image_key
                s_streams = getattr(song, "total_streams", None) if getattr(song, "total_streams", None) is not None else (total_streams or 0)
                s_status = getattr(song, "status", "ACTIVE") or "ACTIVE"
        else:
            s_id = str(song_id or "")
            s_title = title or ""
            s_artist = artist_name or ""
            s_lang = language or ""
            s_genre = genre
            s_dur = duration
            s_album = album
            s_img = image_key
            s_streams = total_streams or 0
            s_status = "ACTIVE"

        if not s_id:
            logger.warning("Recombee save_song skipped: missing song id")
            return

        # If deleted or blocked, clean up from Recombee catalogue
        if str(s_status).upper() in ("DELETED", "BLOCKED"):
            cls.delete_song(s_id)
            return

        from recombee_api_client.api_requests import SetItemValues
        values = {
            "title": str(s_title or ""),
            "artistName": str(s_artist or ""),
            "language": str(s_lang or ""),
        }
        if s_genre and str(s_genre).strip():
            values["genre"] = str(s_genre).strip()
        if s_album and str(s_album).strip():
            values["album"] = str(s_album).strip()
        if s_img and str(s_img).strip():
            values["imageKey"] = str(s_img).strip()
        if s_dur and int(s_dur) > 0:
            values["duration"] = int(s_dur)
        if s_streams is not None:
            values["totalStreams"] = int(s_streams or 0)
            values["listenCount"] = int(s_streams or 0)
        try:
            client.send(SetItemValues(s_id, values, cascade_create=True))
            logger.info("Saved song [%s] to Recombee catalogue with full metadata", s_id)
        except Exception as e:
            logger.warning("Recombee save song [%s] failed: %s", s_id, e)

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


