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
            ("title", "string"),
            ("artistName", "string"),
            ("language", "string"),
            ("genre", "string"),
            ("album", "string"),
            ("duration", "int"),
            ("totalStreams", "int"),
            ("imageKey", "string"),
            ("songKey", "string"),
            ("videoKey", "string"),
            ("fullVideoKey", "string"),
            ("previewStartTime", "int"),
            ("previewEndTime", "int"),
            ("isFeatured", "boolean"),
            ("lrclibId", "string"),
            ("status", "string"),
            ("jobId", "string"),
            ("createdAt", "string"),
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
        song: Optional[Any] = None,
        song_id: Optional[str] = None,
        title: Optional[str] = None,
        artist_name: Optional[str] = None,
        language: Optional[str] = None,
        genre: Optional[str] = None,
        duration: Optional[int] = None,
        album: Optional[str] = None,
        image_key: Optional[str] = None,
        total_streams: Optional[int] = None,
        song_key: Optional[str] = None,
        video_key: Optional[str] = None,
        full_video_key: Optional[str] = None,
        preview_start_time: Optional[int] = None,
        preview_end_time: Optional[int] = None,
        is_featured: Optional[bool] = None,
        lrclib_id: Optional[str] = None,
        status: Optional[str] = None,
        job_id: Optional[str] = None,
        created_at: Optional[Any] = None,
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
        **kwargs,
    ) -> None:
        client = cls.get_client()
        if not client:
            return
        cls.ensure_audio_properties(client)
        from recombee_api_client.api_requests import SetItemValues

        if isinstance(song, str) and not song_id:
            song_id = song
            song = None

        if song is not None:
            if isinstance(song, dict):
                song_id = str(song.get("id") or song_id or "")
                title = song.get("title") or title or ""
                artist_name = song.get("artist_name") or song.get("artistName") or artist_name or ""
                language = song.get("language") or language or ""
                if genre is None:
                    genre = song.get("genre")
                if album is None:
                    album = song.get("album")
                if duration is None:
                    duration = song.get("duration")
                if image_key is None:
                    image_key = song.get("image_key") or song.get("imageKey")
                if song_key is None:
                    song_key = song.get("song_key") or song.get("songKey")
                if video_key is None:
                    video_key = song.get("video_key") or song.get("videoKey")
                if full_video_key is None:
                    full_video_key = song.get("full_video_key") or song.get("fullVideoKey")
                if preview_start_time is None:
                    preview_start_time = song.get("preview_start_time") or song.get("previewStartTime")
                if preview_end_time is None:
                    preview_end_time = song.get("preview_end_time") or song.get("previewEndTime")
                if is_featured is None:
                    is_featured = song.get("is_featured") or song.get("isFeatured")
                if lrclib_id is None:
                    lrclib_id = song.get("lrclib_id") or song.get("lrclibId")
                if status is None:
                    status = song.get("status")
                if job_id is None:
                    job_id = song.get("job_id") or song.get("jobId")
                if created_at is None:
                    created_at = song.get("created_at") or song.get("createdAt")
                if total_streams is None:
                    total_streams = song.get("total_streams") or song.get("totalStreams") or 0
            else:
                song_id = str(getattr(song, "id", None) or song_id or "")
                title = getattr(song, "title", None) or title or ""
                artist_name = getattr(song, "artist_name", None) or artist_name or ""
                language = getattr(song, "language", None) or language or ""
                if genre is None:
                    genre = getattr(song, "genre", None)
                if album is None:
                    album = getattr(song, "album", None)
                if duration is None:
                    duration = getattr(song, "duration", None)
                if image_key is None:
                    image_key = getattr(song, "image_key", None)
                if song_key is None:
                    song_key = getattr(song, "song_key", None)
                if video_key is None:
                    video_key = getattr(song, "video_key", None)
                if full_video_key is None:
                    full_video_key = getattr(song, "full_video_key", None)
                if preview_start_time is None:
                    preview_start_time = getattr(song, "preview_start_time", None)
                if preview_end_time is None:
                    preview_end_time = getattr(song, "preview_end_time", None)
                if is_featured is None:
                    is_featured = getattr(song, "is_featured", False)
                if lrclib_id is None:
                    lrclib_id = getattr(song, "lrclib_id", None)
                if status is None:
                    status = getattr(song, "status", None)
                if job_id is None:
                    job_id = getattr(song, "job_id", None)
                if created_at is None:
                    ca = getattr(song, "created_at", None)
                    created_at = ca.isoformat() if hasattr(ca, "isoformat") else ca
                if total_streams is None:
                    meta = getattr(song, "metadata", None)
                    total_streams = getattr(meta, "total_streams", 0) if meta else getattr(song, "total_streams", 0)

        if not song_id:
            logger.warning("Recombee save_song skipped: missing song_id")
            return

        values: Dict[str, Any] = {
            "title": title or "",
            "artistName": artist_name or "",
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

        s_key = song_key or kwargs.get("songKey")
        if s_key:
            values["songKey"] = str(s_key)
        v_key = video_key or kwargs.get("videoKey")
        if v_key:
            values["videoKey"] = str(v_key)
        fv_key = full_video_key or kwargs.get("fullVideoKey")
        if fv_key:
            values["fullVideoKey"] = str(fv_key)
        p_start = preview_start_time if preview_start_time is not None else kwargs.get("previewStartTime")
        if p_start is not None and int(p_start) >= 0:
            values["previewStartTime"] = int(p_start)
        p_end = preview_end_time if preview_end_time is not None else kwargs.get("previewEndTime")
        if p_end is not None and int(p_end) > 0:
            values["previewEndTime"] = int(p_end)
        feat = is_featured if is_featured is not None else kwargs.get("isFeatured", False)
        values["isFeatured"] = bool(feat)
        lrc = lrclib_id or kwargs.get("lrclibId")
        if lrc:
            values["lrclibId"] = str(lrc)
        st = status or kwargs.get("status")
        if st:
            values["status"] = str(st)
        jid = job_id or kwargs.get("jobId")
        if jid:
            values["jobId"] = str(jid)
        cat = created_at or kwargs.get("createdAt")
        if cat:
            values["createdAt"] = str(cat)

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
            logger.info("Saved song [%s] to Recombee catalogue with rich metadata and audio features", song_id)
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
    def reindex_all_active_songs(
        cls,
        songs: List[Song],
        jobs_by_song_id: Optional[Dict[str, Any]] = None,
    ) -> int:
        client = cls.get_client()
        if not client or not songs:
            return 0
        cls.ensure_audio_properties(client)

        if jobs_by_song_id is None:
            try:
                from jobs.models import Job
                from django.db.models import Q
                song_ids = [s.id for s in songs if s.id]
                job_ids = [s.job_id for s in songs if getattr(s, "job_id", None)]
                jobs = list(Job.objects.filter(Q(song_id__in=song_ids) | Q(id__in=job_ids)))
                jobs_by_song_id = {}
                for j in jobs:
                    song_key = j.song_id if j.song_id else None
                    job_key = j.id if j.id else None
                    if song_key:
                        existing = jobs_by_song_id.get(song_key)
                        if existing is None or (getattr(existing, "danceability", None) is None and j.danceability is not None):
                            jobs_by_song_id[song_key] = j
                    if job_key:
                        jobs_by_song_id[job_key] = j
            except Exception as err:
                logger.warning("Could not prefetch jobs for audio features: %s", err)
                jobs_by_song_id = {}

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
            song_key = getattr(s, "song_key", None)
            if song_key:
                vals["songKey"] = str(song_key)
            video_key = getattr(s, "video_key", None)
            if video_key:
                vals["videoKey"] = str(video_key)
            full_video_key = getattr(s, "full_video_key", None)
            if full_video_key:
                vals["fullVideoKey"] = str(full_video_key)
            prev_start = getattr(s, "preview_start_time", None)
            if prev_start is not None and int(prev_start) >= 0:
                vals["previewStartTime"] = int(prev_start)
            prev_end = getattr(s, "preview_end_time", None)
            if prev_end is not None and int(prev_end) > 0:
                vals["previewEndTime"] = int(prev_end)
            vals["isFeatured"] = bool(getattr(s, "is_featured", False))
            lrclib_id = getattr(s, "lrclib_id", None)
            if lrclib_id:
                vals["lrclibId"] = str(lrclib_id)
            status_val = getattr(s, "status", None)
            if status_val:
                vals["status"] = str(status_val)
            job_id_val = getattr(s, "job_id", None)
            if job_id_val:
                vals["jobId"] = str(job_id_val)
            created_at_val = getattr(s, "created_at", None)
            if created_at_val:
                vals["createdAt"] = str(created_at_val)
            if s.duration and s.duration > 0:
                vals["duration"] = s.duration
            streams = int(getattr(s, "total_streams", 0) or 0)
            vals["totalStreams"] = streams

            # Audio features from matching Job (prioritize job with audio features)
            job = None
            if jobs_by_song_id:
                cand1 = jobs_by_song_id.get(s.id)
                cand2 = jobs_by_song_id.get(s.job_id) if getattr(s, "job_id", None) else None
                if cand1 and getattr(cand1, "danceability", None) is not None:
                    job = cand1
                elif cand2 and getattr(cand2, "danceability", None) is not None:
                    job = cand2
                else:
                    job = cand1 or cand2
            if job:
                for f_name in [
                    "tempo",
                    "danceability",
                    "energy",
                    "valence",
                    "acousticness",
                    "instrumentalness",
                    "liveness",
                    "speechiness",
                    "loudness",
                ]:
                    val = getattr(job, f_name, None)
                    if val is not None:
                        vals[f_name] = float(val)
                for i_name in ["key", "mode"]:
                    val = getattr(job, i_name, None)
                    if val is not None:
                        vals[i_name] = int(val)

            requests_list.append(SetItemValues(s.id, vals, cascade_create=True))

        try:
            chunk_size = 100
            for i in range(0, len(requests_list), chunk_size):
                chunk = requests_list[i : i + chunk_size]
                client.send(Batch(chunk))
            logger.info("Re-indexed %d songs in Recombee with full metadata and audio features", len(requests_list))
            return len(requests_list)
        except Exception as e:
            logger.error("Failed batch reindex in Recombee: %s", e)
            raise



