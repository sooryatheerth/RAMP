# Generated for RAMP Gamification & Achievement Badges

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_verticalconnection'),
    ]

    operations = [
        migrations.CreateModel(
            name='Badge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.SlugField(unique=True)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField()),
                ('category', models.CharField(choices=[('mapping', 'Mapping'), ('verification', 'Verification'), ('attributes', 'Attributes'), ('photos', 'Photos'), ('reputation', 'Reputation'), ('milestone', 'Milestone')], default='mapping', max_length=20)),
                ('tier', models.CharField(choices=[('bronze', 'Bronze'), ('silver', 'Silver'), ('gold', 'Gold'), ('platinum', 'Platinum'), ('diamond', 'Diamond')], default='bronze', max_length=20)),
                ('icon', models.CharField(default='🏆', max_length=50)),
                ('metric', models.CharField(help_text='Metric tracked: places_count, verifications_count, attributes_count, images_count, reputation_score', max_length=50)),
                ('threshold', models.PositiveIntegerField(default=1)),
                ('points_reward', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='UserBadge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('awarded_at', models.DateTimeField(auto_now_add=True)),
                ('badge', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='awarded_users', to='core.badge')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_badges', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-awarded_at'],
                'unique_together': {('user', 'badge')},
            },
        ),
    ]
