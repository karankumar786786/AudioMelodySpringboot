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

    _properties_ensured = False

    @classmethod
    def ensure_audio_properties(cls, client) -> None:
        if cls._properties_ensured or not client:
            return
        from recombee_api_client.api_requests import AddItemProperty
        feature_props = [
            ("tempo", "double"),
            ("danceability", "double"),
            ("energy", "double"),
            ("valence", "double"),
            ("acousticness", "double"),
            ("instrumentalness", "double"),
            ("liveness", "double"),
            ("speechiness", "double"),
            ("loudness", "double"),
            ("key", "int"),
            ("mode", "int"),
        ]
        for prop_name, prop_type in feature_props:
            try:
                client.send(AddItemProperty(prop_name, prop_type))
            except Exception:
                pass
        cls._properties_ensured = True

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
        tempo: Optional[float] = None,
        danceability: Optional[float] = None,
        energy: Optional[float] = None,
        valence: Optional[float] = None,
        acousticness: Optional[float] = None,
        instrumentalness: Optional[float] = None,
        liveness: Optional[float] = None,
        speechiness: Optional[float] = None,
        loudness: Optional[float] = None,
        key: Optional[int] = None,
        mode: Optional[int] = None,
    ) -> None:
        client = cls.get_client()
        if not client:
            return
        cls.ensure_audio_properties(client)
        from recombee_api_client.api_requests import SetItemValues
        values: Dict[str, Any] = {
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
            values["duration"] = duration
        if total_streams is not None:
            values["totalStreams"] = total_streams
            values["listenCount"] = total_streams

        # Audio features for smart recommendations
        if tempo is not None:
            values["tempo"] = float(tempo)
        if danceability is not None:
            values["danceability"] = float(danceability)
        if energy is not None:
            values["energy"] = float(energy)
        if valence is not None:
            values["valence"] = float(valence)
        if acousticness is not None:
            values["acousticness"] = float(acousticness)
        if instrumentalness is not None:
            values["instrumentalness"] = float(instrumentalness)
        if liveness is not None:
            values["liveness"] = float(liveness)
        if speechiness is not None:
            values["speechiness"] = float(speechiness)
        if loudness is not None:
            values["loudness"] = float(loudness)
        if key is not None:
            values["key"] = key
        if mode is not None:
            values["mode"] = mode

        try:
            client.send(SetItemValues(song_id, values, cascade_create=True))
            logger.info("Saved song [%s] to Recombee catalogue with audio features", song_id)
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
        from recombee_api_client.api_requests import Batch, Request, SetItemValues
        requests_list: List[Request] = []
        for s in songs:
            vals: Dict[str, Any] = {
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
                vals["duration"] = s.duration
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


