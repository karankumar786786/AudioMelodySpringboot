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
            s_clip_start = None
            s_clip_end = None
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
                s_clip_start = song.get("clip_start_sec") if song.get("clip_start_sec") is not None else (song.get("clipStartSec") if song.get("clipStartSec") is not None else song.get("canvasStartTime"))
                s_clip_end = song.get("clip_end_sec") if song.get("clip_end_sec") is not None else (song.get("clipEndSec") if song.get("clipEndSec") is not None else song.get("canvasEndTime"))
                s_streams = song.get("total_streams") if song.get("total_streams") is not None else (song.get("totalStreams") if song.get("totalStreams") is not None else total_streams)
                s_search_count = song.get("search_count") if song.get("search_count") is not None else (song.get("searchCount") if song.get("searchCount") is not None else 0)
                s_song_key = song.get("song_key") or song.get("songKey") or song.get("audio_key") or song.get("audioKey")
                s_video_key = song.get("video_key") or song.get("videoKey") or song.get("canvas_key") or song.get("canvasKey")
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
                s_clip_start = getattr(song, "clip_start_sec", None)
                s_clip_end = getattr(song, "clip_end_sec", None)
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
                s_song_key = kwargs.get("song_key") or kwargs.get("songKey") or kwargs.get("audio_key") or kwargs.get("audioKey")
                s_video_key = kwargs.get("video_key") or kwargs.get("videoKey") or kwargs.get("canvas_key") or kwargs.get("canvasKey")
                s_full_video_key = kwargs.get("full_video_key") or kwargs.get("fullVideoKey")
                s_clip_start = kwargs.get("clip_start_sec") if kwargs.get("clip_start_sec") is not None else (kwargs.get("clipStartSec") if kwargs.get("clipStartSec") is not None else kwargs.get("canvasStartTime"))
                s_clip_end = kwargs.get("clip_end_sec") if kwargs.get("clip_end_sec") is not None else (kwargs.get("clipEndSec") if kwargs.get("clipEndSec") is not None else kwargs.get("canvasEndTime"))
                s_is_featured = kwargs.get("is_featured", False)
                s_lrclib_id = kwargs.get("lrclib_id") or kwargs.get("lrclibId")
                s_status = kwargs.get("status")
                s_job_id = kwargs.get("job_id") or kwargs.get("jobId")
                s_created_at = kwargs.get("created_at") or kwargs.get("createdAt")

            # Look up associated Job if clip timestamps or video keys are missing
            if s_clip_start is None or not s_video_key or s_prev_start is None:
                try:
                    from jobs.models import Job
                    job_obj = None
                    if s_job_id:
                        job_obj = Job.objects.filter(id=s_job_id).first()
                    if not job_obj and s_id:
                        job_obj = Job.objects.filter(song_id=s_id).first()
                    if job_obj:
                        if s_clip_start is None:
                            s_clip_start = getattr(job_obj, "clip_start_sec", None)
                        if s_clip_end is None:
                            s_clip_end = getattr(job_obj, "clip_end_sec", None)
                        if not s_video_key:
                            s_video_key = getattr(job_obj, "video_key", None)
                        if not s_full_video_key:
                            s_full_video_key = getattr(job_obj, "full_video_key", None)
                        if s_prev_start is None:
                            s_prev_start = getattr(job_obj, "preview_start_time", None)
                        if s_prev_end is None:
                            s_prev_end = getattr(job_obj, "preview_end_time", None)
                except Exception:
                    pass

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
                "audioKey": str(s_song_key or ""),
                "videoKey": str(s_video_key) if s_video_key else None,
                "canvasKey": str(s_video_key) if s_video_key else None,
                "fullVideoKey": str(s_full_video_key) if s_full_video_key else None,
                "duration": int(s_dur or 0),
                "previewStartTime": int(s_prev_start) if s_prev_start is not None and int(s_prev_start) >= 0 else None,
                "previewEndTime": int(s_prev_end) if s_prev_end is not None and int(s_prev_end) > 0 else None,
                "clipStartSec": int(s_clip_start) if s_clip_start is not None and int(s_clip_start) >= 0 else None,
                "clipEndSec": int(s_clip_end) if s_clip_end is not None and int(s_clip_end) > 0 else None,
                "canvasStartTime": int(s_clip_start) if s_clip_start is not None and int(s_clip_start) >= 0 else None,
                "canvasEndTime": int(s_clip_end) if s_clip_end is not None and int(s_clip_end) > 0 else None,
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
    def build_song_record(cls, song: Any, job: Optional[Any] = None) -> Optional[Dict[str, Any]]:
        s_clip_start = None
        s_clip_end = None
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
            s_clip_start = song.get("clip_start_sec") if song.get("clip_start_sec") is not None else (song.get("clipStartSec") if song.get("clipStartSec") is not None else song.get("canvasStartTime"))
            s_clip_end = song.get("clip_end_sec") if song.get("clip_end_sec") is not None else (song.get("clipEndSec") if song.get("clipEndSec") is not None else song.get("canvasEndTime"))
            s_streams = song.get("total_streams") or song.get("totalStreams") or 0
            s_search_count = song.get("search_count") if song.get("search_count") is not None else (song.get("searchCount") or 0)
            s_song_key = song.get("song_key") or song.get("songKey") or song.get("audio_key") or song.get("audioKey")
            s_video_key = song.get("video_key") or song.get("videoKey") or song.get("canvas_key") or song.get("canvasKey")
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
            s_clip_start = getattr(song, "clip_start_sec", None)
            s_clip_end = getattr(song, "clip_end_sec", None)
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

        if job:
            if s_clip_start is None:
                s_clip_start = getattr(job, "clip_start_sec", None)
            if s_clip_end is None:
                s_clip_end = getattr(job, "clip_end_sec", None)
            if not s_video_key:
                s_video_key = getattr(job, "video_key", None)
            if not s_full_video_key:
                s_full_video_key = getattr(job, "full_video_key", None)
            if s_prev_start is None:
                s_prev_start = getattr(job, "preview_start_time", None)
            if s_prev_end is None:
                s_prev_end = getattr(job, "preview_end_time", None)

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
            "audioKey": str(s_song_key or ""),
            "videoKey": str(s_video_key) if s_video_key else None,
            "canvasKey": str(s_video_key) if s_video_key else None,
            "fullVideoKey": str(s_full_video_key) if s_full_video_key else None,
            "duration": int(s_dur or 0),
            "previewStartTime": int(s_prev_start) if s_prev_start is not None and int(s_prev_start) >= 0 else None,
            "previewEndTime": int(s_prev_end) if s_prev_end is not None and int(s_prev_end) > 0 else None,
            "clipStartSec": int(s_clip_start) if s_clip_start is not None and int(s_clip_start) >= 0 else None,
            "clipEndSec": int(s_clip_end) if s_clip_end is not None and int(s_clip_end) > 0 else None,
            "canvasStartTime": int(s_clip_start) if s_clip_start is not None and int(s_clip_start) >= 0 else None,
            "canvasEndTime": int(s_clip_end) if s_clip_end is not None and int(s_clip_end) > 0 else None,
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
    def reindex_all_active_songs(
        cls,
        songs: List[Any],
        batch_size: int = 100,
        jobs_by_song_id: Optional[Dict[str, Any]] = None,
    ) -> int:
        client = cls.get_client()
        if not client or not songs:
            return 0

        if jobs_by_song_id is None:
            try:
                from jobs.models import Job
                from django.db.models import Q
                song_ids = [s.id for s in songs if getattr(s, "id", None)]
                job_ids = [getattr(s, "job_id", None) for s in songs if getattr(s, "job_id", None)]
                jobs = list(Job.objects.filter(Q(song_id__in=song_ids) | Q(id__in=job_ids)).order_by("-created_at"))
                jobs_grouped = {}
                for j in jobs:
                    if j.song_id:
                        jobs_grouped.setdefault(j.song_id, []).append(j)
                    if j.id:
                        jobs_grouped.setdefault(j.id, []).append(j)

                class MergedJob:
                    id: Optional[str] = None
                    song_id: Optional[str] = None
                    clip_start_sec: Optional[int] = None
                    clip_end_sec: Optional[int] = None
                    video_key: Optional[str] = None
                    full_video_key: Optional[str] = None
                    preview_start_time: Optional[int] = None
                    preview_end_time: Optional[int] = None
                    song_key: Optional[str] = None
                    tempo: Optional[float] = None
                    danceability: Optional[float] = None
                    energy: Optional[float] = None
                    valence: Optional[float] = None
                    acousticness: Optional[float] = None
                    instrumentalness: Optional[float] = None
                    liveness: Optional[float] = None
                    speechiness: Optional[float] = None
                    loudness: Optional[float] = None
                    key: Optional[int] = None
                    mode: Optional[int] = None

                    def __init__(self, j_list):
                        fields = [
                            "id", "song_id", "clip_start_sec", "clip_end_sec", "video_key", "full_video_key",
                            "preview_start_time", "preview_end_time", "song_key",
                            "tempo", "danceability", "energy", "valence", "acousticness",
                            "instrumentalness", "liveness", "speechiness", "loudness", "key", "mode"
                        ]
                        for f in fields:
                            val = None
                            for j in j_list:
                                v = getattr(j, f, None)
                                if v is not None:
                                    val = v
                                    break
                            setattr(self, f, val)

                jobs_by_song_id = {}
                for s in songs:
                    s_id = str(getattr(s, "id", None) or (s.get("id") if isinstance(s, dict) else "") or "")
                    s_job_id = str(getattr(s, "job_id", None) or (s.get("job_id") if isinstance(s, dict) else "") or "")
                    j_list = []
                    if s_id and s_id in jobs_grouped:
                        j_list.extend(jobs_grouped[s_id])
                    if s_job_id and s_job_id in jobs_grouped:
                        for j in jobs_grouped[s_job_id]:
                            if j not in j_list:
                                j_list.append(j)
                    if j_list:
                        merged = MergedJob(j_list)
                        if s_id:
                            jobs_by_song_id[s_id] = merged
                        if s_job_id:
                            jobs_by_song_id[s_job_id] = merged
            except Exception as err:
                logger.warning("Could not prefetch jobs for Algolia reindex: %s", err)
                jobs_by_song_id = {}

        records = []
        for s in songs:
            s_id_val = str(getattr(s, "id", None) or (s.get("id") if isinstance(s, dict) else "") or "")
            s_job_id_val = str(getattr(s, "job_id", None) or (s.get("job_id") if isinstance(s, dict) else "") or "")
            job = None
            if jobs_by_song_id:
                if s_id_val and s_id_val in jobs_by_song_id:
                    job = jobs_by_song_id.get(s_id_val)
                elif s_job_id_val and s_job_id_val in jobs_by_song_id:
                    job = jobs_by_song_id.get(s_job_id_val)
            rec = cls.build_song_record(s, job=job)
            if rec:
                records.append(rec)

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




