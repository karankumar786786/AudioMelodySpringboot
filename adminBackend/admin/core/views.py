from rest_framework.views import APIView
from core.authentication import AdminSessionAuthentication, IsAdminUserPermission


class BaseAdminView(APIView):
    """Base Admin API View enforcing Redis session authentication & admin role permission."""
    authentication_classes = [AdminSessionAuthentication]
    permission_classes = [IsAdminUserPermission]
