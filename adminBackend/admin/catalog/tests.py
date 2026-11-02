from datetime import datetime
from unittest.mock import patch
from django.test import SimpleTestCase
# pyrefly: ignore[missing-import]
from catalog.models import Artist, Playlist, Song, UserPlaylist
# pyrefly: ignore[missing-import]
from catalog.serializers import ArtistSerializer, PlaylistSerializer, SongSerializer


class CatalogAppTests(SimpleTestCase):
    def test_artist_serializer(self):
        artist = Artist(
            id="art-1",
            name="Arijit Singh",
            about="Playback Singer",
            cover_image_key="artists/arijit.jpg",
            status="ACTIVE",
            created_at=datetime.now(),
        )
        serializer = ArtistSerializer(artist)
        data = serializer.data
        self.assertEqual(data["name"], "Arijit Singh")
        self.assertEqual(data["coverImageKey"], "artists/arijit.jpg")

    def test_playlist_serializer(self):
        playlist = Playlist(
            id="pl-1",
            name="Chill Vibes",
            description="Relaxing evening tunes",
            cover_image_key="playlists/chill.jpg",
            total_songs=15,
            status="ACTIVE",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        serializer = PlaylistSerializer(playlist)
        data = serializer.data
        self.assertEqual(data["name"], "Chill Vibes")
        self.assertEqual(data["totalSongs"], 15)

    def test_song_serializer(self):
        song = Song(
            id="song-1",
            title="Tum Hi Ho",
            artist_name="Arijit Singh",
            duration=262,
            song_key="audios/tumhiho.mp3",
            image_key="images/tumhiho.jpg",
            preview_start_time=30,
            preview_end_time=60,
            is_featured=True,
            language="Hindi",
            genre="Romantic",
            album="Aashiqui 2",
            lrclib_id="1234",
            status="ACTIVE",
            job_id="job-1",
            created_at=datetime.now(),
        )
        serializer = SongSerializer(song)
        data = serializer.data
        self.assertEqual(data["title"], "Tum Hi Ho")
        self.assertEqual(data["artistName"], "Arijit Singh")
        self.assertTrue(data["isFeatured"])
        self.assertEqual(data["previewStartTime"], 30)

    def test_build_user_playlist_record_for_algolia(self):
        from core.services import AlgoliaService
        up_dict = {
            "id": "upl-101",
            "name": "My Favorites",
            "privacy": "PUBLIC",
            "shareToken": "token-xyz",
            "totalSongs": 12,
            "ownerId": "u-1",
            "ownerName": "karan",
        }
        record = AlgoliaService.build_user_playlist_record(up_dict)
        self.assertIsNotNone(record)
        self.assertEqual(record["objectID"], "upl-101")
        self.assertEqual(record["type"], "playlist")
        self.assertTrue(record["isUserPlaylist"])
        self.assertEqual(record["privacy"], "PUBLIC")
        self.assertEqual(record["ownerName"], "karan")
        self.assertEqual(record["totalSongs"], 12)

    @patch("catalog.models.Song.objects.filter")
    @patch("catalog.models.Artist.objects.filter")
    @patch("catalog.models.Playlist.objects.filter")
    @patch("catalog.models.UserPlaylist.objects.filter")
    def test_catalog_sync_health(self, mock_up, mock_pl, mock_art, mock_song):
        mock_song.return_value.count.return_value = 10
        mock_art.return_value.count.return_value = 5
        mock_pl.return_value.count.return_value = 2
        mock_up.return_value.count.return_value = 3

        from core.services import CatalogSyncService
        health = CatalogSyncService.get_sync_health()
        self.assertIn("status", health)
        self.assertIn("engines", health)
        self.assertIn("databaseCounts", health)
        self.assertEqual(health["databaseCounts"]["activeSongs"], 10)
        self.assertEqual(health["databaseCounts"]["publicUserPlaylists"], 3)

