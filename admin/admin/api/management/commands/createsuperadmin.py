import re
import uuid
from django.core.management.base import BaseCommand, CommandError
# pyrefly: ignore [missing-import]
from api.models import User
# pyrefly: ignore [missing-import]
from api.services import PaginationMetadataService


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Command(BaseCommand):
    help = "Creates or promotes a user to SUPER_ADMIN in the AudioMelody database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            help="Super Admin email address",
        )
        parser.add_argument(
            "--username",
            type=str,
            default=None,
            help="Super Admin display username",
        )

    def handle(self, *args, **options):
        email = options.get("email")
        username = options.get("username")

        is_interactive = not options.get("email")

        # 1. Prompt interactively if not provided
        if is_interactive:
            self.stdout.write(self.style.NOTICE("=== AudioMelody Super Admin Creation ==="))
            while not email:
                try:
                    val = input("Enter Super Admin Email: ").strip()
                except (KeyboardInterrupt, EOFError):
                    self.stdout.write("\nOperation cancelled.")
                    return
                if not val:
                    self.stderr.write(self.style.ERROR("Email cannot be empty."))
                    continue
                if not EMAIL_REGEX.match(val):
                    self.stderr.write(self.style.ERROR("Invalid email format. Please enter a valid email."))
                    continue
                email = val

        email = email.strip().lower()
        if not EMAIL_REGEX.match(email):
            raise CommandError(f"Invalid email address: '{email}'")

        if not username:
            if is_interactive:
                try:
                    username_input = input(f"Enter Super Admin Display Name [default: {email.split('@')[0]}]: ").strip()
                    username = username_input if username_input else email.split("@")[0]
                except (KeyboardInterrupt, EOFError):
                    username = email.split("@")[0]
            else:
                username = email.split("@")[0]

        # 2. Check if user already exists
        existing_user = User.objects.filter(email__iexact=email).first()

        if existing_user:
            old_role = existing_user.role
            was_already_super = (old_role == "SUPER_ADMIN" and existing_user.status == "ACTIVE")
            
            existing_user.role = "SUPER_ADMIN"
            existing_user.status = "ACTIVE"
            if username and not existing_user.user_name:
                existing_user.user_name = username
            existing_user.save()

            if was_already_super:
                self.stdout.write(
                    self.style.SUCCESS(f"\n[OK] User '{email}' (ID: {existing_user.id}) is already an ACTIVE SUPER_ADMIN.")
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"\n[OK] Successfully promoted user '{email}' (ID: {existing_user.id}) from {old_role} to SUPER_ADMIN!"
                    )
                )
            user = existing_user
        else:
            # Create new Super Admin user
            user_id = str(uuid.uuid4())
            user = User.objects.create(
                id=user_id,
                email=email,
                user_name=username,
                role="SUPER_ADMIN",
                status="ACTIVE",
            )
            try:
                PaginationMetadataService.increment_status("UsersEntity", "ACTIVE")
            except Exception as e:
                self.stderr.write(self.style.WARNING(f"Note: Could not increment pagination metadata: {e}"))

            self.stdout.write(
                self.style.SUCCESS(
                    f"\n[OK] Successfully created new SUPER_ADMIN user:\n"
                    f"     ID:       {user.id}\n"
                    f"     Email:    {user.email}\n"
                    f"     Name:     {user.user_name}\n"
                    f"     Role:     {user.role}\n"
                    f"     Status:   {user.status}"
                )
            )

        self.stdout.write(
            self.style.NOTICE(
                f"\nSuper Admin '{user.email}' is configured. You can now log in directly via the Admin Frontend."
            )
        )
