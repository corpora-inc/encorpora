import datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator

from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.agents.core import Agent

from history.models import When, Course
# from .courses import CourseModel


# llm = load_llm_provider("xai", completion_model="grok-3-mini-fast")
llm = load_llm_provider("xai", completion_model="grok-3-mini-fast")


class PlanWhensInput(BaseModel):
    course: str


class ListWhen(BaseModel):
    list_event_names: List[str]


class DescribeWhenInput(BaseModel):
    name: str
    course: str


class WhenOutput(BaseModel):
    name: str
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


class PlanWhensAgent(Agent[PlanWhensInput, ListWhen, BaseModel]):
    name = "PlanWhensAgent"

    system_prompt = "You are a history expert who will help build an exhaustive list of events in the {course} course."
    user_prompt = (
        "You will help build an exhaustive, comprehensive list of events and happenings in the {course} course. "
        "Currently, the course **already has** the following events: \n\n---\n\n{whens}\n\n---\n\n"
        "Please provide a list of events that are not already included in the course."
        "Each string in the list should just be the Title of a particular event or happening. "
        "key dates, cultural phenomena, time ranges, publications, proclamations, crucial moments, etc."
        "Provide as many events as you can, according to what will help the student dominate the {course} test."
        "Give just a list of names/titles to add to our course events. Further agents can be used to describe them."
        "DO NOT ADD REDUNDANT EVENTS. Add unique events that are necessary for the user to fully understand the material. "
        "Provide only _new_ events that are not already in the course. "
        "Only use real events that will help with the test. "
        "Give a nice, concise title without prefixes like 'Establishment of the First American...'. "
        "Just give the title of the event with the date(s) in parentheses."
    )
    target_number = 3500

    def run(self, input: PlanWhensInput) -> ListWhen:
        # course = CourseModel(name=input.course)
        current_whens = When.objects.filter(course__name=input.course).values_list(
            "name", flat=True
        )

        print(f"Current whens: {current_whens.count()}")

        if current_whens.count() >= self.target_number:
            return ListWhen(list_event_names=list(current_whens))

        while current_whens.count() < self.target_number:
            messages = [
                ChatCompletionTextMessage(
                    role="system",
                    text=self.system_prompt.format(course=input.course),
                ),
                ChatCompletionTextMessage(
                    role="user",
                    text=self.user_prompt.format(
                        course=input.course,
                        whens=", ".join(current_whens) if current_whens else "none",
                    ),
                ),
            ]
            response = llm.get_data_completion(messages, model=ListWhen)
            print(f"Response: {response.list_event_names}")
            for event in response.list_event_names:
                When.objects.get_or_create(
                    name=event,
                    course=Course.objects.get(name=input.course),
                )
            current_whens = When.objects.filter(course__name=input.course).values_list(
                "name", flat=True
            )
            print(f"\n\n{current_whens.count()}")

        return response


class DescribeWhenAgent(Agent[DescribeWhenInput, When, BaseModel]):
    name = "describe_when"

    system_prompt = (
        "You are a history curriculum designer, writing about a key event or happening in the {course} course. "
        "You love to give very verbose, fact dense, comprehensive descriptions of historical events."
    )
    user_prompt_template = (
        "Add a comprehensive, verbose description for the event **'{name}'** for the {course} course. "
        "Additionally, use the tool parameters schema to provide dates for start_date and end_date for '{name}' as possible. "
        "Give all relevant facts and context that would help the student understand the event and get full credit on the {course} test. "
    )

    def run(
        self, input: DescribeWhenInput, context: Optional[BaseModel] = None
    ) -> When:
        when, _ = When.objects.get_or_create(name=input.name)
        if when.description:
            return WhenOutput(
                name=when.name,
                description=when.description,
                start_date=when.start_date,
                end_date=when.end_date,
            )

        messages = [
            ChatCompletionTextMessage(
                role="system",
                text=self.system_prompt.format(course=input.course),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=self.user_prompt_template.format(
                    name=input.name,
                    course=input.course,
                ),
            ),
        ]

        result: WhenOutput = llm.get_data_completion(messages, model=WhenOutput)
        when.description = result.description
        when.start_date = result.start_date
        when.end_date = result.end_date
        when.save()
        return result
