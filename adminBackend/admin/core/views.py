"""Base view jo saare admin views extend karte hain."""
from typing import Sequence, Any
from rest_framework.views import APIView
from core.authentication import AdminSessionAuthentication, IsAdminUserPermission


class BaseAdminView(APIView):
    """Saare admin API views ka base: Redis session login + admin role zaroori."""
    authentication_classes: Sequence[Any] = [AdminSessionAuthentication]
    permission_classes: Sequence[Any] = [IsAdminUserPermission]
