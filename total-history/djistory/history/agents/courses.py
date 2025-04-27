from typing import Optional

from pydantic import BaseModel

from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.agents.core import Agent

from history.models import Course

llm = load_llm_provider("xai")


class CourseNameInput(BaseModel):
    name: str


class CourseModel(BaseModel):
    name: str
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
