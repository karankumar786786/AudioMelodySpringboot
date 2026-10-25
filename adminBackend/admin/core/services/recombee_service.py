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
            ("audioKey", "string"),
            ("videoKey", "string"),
            ("canvasKey", "string"),
            ("fullVideoKey", "string"),
            ("previewStartTime", "int"),
            ("previewEndTime", "int"),
            ("clipStartSec", "int"),
            ("clipEndSec", "int"),
            ("canvasStartTime", "int"),
            ("canvasEndTime", "int"),
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
                req = AddItemProperty(prop_name, prop_type)
                req.timeout = 15000
                client.send(req)
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
        audio_key: Optional[str] = None,
        video_key: Optional[str] = None,
        canvas_key: Optional[str] = None,
        full_video_key: Optional[str] = None,
        preview_start_time: Optional[int] = None,
        preview_end_time: Optional[int] = None,
        clip_start_sec: Optional[int] = None,
        clip_end_sec: Optional[int] = None,
        canvas_start_time: Optional[int] = None,
        canvas_end_time: Optional[int] = None,
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

        c_start = clip_start_sec if clip_start_sec is not None else canvas_start_time
        c_end = clip_end_sec if clip_end_sec is not None else canvas_end_time

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
                    song_key = song.get("song_key") or song.get("songKey") or song.get("audio_key") or song.get("audioKey")
                if video_key is None:
                    video_key = song.get("video_key") or song.get("videoKey") or song.get("canvas_key") or song.get("canvasKey")
                if full_video_key is None:
                    full_video_key = song.get("full_video_key") or song.get("fullVideoKey")
                if preview_start_time is None:
                    preview_start_time = song.get("preview_start_time") or song.get("previewStartTime")
                if preview_end_time is None:
                    preview_end_time = song.get("preview_end_time") or song.get("previewEndTime")
                if c_start is None:
                    c_start = song.get("clip_start_sec") if song.get("clip_start_sec") is not None else (song.get("clipStartSec") if song.get("clipStartSec") is not None else song.get("canvasStartTime"))
                if c_end is None:
                    c_end = song.get("clip_end_sec") if song.get("clip_end_sec") is not None else (song.get("clipEndSec") if song.get("clipEndSec") is not None else song.get("canvasEndTime"))
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
                if c_start is None:
                    c_start = getattr(song, "clip_start_sec", None)
                if c_end is None:
                    c_end = getattr(song, "clip_end_sec", None)
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

        # Fallback to kwargs or matching Job
        if c_start is None:
            c_start = kwargs.get("clip_start_sec") if kwargs.get("clip_start_sec") is not None else (kwargs.get("clipStartSec") if kwargs.get("clipStartSec") is not None else kwargs.get("canvasStartTime"))
        if c_end is None:
            c_end = kwargs.get("clip_end_sec") if kwargs.get("clip_end_sec") is not None else (kwargs.get("clipEndSec") if kwargs.get("clipEndSec") is not None else kwargs.get("canvasEndTime"))

        if c_start is None or not video_key or preview_start_time is None:
            try:
                from jobs.models import Job
                job_obj = None
                if job_id:
                    job_obj = Job.objects.filter(id=job_id).first()
                if not job_obj and song_id:
                    job_obj = Job.objects.filter(song_id=song_id).first()
                if job_obj:
                    if c_start is None:
                        c_start = getattr(job_obj, "clip_start_sec", None)
                    if c_end is None:
                        c_end = getattr(job_obj, "clip_end_sec", None)
                    if not video_key:
                        video_key = getattr(job_obj, "video_key", None)
                    if not full_video_key:
                        full_video_key = getattr(job_obj, "full_video_key", None)
                    if preview_start_time is None:
                        preview_start_time = getattr(job_obj, "preview_start_time", None)
                    if preview_end_time is None:
                        preview_end_time = getattr(job_obj, "preview_end_time", None)
                    if tempo is None and getattr(job_obj, "tempo", None) is not None:
                        tempo = job_obj.tempo
                        danceability = job_obj.danceability
                        energy = job_obj.energy
                        valence = job_obj.valence
                        acousticness = job_obj.acousticness
                        instrumentalness = job_obj.instrumentalness
                        liveness = job_obj.liveness
                        speechiness = job_obj.speechiness
                        loudness = job_obj.loudness
                        key = job_obj.key
                        mode = job_obj.mode
            except Exception:
                pass

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

        s_key = song_key or audio_key or kwargs.get("songKey") or kwargs.get("audioKey")
        if s_key:
            values["songKey"] = str(s_key)
            values["audioKey"] = str(s_key)
        v_key = video_key or canvas_key or kwargs.get("videoKey") or kwargs.get("canvasKey")
        if v_key:
            values["videoKey"] = str(v_key)
            values["canvasKey"] = str(v_key)
        fv_key = full_video_key or kwargs.get("fullVideoKey")
        if fv_key:
            values["fullVideoKey"] = str(fv_key)
        p_start = preview_start_time if preview_start_time is not None else kwargs.get("previewStartTime")
        if p_start is not None and int(p_start) >= 0:
            values["previewStartTime"] = int(p_start)
        p_end = preview_end_time if preview_end_time is not None else kwargs.get("previewEndTime")
        if p_end is not None and int(p_end) > 0:
            values["previewEndTime"] = int(p_end)
        if c_start is not None and int(c_start) >= 0:
            values["clipStartSec"] = int(c_start)
            values["canvasStartTime"] = int(c_start)
        if c_end is not None and int(c_end) > 0:
            values["clipEndSec"] = int(c_end)
            values["canvasEndTime"] = int(c_end)

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
            req = SetItemValues(song_id, values, cascade_create=True)
            req.timeout = 15000
            client.send(req)
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
                    s_id = str(getattr(s, "id", None) or "")
                    s_job_id = str(getattr(s, "job_id", None) or "")
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
            # Audio features and canvas timestamps from matching Job
            s_id_val = str(getattr(s, "id", None) or "")
            s_job_id_val = str(getattr(s, "job_id", None) or "")
            job = None
            if jobs_by_song_id:
                if s_id_val and s_id_val in jobs_by_song_id:
                    job = jobs_by_song_id.get(s_id_val)
                elif s_job_id_val and s_job_id_val in jobs_by_song_id:
                    job = jobs_by_song_id.get(s_job_id_val)

            song_key = getattr(s, "song_key", None) or (getattr(job, "song_key", None) if job else None)
            if song_key:
                vals["songKey"] = str(song_key)
                vals["audioKey"] = str(song_key)
            video_key = getattr(s, "video_key", None) or (getattr(job, "video_key", None) if job else None)
            if video_key:
                vals["videoKey"] = str(video_key)
                vals["canvasKey"] = str(video_key)
            full_video_key = getattr(s, "full_video_key", None) or (getattr(job, "full_video_key", None) if job else None)
            if full_video_key:
                vals["fullVideoKey"] = str(full_video_key)
            prev_start = getattr(s, "preview_start_time", None) if getattr(s, "preview_start_time", None) is not None else (getattr(job, "preview_start_time", None) if job else None)
            if prev_start is not None and int(prev_start) >= 0:
                vals["previewStartTime"] = int(prev_start)
            prev_end = getattr(s, "preview_end_time", None) if getattr(s, "preview_end_time", None) is not None else (getattr(job, "preview_end_time", None) if job else None)
            if prev_end is not None and int(prev_end) > 0:
                vals["previewEndTime"] = int(prev_end)
            clip_start = getattr(s, "clip_start_sec", None) if getattr(s, "clip_start_sec", None) is not None else (getattr(job, "clip_start_sec", None) if job else None)
            if clip_start is not None and int(clip_start) >= 0:
                vals["clipStartSec"] = int(clip_start)
                vals["canvasStartTime"] = int(clip_start)
            clip_end = getattr(s, "clip_end_sec", None) if getattr(s, "clip_end_sec", None) is not None else (getattr(job, "clip_end_sec", None) if job else None)
            if clip_end is not None and int(clip_end) > 0:
                vals["clipEndSec"] = int(clip_end)
                vals["canvasEndTime"] = int(clip_end)

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
            chunk_size = 50
            for i in range(0, len(requests_list), chunk_size):
                chunk = requests_list[i : i + chunk_size]
                batch_req = Batch(chunk)
                batch_req.timeout = 25000
                client.send(batch_req)
            logger.info("Re-indexed %d songs in Recombee with full metadata, keys, clip timestamps and audio features", len(requests_list))
            return len(requests_list)
        except Exception as e:
            logger.error("Failed batch reindex in Recombee: %s", e)
            raise



