import core.models
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.CharField(default=core.models.generate_uuid, max_length=255, primary_key=True, serialize=False)),
                ('user_name', models.CharField(blank=True, db_column='user_name', max_length=255, null=True)),
                ('email', models.CharField(max_length=255, unique=True)),
                ('status', models.CharField(default='ACTIVE', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_column='created_at')),
            ],
            options={
                'db_table': 'users',
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='Session',
            fields=[
                ('id', models.CharField(default=core.models.generate_uuid, max_length=255, primary_key=True, serialize=False)),
                ('device_id', models.CharField(db_column='device_id', max_length=255)),
                ('refresh_token', models.CharField(db_column='refresh_token', max_length=1000)),
                ('expires_at', models.DateTimeField(db_column='expires_at')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_column='created_at')),
                ('updated_at', models.DateTimeField(auto_now=True, db_column='updated_at')),
            ],
            options={
                'db_table': 'sessions',
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='Admin',
            fields=[
                ('id', models.CharField(default=core.models.generate_uuid, max_length=255, primary_key=True, serialize=False)),
                ('email', models.CharField(max_length=255, unique=True)),
                ('name', models.CharField(blank=True, db_column='name', max_length=255, null=True)),
                ('role', models.CharField(default='ADMIN', max_length=255)),
                ('status', models.CharField(default='ACTIVE', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_column='created_at')),
                ('updated_at', models.DateTimeField(auto_now=True, db_column='updated_at')),
            ],
            options={
                'db_table': 'admin_users',
                'managed': True,
            },
        ),
    ]
