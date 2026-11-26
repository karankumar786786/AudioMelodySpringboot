"""Django ke "createsuperuser" ko hamare createsuperadmin se badal deta hai (Django ka apna user table use nahi hota)."""
from accounts.management.commands.createsuperadmin import Command as SuperAdminCommand


class Command(SuperAdminCommand):
    """Django ka 'createsuperuser' command bhi Super Admin hi banaye (createsuperadmin wala logic)."""
    help = "Alias for createsuperadmin: creates or promotes an admin to SUPER_ADMIN in the admin_users table."
