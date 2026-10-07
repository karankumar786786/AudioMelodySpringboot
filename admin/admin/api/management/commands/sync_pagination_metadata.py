import json
from django.core.management.base import BaseCommand
# pyrefly: ignore [missing-import]
from api.services import PaginationMetadataService


class Command(BaseCommand):
    help = "Reconcile PostgreSQL table counts with pagination_metadata rows and flush Redis cache"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting pagination metadata reconciliation..."))
        try:
            results = PaginationMetadataService.sync_all_metadata()
            self.stdout.write(self.style.SUCCESS("Reconciliation completed successfully:"))
            self.stdout.write(json.dumps(results, indent=2))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Reconciliation failed: {e}"))
            raise
