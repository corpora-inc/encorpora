import datetime
from typing import Optional, List

from pydantic import BaseModel, field_validator

from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.agents.core import Agent

from history.models import Who, Course
from .courses import CourseModel

# llm = load_llm_provider("openai")
# llm = load_llm_provider("xai", completion_model="grok-3")
llm = load_llm_provider("xai", completion_model="grok-3-mini-fast")


class PlanWhosInput(BaseModel):
    course: str


class WhoInit(BaseModel):
    name: str


class DescribeWhoInput(WhoInit):
    name: str
    course: CourseModel


class WhoDescribeModel(WhoInit):
    description: str
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def fix_bare_year_and_invalid_date(cls, v):
        if not v:
            return v
        if isinstance(v, str):
            if len(v) == 4 and v.isdigit():
                try:
                    return datetime.datetime.strptime(v + "-01-01", "%Y-%m-%d").date()
                except ValueError:
                    print(f"Invalid date format: {v}")
                    return None
            try:
                return datetime.datetime.strptime(v, "%Y-%m-%d").date()
            except ValueError:
                print(f"Invalid date format: {v}")
                return None
        return v


class WhoModel(WhoDescribeModel):
    course: CourseModel


class ListWhoInit(BaseModel):
    list_of_names: List[str]


class PlanWhosAgent(Agent[PlanWhosInput, ListWhoInit, BaseModel]):
    name = "plan_whos"

    system_prompt = (
        "You are a history curriculum designer creating a comprehensive, exhaustive list "
        "of all people, groups, and organizations for the course '{course}'."
        "This is the 'who' of the course - concentrate on people and groups - "
        "events, themes, periods and places are covered elsewhere."
    )
    user_prompt_template = (
        "So far we have the following names: {existing_names}. "
        "Do not repeat the names we already have. "
        "Help complete a comprehensive, exhaustive list of all people, leaders, political figures, and groups, that should be studied in the course '{course}'. "
        "Return as many new names as you can using the provided tool parameters schema to properly format the output into a ListWhoInit.list_of_names array."
        "Do not mention what we already have, return only the final list of **new** names."
        "Each string should only contain the name of the person or group, and nothing else. There should be no label or `:` or notes in the string. "
        "If someone is already in the list, do not add a note about them, a note about skipping. "
        "`list_of_names` should only contain the names, not any thoughts or notes or other text. "
        "If you have something like 'already listed' in the output, you have failed. "
        "You must only output the list of new names/titles and nothing else. "
    )

    target_number = 500

    def run(
        self, input: PlanWhosInput, context: Optional[BaseModel] = None
    ) -> ListWhoInit:
        existing_names = Who.objects.filter(course__name=input.course).values_list(
            "name", flat=True
        )

        if existing_names.count() > self.target_number:
            return ListWhoInit(list_of_names=[n for n in existing_names])

        rounds = 0
        while existing_names.count() < self.target_number:
            rounds += 1
            print(f"Round {rounds} - existing names: {existing_names.count()}")

            messages = [
                ChatCompletionTextMessage(
                    role="system",
                    text=self.system_prompt.format(course=input.course),
                ),
                ChatCompletionTextMessage(
                    role="user",
                    text=self.user_prompt_template.format(
                        course=input.course,
                        existing_names=", ".join(existing_names),
                    ),
                ),
            ]

            tries = 0
            while tries < 3:
                tries += 1
                try:
                    result: ListWhoInit = llm.get_data_completion(
                        messages, model=ListWhoInit
                    )
                    print(f"Result: {result.list_of_names}")
                    break
                except Exception as e:
                    print(f"Error: {e}")
                    if tries == 3:
                        raise
                    print("Retrying...")

            course_obj = Course.objects.get(name=input.course)
            for name in result.list_of_names:
                Who.objects.get_or_create(
                    name=name,
                    course=course_obj,
                )

            existing_names = Who.objects.filter(course__name=input.course).values_list(
                "name", flat=True
            )

        return ListWhoInit(
            list_of_names=[
                n
                for n in Who.objects.filter(course__name=input.course).values_list(
                    "name", flat=True
                )
            ]
        )


class DescribeWhoAgent(Agent[DescribeWhoInput, WhoModel, BaseModel]):
    name = "describe_who"

    system_prompt = (
        "You are a history curriculum designer, writing about a key figure or group "
        "for the {course_name} course."
    )
    user_prompt_template = (
        "Add a thorough, comprehensive description for '{name}'. "
        "Do not mention the course name, just the necessary facts about the person or group. "
        "You may use multiple paragraphs if needed. "
        "Use the tool parameters schema to provide dates for birth/start and death/end if known."
    )

    def run(
        self, input: DescribeWhoInput, context: Optional[BaseModel] = None
    ) -> WhoModel:
        who = Who.objects.get(
            name=input.name,
            course__name=input.course.name,
        )
        if who.description and who.start_date and who.end_date:
            return WhoModel(
                name=who.name,
                description=who.description,
                start_date=who.start_date,
                end_date=who.end_date,
                course=input.course,
            )

        messages = [
            ChatCompletionTextMessage(
                role="system",
                text=self.system_prompt.format(course_name=input.course.name),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=self.user_prompt_template.format(
                    name=input.name,
                ),
            ),
        ]

        tries = 0

        while tries < 3:
            tries += 1
            try:
                result = llm.get_data_completion(messages, model=WhoDescribeModel)
            except Exception as e:
                print(f"Error: {e}")
                if tries == 3:
                    raise
                else:
                    print("Retrying...")
                    continue
            if result.description:
                print(f"Result: {result.description[:10]}")
                break
            if tries == 3:
                raise ValueError(
                    "Failed to get a description after 3 attempts. "
                    "Please check the input and try again."
                )

        who.description = result.description
        who.start_date = result.start_date
        who.end_date = result.end_date
        who.save()

        return WhoModel(
            name=who.name,
            description=result.description,
            start_date=result.start_date,
            end_date=result.end_date,
            course=input.course,
        )
