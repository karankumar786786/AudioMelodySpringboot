# pyrefly: ignore [missing-import]
from api.management.commands.createsuperadmin import Command as SuperAdminCommand


class Command(SuperAdminCommand):
    help = "Creates or promotes a user to SUPER_ADMIN in the AudioMelody database (alias for createsuperadmin)."
