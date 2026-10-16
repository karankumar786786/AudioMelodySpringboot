from accounts.management.commands.createsuperadmin import Command as SuperAdminCommand


class Command(SuperAdminCommand):
    help = "Alias for createsuperadmin: creates or promotes an admin to SUPER_ADMIN in the admin_users table."
