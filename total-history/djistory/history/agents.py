import datetime
from typing import Optional, List

from pydantic import BaseModel

from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.agents.core import Agent
from history.models import Period, Course

llm = load_llm_provider("xai")


class CourseNameInput(BaseModel):
    name: str


class CourseModel(BaseModel):
    name: str
    description: str


class PeriodInit(BaseModel):
    name: str
    start_date: datetime.date
    end_date: datetime.date


class ListPeriodInit(BaseModel):
    list: List[PeriodInit]


class DescribePeriodInput(PeriodInit):
    course: CourseModel


class PeriodModel(DescribePeriodInput):
    description: str


class DescribeCourseAgent(Agent[CourseNameInput, CourseModel, BaseModel]):
    name = "describe_course"

    system_prompt = "You are a history curriculum designer."
    user_prompt_template = "Add a comprehensive description for the course '{title}'"

    def run(
        self, input: CourseNameInput, context: Optional[BaseModel] = None
    ) -> CourseModel:
        course, _ = Course.objects.get_or_create(name=input.name)
        if course.description:
            return CourseModel(
                name=course.name,
                description=course.description,
            )
        messages = [
            ChatCompletionTextMessage(
                role="system",
                text=self.system_prompt,
            ),
            ChatCompletionTextMessage(
                role="user",
                text=self.user_prompt_template.format(title=input.name),
            ),
        ]

        result: CourseModel = llm.get_data_completion(messages, model=CourseModel)
        course.description = result.description
        course.save()
        return result


class PlanPeriodsAgent(Agent[CourseModel, ListPeriodInit, BaseModel]):
    name = "plan_periods"

    system_prompt = "You are a history curriculum designer creating a comprehensive list of periods for a course."
    user_prompt_template = (
        "List all major periods for the course '{title}'. "
        "For each period, give the name, start year, and end year."
    )

    def run(
        self, input: CourseModel, context: Optional[BaseModel] = None
    ) -> ListPeriodInit:
        # if you want this to run, rm all Period objects from DB
        if Period.objects.exists():
            return ListPeriodInit(
                list=[
                    PeriodInit(
                        name=p.name,
                        start_date=p.start_date,
                        end_date=p.end_date,
                    )
                    for p in Period.objects.filter(course__name=input.name)
                ]
            )

        messages = [
            ChatCompletionTextMessage(
                role="system",
                text=self.system_prompt,
            ),
            ChatCompletionTextMessage(
                role="user",
                text=self.user_prompt_template.format(title=input.name),
            ),
        ]

        result: ListPeriodInit = llm.get_data_completion(messages, model=ListPeriodInit)
        for period in result.list:
            Period.objects.create(
                name=period.name,
                start_date=period.start_date,
                end_date=period.end_date,
                course=Course.objects.get(name=input.name),
            )

        return result


class DescribePeriodAgent(Agent[DescribePeriodInput, PeriodModel, BaseModel]):
    name = "describe_period"

    system_prompt = "You are a history curriculum designer, describing a period in history for {course_name}."
    user_prompt_template = "Add a comprehensive description for the period '{title}' ({start_date} - {end_date})"

    def run(
        self, input: DescribePeriodInput, context: Optional[BaseModel] = None
    ) -> PeriodModel:
        period = Period.objects.get(name=input.name, course__name=input.course.name)
        if period.description:
            return PeriodModel(
                name=period.name,
                start_date=period.start_date,
                end_date=period.end_date,
                course=input.course,
                description=period.description,
            )
        messages = [
            ChatCompletionTextMessage(
                role="system",
                text=self.system_prompt.format(course_name=input.course.name),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=self.user_prompt_template.format(
                    title=input.name,
                    start_date=input.start_date,
                    end_date=input.end_date,
                ),
            ),
        ]

        result = llm.get_data_completion(messages, model=PeriodModel)
        period.description = result.description
        period.save()
        return result
