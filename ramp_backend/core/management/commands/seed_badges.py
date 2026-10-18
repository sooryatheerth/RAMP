from django.core.management.base import BaseCommand
from core.gamification import ensure_default_badges, evaluate_and_award_badges
from core.models import User, Badge


class Command(BaseCommand):
    help = "Seeds default achievement badges and evaluates existing users."

    def handle(self, *args, **options):
        self.stdout.write("Ensuring default achievement badges...")
        ensure_default_badges()
        count = Badge.objects.count()
        self.stdout.write(self.style.SUCCESS(f"Loaded {count} active badges."))

        users = User.objects.all()
        awarded_total = 0
        for user in users:
            awarded = evaluate_and_award_badges(user)
            awarded_total += len(awarded)

        self.stdout.write(
            self.style.SUCCESS(
                f"Evaluated {users.count()} users, awarded {awarded_total} new badges."
            )
        )
