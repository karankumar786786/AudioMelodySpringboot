"""catalog ke views (API endpoints): artists, playlists aur songs ka CRUD, upload / reprocess jobs,
Algolia / Recombee reindex aur catalog health.

Flow: admin dashboard -> yeh views -> Postgres + Algolia / Recombee / ImageKit, aur naye uploads ke liye Inngest (media pipeline).
"""
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
    CatalogSyncService,
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
from .serializers import ArtistSerializer, CatalogHealthSongSerializer, PlaylistSerializer, SongSerializer
from . import health as catalog_health

logger = logging.getLogger(__name__)


# ==============================================================================
# Artists sambhalna
# ==============================================================================

class ArtistListView(BaseAdminView):
    """GET / POST /admin/artist - artists ki list, ya naya artist."""
    def get(self, request):
        """status (default ACTIVE, ALL = sab) aur search (naam / about) se filter, naye pehle, pages me.
        Filter na ho to total count sasti pagination metadata se.
        """
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
        """Naam zaroori (warna 400). Artist banao, counters set karo, Algolia me daalo. Output: 201."""
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
    """GET / PUT / DELETE /admin/artist/<id> - ek artist dekho, badlo ya delete karo."""
    def get(self, request, pk):
        """Ek artist ka JSON; na mile to 404."""
        artist = get_object_or_404(Artist, pk=pk)
        return Response(ArtistSerializer(artist).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        """Body me aaye fields badlo. Naya cover aaye to purana ImageKit se hatao. Algolia update. Output: 202."""
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
        """Soft delete: status DELETED, counters update, aur delete chain (Inngest) shuru.
        Pehle se DELETED ho to kuch nahi. Output: 202.
        """
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
    """GET /api/artists/<pk>/songs aur /admin/artist/<pk>/songs
    Ek artist ke songs pages me lautata hai.
    """
    def get(self, request, pk):
        """Artist ke naam se mile ACTIVE songs (search title / album se), naye pehle, pages me."""
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
# Playlists sambhalna
# ==============================================================================

class PlaylistListView(BaseAdminView):
    """GET / POST /admin/playlist - playlists ki list, ya nayi playlist."""
    def get(self, request):
        """status (default ACTIVE) aur search (naam / description) se filter, naye pehle, pages me."""
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
        """Naam zaroori (warna 400). Playlist banao, counters set karo, Algolia me daalo. Output: 201."""
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
    """GET / PUT / DELETE /admin/playlist/<id> - ek playlist dekho, badlo ya delete karo."""
    def get(self, request, pk):
        """Ek playlist ka JSON; na mile to 404."""
        playlist = get_object_or_404(Playlist, pk=pk)
        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        """Body ke fields badlo. Cover badle to purana hatao. videoKey khaali / "null" = video hatao,
        naya ho to purana hata ke naya lagao. Algolia update.
        """
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
        """Soft delete: status DELETED, counters update, delete chain shuru. Output: 204."""
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
    """GET / POST /admin/playlist/<id>/songs - playlist ke songs, ya ek song jodo."""
    def get(self, request, pk):
        """Playlist ke ACTIVE songs; featured aur search filter; naye pehle, pages me."""
        playlist = get_object_or_404(Playlist, pk=pk)
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        search = (request.query_params.get("search") or "").strip()
        offset = page * size

        song_ids = PlaylistSong.objects.filter(playlist=playlist).values_list("song_id", flat=True)
        qs = Song.objects.select_related("metadata").filter(id__in=song_ids, status="ACTIVE")

        featured_param = request.query_params.get("featured") or request.query_params.get("isFeatured")
        if featured_param is not None and str(featured_param).strip() != "":
            is_feat = str(featured_param).lower() in ("true", "1")
            qs = qs.filter(is_featured=is_feat)

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
        """PlaylistAddSongView.post hi chalata hai."""
        return PlaylistAddSongView().post(request, pk)


class PlaylistAddSongView(BaseAdminView):
    """POST /admin/playlist/<id>/songs/add - playlist me song jodo."""
    def post(self, request, pk):
        """songId zaroori (400). Song pehle se ho to kuch nahi; naya juda to total_songs +1
        (F() se DB me hi +1, taaki do requests saath aayein to bhi ginti sahi rahe).
        """
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
    """DELETE /admin/playlist/<id>/songs/<song_id> - playlist se song hatao."""
    def delete(self, request, pk, song_id):
        """Jod hatao; hata to total_songs ghatao par 0 se neeche nahi (Case/When se DB me hi)."""
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
# Songs sambhalna
# ==============================================================================

def _is_true(value) -> bool:
    """Query param "true" ya "1" hai? (None / khaali / baaki sab = False)"""
    return bool(value) and str(value).lower() in ("true", "1")


def _min_sec_total(data, prefix: str):
    """Form ke <prefix>Min aur <prefix>Sec ko jod ke total seconds banao (jaise clipStartMin=1, clipStartSec=5 -> 65).
    Dono me se koi bhi na aaya ho to None (matlab "set nahi kiya").
    """
    minutes = data.get(prefix + "Min")
    seconds = data.get(prefix + "Sec")
    if minutes is None and seconds is None:
        return None
    return int(minutes or 0) * 60 + int(seconds or 0)


class SongListView(BaseAdminView):
    """GET / POST /admin/song - songs ki list, ya naya song upload (job banta hai)."""
    def get(self, request):
        """Bahut saare filters (status, genre, language, country, featured, video / full video / lyrics, search).
        Naye pehle, pages me. Filter na ho to total count sasti pagination metadata se.
        """
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        search = (request.query_params.get("search") or "").strip()
        status_param = (request.query_params.get("status") or "").strip()
        genre_param = (request.query_params.get("genre") or "").strip()
        lang_param = (request.query_params.get("language") or "").strip()
        country_param = (request.query_params.get("country") or "").strip()
        featured_param = request.query_params.get("featured") or request.query_params.get("isFeatured")
        has_video_param = request.query_params.get("hasVideo")
        has_full_video_param = request.query_params.get("hasFullVideo")
        has_lyrics_param = request.query_params.get("hasLyrics")
        offset = page * size

        qs = Song.objects.select_related("metadata").all()
        if status_param and status_param.upper() != "ALL":
            qs = qs.filter(status=status_param.upper())
        elif not status_param:
            qs = qs.filter(status="ACTIVE")

        if genre_param and genre_param.upper() != "ALL":
            qs = qs.filter(Q(genre__iexact=genre_param) | Q(genre__icontains=genre_param))
        if lang_param and lang_param.upper() != "ALL":
            qs = qs.filter(language__iexact=lang_param)
        if country_param and country_param.upper() != "ALL":
            qs = qs.filter(country__iexact=country_param)
        if featured_param is not None and str(featured_param).strip() != "":
            is_feat = str(featured_param).lower() in ("true", "1")
            qs = qs.filter(is_featured=is_feat)
        if _is_true(has_video_param):
            qs = qs.filter(video_key__isnull=False).exclude(video_key="")
        if _is_true(has_full_video_param):
            qs = qs.filter(full_video_key__isnull=False).exclude(full_video_key="")
        if _is_true(has_lyrics_param):
            qs = qs.filter(lrclib_id__isnull=False).exclude(lrclib_id=0)

        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(artist_name__icontains=search)
                | Q(album__icontains=search)
                | Q(genre__icontains=search)
                | Q(country__icontains=search)
                | Q(language__icontains=search)
            )

        songs = list(qs.order_by("-created_at")[offset : offset + size])
        meta = PaginationMetadataService.get_metadata("SongsEntity")

        has_filters = bool(
            search
            or (genre_param and genre_param.upper() != "ALL")
            or (lang_param and lang_param.upper() != "ALL")
            or (country_param and country_param.upper() != "ALL")
            or (featured_param is not None and str(featured_param).strip() != "")
            or _is_true(has_video_param)
            or _is_true(has_full_video_param)
            or _is_true(has_lyrics_param)
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
        """tempSongKey ya tempVideoKey me se ek zaroori (400). Clip aur preview time seconds me badlo,
        naya Job (PENDING / QUEUED) banao aur Inngest ko bhejo. Song baad me finalize webhook banata hai. Output: 201 { jobId }.
        """
        data = request.data
        temp_song_key = (data.get("tempSongKey") or "").strip()
        temp_video_key = (data.get("tempVideoKey") or "").strip()

        if not temp_song_key and not temp_video_key:
            return Response(
                {"error": "Either audio file (tempSongKey) or full video file (tempVideoKey) must be provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clip_start_sec = _min_sec_total(data, "clipStart")
        clip_end_sec = _min_sec_total(data, "clipEnd")

        # previewStartTime (seconds) seedha aaye to wahi, warna previewStartMin / previewStartSec se banao
        preview_start = data.get("previewStartTime")
        if preview_start is None:
            preview_start = _min_sec_total(data, "previewStart")
        if preview_start is not None and preview_start < 0:
            preview_start = None

        preview_end = data.get("previewEndTime")
        if preview_end is None:
            preview_end = _min_sec_total(data, "previewEnd")
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
            country=data.get("country", "India") or "India",
            song_id=song_id,
            transcoding_attempt=0,
            transcoded=False,
            saved_in_search=False,
            saved_in_recommendation=False,
            status="PENDING",
            current_stage="QUEUED",
        )
        PaginationMetadataService.increment_job()
        RedisService.queue_audio_processing(job_id, attempt=job.transcoding_attempt)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_201_CREATED)


class SongDetailView(BaseAdminView):
    """GET / PUT / DELETE /admin/song/<id> - ek song dekho, badlo ya delete karo."""
    def get(self, request, pk):
        """Ek song ka JSON (stream count ke saath); na mile to 404."""
        song = get_object_or_404(Song.objects.select_related("metadata"), pk=pk)
        return Response(SongSerializer(song).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        """Body me aaye fields badlo. Artist ya status badle to unke counters bhi shift karo.
        Nayi image / video aaye to save ke baad purani ImageKit se hatao. Phir Recombee aur Algolia update.
        """
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
        if "country" in data:
            c = str(data["country"]).strip() if data["country"] else "India"
            song.country = c
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

        RecombeeService.save_song(song=song)
        AlgoliaService.save_song(song)

        return Response(SongSerializer(song).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        """Soft delete: status DELETED, artist / playlist counters update, delete chain shuru. Output: 204."""
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
    """PATCH /admin/song/<id>/featured - song ko featured / normal karo."""
    def patch(self, request, pk):
        """Body ka featured do to wahi, warna ulta kar do (toggle). Algolia aur Recombee update."""
        song = get_object_or_404(Song, pk=pk)
        featured = bool(request.data.get("featured", not song.is_featured))
        song.is_featured = featured
        song.save()
        AlgoliaService.save_song(song)
        RecombeeService.save_song(song=song)
        return Response(SongSerializer(song).data, status=status.HTTP_200_OK)


class SongJobDetailView(BaseAdminView):
    """GET /admin/song/job/<id> - ek upload job ka poora JSON."""
    def get(self, request, pk):
        """Job dhoondo (na mile to 404) aur JobSerializer se lautao."""
        job = get_object_or_404(Job, pk=pk)
        return Response(JobSerializer(job).data, status=status.HTTP_200_OK)


class SongJobsListView(BaseAdminView):
    """GET /admin/song/jobs - saare upload jobs ki list (search ke saath)."""
    def get(self, request):
        """title / artist / id se search, naye pehle, pages me."""
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
    """POST /admin/song/<id>/reprocess-audio - song ki audio nayi file se badlo."""
    def post(self, request, pk):
        """tempSongKey zaroori (400). Song ki info ke saath is_audio_reprocess wala naya Job banao aur bhejo. Output: 202."""
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
            country=song.country or "India",
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
        RedisService.queue_audio_processing(job_id, attempt=job.transcoding_attempt)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)


class SongReprocessVideoView(BaseAdminView):
    """POST /admin/song/<id>/reprocess-video - song ka video nayi file se badlo."""
    def post(self, request, pk):
        """tempVideoKey zaroori (400). Clip time ke saath is_video_reprocess wala Job banao aur bhejo. Output: 202."""
        song = get_object_or_404(Song, pk=pk)
        temp_video_key = (request.data.get("tempVideoKey") or "").strip()
        if not temp_video_key:
            return Response({"error": "tempVideoKey is required for video reprocessing"}, status=status.HTTP_400_BAD_REQUEST)

        clip_start_sec = _min_sec_total(request.data, "clipStart")
        clip_end_sec = _min_sec_total(request.data, "clipEnd")

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
            country=song.country or "India",
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
        RedisService.queue_audio_processing(job_id, attempt=job.transcoding_attempt)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)


class SongRecoverMediaView(BaseAdminView):
    """POST /admin/song/<id>/recover-media - kho gayi audio aur/ya video dobara upload karo."""
    def post(self, request, pk):
        """Audio ya video me se ek zaroori (400). Jo diya uske hisaab se audio / video reprocess flags set karke Job bhejo. Output: 202."""
        song = get_object_or_404(Song, pk=pk)
        temp_song_key = (request.data.get("tempSongKey") or "").strip() or None
        temp_video_key = (request.data.get("tempVideoKey") or "").strip() or None

        if not temp_song_key and not temp_video_key:
            return Response(
                {"error": "Either replacement audio (tempSongKey) or video (tempVideoKey) must be provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clip_start_sec = _min_sec_total(request.data, "clipStart")
        clip_end_sec = _min_sec_total(request.data, "clipEnd")

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
            country=song.country or "India",
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
        RedisService.queue_audio_processing(job_id, attempt=job.transcoding_attempt)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)


class SongReindexRecombeeView(BaseAdminView):
    """POST /admin/song/reindex-recombee - saare ACTIVE songs Recombee me dobara bhejo."""
    def post(self, request):
        """Jobs se audio features jod ke reindex karo. Error ho to 500 + message."""
        active_songs = list(Song.objects.filter(status="ACTIVE").select_related("metadata"))
        jobs_map = CatalogSyncService.build_jobs_map(active_songs)
        try:
            count = RecombeeService.reindex_all_active_songs(active_songs, jobs_by_song_id=jobs_map)
            return Response({"status": "success", "reindexed": count}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SongReindexAlgoliaView(BaseAdminView):
    """POST /admin/song/reindex-algolia - saare ACTIVE songs Algolia me dobara bhejo."""
    def post(self, request):
        """Jobs ki info jod ke reindex karo. Error ho to 500 + message."""
        active_songs = list(Song.objects.filter(status="ACTIVE").select_related("metadata"))
        jobs_map = CatalogSyncService.build_jobs_map(active_songs)
        try:
            count = AlgoliaService.reindex_all_active_songs(active_songs, jobs_by_song_id=jobs_map)
            return Response({"status": "success", "reindexed": count}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ArtistReindexAlgoliaView(BaseAdminView):
    """POST /admin/artist/reindex-algolia - saare ACTIVE artists Algolia me dobara bhejo."""
    def post(self, request):
        """Followers count ek hi query me jodo (fail ho to bina uske), phir reindex. Error = 500."""
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
    """POST /admin/playlist/reindex-algolia - saari ACTIVE playlists Algolia me dobara bhejo."""
    def post(self, request):
        """Reindex karo aur ginti lautao. Error = 500."""
        active_playlists = list(Playlist.objects.filter(status="ACTIVE"))
        try:
            count = AlgoliaService.reindex_all_playlists(active_playlists)
            return Response({"status": "success", "reindexed": count}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CatalogReindexAllView(BaseAdminView):
    """POST /admin/catalog/reindex-all - poora catalog Algolia + Recombee me sync."""
    def post(self, request):
        """purgeInactive (default True) ke saath CatalogSyncService.sync_full_catalog chalao. Error = 500."""
        try:
            purge_inactive = True
            if isinstance(request.data, dict) and "purgeInactive" in request.data:
                purge_inactive = bool(request.data["purgeInactive"])
            report = CatalogSyncService.sync_full_catalog(purge_inactive=purge_inactive)
            return Response(report, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CatalogSyncStreamCountsView(BaseAdminView):
    """POST /admin/catalog/sync-streams - sirf stream counts engines me sync karo."""
    def post(self, request):
        """CatalogSyncService.sync_stream_counts ki report lautao. Error = 500."""
        try:
            report = CatalogSyncService.sync_stream_counts()
            return Response(report, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CatalogSyncHealthView(BaseAdminView):
    """GET /admin/catalog/sync-health - DB aur engines (Algolia / Recombee) me kitna farak hai."""
    def get(self, request):
        """CatalogSyncService.get_sync_health ka result lautao. Error = 500."""
        try:
            health = CatalogSyncService.get_sync_health()
            return Response(health, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ==============================================================================
# Catalog health (/admin/catalog/health)
# ==============================================================================

MAX_HEALTH_BULK_SONGS = 200


def _parse_song_ids(data):
    """Body se songIds nikalo: khaali na ho, duplicate hatao (order wahi), 200 se zyada nahi.
    Output: (ids, None) ya (None, 400 wala Response).
    """
    ids = data.get("songIds") if isinstance(data, dict) else None
    if not isinstance(ids, list) or not ids:
        return None, Response({"error": "songIds must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)
    ids = list(dict.fromkeys(str(i).strip() for i in ids if str(i).strip()))
    if len(ids) > MAX_HEALTH_BULK_SONGS:
        return None, Response(
            {"error": f"At most {MAX_HEALTH_BULK_SONGS} songs per request"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return ids, None


class CatalogHealthView(BaseAdminView):
    """GET: summary counts + problem wale songs (pages me).

    Query params: issue=<catalog_health.ISSUES ki comma list> (default: koi bhi issue),
    match=any|all, search, status=ACTIVE|INACTIVE|ALL (default ACTIVE), page (0 se shuru), size.
    """

    def get(self, request):
        """page / size / issue / match check karo (galat = 400), summary aur problem wale songs lautao."""
        try:
            page = max(0, int(request.query_params.get("page", 0)))
            size = min(100, max(1, int(request.query_params.get("size", 20))))
        except (TypeError, ValueError):
            return Response({"error": "page and size must be integers"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            issues = catalog_health.parse_issues(request.query_params.get("issue"))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        match = (request.query_params.get("match") or "any").lower()
        if match not in ("any", "all"):
            return Response({"error": "match must be 'any' or 'all'"}, status=status.HTTP_400_BAD_REQUEST)
        status_param = (request.query_params.get("status") or "ACTIVE").strip().upper()
        search = (request.query_params.get("search") or "").strip()

        base = Song.objects.all()
        if status_param != "ALL":
            base = base.filter(status=status_param)
        base = catalog_health.annotate_health(base)
        summary = catalog_health.summarize(base)

        qs = catalog_health.filter_by_issues(base, issues, match)
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(artist_name__icontains=search) | Q(album__icontains=search))
        total = qs.count()
        songs = list(qs.order_by("-created_at", "id")[page * size : page * size + size])

        return Response(
            {
                "summary": summary,
                "issues": catalog_health.ISSUES,
                "content": CatalogHealthSongSerializer(songs, many=True).data,
                "page": page,
                "size": size,
                "totalElements": total,
                "totalPages": (total + size - 1) // size,
            },
            status=status.HTTP_200_OK,
        )


class CatalogHealthResyncView(BaseAdminView):
    """POST {songIds: [...], targets?: ["algolia", "recombee"]} -> chune hue ACTIVE songs dobara bhejo."""

    def post(self, request):
        """Sirf ACTIVE songs bhejo (baaki skipped). Sab kamyab ho to unke jobs pe 'saved' mark karo.
        Kisi engine me error ho to 502 + errors.
        """
        ids, error = _parse_song_ids(request.data)
        if error:
            return error
        targets = request.data.get("targets") or ["algolia", "recombee"]
        if not isinstance(targets, list) or not set(targets) <= {"algolia", "recombee"} or not targets:
            return Response({"error": "targets must be a subset of ['algolia', 'recombee']"}, status=status.HTTP_400_BAD_REQUEST)

        songs = list(Song.objects.filter(id__in=ids, status="ACTIVE").select_related("metadata"))
        found = {s.id for s in songs}
        skipped = [{"songId": i, "reason": "not found or not ACTIVE"} for i in ids if i not in found]
        result = {"requested": len(ids), "skipped": skipped, "algolia": None, "recombee": None}
        if not songs:
            return Response(result, status=status.HTTP_200_OK)

        jobs_map = CatalogSyncService.build_jobs_map(songs)
        errors = {}
        if "algolia" in targets:
            try:
                result["algolia"] = AlgoliaService.reindex_all_active_songs(songs, jobs_by_song_id=jobs_map)
            except Exception as e:
                errors["algolia"] = str(e)
        if "recombee" in targets:
            try:
                result["recombee"] = RecombeeService.reindex_all_active_songs(songs, jobs_by_song_id=jobs_map)
            except Exception as e:
                errors["recombee"] = str(e)

        # Kamyab push ko songs ke COMPLETED jobs pe record karo taaki "notIndexed" hat jaaye.
        # Count 0 matlab engine ka client set hi nahi hai, tab kuch mark nahi karte.
        song_ids = list(found)
        completed_jobs = Job.objects.filter(Q(song_id__in=song_ids) | Q(id__in=[s.job_id for s in songs if s.job_id]), status="COMPLETED")
        if result["algolia"] == len(songs):
            completed_jobs.filter(saved_in_search=False).update(saved_in_search=True)
        if result["recombee"] == len(songs):
            completed_jobs.filter(saved_in_recommendation=False).update(saved_in_recommendation=True)

        if errors:
            result["errors"] = errors
            return Response(result, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result, status=status.HTTP_200_OK)


class CatalogHealthReprocessView(BaseAdminView):
    """POST {songIds: [...]} -> har song ka sabse naya FAILED upload job dobara chalao.

    COMPLETED jobs dobara nahi chal sakte: finalize unki temp files hata deta hai, isliye aise songs
    skip hote hain - unke liye Songs Studio -> Reprocess audio se nayi file chahiye.
    """

    def post(self, request):
        # pyrefly: ignore[missing-import]
        """Har song ka sabse naya job dhoondo. FAILED ho to requeue_job, warna skip (wajah ke saath).
        Output: { queued, skipped }.
        """
        from jobs.views import requeue_job

        ids, error = _parse_song_ids(request.data)
        if error:
            return error
        songs = {s.id: s for s in Song.objects.filter(id__in=ids)}
        # Jobs naye se purane order me aate hain, isliye har song ka pehla mila job hi uska sabse naya job hai.
        jobs_by_song = {}
        for job in Job.objects.filter(Q(song_id__in=list(songs)) | Q(id__in=[s.job_id for s in songs.values() if s.job_id])).order_by("-created_at"):
            for s_id, s in songs.items():
                if (job.song_id == s_id or job.id == s.job_id) and s_id not in jobs_by_song:
                    jobs_by_song[s_id] = job

        queued, skipped = [], []
        for s_id in ids:
            job = jobs_by_song.get(s_id)
            if s_id not in songs:
                skipped.append({"songId": s_id, "reason": "song not found"})
            elif job is None:
                skipped.append({"songId": s_id, "reason": "no ingestion job"})
            elif job.status != "FAILED":
                skipped.append({
                    "songId": s_id,
                    "jobId": job.id,
                    "reason": f"latest job is {job.status}; upload new media via Reprocess audio instead",
                })
            elif requeue_job(job):
                queued.append({"songId": s_id, "jobId": job.id})
            else:
                skipped.append({"songId": s_id, "jobId": job.id, "reason": "failed to dispatch to Inngest"})

        return Response({"queued": queued, "skipped": skipped}, status=status.HTTP_200_OK)
