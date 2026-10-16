from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


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


def to_job_progress_dto(job: Any) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    current_stage = getattr(job, "current_stage", "QUEUED") or "QUEUED"
    status = getattr(job, "status", "PENDING") or "PENDING"
    is_reprocess = bool(getattr(job, "is_video_reprocess", False) or getattr(job, "is_audio_reprocess", False))

    # Calculate total elapsed time
    elapsed_total_ms = getattr(job, "total_duration_ms", None)
    created_at = getattr(job, "created_at", None)
    completed_at = getattr(job, "completed_at", None)
    search_saved_at = getattr(job, "search_saved_at", None)
    transcoded_at = getattr(job, "transcoded_at", None)
    transcoding_started_at = getattr(job, "transcoding_started_at", None)
    recommendation_saved_at = getattr(job, "recommendation_saved_at", None)
    failed_at = getattr(job, "failed_at", None)

    if elapsed_total_ms is None and created_at:
        if status == "COMPLETED":
            end = completed_at or search_saved_at or transcoded_at or created_at
            elapsed_total_ms = safe_diff_ms(end, created_at)
        elif status == "FAILED":
            end = failed_at or search_saved_at or transcoded_at or created_at
            elapsed_total_ms = safe_diff_ms(end, created_at)
        else:
            elapsed_total_ms = safe_diff_ms(now, created_at)

    # Calculate current stage elapsed time
    current_stage_elapsed_ms = None
    if status in ("PROCESSING", "PENDING"):
        stage_start = created_at
        if current_stage == "TRANSCODING":
            stage_start = transcoding_started_at or created_at
        elif current_stage == "RECOMMENDATION_INDEXING":
            stage_start = transcoded_at or created_at
        elif current_stage == "SEARCH_INDEXING":
            stage_start = recommendation_saved_at or created_at
        elif current_stage == "FINALIZING":
            stage_start = search_saved_at or transcoded_at or created_at

        if stage_start:
            diff = safe_diff_ms(now, stage_start)
            current_stage_elapsed_ms = max(0, diff) if diff is not None else None

    stages = []

    # 1. QUEUED
    q_status = "COMPLETED"
    q_duration = None
    if transcoding_started_at:
        q_status = "COMPLETED"
        q_duration = safe_diff_ms(transcoding_started_at, created_at)
    elif status == "FAILED" and current_stage == "QUEUED":
        q_status = "FAILED"
        end = failed_at or created_at
        q_duration = safe_diff_ms(end, created_at)
    elif status in ("PENDING", "PROCESSING"):
        q_status = "IN_PROGRESS"
        q_duration = safe_diff_ms(now, created_at)
    stages.append({
        "stageName": "QUEUED",
        "label": "Queue & Pickup",
        "status": q_status,
        "startedAt": created_at.isoformat() if created_at else None,
        "completedAt": transcoding_started_at.isoformat() if transcoding_started_at else None,
        "durationMs": q_duration,
        "formattedDuration": format_ms(q_duration),
    })

    # 2. TRANSCODING
    t_status = "PENDING"
    t_duration = getattr(job, "transcoding_duration_ms", None)
    if transcoded_at:
        t_status = "COMPLETED"
    elif current_stage == "TRANSCODING":
        t_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if t_duration is None and transcoding_started_at:
            end = failed_at if (status == "FAILED" and failed_at) else now
            t_duration = safe_diff_ms(end, transcoding_started_at)
    elif not transcoding_started_at:
        t_status = "PENDING"
    else:
        t_status = "COMPLETED"
    stages.append({
        "stageName": "TRANSCODING",
        "label": "Transcoding & Packaging",
        "status": t_status,
        "startedAt": transcoding_started_at.isoformat() if transcoding_started_at else None,
        "completedAt": transcoded_at.isoformat() if transcoded_at else None,
        "durationMs": t_duration,
        "formattedDuration": format_ms(t_duration),
    })

    # 3. RECOMMENDATION INDEXING
    r_status = "PENDING"
    r_duration = getattr(job, "recommendation_duration_ms", None)
    if is_reprocess:
        r_status = "SKIPPED"
    elif getattr(job, "saved_in_recommendation", False):
        r_status = "COMPLETED"
    elif current_stage == "RECOMMENDATION_INDEXING":
        r_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if r_duration is None and transcoded_at:
            end = failed_at if (status == "FAILED" and failed_at) else now
            r_duration = safe_diff_ms(end, transcoded_at)
    elif not transcoded_at:
        r_status = "PENDING"
    else:
        r_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "RECOMMENDATION_INDEXING",
        "label": "Recombee Indexing",
        "status": r_status,
        "startedAt": transcoded_at.isoformat() if transcoded_at else None,
        "completedAt": recommendation_saved_at.isoformat() if recommendation_saved_at else None,
        "durationMs": r_duration,
        "formattedDuration": format_ms(r_duration),
    })

    # 4. SEARCH INDEXING
    s_status = "PENDING"
    s_duration = getattr(job, "search_duration_ms", None)
    if is_reprocess:
        s_status = "SKIPPED"
    elif getattr(job, "saved_in_search", False):
        s_status = "COMPLETED"
    elif current_stage == "SEARCH_INDEXING":
        s_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if s_duration is None and recommendation_saved_at:
            end = failed_at if (status == "FAILED" and failed_at) else now
            s_duration = safe_diff_ms(end, recommendation_saved_at)
    elif not recommendation_saved_at:
        s_status = "PENDING"
    else:
        s_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "SEARCH_INDEXING",
        "label": "Algolia Search Sync",
        "status": s_status,
        "startedAt": recommendation_saved_at.isoformat() if recommendation_saved_at else None,
        "completedAt": getattr(job, "search_saved_at", None).isoformat() if getattr(job, "search_saved_at", None) else None,
        "durationMs": s_duration,
        "formattedDuration": format_ms(s_duration),
    })

    # 5. FINALIZING
    f_status = "PENDING"
    f_duration = getattr(job, "finalize_duration_ms", None)
    if status == "COMPLETED":
        f_status = "COMPLETED"
    elif current_stage == "FINALIZING":
        f_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        prev = search_saved_at or transcoded_at
        if f_duration is None and prev:
            end = failed_at if (status == "FAILED" and failed_at) else now
            f_duration = safe_diff_ms(end, prev)
    else:
        f_status = "FAILED" if status == "FAILED" else "PENDING"
    stages.append({
        "stageName": "FINALIZING",
        "label": "Update Song Record" if is_reprocess else "Finalize & Publish",
        "status": f_status,
        "startedAt": (search_saved_at or transcoded_at).isoformat() if (search_saved_at or transcoded_at) else None,
        "completedAt": completed_at.isoformat() if completed_at else None,
        "durationMs": f_duration,
        "formattedDuration": format_ms(f_duration),
    })

    return {
        "id": job.id,
        "title": getattr(job, "title", ""),
        "artistName": getattr(job, "artist_name", ""),
        "songId": getattr(job, "song_id", ""),
        "imageKey": getattr(job, "image_key", ""),
        "videoKey": getattr(job, "video_key", None),
        "fullVideoKey": getattr(job, "full_video_key", None),
        "duration": getattr(job, "duration", None),
        "status": status,
        "currentStage": current_stage,
        "transcodingAttempt": getattr(job, "transcoding_attempt", 0) or 0,
        "isVideoReprocess": bool(getattr(job, "is_video_reprocess", False)),
        "isAudioReprocess": bool(getattr(job, "is_audio_reprocess", False)),
        "createdAt": created_at.isoformat() if created_at else None,
        "transcodingStartedAt": transcoding_started_at.isoformat() if transcoding_started_at else None,
        "transcodedAt": transcoded_at.isoformat() if transcoded_at else None,
        "recommendationSavedAt": recommendation_saved_at.isoformat() if recommendation_saved_at else None,
        "searchSavedAt": search_saved_at.isoformat() if search_saved_at else None,
        "completedAt": completed_at.isoformat() if completed_at else None,
        "failedAt": failed_at.isoformat() if failed_at else None,
        "failureReason": getattr(job, "failure_reason", None),
        "transcodingDurationMs": getattr(job, "transcoding_duration_ms", None),
        "recommendationDurationMs": getattr(job, "recommendation_duration_ms", None),
        "searchDurationMs": getattr(job, "search_duration_ms", None),
        "finalizeDurationMs": getattr(job, "finalize_duration_ms", None),
        "totalDurationMs": getattr(job, "total_duration_ms", None),
        "elapsedTotalMs": elapsed_total_ms,
        "currentStageElapsedMs": current_stage_elapsed_ms,
        "stages": stages,
    }


def to_delete_job_progress_dto(job: Any) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    current_stage = getattr(job, "current_stage", "QUEUED") or "QUEUED"
    status = getattr(job, "status", "PENDING") or "PENDING"

    elapsed_total_ms = getattr(job, "total_duration_ms", None)
    created_at = getattr(job, "created_at", None)
    started_at = getattr(job, "started_at", None)
    search_deleted_at = getattr(job, "search_deleted_at", None)
    recommendation_deleted_at = getattr(job, "recommendation_deleted_at", None)
    imagekit_deleted_at = getattr(job, "imagekit_deleted_at", None)
    s3_deleted_at = getattr(job, "s3_deleted_at", None)
    completed_at = getattr(job, "completed_at", None)
    failed_at = getattr(job, "failed_at", None)

    if elapsed_total_ms is None and created_at:
        if status == "COMPLETED":
            end = completed_at or s3_deleted_at or created_at
            elapsed_total_ms = safe_diff_ms(end, created_at)
        elif status == "FAILED":
            end = failed_at or created_at
            elapsed_total_ms = safe_diff_ms(end, created_at)
        else:
            elapsed_total_ms = safe_diff_ms(now, created_at)

    current_stage_elapsed_ms = None
    if status in ("IN_PROGRESS", "PENDING"):
        stage_start = created_at
        if current_stage == "SEARCH_DELETED":
            stage_start = started_at or created_at
        elif current_stage == "RECOMMENDATION_DELETED":
            stage_start = search_deleted_at or created_at
        elif current_stage == "IMAGEKIT_DELETED":
            stage_start = recommendation_deleted_at or created_at
        elif current_stage == "S3_DELETED":
            stage_start = imagekit_deleted_at or created_at
        elif current_stage == "COMPLETED":
            stage_start = s3_deleted_at or created_at

        if stage_start:
            diff = safe_diff_ms(now, stage_start)
            current_stage_elapsed_ms = max(0, diff) if diff is not None else None

    stages = []

    # 1. QUEUED
    q_status = "COMPLETED"
    q_duration = None
    if started_at:
        q_status = "COMPLETED"
        q_duration = safe_diff_ms(started_at, created_at)
    elif status == "FAILED" and current_stage == "QUEUED":
        q_status = "FAILED"
        end = failed_at or created_at
        q_duration = safe_diff_ms(end, created_at)
    elif status in ("PENDING", "IN_PROGRESS"):
        q_status = "IN_PROGRESS"
        q_duration = safe_diff_ms(now, created_at)
    stages.append({
        "stageName": "QUEUED",
        "label": "Queue & Pickup",
        "status": q_status,
        "startedAt": created_at.isoformat() if created_at else None,
        "completedAt": started_at.isoformat() if started_at else None,
        "durationMs": q_duration,
        "formattedDuration": format_ms(q_duration),
    })

    # 2. SEARCH_DELETED
    s_status = "PENDING"
    s_duration = getattr(job, "search_duration_ms", None)
    if search_deleted_at:
        s_status = "COMPLETED"
    elif current_stage == "SEARCH_DELETED":
        s_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if s_duration is None and started_at:
            end = failed_at if (status == "FAILED" and failed_at) else now
            s_duration = safe_diff_ms(end, started_at)
    elif not started_at:
        s_status = "PENDING"
    else:
        s_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "SEARCH_DELETED",
        "label": "Algolia Search Sync",
        "status": s_status,
        "startedAt": started_at.isoformat() if started_at else None,
        "completedAt": search_deleted_at.isoformat() if search_deleted_at else None,
        "durationMs": s_duration,
        "formattedDuration": format_ms(s_duration),
    })

    # 3. RECOMMENDATION_DELETED
    r_status = "PENDING"
    r_duration = getattr(job, "recommendation_duration_ms", None)
    entity_type = getattr(job, "entity_type", "")
    if entity_type != "SONG":
        r_status = "SKIPPED"
    elif recommendation_deleted_at:
        r_status = "COMPLETED"
    elif current_stage == "RECOMMENDATION_DELETED":
        r_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if r_duration is None and search_deleted_at:
            end = failed_at if (status == "FAILED" and failed_at) else now
            r_duration = safe_diff_ms(end, search_deleted_at)
    elif not search_deleted_at:
        r_status = "PENDING"
    else:
        r_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "RECOMMENDATION_DELETED",
        "label": "Recombee Indexing",
        "status": r_status,
        "startedAt": search_deleted_at.isoformat() if search_deleted_at else None,
        "completedAt": recommendation_deleted_at.isoformat() if recommendation_deleted_at else None,
        "durationMs": r_duration,
        "formattedDuration": format_ms(r_duration),
    })

    # 4. IMAGEKIT_DELETED
    i_status = "PENDING"
    i_duration = getattr(job, "imagekit_duration_ms", None)
    if imagekit_deleted_at:
        i_status = "COMPLETED"
    elif current_stage == "IMAGEKIT_DELETED":
        i_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        prev = recommendation_deleted_at or search_deleted_at
        if i_duration is None and prev:
            end = failed_at if (status == "FAILED" and failed_at) else now
            i_duration = safe_diff_ms(end, prev)
    elif not (recommendation_deleted_at or search_deleted_at):
        i_status = "PENDING"
    else:
        i_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "IMAGEKIT_DELETED",
        "label": "ImageKit CDN Media",
        "status": i_status,
        "startedAt": (recommendation_deleted_at or search_deleted_at).isoformat() if (recommendation_deleted_at or search_deleted_at) else None,
        "completedAt": imagekit_deleted_at.isoformat() if imagekit_deleted_at else None,
        "durationMs": i_duration,
        "formattedDuration": format_ms(i_duration),
    })

    # 5. S3_DELETED
    s3_status = "PENDING"
    s3_duration = getattr(job, "s3_duration_ms", None)
    if s3_deleted_at:
        s3_status = "COMPLETED"
    elif current_stage == "S3_DELETED":
        s3_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if s3_duration is None and imagekit_deleted_at:
            end = failed_at if (status == "FAILED" and failed_at) else now
            s3_duration = safe_diff_ms(end, imagekit_deleted_at)
    elif not imagekit_deleted_at:
        s3_status = "PENDING"
    else:
        s3_status = "COMPLETED" if status == "COMPLETED" else "PENDING"
    stages.append({
        "stageName": "S3_DELETED",
        "label": "S3 Audio & Video Prefix",
        "status": s3_status,
        "startedAt": imagekit_deleted_at.isoformat() if imagekit_deleted_at else None,
        "completedAt": s3_deleted_at.isoformat() if s3_deleted_at else None,
        "durationMs": s3_duration,
        "formattedDuration": format_ms(s3_duration),
    })

    # 6. COMPLETED
    c_status = "PENDING"
    c_duration = getattr(job, "finalize_duration_ms", None)
    if status == "COMPLETED":
        c_status = "COMPLETED"
    elif current_stage == "COMPLETED":
        c_status = "FAILED" if status == "FAILED" else "IN_PROGRESS"
        if c_duration is None and s3_deleted_at:
            end = failed_at if (status == "FAILED" and failed_at) else now
            c_duration = safe_diff_ms(end, s3_deleted_at)
    else:
        c_status = "FAILED" if status == "FAILED" else "PENDING"
    stages.append({
        "stageName": "COMPLETED",
        "label": "Database Hard Delete",
        "status": c_status,
        "startedAt": (s3_deleted_at or imagekit_deleted_at).isoformat() if (s3_deleted_at or imagekit_deleted_at) else None,
        "completedAt": completed_at.isoformat() if completed_at else None,
        "durationMs": c_duration,
        "formattedDuration": format_ms(c_duration),
    })

    return {
        "id": job.id,
        "entityType": getattr(job, "entity_type", ""),
        "entityId": getattr(job, "entity_id", ""),
        "entityTitle": getattr(job, "entity_title", ""),
        "songKey": getattr(job, "song_key", ""),
        "imageKey": getattr(job, "image_key", ""),
        "coverImageKey": getattr(job, "cover_image_key", ""),
        "videoKey": getattr(job, "video_key", None),
        "fullVideoKey": getattr(job, "full_video_key", None),
        "status": status,
        "currentStage": current_stage,
        "attemptCount": getattr(job, "attempt_count", 0) or 0,
        "maxAttempts": getattr(job, "max_attempts", 3) or 3,
        "createdAt": created_at.isoformat() if created_at else None,
        "startedAt": started_at.isoformat() if started_at else None,
        "searchDeletedAt": search_deleted_at.isoformat() if search_deleted_at else None,
        "recommendationDeletedAt": recommendation_deleted_at.isoformat() if recommendation_deleted_at else None,
        "imagekitDeletedAt": imagekit_deleted_at.isoformat() if imagekit_deleted_at else None,
        "s3DeletedAt": s3_deleted_at.isoformat() if s3_deleted_at else None,
        "completedAt": completed_at.isoformat() if completed_at else None,
        "failedAt": failed_at.isoformat() if failed_at else None,
        "failureReason": getattr(job, "failure_reason", None),
        "searchDurationMs": getattr(job, "search_duration_ms", None),
        "recommendationDurationMs": getattr(job, "recommendation_duration_ms", None),
        "imagekitDurationMs": getattr(job, "imagekit_duration_ms", None),
        "s3DurationMs": getattr(job, "s3_duration_ms", None),
        "finalizeDurationMs": getattr(job, "finalize_duration_ms", None),
        "totalDurationMs": getattr(job, "total_duration_ms", None),
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
