from pydantic import BaseModel
from typing import List


from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage

llm = load_llm_provider("xai")


class CoursePlanUnit(BaseModel):
    name: str
    number: float


class CoursePlanResponse(BaseModel):
    summary: str
    units: List[CoursePlanUnit]


class UnitPlanLesson(BaseModel):
    name: str
    number: float


class UnitPlanResponse(BaseModel):
    summary: str
    lessons: List[UnitPlanLesson]


class LessonPlanExercise(BaseModel):
    name: str


class LessonPlanResponse(BaseModel):
    summary: str
    exercises: List[LessonPlanExercise]


def get_course_plan(course_name: str) -> CoursePlanResponse:
    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    f"You are an expert curriculum planner for the course: `{course_name}`. "
                    "You specialize in returning a list of unit names for the course. "
                    "You break up the course into 6-20, probably 10-15 units. "
                    "DO NOT number the units *in* the names, eg `Unit 1: Foo`. "
                    "Return a nice stand-alone, understandable title as the name and "
                    "use the JSON tool to return the number of the unit for ordering."
                ),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate the skeleton for the course: {course_name} using the JSON tool."
                ),
            ),
        ],
        CoursePlanResponse,
    )


def get_unit_plan(course_name: str, unit_name: str) -> UnitPlanResponse:
    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    f"You are an expert curriculum planner for the course: `{course_name}`. "
                    f"You are now working on the unit: `{unit_name}`. "
                    "Use the JSON tool to fill in a summary of the unit along with a list of lessons. "
                    "You specialize in returning a list of lesson names for the unit. "
                    "You break up the unit into 6-10 lessons. "
                    "DO NOT number the lessons *in* the names, eg `Lesson 1: Foo`. "
                    "Return a nice stand-alone, understandable title as the name of each lesson. "
                    "And use the JSON tool format to return the number of the lesson for ordering."
                ),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate the lesson names for the unit: {unit_name} in {course_name} using the JSON tool."
                ),
            ),
        ],
        UnitPlanResponse,
    )


def get_lesson_plan(
    course_name: str, unit_name: str, lesson_name: str
) -> LessonPlanResponse:
    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    f"You are an expert curriculum planner for the course: `{course_name}`. "
                    f"You are now working on the unit: `{unit_name}`. "
                    f"You are now working on the lesson: `{lesson_name}`. "
                    "You specialize in returning a list of exercise names for the lesson. "
                    "You break up the lesson into 6-10 exercises. "
                    "DO NOT number the exercises *in* the names, eg `Exercise 1: Foo`. "
                    "Return a nice stand-alone, understandable title as the name."
                ),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate the exercise names for the lesson: {lesson_name} in {unit_name} in {course_name} using the JSON tool."
                ),
            ),
        ],
        LessonPlanResponse,
    )
