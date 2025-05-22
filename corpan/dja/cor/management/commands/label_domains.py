import time
from typing import List, Type
from enum import Enum
from django.core.management.base import BaseCommand
from django.db.models import QuerySet

from pydantic import BaseModel

from cor.models import Entry, Domain
from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage


# def get_domain_enum():
#     return Enum("DomainEnum", {d.code for d in Domain.objects.all()})

# # DOMAINS = Enum({'business',
# #  'civic',
# #  'culture',
# #  'education',
# #  'emergency',
# #  'environment',
# #  'everyday',
# #  'health',
# #  'housing',
# #  'numbers',
# #  'social',
# #  'technology',
# #  'travel'})


class DOMAINS(str, Enum):
    business = "business"
    civic = "civic"
    culture = "culture"
    education = "education"
    emergency = "emergency"
    environment = "environment"
    everyday = "everyday"
    health = "health"
    housing = "housing"
    numbers = "numbers"
    social = "social"
    technology = "technology"
    travel = "travel"


# Schema for LLM response
class DomainAssignment(BaseModel):
    entry_id: int
    # LLM just won't listen ;/
    # domain_codes: List[DOMAINS]
    domain_codes: List[str]


class DomainAssignmentBatch(BaseModel):
    assignments: List[DomainAssignment]


class Command(BaseCommand):
    help = "Auto-label entries with CEFR domain(s) using LLM and a structured schema."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", default=False)
        parser.add_argument("--limit", type=int, default=0)
        parser.add_argument("--batch-size", type=int, default=10)
        parser.add_argument("--provider", type=str, default="openai")

    def handle(self, *args, **opts):
        dry_run: bool = opts["dry_run"]
        limit: int = opts["limit"]
        batch_size: int = opts["batch_size"]
        provider: str = opts["provider"]

        llm = self.load_llm(provider)

        entries: QuerySet[Entry] = Entry.objects.filter(domains__isnull=True).order_by(
            "id"
        )
        if limit:
            entries = entries[:limit]

        total = entries.count()
        self.stdout.write(f"Found {total} entries without domains.")

        total_labeled = 0
        start_time = time.time()

        for i in range(0, entries.count(), batch_size):
            batch = list(entries[i : i + batch_size])
            if not batch:
                break

            messages = self.build_prompt(batch)
            schema: Type[DomainAssignmentBatch] = DomainAssignmentBatch

            result = None
            tries = 0
            while result is None and tries < 5:
                try:
                    result: DomainAssignmentBatch = llm.get_data_completion(
                        messages, schema
                    )
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Error processing batch: {e}"))
                    tries += 1
                    if tries >= 5:
                        raise

            for assignment in result.assignments:
                entry = Entry.objects.get(id=assignment.entry_id)
                domain_codes = [d for d in assignment.domain_codes]
                domains = list(Domain.objects.filter(code__in=domain_codes))

                self.stdout.write(f"  {entry.en_text} → {domain_codes}")
                if not dry_run:
                    entry.domains.add(*domains)

            total_labeled += len(result.assignments)

            self.stdout.write(self.style.SUCCESS(f"{total_labeled} / {total}"))

        elapsed = time.time() - start_time
        self.stdout.write(f"\nDone. Labeled {total_labeled} entries in {elapsed:.2f}s")

    def load_llm(self, provider: str):
        if provider == "local":
            # return load_llm_provider("local", completion_model="qwen3-30b-a3b-mlx")
            return load_llm_provider(
                "local", completion_model="qwen2.5-7b-instruct-mlx"
            )
        elif provider == "xai":
            return load_llm_provider("xai", completion_model="grok-3-mini")
        elif provider == "openai":
            # return load_llm_provider("openai", completion_model="gpt-4o")
            return load_llm_provider("openai", completion_model="gpt-3.5-turbo")
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def build_prompt(self, entries: List[Entry]) -> List[ChatCompletionTextMessage]:
        domain_list = Domain.objects.all()
        domain_codes = "\n".join([d.code for d in domain_list])
        examples = "\n".join([f"{e.id}: {e.en_text}" for e in entries])

        system_message = (
            "You are a domain classification expert. Each English sentence below "
            "belongs to one or more topic domains. Classify each sentence using ONLY the allowed domain codes.\n\n"
            f"Available domain codes:\n{domain_codes}\n\n"
            "Return only the JSON tool matching the provided DomainAssignmentBatch schema:\n\n"
            f"```\n{DomainAssignmentBatch.model_json_schema()}\n```\n\n"
        )

        return [
            ChatCompletionTextMessage(role="system", text=system_message),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    "Use the JSON tool to respond with the DomainAssignmentBatch object. "
                    f"DO NOT use domain codes other than: {domain_codes}\n\n"
                    "Use as many domains as you think are appropriate.\n\n"
                    f"Classify the following into the given domains:\n\n"
                    f"```\n{examples}\n```\n"
                ),
            ),
        ]
