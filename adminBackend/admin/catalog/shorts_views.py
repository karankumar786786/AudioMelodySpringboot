"""Admin endpoints for Shorts: upload, list, edit, moderate, and resolve reports."""

from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response

from core.helpers import format_paginated_response
from core.services.s3_service import S3Service
from core.services.short_service import ALLOWED_CONTENT_TYPES, ShortError, ShortService, new_raw_key, serialize
from core.views import BaseAdminView

from .models import Short, ShortReport


def _error(e: ShortError) -> Response:
    return Response({"message": str(e)}, status=e.status_code)


def _page_params(request):
    try:
        page = max(0, int(request.query_params.get("page", 0)))
        size = min(100, max(1, int(request.query_params.get("size", 20))))
    except ValueError:
        page, size = 0, 20
    return page, size


class ShortUploadUrlView(BaseAdminView):
    """A pre-signed PUT URL for the raw video (temp bucket, 30 minutes).

    GET ?contentType=... answers in the shape the dashboard's uploadToS3WithProgress
    helper expects ({key, preSignedUrl}); POST {contentType} does the same.
    """

    def _issue(self, content_type: str) -> Response:
        content_type = (content_type or "video/mp4").strip().lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            return Response({"message": "Only MP4 or MOV videos can be uploaded"}, status=status.HTTP_400_BAD_REQUEST)
        key = new_raw_key(content_type)
        url = S3Service.generate_presigned_upload_url(key)
        return Response({"key": key, "preSignedUrl": url, "rawKey": key, "uploadUrl": url}, status=status.HTTP_200_OK)

    def get(self, request):
        return self._issue(request.query_params.get("contentType"))

    def post(self, request):
        return self._issue(request.data.get("contentType"))


class ShortListView(BaseAdminView):
    def get(self, request):
        page, size = _page_params(request)
        qs = Short.objects.select_related("song").all()
        status_param = (request.query_params.get("status") or "").strip().upper()
        if status_param and status_param != "ALL":
            qs = qs.filter(status=status_param)
        else:
            qs = qs.exclude(status="DELETED")
        owner = (request.query_params.get("owner") or "").strip().upper()
        if owner in ("ADMIN", "LISTENER"):
            qs = qs.filter(owner_type=owner)
        if request.query_params.get("reported") in ("1", "true"):
            qs = qs.filter(reports_count__gt=0)
        song_id = (request.query_params.get("songId") or "").strip()
        if song_id:
            qs = qs.filter(song_id=song_id)
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(Q(caption__icontains=search) | Q(id__iexact=search) | Q(song__title__icontains=search))
        total = qs.count()
        rows = qs.order_by("-created_at")[page * size : page * size + size]
        meta = {"entityName": "Shorts", "totalCount": total, "activeCount": total, "blockedCount": 0, "deletedCount": 0}
        return Response(format_paginated_response([serialize(s) for s in rows], page, size, meta), status=status.HTTP_200_OK)

    def post(self, request):
        try:
            short = ShortService.create_admin_short(
                admin_id=str(getattr(request.user, "id", "") or ""),
                raw_key=request.data.get("rawKey"),
                caption=request.data.get("caption"),
                song_id=request.data.get("songId"),
            )
        except ShortError as e:
            return _error(e)
        return Response(serialize(short), status=status.HTTP_201_CREATED)


class ShortDetailView(BaseAdminView):
    def get(self, request, pk):
        short = Short.objects.select_related("song").filter(id=pk).first()
        if short is None:
            return Response({"message": "Short not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(serialize(short), status=status.HTTP_200_OK)

    def patch(self, request, pk):
        kwargs = {}
        if "caption" in request.data:
            kwargs["caption"] = request.data.get("caption")
        if "songId" in request.data:
            kwargs["song_id"] = request.data.get("songId")
        try:
            short = ShortService.update(pk, **kwargs)
        except ShortError as e:
            return _error(e)
        return Response(serialize(short), status=status.HTTP_200_OK)

    def delete(self, request, pk):
        try:
            ShortService.delete(pk)
        except ShortError as e:
            return _error(e)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ShortHideView(BaseAdminView):
    def post(self, request, pk):
        try:
            short = ShortService.hide(pk, request.data.get("reason"))
        except ShortError as e:
            return _error(e)
        return Response(serialize(short), status=status.HTTP_200_OK)


class ShortUnhideView(BaseAdminView):
    def post(self, request, pk):
        try:
            short = ShortService.unhide(pk)
        except ShortError as e:
            return _error(e)
        return Response(serialize(short), status=status.HTTP_200_OK)


class ShortReportListView(BaseAdminView):
    def get(self, request):
        page, size = _page_params(request)
        qs = ShortReport.objects.select_related("short", "reporter")
        if request.query_params.get("resolved") not in ("1", "true"):
            qs = qs.filter(resolved=False)
        total = qs.count()
        rows = qs.order_by("-created_at")[page * size : page * size + size]
        content = [
            {
                "id": r.id,
                "shortId": r.short_id,
                "shortStatus": r.short.status,
                "shortCaption": r.short.caption,
                "thumbnailKey": r.short.thumbnail_key,
                "reporterId": r.reporter_id,
                "reporterEmail": getattr(r.reporter, "email", None),
                "reason": r.reason,
                "note": r.note,
                "resolved": r.resolved,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
        meta = {"entityName": "ShortReports", "totalCount": total, "activeCount": total, "blockedCount": 0, "deletedCount": 0}
        return Response(format_paginated_response(content, page, size, meta), status=status.HTTP_200_OK)


class ShortReportResolveView(BaseAdminView):
    def post(self, request, report_id):
        try:
            ShortService.resolve_report(int(report_id), (request.data.get("action") or "").strip().lower())
        except ShortError as e:
            return _error(e)
        except ValueError:
            return Response({"message": "Invalid report id"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"resolved": True}, status=status.HTTP_200_OK)


class ShortBanView(BaseAdminView):
    """POST {days: N | 0 for permanent} bans an account from posting; DELETE lifts it."""

    def post(self, request, user_id):
        days = request.data.get("days", 7)
        try:
            until = ShortService.set_ban(user_id, int(days))
        except ShortError as e:
            return _error(e)
        except (TypeError, ValueError):
            return Response({"message": "days must be a number"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"userId": user_id, "bannedUntil": until.isoformat() if until else None}, status=status.HTTP_200_OK)

    def delete(self, request, user_id):
        try:
            ShortService.set_ban(user_id, None)
        except ShortError as e:
            return _error(e)
        return Response({"userId": user_id, "bannedUntil": None}, status=status.HTTP_200_OK)
