from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from .models import DeleteJob, Job


def format_ms(ms: Optional[int]) -> str:
    if ms is None:
        return "-"
    if ms < 1000:
        return f"{ms}ms"
    sec = ms / 1000.0
    return f"{sec:.1f}s"


def safe_diff_ms(t2: Optional[datetime], t1: Optional[datetime]) -> Optional[int]:
    """Calculates millisecond difference between two timestamps safely,
    handling offset-naive and offset-aware datetimes across databases."""
    if not t1 or not t2:
        return None
    try:
        if t2.tzinfo is not None and t1.tzinfo is None:
            t1 = t1.replace(tzinfo=t2.tzinfo)
        elif t2.tzinfo is None and t1.tzinfo is not None:
            t2 = t2.replace(tzinfo=t1.tzinfo)
        return int((t2 - t1).total_seconds() * 1000)
    except Exception:
        return None


def to_job_progress_dto(job: Job) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    current_stage = job.current_stage or "QUEUED"
    status = job.status or "PENDING"
    is_reprocess = bool(job.is_video_reprocess or job.is_audio_reprocess)

    # Calculate total elapsed time
    elapsed_total_ms = job.total_duration_ms
    if elapsed_total_ms is None and job.created_at:
        if status == "COMPLETED":
            end = job.completed_at or job.search_saved_at or job.transcoded_at or job.created_at
            elapsed_total_ms = safe_diff_ms(end, job.created_at)
        elif status == "FAILED":
            end = job.failed_at or job.search_saved_at or job.transcoded_at or job.created_at
            elapsed_total_ms = safe_diff_ms(end, job.created_at)
        else:
            elapsed_total_ms = safe_diff_ms(now, job.created_at)

    # Calculate current stage elapsed time
    current_stage_elapsed_ms = None
    if status in ("PROCESSING", "PENDING"):
        stage_start = job.created_at
        if current_stage == "TRANSCODING":
            stage_start = job.transcoding_started_at or job.created_at
        elif current_stage == "RECOMMENDATION_INDEXING":
            stage_start = job.transcoded_at or job.created_at
        elif current_stage == "SEARCH_INDEXING":
            stage_start = job.recommendation_saved_at or job.created_at
        elif current_stage == "FINALIZING":
            stage_start = job.search_saved_at or job.transcoded_at or job.created_at

        if stage_start:
            diff = safe_diff_ms(now, stage_start)
            current_stage_elapsed_ms = max(0, diff) if diff is not None else None

    stages = []

    # 1. QUEUED
    q_status = "COMPLETED"
    q_duration = None
    if job.transcoding_started_at:
        q_status = "COMPLETED"
        q_duration = safe_diff_ms(job.transcoding_started_at, job.created_at)
    elif status == "FAILED" and current_stage == "QUEUED":
        q_status = "FAILED"
        end = job.failed_at or job.created_at
        q_duration = safe_diff_ms(end, job.created_at)
    elif status in ("PENDING", "PROCESSING"):
        q_status = "IN_PROGRESS"
        q_duration = safe_diff_ms(now, job.created_at)
    stages.append({
        "stageName": "QUEUED",
        "label": "Queue & Pickup",
        "status": q_status,
        "startedAt": job.created_at.isoformat() if job.created_at else None,
        "completedAt": job.transcoding_started_at.isoformat() if job.transcoding_started_at else None,
        "durationMs": q_duration,
        "formattedDuration": format_ms(q_duration),
    })

    # 2. TRANSCODING
    t_status = "PENDING"
    t_duration = job.transcoding_duration_ms
    if job.transcoded_at:
        t_status = "COMPLETED"
    elif current_stage == "TRANSCODING":
        t_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if t_duration is None and job.transcoding_started_at:
            end = job.failed_at if (status == "FAILED" and job.failed_at) else now
            t_duration = safe_diff_ms(end, job.transcoding_started_at)
    elif not job.transcoding_started_at:
        t_status = "PENDING"
    else:
        t_status = "COMPLETED"
    stages.append({
        "stageName": "TRANSCODING",
        "label": "Transcoding & Packaging",
        "status": t_status,
        "startedAt": job.transcoding_started_at.isoformat() if job.transcoding_started_at else None,
        "completedAt": job.transcoded_at.isoformat() if job.transcoded_at else None,
        "durationMs": t_duration,
        "formattedDuration": format_ms(t_duration),
    })

    # 3. RECOMMENDATION INDEXING
    r_status = "PENDING"
    r_duration = job.recommendation_duration_ms
    if is_reprocess:
        r_status = "SKIPPED"
    elif job.saved_in_recommendation:
        r_status = "COMPLETED"
    elif current_stage == "RECOMMENDATION_INDEXING":
        r_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if r_duration is None and job.transcoded_at:
            end = job.failed_at if (status == "FAILED" and job.failed_at) else now
            r_duration = safe_diff_ms(end, job.transcoded_at)
    elif not job.transcoded_at:
        r_status = "PENDING"
    else:
        r_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "RECOMMENDATION_INDEXING",
        "label": "Recombee Indexing",
        "status": r_status,
        "startedAt": job.transcoded_at.isoformat() if job.transcoded_at else None,
        "completedAt": job.recommendation_saved_at.isoformat() if job.recommendation_saved_at else None,
        "durationMs": r_duration,
        "formattedDuration": format_ms(r_duration),
    })

    # 4. SEARCH INDEXING
    s_status = "PENDING"
    s_duration = job.search_duration_ms
    if is_reprocess:
        s_status = "SKIPPED"
    elif job.saved_in_search:
        s_status = "COMPLETED"
    elif current_stage == "SEARCH_INDEXING":
        s_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if s_duration is None and job.recommendation_saved_at:
            end = job.failed_at if (status == "FAILED" and job.failed_at) else now
            s_duration = safe_diff_ms(end, job.recommendation_saved_at)
    elif not job.recommendation_saved_at:
        s_status = "PENDING"
    else:
        s_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "SEARCH_INDEXING",
        "label": "Algolia Search Sync",
        "status": s_status,
        "startedAt": job.recommendation_saved_at.isoformat() if job.recommendation_saved_at else None,
        "completedAt": job.search_saved_at.isoformat() if job.search_saved_at else None,
        "durationMs": s_duration,
        "formattedDuration": format_ms(s_duration),
    })

    # 5. FINALIZING
    f_status = "PENDING"
    f_duration = job.finalize_duration_ms
    if status == "COMPLETED":
        f_status = "COMPLETED"
    elif current_stage == "FINALIZING":
        f_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        prev = job.search_saved_at or job.transcoded_at
        if f_duration is None and prev:
            end = job.failed_at if (status == "FAILED" and job.failed_at) else now
            f_duration = safe_diff_ms(end, prev)
    else:
        f_status = "FAILED" if status == "FAILED" else "PENDING"
    stages.append({
        "stageName": "FINALIZING",
        "label": "Update Song Record" if is_reprocess else "Finalize & Publish",
        "status": f_status,
        "startedAt": (job.search_saved_at or job.transcoded_at).isoformat() if (job.search_saved_at or job.transcoded_at) else None,
        "completedAt": job.completed_at.isoformat() if job.completed_at else None,
        "durationMs": f_duration,
        "formattedDuration": format_ms(f_duration),
    })

    return {
        "id": job.id,
        "title": job.title,
        "artistName": job.artist_name,
        "songId": job.song_id,
        "imageKey": job.image_key,
        "videoKey": job.video_key,
        "fullVideoKey": job.full_video_key,
        "duration": job.duration,
        "status": status,
        "currentStage": current_stage,
        "transcodingAttempt": job.transcoding_attempt or 0,
        "isVideoReprocess": bool(job.is_video_reprocess),
        "isAudioReprocess": bool(job.is_audio_reprocess),
        "createdAt": job.created_at.isoformat() if job.created_at else None,
        "transcodingStartedAt": job.transcoding_started_at.isoformat() if job.transcoding_started_at else None,
        "transcodedAt": job.transcoded_at.isoformat() if job.transcoded_at else None,
        "recommendationSavedAt": job.recommendation_saved_at.isoformat() if job.recommendation_saved_at else None,
        "searchSavedAt": job.search_saved_at.isoformat() if job.search_saved_at else None,
        "completedAt": job.completed_at.isoformat() if job.completed_at else None,
        "failedAt": job.failed_at.isoformat() if job.failed_at else None,
        "failureReason": job.failure_reason,
        "transcodingDurationMs": job.transcoding_duration_ms,
        "recommendationDurationMs": job.recommendation_duration_ms,
        "searchDurationMs": job.search_duration_ms,
        "finalizeDurationMs": job.finalize_duration_ms,
        "totalDurationMs": job.total_duration_ms,
        "elapsedTotalMs": elapsed_total_ms,
        "currentStageElapsedMs": current_stage_elapsed_ms,
        "stages": stages,
    }


def to_delete_job_progress_dto(job: DeleteJob) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    current_stage = job.current_stage or "QUEUED"
    status = job.status or "PENDING"

    elapsed_total_ms = job.total_duration_ms
    if elapsed_total_ms is None and job.created_at:
        if status == "COMPLETED":
            end = job.completed_at or job.s3_deleted_at or job.created_at
            elapsed_total_ms = safe_diff_ms(end, job.created_at)
        elif status == "FAILED":
            end = job.failed_at or job.created_at
            elapsed_total_ms = safe_diff_ms(end, job.created_at)
        else:
            elapsed_total_ms = safe_diff_ms(now, job.created_at)

    current_stage_elapsed_ms = None
    if status in ("IN_PROGRESS", "PENDING"):
        stage_start = job.created_at
        if current_stage == "SEARCH_DELETED":
            stage_start = job.started_at or job.created_at
        elif current_stage == "RECOMMENDATION_DELETED":
            stage_start = job.search_deleted_at or job.created_at
        elif current_stage == "IMAGEKIT_DELETED":
            stage_start = job.recommendation_deleted_at or job.created_at
        elif current_stage == "S3_DELETED":
            stage_start = job.imagekit_deleted_at or job.created_at
        elif current_stage == "COMPLETED":
            stage_start = job.s3_deleted_at or job.created_at

        if stage_start:
            diff = safe_diff_ms(now, stage_start)
            current_stage_elapsed_ms = max(0, diff) if diff is not None else None

    stages = []

    # 1. QUEUED
    q_status = "COMPLETED"
    q_duration = None
    if job.started_at:
        q_status = "COMPLETED"
        q_duration = safe_diff_ms(job.started_at, job.created_at)
    elif status == "FAILED" and current_stage == "QUEUED":
        q_status = "FAILED"
        end = job.failed_at or job.created_at
        q_duration = safe_diff_ms(end, job.created_at)
    elif status in ("PENDING", "IN_PROGRESS"):
        q_status = "IN_PROGRESS"
        q_duration = safe_diff_ms(now, job.created_at)
    stages.append({
        "stageName": "QUEUED",
        "label": "Queue & Pickup",
        "status": q_status,
        "startedAt": job.created_at.isoformat() if job.created_at else None,
        "completedAt": job.started_at.isoformat() if job.started_at else None,
        "durationMs": q_duration,
        "formattedDuration": format_ms(q_duration),
    })

    # 2. SEARCH_DELETED
    s_status = "PENDING"
    s_duration = job.search_duration_ms
    if job.search_deleted_at:
        s_status = "COMPLETED"
    elif current_stage == "SEARCH_DELETED":
        s_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if s_duration is None and job.started_at:
            end = job.failed_at if (status == "FAILED" and job.failed_at) else now
            s_duration = safe_diff_ms(end, job.started_at)
    elif not job.started_at:
        s_status = "PENDING"
    else:
        s_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "SEARCH_DELETED",
        "label": "Algolia Search Sync",
        "status": s_status,
        "startedAt": job.started_at.isoformat() if job.started_at else None,
        "completedAt": job.search_deleted_at.isoformat() if job.search_deleted_at else None,
        "durationMs": s_duration,
        "formattedDuration": format_ms(s_duration),
    })

    # 3. RECOMMENDATION_DELETED
    r_status = "PENDING"
    r_duration = job.recommendation_duration_ms
    if job.entity_type != "SONG":
        r_status = "SKIPPED"
    elif job.recommendation_deleted_at:
        r_status = "COMPLETED"
    elif current_stage == "RECOMMENDATION_DELETED":
        r_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if r_duration is None and job.search_deleted_at:
            end = job.failed_at if (status == "FAILED" and job.failed_at) else now
            r_duration = safe_diff_ms(end, job.search_deleted_at)
    elif not job.search_deleted_at:
        r_status = "PENDING"
    else:
        r_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "RECOMMENDATION_DELETED",
        "label": "Recombee Indexing",
        "status": r_status,
        "startedAt": job.search_deleted_at.isoformat() if job.search_deleted_at else None,
        "completedAt": job.recommendation_deleted_at.isoformat() if job.recommendation_deleted_at else None,
        "durationMs": r_duration,
        "formattedDuration": format_ms(r_duration),
    })

    # 4. IMAGEKIT_DELETED
    i_status = "PENDING"
    i_duration = job.imagekit_duration_ms
    if job.imagekit_deleted_at:
        i_status = "COMPLETED"
    elif current_stage == "IMAGEKIT_DELETED":
        i_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        prev = job.recommendation_deleted_at or job.search_deleted_at
        if i_duration is None and prev:
            end = job.failed_at if (status == "FAILED" and job.failed_at) else now
            i_duration = safe_diff_ms(end, prev)
    elif not (job.recommendation_deleted_at or job.search_deleted_at):
        i_status = "PENDING"
    else:
        i_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "IMAGEKIT_DELETED",
        "label": "ImageKit CDN Media",
        "status": i_status,
        "startedAt": (job.recommendation_deleted_at or job.search_deleted_at).isoformat() if (job.recommendation_deleted_at or job.search_deleted_at) else None,
        "completedAt": job.imagekit_deleted_at.isoformat() if job.imagekit_deleted_at else None,
        "durationMs": i_duration,
        "formattedDuration": format_ms(i_duration),
    })

    # 5. S3_DELETED
    s3_status = "PENDING"
    s3_duration = job.s3_duration_ms
    if job.s3_deleted_at:
        s3_status = "COMPLETED"
    elif current_stage == "S3_DELETED":
        s3_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if s3_duration is None and job.imagekit_deleted_at:
            end = job.failed_at if (status == "FAILED" and job.failed_at) else now
            s3_duration = safe_diff_ms(end, job.imagekit_deleted_at)
    elif not job.imagekit_deleted_at:
        s3_status = "PENDING"
    else:
        s3_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "S3_DELETED",
        "label": "S3 Audio & Video Prefix",
        "status": s3_status,
        "startedAt": job.imagekit_deleted_at.isoformat() if job.imagekit_deleted_at else None,
        "completedAt": job.s3_deleted_at.isoformat() if job.s3_deleted_at else None,
        "durationMs": s3_duration,
        "formattedDuration": format_ms(s3_duration),
    })

    # 6. COMPLETED
    c_status = "PENDING"
    c_duration = job.finalize_duration_ms
    if status == "COMPLETED":
        c_status = "COMPLETED"
    elif current_stage == "COMPLETED":
        c_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if c_duration is None and job.s3_deleted_at:
            end = job.failed_at if (status == "FAILED" and job.failed_at) else now
            c_duration = safe_diff_ms(end, job.s3_deleted_at)
    else:
        c_status = "FAILED" if status == "FAILED" else "PENDING"
    stages.append({
        "stageName": "COMPLETED",
        "label": "Database Hard Delete",
        "status": c_status,
        "startedAt": (job.s3_deleted_at or job.imagekit_deleted_at).isoformat() if (job.s3_deleted_at or job.imagekit_deleted_at) else None,
        "completedAt": job.completed_at.isoformat() if job.completed_at else None,
        "durationMs": c_duration,
        "formattedDuration": format_ms(c_duration),
    })


    return {
        "id": job.id,
        "entityType": job.entity_type,
        "entityId": job.entity_id,
        "entityTitle": job.entity_title,
        "songKey": job.song_key,
        "imageKey": job.image_key,
        "coverImageKey": job.cover_image_key,
        "videoKey": job.video_key,
        "fullVideoKey": job.full_video_key,
        "status": status,
        "currentStage": current_stage,
        "attemptCount": job.attempt_count or 0,
        "maxAttempts": job.max_attempts or 3,
        "createdAt": job.created_at.isoformat() if job.created_at else None,
        "startedAt": job.started_at.isoformat() if job.started_at else None,
        "searchDeletedAt": job.search_deleted_at.isoformat() if job.search_deleted_at else None,
        "recommendationDeletedAt": job.recommendation_deleted_at.isoformat() if job.recommendation_deleted_at else None,
        "imagekitDeletedAt": job.imagekit_deleted_at.isoformat() if job.imagekit_deleted_at else None,
        "s3DeletedAt": job.s3_deleted_at.isoformat() if job.s3_deleted_at else None,
        "completedAt": job.completed_at.isoformat() if job.completed_at else None,
        "failedAt": job.failed_at.isoformat() if job.failed_at else None,
        "failureReason": job.failure_reason,
        "searchDurationMs": job.search_duration_ms,
        "recommendationDurationMs": job.recommendation_duration_ms,
        "imagekitDurationMs": job.imagekit_duration_ms,
        "s3DurationMs": job.s3_duration_ms,
        "finalizeDurationMs": job.finalize_duration_ms,
        "totalDurationMs": job.total_duration_ms,
        "elapsedTotalMs": elapsed_total_ms,
        "currentStageElapsedMs": current_stage_elapsed_ms,
        "stages": stages,
    }


def format_paginated_response(content: List[Any], page: int, size: int, metadata: Any) -> Dict[str, Any]:
    meta_dict = None
    if metadata:
        if isinstance(metadata, dict):
            meta_dict = metadata
        elif hasattr(metadata, "entity_name"):
            meta_dict = {
                "id": metadata.id,
                "entityName": metadata.entity_name,
                "totalCount": metadata.total_count,
                "activeCount": metadata.active_count,
                "blockedCount": metadata.blocked_count,
                "deletedCount": metadata.deleted_count,
            }

    return {
        "content": content,
        "page": page,
        "size": size,
        "paginationMetaData": meta_dict,
    }
