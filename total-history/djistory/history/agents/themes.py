from typing import Optional, List

from pydantic import BaseModel

from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.agents.core import Agent
from history.models import Theme, Course
from .courses import CourseModel


llm = load_llm_provider("xai")


class ThemeInit(BaseModel):
    name: str


class DescribeThemeInput(ThemeInit):
    course: CourseModel


class ThemeModel(DescribeThemeInput):
    description: str


class ListThemeInit(BaseModel):
    list: List[ThemeInit]


class PlanThemesAgent(Agent[CourseModel, List[ThemeInit], BaseModel]):
    name = "plan_themes"

    system_prompt = "You are a history curriculum designer creating a comprehensive list of key themes for a course."
    user_prompt_template = (
        "Give a comprehensive list of themes for the course '{title}'"
        "For each theme, provide a name only."
    )

    def run(
        self, input: CourseModel, context: Optional[BaseModel] = None
    ) -> ListThemeInit:
        if Theme.objects.filter(course__name=input.name).exists():
            return ListThemeInit(
                list=[
                    ThemeInit(name=theme.name)
                    for theme in Theme.objects.filter(course__name=input.name)
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

        themes = llm.get_data_completion(messages, model=ListThemeInit)

        course_obj = Course.objects.get(name=input.name)
        for theme in themes.list:
            Theme.objects.create(
                name=theme.name,
                course=course_obj,
            )

        return themes


class DescribeThemeAgent(Agent[DescribeThemeInput, ThemeModel, BaseModel]):
    name = "describe_theme"

    system_prompt = "You are a history curriculum designer, describing a key theme in history for {course_name}."
    user_prompt_template = (
        "Add a comprehensive description for the theme '{title}' within {course_name}."
    )

    def run(
        self, input: DescribeThemeInput, context: Optional[BaseModel] = None
    ) -> ThemeModel:
        theme = Theme.objects.get(name=input.name, course__name=input.course.name)
        if theme.description:
            return ThemeModel(
                name=theme.name,
                description=theme.description,
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
                    title=input.name,
                    course_name=input.course.name,
                ),
            ),
        ]

        result = llm.get_data_completion(messages, model=ThemeModel)
        theme.description = result.description
        theme.save()
        return result
