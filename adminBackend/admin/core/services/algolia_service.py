import logging
from typing import Optional, List, Dict, Any
from django.conf import settings

# pyrefly: ignore[missing-import]
from catalog.models import Song, Artist, Playlist

logger = logging.getLogger(__name__)


class AlgoliaService:
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            app_id = getattr(settings, "ALGOLIA_APP_ID", None)
            api_key = getattr(settings, "ALGOLIA_API_KEY", None)
            if app_id and api_key:
                try:
                    from algoliasearch.search.client import SearchClientSync
                    cls._client = SearchClientSync(app_id, api_key)
                except Exception as e:
                    logger.error("Failed to initialize Algolia SearchClientSync: %s", e)
                    return None
        return cls._client

    @classmethod
    def save_song(
        cls,
        song: Optional[Any] = None,
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
            logger.warning("Algolia client not configured, skipping save_song")
            return

        try:
            if isinstance(song, dict):
                s_id = song.get("id") or song_id
                s_title = song.get("title") or title
                s_artist = song.get("artist_name") or song.get("artistName") or song.get("artist") or artist_name
                s_lang = song.get("language") or language
                s_dur = song.get("duration") if song.get("duration") is not None else duration
                s_img = song.get("image_key") or song.get("imageKey") or image_key
                s_vid = song.get("video_key") or song.get("videoKey") or video_key
                s_full_vid = song.get("full_video_key") or song.get("fullVideoKey") or full_video_key
                s_skey = song.get("song_key") or song.get("songKey") or song_key
                s_jid = song.get("job_id") or song.get("jobId") or job_id
                s_album = song.get("album") or album
                s_genre = song.get("genre") or genre
                s_lrclib = song.get("lrclib_id") or song.get("lrclibId") or lrclib_id
                s_prev_start = song.get("preview_start_time") if song.get("preview_start_time") is not None else (song.get("previewStartTime") if song.get("previewStartTime") is not None else preview_start_time)
                s_prev_end = song.get("preview_end_time") if song.get("preview_end_time") is not None else (song.get("previewEndTime") if song.get("previewEndTime") is not None else preview_end_time)
                s_streams = song.get("total_streams") if song.get("total_streams") is not None else (song.get("totalStreams") if song.get("totalStreams") is not None else (song.get("listenCount") if song.get("listenCount") is not None else total_streams))
            elif song is not None:
                s_id = getattr(song, "id", None) or song_id
                s_title = getattr(song, "title", None) or title
                s_artist = getattr(song, "artist_name", None) or artist_name
                s_lang = getattr(song, "language", None) or language
                s_dur = getattr(song, "duration", None) if getattr(song, "duration", None) is not None else duration
                s_img = getattr(song, "image_key", None) or image_key
                s_vid = getattr(song, "video_key", None) or video_key
                s_full_vid = getattr(song, "full_video_key", None) or full_video_key
                s_skey = getattr(song, "song_key", None) or song_key
                s_jid = getattr(song, "job_id", None) or job_id
                s_album = getattr(song, "album", None) or album
                s_genre = getattr(song, "genre", None) or genre
                s_lrclib = getattr(song, "lrclib_id", None) or lrclib_id
                s_prev_start = getattr(song, "preview_start_time", None) if getattr(song, "preview_start_time", None) is not None else preview_start_time
                s_prev_end = getattr(song, "preview_end_time", None) if getattr(song, "preview_end_time", None) is not None else preview_end_time
                s_streams = getattr(song, "total_streams", None) if getattr(song, "total_streams", None) is not None else total_streams
            else:
                s_id = song_id
                s_title = title
                s_artist = artist_name
                s_lang = language
                s_dur = duration
                s_img = image_key
                s_vid = video_key
                s_full_vid = full_video_key
                s_skey = song_key
                s_jid = job_id
                s_album = album
                s_genre = genre
                s_lrclib = lrclib_id
                s_prev_start = preview_start_time
                s_prev_end = preview_end_time
                s_streams = total_streams

            if not s_id:
                logger.warning("Algolia save_song skipped: missing song id")
                return

            streams_val = int(s_streams or 0)
            record = {
                "objectID": str(s_id),
                "type": "song",
                "title": str(s_title or ""),
                "artistName": str(s_artist or ""),
                "artist": str(s_artist or ""),
                "album": str(s_album).strip() if s_album else None,
                "genre": str(s_genre).strip() if s_genre else None,
                "duration": int(s_dur or 0),
                "songKey": str(s_skey or ""),
                "imageKey": str(s_img or ""),
                "videoKey": str(s_vid) if s_vid else None,
                "fullVideoKey": str(s_full_vid) if s_full_vid else None,
                "previewStartTime": int(s_prev_start) if s_prev_start is not None and int(s_prev_start) >= 0 else None,
                "previewEndTime": int(s_prev_end) if s_prev_end is not None and int(s_prev_end) > 0 else None,
                "language": str(s_lang or ""),
                "lrclibId": str(s_lrclib or ""),
                "jobId": str(s_jid or ""),
                "totalStreams": streams_val,
                "listenCount": streams_val,
                "searchCount": 0,
            }

            index_name = getattr(settings, "ALGOLIA_INDEX_NAME", "one_melody_springboot")
            client.save_object(index_name=index_name, body=record)
            logger.info("Successfully saved song [%s] to Algolia index [%s]", s_id, index_name)
        except Exception as e:
            logger.warning("Algolia save song [%s] failed: %s", s_id if "s_id" in locals() else "unknown", e)

    @classmethod
    def save_artist(cls, artist: Any) -> None:
        client = cls.get_client()
        if not client:
            return
        try:
            if isinstance(artist, dict):
                a_id = artist.get("id")
                a_name = artist.get("name")
                a_img = artist.get("cover_image_key") or artist.get("coverImageKey")
                a_followers = artist.get("followers_count") or artist.get("followersCount") or 0
            else:
                a_id = getattr(artist, "id", None)
                a_name = getattr(artist, "name", None)
                a_img = getattr(artist, "cover_image_key", None)
                try:
                    metadata = getattr(artist, "artistmetadata", None) or getattr(artist, "metadata", None)
                    a_followers = metadata.followers_count if metadata else 0
                except Exception:
                    a_followers = 0

            if not a_id:
                return

            record = {
                "objectID": str(a_id),
                "type": "artist",
                "name": str(a_name or ""),
                "coverImageKey": str(a_img) if a_img else None,
                "followersCount": int(a_followers or 0),
                "searchCount": 0,
            }
            index_name = getattr(settings, "ALGOLIA_INDEX_NAME", "one_melody_springboot")
            client.save_object(index_name=index_name, body=record)
            logger.info("Successfully saved artist [%s] to Algolia index [%s]", a_id, index_name)
        except Exception as e:
            logger.warning("Algolia save artist [%s] failed: %s", getattr(artist, "id", "unknown"), e)

    @classmethod
    def save_playlist(cls, playlist: Any) -> None:
        client = cls.get_client()
        if not client:
            return
        try:
            if isinstance(playlist, dict):
                p_id = playlist.get("id")
                p_name = playlist.get("name")
                p_img = playlist.get("cover_image_key") or playlist.get("coverImageKey")
                p_songs = playlist.get("total_songs") or playlist.get("totalSongs") or 0
                p_type = playlist.get("type") or ("userPlaylist" if playlist.get("isUserPlaylist") else "playlist")
                is_user = playlist.get("isUserPlaylist", False)
                owner = playlist.get("ownerName") or playlist.get("owner_name")
            else:
                p_id = getattr(playlist, "id", None)
                p_name = getattr(playlist, "name", None)
                p_img = getattr(playlist, "cover_image_key", None)
                p_songs = getattr(playlist, "total_songs", 0)
                p_type = "playlist"
                is_user = False
                owner = None

            if not p_id:
                return

            record = {
                "objectID": str(p_id),
                "type": p_type,
                "name": str(p_name or ""),
                "coverImageKey": str(p_img) if p_img else None,
                "totalSongs": int(p_songs or 0),
                "isUserPlaylist": is_user,
                "searchCount": 0,
            }
            if owner:
                record["ownerName"] = str(owner)

            index_name = getattr(settings, "ALGOLIA_INDEX_NAME", "one_melody_springboot")
            client.save_object(index_name=index_name, body=record)
            logger.info("Successfully saved playlist [%s] to Algolia index [%s]", p_id, index_name)
        except Exception as e:
            logger.warning("Algolia save playlist [%s] failed: %s", getattr(playlist, "id", "unknown"), e)

    @classmethod
    def delete_object(cls, object_id: str) -> None:
        client = cls.get_client()
        if not client or not object_id:
            return
        try:
            index_name = getattr(settings, "ALGOLIA_INDEX_NAME", "one_melody_springboot")
            client.delete_object(index_name=index_name, object_id=str(object_id))
            logger.info("Deleted object [%s] from Algolia index [%s]", object_id, index_name)
        except Exception as e:
            logger.warning("Algolia delete object [%s] failed: %s", object_id, e)

    @classmethod
    def delete_record(cls, object_id: str) -> None:
        cls.delete_object(object_id)



