import logging
import uuid
from django.db import models
from django.db.models import Q
# pyrefly: ignore[missing-import]
from core.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

# pyrefly: ignore[missing-import]
from core.helpers import format_paginated_response
# pyrefly: ignore[missing-import]
from core.services import (
    AlgoliaService,
    ImageKitService,
    PaginationMetadataService,
    RecombeeService,
    RedisService,
)
# pyrefly: ignore[missing-import]
from core.views import BaseAdminView
# pyrefly: ignore[missing-import]
from jobs.models import Job
# pyrefly: ignore[missing-import]
from jobs.serializers import JobSerializer
from .models import Artist, Playlist, PlaylistSong, Song
from .serializers import ArtistSerializer, PlaylistSerializer, SongSerializer

logger = logging.getLogger(__name__)


# ==============================================================================
# Artist Management
# ==============================================================================

class ArtistListView(BaseAdminView):
    def get(self, request):
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        search = (request.query_params.get("search") or "").strip()
        status_param = (request.query_params.get("status") or "").strip()
        offset = page * size

        qs = Artist.objects.all()
        if status_param and status_param.upper() != "ALL":
            qs = qs.filter(status=status_param.upper())
        elif not status_param:
            qs = qs.filter(status="ACTIVE")

        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(about__icontains=search))

        artists = list(qs.order_by("-created_at")[offset : offset + size])

        meta = PaginationMetadataService.get_metadata("ArtistsEntity")
        has_filters = bool(search or (status_param and status_param.upper() != "ACTIVE"))
        if has_filters:
            total_count = qs.count()
        else:
            total_count = meta.total_count if (meta and meta.total_count > 0) else qs.count()

        meta_dict = {
            "id": meta.id if meta else "ArtistsEntity",
            "entityName": "ArtistsEntity",
            "totalCount": total_count,
            "activeCount": meta.active_count if meta else total_count,
            "blockedCount": 0,
            "deletedCount": meta.deleted_count if meta else 0,
        }

        return Response(
            format_paginated_response(ArtistSerializer(artists, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        name = request.data.get("name")
        about = request.data.get("about")
        cover_image_key = request.data.get("coverImageKey")
        dob = request.data.get("dob")

        if not name or not str(name).strip():
            return Response({"error": "Artist name is required"}, status=status.HTTP_400_BAD_REQUEST)

        artist = Artist.objects.create(
            id=str(uuid.uuid4()),
            name=str(name).strip(),
            about=about,
            cover_image_key=cover_image_key,
            dob=dob,
            status="ACTIVE",
        )
        PaginationMetadataService.increment_status("ArtistsEntity", "ACTIVE")
        PaginationMetadataService._save_or_update(f"ArtistSongs_{artist.id}", 0, 0, 0, 0)
        AlgoliaService.save_artist(artist)

        return Response(ArtistSerializer(artist).data, status=status.HTTP_201_CREATED)


class ArtistDetailView(BaseAdminView):
    def get(self, request, pk):
        artist = get_object_or_404(Artist, pk=pk)
        return Response(ArtistSerializer(artist).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        artist = get_object_or_404(Artist, pk=pk)
        old_cover = artist.cover_image_key

        if "name" in request.data:
            artist.name = request.data["name"]
        if "about" in request.data:
            artist.about = request.data["about"]
        if "dob" in request.data:
            artist.dob = request.data["dob"]
        if "coverImageKey" in request.data:
            new_cover = request.data["coverImageKey"]
            if new_cover and new_cover != old_cover:
                artist.cover_image_key = new_cover
                if old_cover:
                    ImageKitService.delete_by_key(old_cover)

        artist.save()
        AlgoliaService.save_artist(artist)
        return Response(ArtistSerializer(artist).data, status=status.HTTP_202_ACCEPTED)

    def delete(self, request, pk):
        artist = get_object_or_404(Artist, pk=pk)
        if artist.status != "DELETED":
            old_status = artist.status
            artist.status = "DELETED"
            artist.save()
            PaginationMetadataService.transition_status("ArtistsEntity", old_status, "DELETED")
            PaginationMetadataService.transition_status(f"ArtistSongs_{artist.id}", "ACTIVE", "DELETED")
            RedisService.queue_delete_event({
                "entityType": "ARTIST",
                "entityId": artist.id,
                "entityTitle": artist.name,
                "coverImageKey": artist.cover_image_key,
            })
        return Response(status=status.HTTP_202_ACCEPTED)


class ArtistSongsView(BaseAdminView):
    """
    GET /api/artists/<pk>/songs and /admin/artist/<pk>/songs
    Returns paginated songs for a specific artist.
    """
    def get(self, request, pk):
        artist = get_object_or_404(Artist, pk=pk)
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        search = (request.query_params.get("search") or "").strip()
        offset = page * size

        qs = Song.objects.filter(
            Q(artist_name__iexact=artist.name) | Q(artist_name__icontains=artist.name),
            status="ACTIVE",
        ).select_related("metadata")

        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(album__icontains=search))

        total = qs.count()
        songs = list(qs.order_by("-created_at")[offset : offset + size])
        meta = PaginationMetadataService.get_metadata(f"ArtistSongs_{pk}")

        meta_dict = {
            "id": meta.id if meta else f"ArtistSongs_{pk}",
            "entityName": f"ArtistSongs_{pk}",
            "totalCount": total,
            "activeCount": total,
            "blockedCount": 0,
            "deletedCount": 0,
        }

        return Response(
            format_paginated_response(SongSerializer(songs, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# Playlist Management
# ==============================================================================

class PlaylistListView(BaseAdminView):
    def get(self, request):
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        search = (request.query_params.get("search") or "").strip()
        status_param = (request.query_params.get("status") or "").strip()
        offset = page * size

        qs = Playlist.objects.all()
        if status_param and status_param.upper() != "ALL":
            qs = qs.filter(status=status_param.upper())
        elif not status_param:
            qs = qs.filter(status="ACTIVE")

        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))

        playlists = list(qs.order_by("-created_at")[offset : offset + size])

        meta = PaginationMetadataService.get_metadata("PlaylistsEntity")
        has_filters = bool(search or (status_param and status_param.upper() != "ACTIVE"))
        if has_filters:
            total_count = qs.count()
        else:
            total_count = meta.total_count if (meta and meta.total_count > 0) else qs.count()

        meta_dict = {
            "id": meta.id if meta else "PlaylistsEntity",
            "entityName": "PlaylistsEntity",
            "totalCount": total_count,
            "activeCount": meta.active_count if meta else total_count,
            "blockedCount": 0,
            "deletedCount": meta.deleted_count if meta else 0,
        }

        return Response(
            format_paginated_response(PlaylistSerializer(playlists, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        name = request.data.get("name")
        description = request.data.get("description")
        cover_image_key = request.data.get("coverImageKey")
        video_key = request.data.get("videoKey")

        if not name or not str(name).strip():
            return Response({"error": "Playlist name is required"}, status=status.HTTP_400_BAD_REQUEST)

        playlist = Playlist.objects.create(
            id=str(uuid.uuid4()),
            name=str(name).strip(),
            description=description,
            cover_image_key=cover_image_key or "",
            video_key=video_key,
            status="ACTIVE",
        )
        PaginationMetadataService.increment_status("PlaylistsEntity", "ACTIVE")
        PaginationMetadataService._save_or_update(f"PlaylistSongs_{playlist.id}", 0, 0, 0, 0)
        AlgoliaService.save_playlist(playlist)

        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_201_CREATED)


class PlaylistDetailView(BaseAdminView):
    def get(self, request, pk):
        playlist = get_object_or_404(Playlist, pk=pk)
        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        playlist = get_object_or_404(Playlist, pk=pk)
        old_cover = playlist.cover_image_key
        old_video = playlist.video_key

        if "name" in request.data:
            playlist.name = request.data["name"]
        if "description" in request.data:
            playlist.description = request.data["description"]
        if "coverImageKey" in request.data:
            new_cover = request.data["coverImageKey"]
            if new_cover and new_cover != old_cover:
                playlist.cover_image_key = new_cover
                if old_cover:
                    ImageKitService.delete_by_key(old_cover)
        if "videoKey" in request.data:
            new_vid = (request.data.get("videoKey") or "").strip()
            if not new_vid or new_vid.lower() == "null":
                if old_video:
                    ImageKitService.delete_by_key(old_video)
                playlist.video_key = None
            elif new_vid != old_video:
                if old_video:
                    ImageKitService.delete_by_key(old_video)
                playlist.video_key = new_vid

        playlist.save()
        AlgoliaService.save_playlist(playlist)
        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        playlist = get_object_or_404(Playlist, pk=pk)
        if playlist.status != "DELETED":
            old_status = playlist.status
            playlist.status = "DELETED"
            playlist.save()
            PaginationMetadataService.transition_status("PlaylistsEntity", old_status, "DELETED")
            PaginationMetadataService.transition_status(f"PlaylistSongs_{playlist.id}", "ACTIVE", "DELETED")
            RedisService.queue_delete_event({
                "entityType": "PLAYLIST",
                "entityId": playlist.id,
                "entityTitle": playlist.name,
                "coverImageKey": playlist.cover_image_key,
                "videoKey": playlist.video_key,
            })
        return Response(status=status.HTTP_204_NO_CONTENT)


class PlaylistSongsView(BaseAdminView):
    def get(self, request, pk):
        playlist = get_object_or_404(Playlist, pk=pk)
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        search = (request.query_params.get("search") or "").strip()
        offset = page * size

        song_ids = PlaylistSong.objects.filter(playlist=playlist).values_list("song_id", flat=True)
        qs = Song.objects.select_related("metadata").filter(id__in=song_ids, status="ACTIVE")
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(artist_name__icontains=search) | Q(album__icontains=search))

        total = qs.count()
        songs = list(qs.order_by("-created_at")[offset : offset + size])

        meta = PaginationMetadataService.get_metadata(f"PlaylistSongs_{pk}")
        meta_dict = {
            "id": meta.id if meta else f"PlaylistSongs_{pk}",
            "entityName": f"PlaylistSongs_{pk}",
            "totalCount": total,
            "activeCount": total,
            "blockedCount": 0,
            "deletedCount": 0,
        }
        return Response(
            format_paginated_response(SongSerializer(songs, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )

    def post(self, request, pk):
        return PlaylistAddSongView().post(request, pk)


class PlaylistAddSongView(BaseAdminView):
    def post(self, request, pk):
        playlist = get_object_or_404(Playlist, pk=pk)
        song_id = request.data.get("songId")
        if not song_id:
            return Response({"error": "songId is required"}, status=status.HTTP_400_BAD_REQUEST)
        song = get_object_or_404(Song, pk=song_id)

        _, created = PlaylistSong.objects.get_or_create(playlist=playlist, song=song)
        if created:
            Playlist.objects.filter(pk=playlist.pk).update(total_songs=models.F("total_songs") + 1)
            playlist.refresh_from_db()
            PaginationMetadataService.increment_status(f"PlaylistSongs_{pk}", "ACTIVE")
        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_200_OK)


class PlaylistRemoveSongView(BaseAdminView):
    def delete(self, request, pk, song_id):
        playlist = get_object_or_404(Playlist, pk=pk)
        deleted_count, _ = PlaylistSong.objects.filter(playlist=playlist, song_id=song_id).delete()
        if deleted_count > 0:
            Playlist.objects.filter(pk=playlist.pk).update(
                total_songs=models.Case(
                    models.When(total_songs__gte=deleted_count, then=models.F("total_songs") - deleted_count),
                    default=models.Value(0),
                    output_field=models.IntegerField(),
                )
            )
            playlist.refresh_from_db()
            PaginationMetadataService.decrement_status(f"PlaylistSongs_{pk}", "ACTIVE")
        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_200_OK)


# ==============================================================================
# Song Management
# ==============================================================================

class SongListView(BaseAdminView):
    def get(self, request):
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        search = (request.query_params.get("search") or "").strip()
        status_param = (request.query_params.get("status") or "").strip()
        genre_param = (request.query_params.get("genre") or "").strip()
        lang_param = (request.query_params.get("language") or "").strip()
        featured_param = request.query_params.get("featured") or request.query_params.get("isFeatured")
        offset = page * size

        qs = Song.objects.select_related("metadata").all()
        if status_param and status_param.upper() != "ALL":
            qs = qs.filter(status=status_param.upper())
        elif not status_param:
            qs = qs.filter(status="ACTIVE")

        if genre_param and genre_param.upper() != "ALL":
            qs = qs.filter(genre__iexact=genre_param)
        if lang_param and lang_param.upper() != "ALL":
            qs = qs.filter(language__iexact=lang_param)
        if featured_param is not None and str(featured_param).strip() != "":
            is_feat = str(featured_param).lower() in ("true", "1")
            qs = qs.filter(is_featured=is_feat)

        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(artist_name__icontains=search)
                | Q(album__icontains=search)
                | Q(language__icontains=search)
            )

        songs = list(qs.order_by("-created_at")[offset : offset + size])
        meta = PaginationMetadataService.get_metadata("SongsEntity")

        has_filters = bool(
            search
            or (genre_param and genre_param.upper() != "ALL")
            or (lang_param and lang_param.upper() != "ALL")
            or (featured_param is not None and str(featured_param).strip() != "")
            or (status_param and status_param.upper() != "ACTIVE")
        )

        if has_filters:
            total_count = qs.count()
        else:
            total_count = meta.total_count if (meta and meta.total_count > 0) else qs.count()

        meta_dict = {
            "id": meta.id if meta else "SongsEntity",
            "entityName": "SongsEntity",
            "totalCount": total_count,
            "activeCount": meta.active_count if meta else total_count,
            "blockedCount": meta.blocked_count if meta else 0,
            "deletedCount": meta.deleted_count if meta else 0,
        }

        return Response(
            format_paginated_response(SongSerializer(songs, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        data = request.data
        temp_song_key = (data.get("tempSongKey") or "").strip()
        temp_video_key = (data.get("tempVideoKey") or "").strip()

        if not temp_song_key and not temp_video_key:
            return Response(
                {"error": "Either audio file (tempSongKey) or full video file (tempVideoKey) must be provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clip_start_sec = None
        if data.get("clipStartMin") is not None or data.get("clipStartSec") is not None:
            c_min = int(data.get("clipStartMin") or 0)
            c_sec = int(data.get("clipStartSec") or 0)
            clip_start_sec = c_min * 60 + c_sec

        clip_end_sec = None
        if data.get("clipEndMin") is not None or data.get("clipEndSec") is not None:
            c_min = int(data.get("clipEndMin") or 0)
            c_sec = int(data.get("clipEndSec") or 0)
            clip_end_sec = c_min * 60 + c_sec

        preview_start = data.get("previewStartTime")
        if preview_start is None and (data.get("previewStartMin") is not None or data.get("previewStartSec") is not None):
            preview_start = int(data.get("previewStartMin") or 0) * 60 + int(data.get("previewStartSec") or 0)
        if preview_start is not None and preview_start < 0:
            preview_start = None

        preview_end = data.get("previewEndTime")
        if preview_end is None and (data.get("previewEndMin") is not None or data.get("previewEndSec") is not None):
            preview_end = int(data.get("previewEndMin") or 0) * 60 + int(data.get("previewEndSec") or 0)
        if preview_end is not None and preview_end < 0:
            preview_end = None

        job_id = str(uuid.uuid4())
        song_id = str(uuid.uuid4())

        job = Job.objects.create(
            id=job_id,
            title=data.get("title", ""),
            artist_name=data.get("artistName", ""),
            temp_song_key=temp_song_key or None,
            temp_video_key=temp_video_key or None,
            clip_start_sec=clip_start_sec,
            clip_end_sec=clip_end_sec,
            preview_start_time=preview_start,
            preview_end_time=preview_end,
            image_key=data.get("imageKey", ""),
            video_key=data.get("videoKey"),
            language=data.get("language", "English"),
            lrclib_id=data.get("lrclibId", "0"),
            genre=data.get("genre"),
            album=data.get("album"),
            song_id=song_id,
            transcoding_attempt=0,
            transcoded=False,
            saved_in_search=False,
            saved_in_recommendation=False,
            status="PENDING",
            current_stage="QUEUED",
        )
        PaginationMetadataService.increment_job()
        RedisService.queue_audio_processing(job_id)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_201_CREATED)


class SongDetailView(BaseAdminView):
    def get(self, request, pk):
        song = get_object_or_404(Song.objects.select_related("metadata"), pk=pk)
        return Response(SongSerializer(song).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        data = request.data

        if "title" in data and str(data["title"]).strip():
            song.title = str(data["title"]).strip()
        if "artistName" in data and str(data["artistName"]).strip():
            new_artist = str(data["artistName"]).strip()
            old_artist = song.artist_name
            if old_artist != new_artist:
                song.artist_name = new_artist
                if old_artist:
                    try:
                        old_art = Artist.objects.filter(name__iexact=old_artist.strip()).first()
                        if old_art:
                            PaginationMetadataService.decrement_status(f"ArtistSongs_{old_art.id}", song.status)
                    except Exception as e:
                        logger.warning("Failed to decrement old artist song metadata: %s", e)
                try:
                    new_art = Artist.objects.filter(name__iexact=new_artist.strip()).first()
                    if new_art:
                        PaginationMetadataService.increment_status(f"ArtistSongs_{new_art.id}", song.status)
                except Exception as e:
                    logger.warning("Failed to increment new artist song metadata: %s", e)
        if "status" in data and str(data["status"]).strip():
            new_st = str(data["status"]).strip().upper()
            if new_st != song.status:
                old_st = song.status
                song.status = new_st
                PaginationMetadataService.transition_status("SongsEntity", old_st, new_st)
                if song.artist_name:
                    try:
                        art = Artist.objects.filter(name__iexact=song.artist_name.strip()).first()
                        if art:
                            PaginationMetadataService.transition_status(f"ArtistSongs_{art.id}", old_st, new_st)
                    except Exception as e:
                        logger.warning("Failed to transition artist song metadata: %s", e)
                for ps in PlaylistSong.objects.filter(song_id=song.id):
                    PaginationMetadataService.transition_status(f"PlaylistSongs_{ps.playlist_id}", old_st, new_st)
        if "language" in data and str(data["language"]).strip():
            song.language = str(data["language"]).strip()
        if "genre" in data:
            g = str(data["genre"]).strip() if data["genre"] else None
            song.genre = g
        if "album" in data:
            alb = str(data["album"]).strip() if data["album"] else None
            song.album = alb
        if "lrclibId" in data and data["lrclibId"]:
            song.lrclib_id = str(data["lrclibId"])
        if "isFeatured" in data:
            song.is_featured = bool(data["isFeatured"])
        if "previewStartTime" in data:
            val = data["previewStartTime"]
            song.preview_start_time = None if (val is None or val < 0) else int(val)
        if "previewEndTime" in data:
            val = data["previewEndTime"]
            song.preview_end_time = None if (val is None or val < 0) else int(val)

        old_img = None
        if "imageKey" in data and data["imageKey"] and data["imageKey"] != song.image_key:
            old_img = song.image_key
            song.image_key = data["imageKey"]

        old_vid = None
        if "videoKey" in data:
            new_v = (data["videoKey"] or "").strip()
            if not new_v or new_v.lower() == "null":
                if song.video_key:
                    old_vid = song.video_key
                    song.video_key = None
            elif new_v != song.video_key:
                old_vid = song.video_key
                song.video_key = new_v

        if "fullVideoKey" in data:
            new_fv = (data["fullVideoKey"] or "").strip()
            song.full_video_key = None if (not new_fv or new_fv.lower() == "null") else new_fv

        song.save()

        if old_img:
            ImageKitService.delete_by_key(old_img)
        if old_vid:
            ImageKitService.delete_by_key(old_vid)

        RecombeeService.save_song(
            song_id=song.id,
            title=song.title,
            artist_name=song.artist_name,
            language=song.language,
            genre=song.genre,
            duration=song.duration,
            album=song.album,
            image_key=song.image_key,
            total_streams=song.total_streams,
        )
        AlgoliaService.save_song(song)

        return Response(SongSerializer(song).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        if song.status != "DELETED":
            old_status = song.status
            song.status = "DELETED"
            song.save()
            PaginationMetadataService.transition_status("SongsEntity", old_status, "DELETED")
            if song.artist_name:
                try:
                    art = Artist.objects.filter(name__iexact=song.artist_name.strip()).first()
                    if art:
                        PaginationMetadataService.transition_status(f"ArtistSongs_{art.id}", old_status, "DELETED")
                except Exception as e:
                    logger.warning("Failed to update artist song metadata for '%s': %s", song.artist_name, e)
            for ps in PlaylistSong.objects.filter(song_id=song.id):
                PaginationMetadataService.transition_status(f"PlaylistSongs_{ps.playlist_id}", old_status, "DELETED")
            RedisService.queue_delete_event({
                "entityType": "SONG",
                "entityId": song.id,
                "entityTitle": song.title,
                "songKey": song.song_key,
                "imageKey": song.image_key,
                "videoKey": song.video_key,
                "fullVideoKey": song.full_video_key,
            })
        return Response(status=status.HTTP_204_NO_CONTENT)


class SongToggleFeaturedView(BaseAdminView):
    def patch(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        featured = bool(request.data.get("featured", not song.is_featured))
        song.is_featured = featured
        song.save()
        AlgoliaService.save_song(song)
        return Response(SongSerializer(song).data, status=status.HTTP_200_OK)


class SongJobDetailView(BaseAdminView):
    def get(self, request, pk):
        job = get_object_or_404(Job, pk=pk)
        return Response(JobSerializer(job).data, status=status.HTTP_200_OK)


class SongJobsListView(BaseAdminView):
    def get(self, request):
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        search = (request.query_params.get("search") or "").strip()
        offset = page * size

        qs = Job.objects.all()
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(artist_name__icontains=search) | Q(id__icontains=search))

        meta = PaginationMetadataService.get_metadata("JobsEntity")
        total_count = qs.count() if search else (meta.total_count if (meta and meta.total_count > 0) else qs.count())
        jobs = list(qs.order_by("-created_at")[offset : offset + size])

        meta_dict = {
            "id": meta.id if meta else "JobsEntity",
            "entityName": "JobsEntity",
            "totalCount": total_count,
            "activeCount": meta.active_count if meta else total_count,
            "blockedCount": 0,
            "deletedCount": 0,
        }

        return Response(
            format_paginated_response(JobSerializer(jobs, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )


class SongReprocessAudioView(BaseAdminView):
    def post(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        temp_song_key = (request.data.get("tempSongKey") or "").strip()
        temp_video_key = (request.data.get("tempVideoKey") or "").strip() or None

        if not temp_song_key:
            return Response({"error": "tempSongKey is required for audio reprocessing"}, status=status.HTTP_400_BAD_REQUEST)

        job_id = str(uuid.uuid4())
        job = Job.objects.create(
            id=job_id,
            title=song.title,
            artist_name=song.artist_name,
            temp_song_key=temp_song_key,
            temp_video_key=temp_video_key,
            image_key=song.image_key,
            video_key=song.video_key,
            preview_start_time=song.preview_start_time,
            preview_end_time=song.preview_end_time,
            language=song.language,
            lrclib_id=song.lrclib_id or "0",
            genre=song.genre,
            album=song.album,
            song_id=song.id,
            transcoding_attempt=0,
            transcoded=False,
            saved_in_search=False,
            saved_in_recommendation=False,
            is_audio_reprocess=True,
            is_video_reprocess=False,
            status="PENDING",
            current_stage="QUEUED",
        )
        PaginationMetadataService.increment_job()
        RedisService.queue_audio_processing(job_id)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)


class SongReprocessVideoView(BaseAdminView):
    def post(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        temp_video_key = (request.data.get("tempVideoKey") or "").strip()
        if not temp_video_key:
            return Response({"error": "tempVideoKey is required for video reprocessing"}, status=status.HTTP_400_BAD_REQUEST)

        clip_start_sec = None
        if request.data.get("clipStartMin") is not None or request.data.get("clipStartSec") is not None:
            clip_start_sec = int(request.data.get("clipStartMin") or 0) * 60 + int(request.data.get("clipStartSec") or 0)

        clip_end_sec = None
        if request.data.get("clipEndMin") is not None or request.data.get("clipEndSec") is not None:
            clip_end_sec = int(request.data.get("clipEndMin") or 0) * 60 + int(request.data.get("clipEndSec") or 0)

        job_id = str(uuid.uuid4())
        job = Job.objects.create(
            id=job_id,
            title=song.title,
            artist_name=song.artist_name,
            temp_video_key=temp_video_key,
            clip_start_sec=clip_start_sec,
            clip_end_sec=clip_end_sec,
            image_key=song.image_key,
            video_key=song.video_key,
            preview_start_time=song.preview_start_time,
            preview_end_time=song.preview_end_time,
            language=song.language,
            lrclib_id=song.lrclib_id or "0",
            genre=song.genre,
            album=song.album,
            song_id=song.id,
            transcoding_attempt=0,
            transcoded=False,
            saved_in_search=False,
            saved_in_recommendation=False,
            is_video_reprocess=True,
            is_audio_reprocess=False,
            status="PENDING",
            current_stage="QUEUED",
        )
        PaginationMetadataService.increment_job()
        RedisService.queue_audio_processing(job_id)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)


class SongRecoverMediaView(BaseAdminView):
    def post(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        temp_song_key = (request.data.get("tempSongKey") or "").strip() or None
        temp_video_key = (request.data.get("tempVideoKey") or "").strip() or None

        if not temp_song_key and not temp_video_key:
            return Response(
                {"error": "Either replacement audio (tempSongKey) or video (tempVideoKey) must be provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clip_start_sec = None
        if request.data.get("clipStartMin") is not None or request.data.get("clipStartSec") is not None:
            clip_start_sec = int(request.data.get("clipStartMin") or 0) * 60 + int(request.data.get("clipStartSec") or 0)

        clip_end_sec = None
        if request.data.get("clipEndMin") is not None or request.data.get("clipEndSec") is not None:
            clip_end_sec = int(request.data.get("clipEndMin") or 0) * 60 + int(request.data.get("clipEndSec") or 0)

        job_id = str(uuid.uuid4())
        job = Job.objects.create(
            id=job_id,
            title=song.title,
            artist_name=song.artist_name,
            temp_song_key=temp_song_key,
            temp_video_key=temp_video_key,
            clip_start_sec=clip_start_sec,
            clip_end_sec=clip_end_sec,
            image_key=song.image_key,
            video_key=song.video_key,
            preview_start_time=song.preview_start_time,
            preview_end_time=song.preview_end_time,
            language=song.language,
            lrclib_id=song.lrclib_id or "0",
            genre=song.genre,
            album=song.album,
            song_id=song.id,
            transcoding_attempt=0,
            transcoded=False,
            saved_in_search=False,
            saved_in_recommendation=False,
            is_audio_reprocess=bool(temp_song_key),
            is_video_reprocess=bool(temp_video_key),
            status="PENDING",
            current_stage="QUEUED",
        )
        PaginationMetadataService.increment_job()
        RedisService.queue_audio_processing(job_id)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)


class SongReindexRecombeeView(BaseAdminView):
    def post(self, request):
        active_songs = list(Song.objects.filter(status="ACTIVE").select_related("metadata"))
        try:
            count = RecombeeService.reindex_all_active_songs(active_songs)
            return Response({"status": "success", "reindexed": count}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SongReindexAlgoliaView(BaseAdminView):
    def post(self, request):
        active_songs = list(Song.objects.filter(status="ACTIVE").select_related("metadata"))
        try:
            count = AlgoliaService.reindex_all_active_songs(active_songs)
            return Response({"status": "success", "reindexed": count}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ArtistReindexAlgoliaView(BaseAdminView):
    def post(self, request):
        active_artists = list(Artist.objects.filter(status="ACTIVE"))
        try:
            try:
                from catalog.models import ArtistMetadata
                meta_map = {m.artist_id: m.followers_count for m in ArtistMetadata.objects.all()}
                for a in active_artists:
                    a.followers_count = meta_map.get(a.id, 0)
            except Exception:
                pass
            count = AlgoliaService.reindex_all_artists(active_artists)
            return Response({"status": "success", "reindexed": count}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PlaylistReindexAlgoliaView(BaseAdminView):
    def post(self, request):
        active_playlists = list(Playlist.objects.filter(status="ACTIVE"))
        try:
            count = AlgoliaService.reindex_all_playlists(active_playlists)
            return Response({"status": "success", "reindexed": count}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CatalogReindexAllView(BaseAdminView):
    def post(self, request):
        try:
            active_songs = list(Song.objects.filter(status="ACTIVE").select_related("metadata"))
            active_artists = list(Artist.objects.filter(status="ACTIVE"))
            active_playlists = list(Playlist.objects.filter(status="ACTIVE"))

            try:
                from catalog.models import ArtistMetadata
                meta_map = {m.artist_id: m.followers_count for m in ArtistMetadata.objects.all()}
                for a in active_artists:
                    a.followers_count = meta_map.get(a.id, 0)
            except Exception:
                pass

            AlgoliaService.configure_index()
            algolia_songs = AlgoliaService.reindex_all_active_songs(active_songs)
            algolia_artists = AlgoliaService.reindex_all_artists(active_artists)
            algolia_playlists = AlgoliaService.reindex_all_playlists(active_playlists)

            recombee_songs = RecombeeService.reindex_all_active_songs(active_songs)

            return Response(
                {
                    "status": "success",
                    "algolia": {
                        "songs": algolia_songs,
                        "artists": algolia_artists,
                        "playlists": algolia_playlists,
                    },
                    "recombee": {
                        "songs": recombee_songs,
                    },
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

