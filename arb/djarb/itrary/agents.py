from pydantic import BaseModel
from typing import List


from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage

from itrary.models import Exercise, Lesson, Unit

llm = load_llm_provider("xai")

MARKDOWN_CONTENT_INSTRUCTIONS = """
You are writing as part of a larger curriculum.
So, you do not need excessive introduction or conclusion.
You do not need to excessively reference the course name or unit name.
The reader will already know where they are.
Add blank lines between markdown features.
For example, always add a blank line before enumerated lists and bullet points.
You may use `$` for inline math and `$$` display math, if needed.
DO NOT use ANY special unicode characters like `≠`, `α`, `≈`,
instead use inline or display math with LaTeX such as `\neq`, `\alpha`, `\approx`.
The content will be added to a book that uses pandoc to convert to pdf and other formats.
"""


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


class LessonContentRequest(BaseModel):
    course_name: str
    unit_name: str
    lesson_name: str
    lesson_summary: str


class LessonContentResponse(BaseModel):
    markdown: str


class ExerciseContentRequest(BaseModel):
    course_name: str
    unit_name: str
    lesson_name: str
    exercise_name: str


class ExerciseContentResponse(BaseModel):
    summary: str
    markdown: str


def get_course_plan(course_name: str) -> CoursePlanResponse:
    current_units = Unit.objects.filter(course__name=course_name).values_list(
        "name", flat=True
    )

    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    f"You are an expert curriculum planner for the course: `{course_name}`. "
                    "You specialize in returning a list of unit names for the course. "
                    "You break up the course into 6-20, probably 10-15 units. "
                    "DO NOT number the units *in* the names, eg `Unit 1: Foo`. "
                    "We already have the following units: "
                    f"{', '.join(current_units)}. "
                    "If we have units, for the units we already have, return the exact same name. "
                    "If we need new units, add them to the list. "
                    "If we have no units, return a complete list of units of the course. "
                    "Your output will be a summary of the course and the complete list of units. "
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
    current_lessons = Lesson.objects.filter(
        unit__name=unit_name,
    ).values_list("name", flat=True)
    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    f"You are an expert curriculum planner for the course: `{course_name}`. "
                    f"You are now working on the unit: `{unit_name}`. "
                    "Use the JSON tool to fill in a summary of the unit along with a list of lessons. "
                    "You specialize in returning a list of lesson names for the unit. "
                    "We already have the following lessons: "
                    f"{', '.join(current_lessons)}. "
                    "If we have lessons, for the lessons we already have, return the exact same name. "
                    "If we need new lessons, add them to the list. "
                    "If we have no lessons, return a complete list of lessons of the unit. "
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
    current_exercises = Exercise.objects.filter(
        lesson__name=lesson_name,
    ).values_list("name", flat=True)

    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    f"You are an expert curriculum planner for the course: `{course_name}`. "
                    f"You are now working on the unit: `{unit_name}`. "
                    f"You are now working on the lesson: `{lesson_name}`. "
                    "Provide a summary of the lesson along with a list of exercises. "
                    "We already have the following exercises: "
                    f"{', '.join(current_exercises)}. "
                    "If we have exercises, for the exercises we already have, return the exact same name. "
                    "If we need new exercises, add them to the list. "
                    "If we have no exercises, return a complete list of exercises of the lesson. "
                    "You specialize in returning a list of exercise names for the lesson. "
                    "You return 3 amazing exercises that will help the students learn the lesson. "
                    "DO NOT number the exercises *in* the names, eg `Exercise 1: Foo`. "
                    "Return a nice stand-alone, understandable title as the name."
                ),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate the summary and exercise names for the lesson: {lesson_name} in {unit_name} in {course_name} using the JSON tool."
                ),
            ),
        ],
        LessonPlanResponse,
    )


def get_lesson_content(
    lesson_request: LessonContentRequest,
) -> LessonContentResponse:
    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    f"You are an expert curriculum planner and content writer for the course: `{lesson_request.course_name}`. "
                    f"You are now working on the unit: `{lesson_request.unit_name}`. "
                    f"You are now working on the lesson: {lesson_request.lesson_name}."
                    "You return a complete, comprehensive, verbose lesson in markdown format. "
                    "You are writing a lesson for a larger curriculum. "
                    "So, you do not need excessive introduction or conclusion. "
                    f"For markdown, follow the instructions: {MARKDOWN_CONTENT_INSTRUCTIONS} "
                    f"You start the markdown from `### {lesson_request.lesson_name}` with 3 `#`s. "
                    "Write the lesson in a way that is easy to understand for the target audience "
                    "which is implied by the course name and unit name. "
                ),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    "Generate a complete lesson in markdown format for a lesson in "
                    f"{lesson_request.unit_name} in {lesson_request.course_name} using the JSON tool."
                    f"The summary of the lesson is:\n\n```{lesson_request.lesson_summary}```\n\n"
                    f"Use the JSON tool to return the complete markdown lesson content."
                ),
            ),
        ],
        LessonContentResponse,
    )


def get_exercise_content(
    exercise_request: ExerciseContentRequest,
) -> ExerciseContentResponse:
    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    f"You are an expert curriculum planner and content writer for the course: `{exercise_request.course_name}`. "
                    f"You are now working on the unit: `{exercise_request.unit_name}`. "
                    f"You are now working on the lesson: {exercise_request.lesson_name}."
                    "You return a complete, comprehensive, verbose exercise in markdown format. "
                    f"For markdown, follow the instructions: {MARKDOWN_CONTENT_INSTRUCTIONS} "
                    f"You start the markdown from `#### {exercise_request.exercise_name}` with 4 `#`s. "
                    "Write the exercise in a way that is easy to understand for the target audience"
                    "which is implied by the course name and unit name. "
                ),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    "Generate a complete exercise in markdown format for a lesson in "
                    f"{exercise_request.unit_name} in {exercise_request.course_name} using the JSON tool."
                    f"The name of the exercise is: {exercise_request.exercise_name}"
                    f"Use the JSON tool to return the complete markdown exercise content."
                ),
            ),
        ],
        ExerciseContentResponse,
    )
