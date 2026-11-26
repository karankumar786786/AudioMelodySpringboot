import json
from django.core.management.base import BaseCommand
from core.services import PaginationMetadataService


class Command(BaseCommand):
    """python manage.py sync_pagination_metadata - pagination counters ko asli DB counts se dobara milao."""
    help = "Reconcile PostgreSQL table counts with pagination_metadata rows and flush Redis cache"

    def handle(self, *args, **options):
        """PaginationMetadataService.sync_all_metadata() chalao aur result JSON print karo. Fail ho to error likh ke exception aage phenko."""
        self.stdout.write(self.style.NOTICE("Starting pagination metadata reconciliation..."))
        try:
            results = PaginationMetadataService.sync_all_metadata()
            self.stdout.write(self.style.SUCCESS("Reconciliation completed successfully:"))
            self.stdout.write(json.dumps(results, indent=2))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Reconciliation failed: {e}"))
            raise
