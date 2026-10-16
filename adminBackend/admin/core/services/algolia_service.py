import logging
from typing import Optional, List, Dict, Any
from django.conf import settings
from ..models import Song, Artist, Playlist

logger = logging.getLogger(__name__)

class AlgoliaService:
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None and settings.ALGOLIA_APP_ID and settings.ALGOLIA_API_KEY:
            from algoliasearch.search.client import SearchClientSync
            cls._client = SearchClientSync(settings.ALGOLIA_APP_ID, settings.ALGOLIA_API_KEY)
        return cls._client

    @classmethod
    def save_song(
        cls,
        song: Optional[Song] = None,
        song_id: Optional[str] = None,
        title: Optional[str] = None,
        artist_name: Optional[str] = None,
        language: Optional[str] = None,
        duration: Optional[int] = None,
        image_key: Optional[str] = None,
        video_key: Optional[str] = None,
        full_video_key: Optional[str] = None,
        song_key: Optional[str] = None,
        job_id: Optional[str] = None,
        preview_start_time: Optional[int] = None,
        preview_end_time: Optional[int] = None,
        album: Optional[str] = None,
        lrclib_id: Optional[str] = None,
        genre: Optional[str] = None,
        total_streams: Optional[int] = None,
    ) -> None:
        client = cls.get_client()
        if not client:
            return
        try:
            s_id = song.id if song else song_id
            s_title = song.title if song else title
            s_artist = song.artist_name if song else artist_name
            s_lang = song.language if song else language
            s_dur = song.duration if song else duration
            s_img = song.image_key if song else image_key
            s_vid = song.video_key if song else video_key
            s_full_vid = song.full_video_key if song else full_video_key
            s_skey = song.song_key if song else song_key
            s_jid = song.job_id if song else job_id
            s_album = song.album if song else album
            s_genre = song.genre if song else genre
            s_streams = (song.total_streams if song else total_streams) or 0

            record = {
                "objectID": s_id,
                "type": "song",
                "title": s_title,
                "artistName": s_artist,
                "album": s_album,
                "genre": s_genre or "",
                "duration": s_dur,
                "songKey": s_skey or "",
                "imageKey": s_img,
                "videoKey": s_vid,
                "fullVideoKey": s_full_vid,
                "previewStartTime": preview_start_time,
                "previewEndTime": preview_end_time,
                "language": s_lang or "unknown",
                "lrclibId": lrclib_id,
                "jobId": s_jid,
                "totalStreams": s_streams,
                "searchCount": 0,
            }
            client.save_object(index_name=settings.ALGOLIA_INDEX_NAME, body=record)
            logger.info("Saved song [%s] to Algolia index", s_id)
        except Exception as e:
            logger.warning("Algolia save song [%s] failed: %s", s_id if 's_id' in locals() else 'unknown', e)

    @classmethod
    def save_artist(cls, artist: Artist) -> None:
        client = cls.get_client()
        if not client:
            return
        try:
            record = {
                "objectID": artist.id,
                "type": "artist",
                "name": artist.name,
                "searchCount": 0,
            }
            client.save_object(index_name=settings.ALGOLIA_INDEX_NAME, body=record)
            logger.info("Saved artist [%s] to Algolia index", artist.id)
        except Exception as e:
            logger.warning("Algolia save artist [%s] failed: %s", artist.id, e)

    @classmethod
    def save_playlist(cls, playlist: Playlist) -> None:
        client = cls.get_client()
        if not client:
            return
        try:
            record = {
                "objectID": playlist.id,
                "type": "playlist",
                "name": playlist.name,
                "searchCount": 0,
            }
            client.save_object(index_name=settings.ALGOLIA_INDEX_NAME, body=record)
            logger.info("Saved playlist [%s] to Algolia index", playlist.id)
        except Exception as e:
            logger.warning("Algolia save playlist [%s] failed: %s", playlist.id, e)

    @classmethod
    def delete_object(cls, object_id: str) -> None:
        client = cls.get_client()
        if not client or not object_id:
            return
        try:
            client.delete_object(index_name=settings.ALGOLIA_INDEX_NAME, object_id=object_id)
            logger.info("Deleted object [%s] from Algolia index", object_id)
        except Exception as e:
            logger.warning("Algolia delete object [%s] failed: %s", object_id, e)

    @classmethod
    def delete_record(cls, object_id: str) -> None:
        cls.delete_object(object_id)


