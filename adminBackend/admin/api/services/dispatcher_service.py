"""Purane imports ke liye "facade" (sirf aage bhejta hai). Asli code ab core.services.dispatcher_service me hai."""
# pyrefly: ignore[missing-import]
from core.services.dispatcher_service import ExternalJobDispatcher

__all__ = ["ExternalJobDispatcher"]
