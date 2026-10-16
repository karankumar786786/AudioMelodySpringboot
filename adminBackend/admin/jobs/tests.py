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
            type="TRANSCODE",
            input_key="uploads/raw_song.wav",
            output_prefix="processed/song/",
            status="PROCESSING",
            created_at=datetime.now(),
            step=2,
            percentage=50,
            total_steps=4,
            current_step_name="ENCODING_HLS",
        )
        serializer = JobSerializer(job)
        data = serializer.data
        self.assertEqual(data["id"], "job-uuid-1")
        self.assertEqual(data["type"], "TRANSCODE")
        self.assertEqual(data["percentage"], 50)
        self.assertEqual(data["currentStepName"], "ENCODING_HLS")

    def test_delete_job_serializer(self):
        del_job = DeleteJob(
            id="del-uuid-1",
            type="DELETE_SONG",
            target_id="song-target-99",
            status="COMPLETED",
            created_at=datetime.now(),
            completed_at=datetime.now(),
            step=3,
            percentage=100,
            total_steps=3,
            current_step_name="CLEANUP_DONE",
        )
        serializer = DeleteJobSerializer(del_job)
        data = serializer.data
        self.assertEqual(data["id"], "del-uuid-1")
        self.assertEqual(data["type"], "DELETE_SONG")
        self.assertEqual(data["targetId"], "song-target-99")
        self.assertEqual(data["status"], "COMPLETED")

    def test_job_progress_dto_conversion(self):
        job = Job(
            id="job-dto-1",
            type="TRANSCODE",
            status="PROCESSING",
            step=1,
            percentage=25,
            total_steps=4,
            current_step_name="DOWNLOADING_SOURCE",
        )
        dto = to_job_progress_dto(job)
        self.assertEqual(dto["jobId"], "job-dto-1")
        self.assertEqual(dto["status"], "PROCESSING")
        self.assertEqual(dto["percentage"], 25)

    def test_delete_job_progress_dto_conversion(self):
        del_job = DeleteJob(
            id="del-dto-1",
            type="DELETE_ARTIST",
            target_id="art-123",
            status="QUEUED",
            step=0,
            percentage=0,
            total_steps=5,
            current_step_name="QUEUED",
        )
        dto = to_delete_job_progress_dto(del_job)
        self.assertEqual(dto["jobId"], "del-dto-1")
        self.assertEqual(dto["targetId"], "art-123")
        self.assertEqual(dto["status"], "QUEUED")
