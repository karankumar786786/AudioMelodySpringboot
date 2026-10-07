import re
import uuid
from django.core.management.base import BaseCommand, CommandError
# pyrefly: ignore [missing-import]
from api.models import Admin


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Command(BaseCommand):
    help = "Creates or promotes an admin to SUPER_ADMIN in the admin_users table."

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

        # 2. Check if admin user already exists in admin_users table
        existing_admin = Admin.objects.filter(email__iexact=email).first()

        if existing_admin:
            old_role = existing_admin.role
            was_already_super = (old_role == "SUPER_ADMIN" and existing_admin.status == "ACTIVE")
            
            existing_admin.role = "SUPER_ADMIN"
            existing_admin.status = "ACTIVE"
            if username and not existing_admin.name:
                existing_admin.name = username
            existing_admin.save()

            if was_already_super:
                self.stdout.write(
                    self.style.SUCCESS(f"\n[OK] Admin '{email}' (ID: {existing_admin.id}) is already an ACTIVE SUPER_ADMIN.")
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"\n[OK] Successfully promoted admin '{email}' (ID: {existing_admin.id}) from {old_role} to SUPER_ADMIN!"
                    )
                )
            admin = existing_admin
        else:
            # Create new Super Admin user in admin_users table
            user_id = str(uuid.uuid4())
            admin = Admin.objects.create(
                id=user_id,
                email=email,
                name=username,
                role="SUPER_ADMIN",
                status="ACTIVE",
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"\n[OK] Successfully created new SUPER_ADMIN user in admin_users table:\n"
                    f"     ID:       {admin.id}\n"
                    f"     Email:    {admin.email}\n"
                    f"     Name:     {admin.name}\n"
                    f"     Role:     {admin.role}\n"
                    f"     Status:   {admin.status}"
                )
            )

        self.stdout.write(
            self.style.NOTICE(
                f"\nSuper Admin '{admin.email}' is configured. You can now log in directly via the Admin Frontend."
            )
        )

