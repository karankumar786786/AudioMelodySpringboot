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
        preview_start_time: Optional[int] = None,
        preview_end_time: Optional[int] = None,
        album: Optional[str] = None,
        genre: Optional[str] = None,
        total_streams: Optional[int] = None,
        **kwargs,
    ) -> None:
        client = cls.get_client()
        if not client:
            logger.warning("Algolia client not configured, skipping save_song")
            return

        s_id: str = song_id or ""
        try:
            if isinstance(song, dict):
                s_id = song.get("id") or s_id
                s_title = song.get("title") or title
                s_artist = song.get("artist_name") or song.get("artistName") or song.get("artist") or artist_name
                s_lang = song.get("language") or language
                s_dur = song.get("duration") if song.get("duration") is not None else duration
                s_img = song.get("image_key") or song.get("imageKey") or image_key
                s_album = song.get("album") or album
                s_genre = song.get("genre") or genre
                s_prev_start = song.get("preview_start_time") if song.get("preview_start_time") is not None else (song.get("previewStartTime") if song.get("previewStartTime") is not None else preview_start_time)
                s_prev_end = song.get("preview_end_time") if song.get("preview_end_time") is not None else (song.get("previewEndTime") if song.get("previewEndTime") is not None else preview_end_time)
                s_streams = song.get("total_streams") if song.get("total_streams") is not None else (song.get("totalStreams") if song.get("totalStreams") is not None else total_streams)
                s_search_count = song.get("search_count") if song.get("search_count") is not None else (song.get("searchCount") if song.get("searchCount") is not None else 0)
                s_song_key = song.get("song_key") or song.get("songKey")
                s_video_key = song.get("video_key") or song.get("videoKey")
                s_full_video_key = song.get("full_video_key") or song.get("fullVideoKey")
                s_is_featured = song.get("is_featured") if song.get("is_featured") is not None else song.get("isFeatured", False)
                s_lrclib_id = song.get("lrclib_id") or song.get("lrclibId")
                s_status = song.get("status")
                s_job_id = song.get("job_id") or song.get("jobId")
                s_created_at = song.get("created_at") or song.get("createdAt")
            elif song is not None:
                s_id = str(getattr(song, "id", None) or song_id or "")
                s_title = getattr(song, "title", None) or title
                s_artist = getattr(song, "artist_name", None) or artist_name
                s_lang = getattr(song, "language", None) or language
                s_dur = getattr(song, "duration", None) if getattr(song, "duration", None) is not None else duration
                s_img = getattr(song, "image_key", None) or image_key
                s_album = getattr(song, "album", None) or album
                s_genre = getattr(song, "genre", None) or genre
                s_prev_start = getattr(song, "preview_start_time", None) if getattr(song, "preview_start_time", None) is not None else preview_start_time
                s_prev_end = getattr(song, "preview_end_time", None) if getattr(song, "preview_end_time", None) is not None else preview_end_time
                s_streams = getattr(song, "total_streams", None) if getattr(song, "total_streams", None) is not None else total_streams
                s_search_count = getattr(song, "search_count", None) if getattr(song, "search_count", None) is not None else (getattr(song, "searchCount", None) or 0)
                s_song_key = getattr(song, "song_key", None)
                s_video_key = getattr(song, "video_key", None)
                s_full_video_key = getattr(song, "full_video_key", None)
                s_is_featured = getattr(song, "is_featured", False)
                s_lrclib_id = getattr(song, "lrclib_id", None)
                s_status = getattr(song, "status", None)
                s_job_id = getattr(song, "job_id", None)
                s_created_at = getattr(song, "created_at", None)
            else:
                s_id = song_id or ""
                s_title = title
                s_artist = artist_name
                s_lang = language
                s_dur = duration
                s_img = image_key
                s_album = album
                s_genre = genre
                s_prev_start = preview_start_time
                s_prev_end = preview_end_time
                s_streams = total_streams
                s_search_count = 0
                s_song_key = kwargs.get("song_key") or kwargs.get("songKey")
                s_video_key = kwargs.get("video_key") or kwargs.get("videoKey")
                s_full_video_key = kwargs.get("full_video_key") or kwargs.get("fullVideoKey")
                s_is_featured = kwargs.get("is_featured", False)
                s_lrclib_id = kwargs.get("lrclib_id") or kwargs.get("lrclibId")
                s_status = kwargs.get("status")
                s_job_id = kwargs.get("job_id") or kwargs.get("jobId")
                s_created_at = kwargs.get("created_at") or kwargs.get("createdAt")

            if not s_id:
                logger.warning("Algolia save_song skipped: missing song id")
                return

            streams_val = int(s_streams or 0)
            search_count_val = int(s_search_count or 0)
            record = {
                "objectID": str(s_id),
                "type": "song",
                "title": str(s_title or ""),
                "artistName": str(s_artist or ""),
                "artist": str(s_artist or ""),
                "album": str(s_album).strip() if s_album else None,
                "genre": str(s_genre).strip() if s_genre else None,
                "language": str(s_lang or ""),
                "imageKey": str(s_img or ""),
                "songKey": str(s_song_key or ""),
                "videoKey": str(s_video_key) if s_video_key else None,
                "fullVideoKey": str(s_full_video_key) if s_full_video_key else None,
                "duration": int(s_dur or 0),
                "previewStartTime": int(s_prev_start) if s_prev_start is not None and int(s_prev_start) >= 0 else None,
                "previewEndTime": int(s_prev_end) if s_prev_end is not None and int(s_prev_end) > 0 else None,
                "isFeatured": bool(s_is_featured),
                "lrclibId": str(s_lrclib_id) if s_lrclib_id else None,
                "status": str(s_status) if s_status else None,
                "jobId": str(s_job_id) if s_job_id else None,
                "createdAt": str(s_created_at) if s_created_at else None,
                "totalStreams": streams_val,
                "searchCount": search_count_val,
            }

            index_name = getattr(settings, "ALGOLIA_INDEX_NAME", "one_melody_springboot")
            client.save_object(index_name=index_name, body=record)
            logger.info("Successfully saved song [%s] to Algolia index [%s]", s_id, index_name)
        except Exception as e:
            logger.warning("Algolia save song [%s] failed: %s", s_id or "unknown", e)


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
    def build_song_record(cls, song: Any) -> Optional[Dict[str, Any]]:
        if isinstance(song, dict):
            s_id = song.get("id") or song.get("song_id") or song.get("songId")
            s_title = song.get("title")
            s_artist = song.get("artist_name") or song.get("artistName")
            s_album = song.get("album")
            s_genre = song.get("genre")
            s_img = song.get("image_key") or song.get("imageKey")
            s_dur = song.get("duration")
            s_lang = song.get("language")
            s_prev_start = song.get("preview_start_time") or song.get("previewStartTime")
            s_prev_end = song.get("preview_end_time") or song.get("previewEndTime")
            s_streams = song.get("total_streams") or song.get("totalStreams") or 0
            s_search_count = song.get("search_count") if song.get("search_count") is not None else (song.get("searchCount") or 0)
            s_song_key = song.get("song_key") or song.get("songKey")
            s_video_key = song.get("video_key") or song.get("videoKey")
            s_full_video_key = song.get("full_video_key") or song.get("fullVideoKey")
            s_is_featured = song.get("is_featured") if song.get("is_featured") is not None else song.get("isFeatured", False)
            s_lrclib_id = song.get("lrclib_id") or song.get("lrclibId")
            s_status = song.get("status")
            s_job_id = song.get("job_id") or song.get("jobId")
            s_created_at = song.get("created_at") or song.get("createdAt")
        else:
            s_id = getattr(song, "id", None)
            s_title = getattr(song, "title", None)
            s_artist = getattr(song, "artist_name", None)
            s_album = getattr(song, "album", None)
            s_genre = getattr(song, "genre", None)
            s_img = getattr(song, "image_key", None)
            s_dur = getattr(song, "duration", None)
            s_lang = getattr(song, "language", None)
            s_prev_start = getattr(song, "preview_start_time", None)
            s_prev_end = getattr(song, "preview_end_time", None)
            try:
                s_streams = getattr(song, "total_streams", 0)
            except Exception:
                s_streams = 0
            s_search_count = getattr(song, "search_count", None) if getattr(song, "search_count", None) is not None else (getattr(song, "searchCount", None) or 0)
            s_song_key = getattr(song, "song_key", None)
            s_video_key = getattr(song, "video_key", None)
            s_full_video_key = getattr(song, "full_video_key", None)
            s_is_featured = getattr(song, "is_featured", False)
            s_lrclib_id = getattr(song, "lrclib_id", None)
            s_status = getattr(song, "status", None)
            s_job_id = getattr(song, "job_id", None)
            s_created_at = getattr(song, "created_at", None)

        if not s_id:
            return None

        return {
            "objectID": str(s_id),
            "type": "song",
            "title": str(s_title or ""),
            "artistName": str(s_artist or ""),
            "artist": str(s_artist or ""),
            "album": str(s_album).strip() if s_album else None,
            "genre": str(s_genre).strip() if s_genre else None,
            "language": str(s_lang or ""),
            "imageKey": str(s_img or ""),
            "songKey": str(s_song_key or ""),
            "videoKey": str(s_video_key) if s_video_key else None,
            "fullVideoKey": str(s_full_video_key) if s_full_video_key else None,
            "duration": int(s_dur or 0),
            "previewStartTime": int(s_prev_start) if s_prev_start is not None and int(s_prev_start) >= 0 else None,
            "previewEndTime": int(s_prev_end) if s_prev_end is not None and int(s_prev_end) > 0 else None,
            "isFeatured": bool(s_is_featured),
            "lrclibId": str(s_lrclib_id) if s_lrclib_id else None,
            "status": str(s_status) if s_status else None,
            "jobId": str(s_job_id) if s_job_id else None,
            "createdAt": str(s_created_at) if s_created_at else None,
            "totalStreams": int(s_streams or 0),
            "searchCount": int(s_search_count or 0),
        }

    @classmethod
    def build_artist_record(cls, artist: Any) -> Optional[Dict[str, Any]]:
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
                a_followers = metadata.followers_count if metadata else getattr(artist, "followers_count", 0)
            except Exception:
                a_followers = getattr(artist, "followers_count", 0)

        if not a_id:
            return None

        return {
            "objectID": str(a_id),
            "type": "artist",
            "name": str(a_name or ""),
            "coverImageKey": str(a_img) if a_img else None,
            "followersCount": int(a_followers or 0),
            "searchCount": 0,
        }

    @classmethod
    def build_playlist_record(cls, playlist: Any) -> Optional[Dict[str, Any]]:
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
            return None

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
        return record

    @classmethod
    def reindex_all_active_songs(cls, songs: List[Any], batch_size: int = 100) -> int:
        client = cls.get_client()
        if not client or not songs:
            return 0
        records = [cls.build_song_record(s) for s in songs]
        records = [r for r in records if r]
        if not records:
            return 0
        index_name = getattr(settings, "ALGOLIA_INDEX_NAME", "one_melody_springboot")
        try:
            for i in range(0, len(records), batch_size):
                chunk = records[i : i + batch_size]
                client.save_objects(index_name=index_name, objects=chunk)
            logger.info("Re-indexed %d songs in Algolia index [%s]", len(records), index_name)
            return len(records)
        except Exception as e:
            logger.error("Failed batch reindex of songs in Algolia: %s", e)
            raise

    @classmethod
    def reindex_all_artists(cls, artists: List[Any], batch_size: int = 100) -> int:
        client = cls.get_client()
        if not client or not artists:
            return 0
        records = [cls.build_artist_record(a) for a in artists]
        records = [r for r in records if r]
        if not records:
            return 0
        index_name = getattr(settings, "ALGOLIA_INDEX_NAME", "one_melody_springboot")
        try:
            for i in range(0, len(records), batch_size):
                chunk = records[i : i + batch_size]
                client.save_objects(index_name=index_name, objects=chunk)
            logger.info("Re-indexed %d artists in Algolia index [%s]", len(records), index_name)
            return len(records)
        except Exception as e:
            logger.error("Failed batch reindex of artists in Algolia: %s", e)
            raise

    @classmethod
    def reindex_all_playlists(cls, playlists: List[Any], batch_size: int = 100) -> int:
        client = cls.get_client()
        if not client or not playlists:
            return 0
        records = [cls.build_playlist_record(p) for p in playlists]
        records = [r for r in records if r]
        if not records:
            return 0
        index_name = getattr(settings, "ALGOLIA_INDEX_NAME", "one_melody_springboot")
        try:
            for i in range(0, len(records), batch_size):
                chunk = records[i : i + batch_size]
                client.save_objects(index_name=index_name, objects=chunk)
            logger.info("Re-indexed %d playlists in Algolia index [%s]", len(records), index_name)
            return len(records)
        except Exception as e:
            logger.error("Failed batch reindex of playlists in Algolia: %s", e)
            raise

    @classmethod
    def configure_index(cls) -> None:
        client = cls.get_client()
        if not client:
            return
        index_name = getattr(settings, "ALGOLIA_INDEX_NAME", "one_melody_springboot")
        try:
            settings_dict = {
                "searchableAttributes": [
                    "title",
                    "artistName",
                    "album",
                    "name",
                    "language",
                    "genre",
                ],
                "attributesForFaceting": [
                    "filterOnly(type)",
                    "searchable(language)",
                    "searchable(genre)",
                ],
                "customRanking": [
                    "desc(searchCount)",
                    "desc(totalStreams)",
                ],
            }
            client.set_settings(index_name=index_name, index_settings=settings_dict)
            logger.info("Algolia index [%s] settings configured successfully", index_name)
        except Exception as e:
            logger.warning("Failed to configure Algolia index settings: %s", e)

    @classmethod
    def delete_object(cls, object_id: str) -> None:
        client = cls.get_client()
        if not client or not object_id:
            return
        try:
            index_name = getattr(settings, "ALGOLIA_INDEX_NAME", "one_melody_springboot")
            client.delete_object(index_name=index_name, object_id=object_id)
            logger.info("Deleted object [%s] from Algolia index [%s]", object_id, index_name)
        except Exception as e:
            logger.warning("Algolia delete object [%s] failed: %s", object_id, e)

    @classmethod
    def delete_record(cls, object_id: str) -> None:
        cls.delete_object(object_id)




