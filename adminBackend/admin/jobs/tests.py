from datetime import datetime
from django.test import SimpleTestCase
# pyrefly: ignore[missing-import]
from jobs.models import Job, DeleteJob
# pyrefly: ignore[missing-import]
from jobs.serializers import JobSerializer, DeleteJobSerializer
# pyrefly: ignore[missing-import]
from core.helpers import to_job_progress_dto, to_delete_job_progress_dto


class JobsAppTests(SimpleTestCase):
    def test_job_serializer(self):
        job = Job(
            id="job-uuid-1",
            title="Blinding Lights",
            artist_name="The Weeknd",
            song_id="song-1",
            duration=200,
            image_key="images/bl.jpg",
            song_key="songs/bl.m3u8",
            status="PROCESSING",
            current_stage="TRANSCODING",
            transcoding_attempt=1,
            created_at=datetime.now(),
        )
        serializer = JobSerializer(job)
        data = serializer.data
        self.assertEqual(data["id"], "job-uuid-1")
        self.assertEqual(data["title"], "Blinding Lights")
        self.assertEqual(data["artistName"], "The Weeknd")
        self.assertEqual(data["currentStage"], "TRANSCODING")
        self.assertEqual(data["transcodingAttempt"], 1)

    def test_delete_job_serializer(self):
        del_job = DeleteJob(
            id="del-uuid-1",
            entity_type="SONG",
            entity_id="song-target-99",
            entity_title="Old Song",
            status="COMPLETED",
            current_stage="COMPLETED",
            attempt_count=1,
            max_attempts=3,
            created_at=datetime.now(),
            completed_at=datetime.now(),
        )
        serializer = DeleteJobSerializer(del_job)
        data = serializer.data
        self.assertEqual(data["id"], "del-uuid-1")
        self.assertEqual(data["entityType"], "SONG")
        self.assertEqual(data["entityId"], "song-target-99")
        self.assertEqual(data["entityTitle"], "Old Song")
        self.assertEqual(data["status"], "COMPLETED")

    def test_job_progress_dto_conversion(self):
        job = Job(
            id="job-dto-1",
            title="Starboy",
            artist_name="The Weeknd",
            song_id="song-2",
            image_key="images/starboy.jpg",
            status="PROCESSING",
            current_stage="TRANSCODING",
            created_at=datetime.now(),
        )
        dto = to_job_progress_dto(job)
        self.assertEqual(dto["id"], "job-dto-1")
        self.assertEqual(dto["title"], "Starboy")
        self.assertEqual(dto["artistName"], "The Weeknd")
        self.assertEqual(dto["status"], "PROCESSING")
        self.assertEqual(dto["currentStage"], "TRANSCODING")

    def test_delete_job_progress_dto_conversion(self):
        del_job = DeleteJob(
            id="del-dto-1",
            entity_type="ARTIST",
            entity_id="art-123",
            entity_title="Artist 123",
            status="PENDING",
            current_stage="QUEUED",
            created_at=datetime.now(),
        )
        dto = to_delete_job_progress_dto(del_job)
        self.assertEqual(dto["id"], "del-dto-1")
        self.assertEqual(dto["entityType"], "ARTIST")
        self.assertEqual(dto["entityId"], "art-123")
        self.assertEqual(dto["status"], "PENDING")
