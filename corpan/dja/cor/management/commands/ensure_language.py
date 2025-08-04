from django.core.management.base import BaseCommand
from cor.models import Language


class Command(BaseCommand):
    help = "Ensure a language with the given code and name exists."

    def add_arguments(self, parser):
        parser.add_argument("code", type=str, help="Language code (e.g., 'es', 'ko')")
        parser.add_argument(
            "name", type=str, help="Full name (e.g., 'Spanish', 'Korean')"
        )

    def handle(self, *args, **options):
        code = options["code"]
        name = options["name"]

        lang, created = Language.objects.get_or_create(
            code=code, defaults={"name": name}
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f"Language created: [{code}] {name}"))
        else:
            if lang.name != name:
                self.stdout.write(
                    self.style.WARNING(
                        f"Language with code '{code}' already exists as '{lang.name}'."
                        f" You provided '{name}'."
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(f"Language already exists: [{code}] {name}")
                )
