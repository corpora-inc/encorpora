from pydantic import BaseModel
from typing import List


from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage

from itrary.models import Exercise, Lesson, Unit
from itrary.utils import BookConfig

llm = load_llm_provider("xai")


MARKDOWN_CONTENT_INSTRUCTIONS = """
You are writing content for a book within a larger curriculum.
Avoid excessive introductions or conclusions,
and do not repeatedly reference the course or unit name,
as the reader knows their context.
Jump straight into the content.

Follow these markdown formatting rules:
- Add a blank line before and after lists (bullet or numbered).
- Use `$` for inline math and `$$` for display math.
- Avoid special Unicode characters (e.g., ≠, α, ≈).
  Instead, use LaTeX in math mode, if needed (e.g., `$\neq$`, `$\alpha$`, `$\approx$`).
- Insert image placeholders where visuals enhance the content,
  using the format `{{IMAGE: descriptive alt text}}` on its own line,
  surrounded by blank lines. The alt text should be a concise, engaging caption
  suitable for display as figure text in the final textbook.

The content will be processed by pandoc to generate PDF, EPUB, and other formats, so ensure compatibility.
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


def get_course_plan(config: BookConfig) -> CoursePlanResponse:
    title = config.title
    current_units = Unit.objects.filter(course__name=title).values_list(
        "name", flat=True
    )

    system_prompt = (
        "You are an expert curriculum planner for the course:\n\n"
        f"{title}\n"
        f"{config.subtitle}\n\n"
        "You specialize in returning a list of unit names for the course. "
        f"You break up the course into {config.units} units. "
        "DO NOT number the units *in* the names, eg `Unit 1: Foo`. "
        "We already have the following units: "
        f"{', '.join(current_units) if current_units else "NO CURRENT UNITS"}. "
        "You are going to construct the perfect, complete list of units for the course. "
        "Use the units we already have with the exact same name, if we have any. "
        "If we have no units, return a complete list of units of the course. "
        "Your output will be a summary of the course and the complete list of units. "
        "Return a nice stand-alone, understandable title as the name for each unit and "
        "use the JSON tool to return the number of the unit for ordering as well."
    )
    if config and config.llm_instructions:
        system_prompt += f"\nAdditional instructions: {config.llm_instructions}"

    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=system_prompt,
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate the skeleton for the course: {config.title} using the JSON tool."
                ),
            ),
        ],
        CoursePlanResponse,
    )


def get_unit_plan(
    unit_name: str,
    config: BookConfig,
) -> UnitPlanResponse:
    current_lessons = Lesson.objects.filter(
        unit__name=unit_name,
    ).values_list("name", flat=True)

    system_prompt = (
        f"You are an expert curriculum planner for the course:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```"
        f"You are now working on the unit: `{unit_name}`."
        "Use the JSON tool to fill in a summary of the unit along with a list of lessons. "
        "You specialize in returning a list of lesson names for the unit. "
        "We already have the following lessons: "
        f"\n\n`{'\n- '.join(current_lessons)}`\n\n"
        "You are going to construct the perfect, complete list of lessons for the unit. "
        f"You break up the unit into {config.lessons_per_unit} lessons. "
        "Use the lessons we already have with the exact same name, if we have any. "
        "If we have no lessons, return a complete list of lessons for the unit. "
        "DO NOT number the lessons *in* the names, eg `Lesson 1: Foo`. "
        "Return a nice stand-alone, understandable title as the name of each lesson. "
        "Use the JSON tool format to return the number of each lesson for ordering. "
        "Your output will be a summary of the unit and the complete list of lessons. "
    )
    if config and config.llm_instructions:
        system_prompt += f"\nAdditional instructions: {config.llm_instructions}"

    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=system_prompt,
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate the unit summary and lesson names for the unit: {unit_name} in {config.title} using the JSON tool."
                ),
            ),
        ],
        UnitPlanResponse,
    )


def get_lesson_plan(
    unit_name: str, lesson_name: str, config: BookConfig
) -> LessonPlanResponse:
    current_exercises = Exercise.objects.filter(lesson__name=lesson_name).values_list(
        "name", flat=True
    )

    system_prompt = (
        "You are an expert curriculum planner for the course:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```"
        f"You are now working on the unit: `{unit_name}`.\n"
        f"You are now working on the lesson: `{lesson_name}`.\n\n"
        "Use the JSON tool to fill in a summary of the lesson along with a list of exercises. "
        "You specialize in returning a list of exercise names for the lesson. "
        "We already have the following exercises: "
        f"{', '.join(current_exercises) if current_exercises else 'NO CURRENT EXERCISES'}. "
        "You are going to construct the perfect, "
        f"complete list of {config.exercises_per_lesson} exercises for the lesson. "
        "Use the exercises we already have with the exact same name, if we have any. "
        "If we have no exercises, return a complete list of exercises for the lesson. "
        "DO NOT number the exercises *in* the names, eg `Exercise 1: Foo`. "
        "Return a nice stand-alone, understandable title as the name of each exercise. "
        "Your output will be a summary of the lesson and the complete list of exercises."
    )
    if config.llm_instructions:
        system_prompt += f"\nAdditional instructions: {config.llm_instructions}"

    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=system_prompt,
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    "Generate the lesson summary and exercise names "
                    f"for the lesson: {lesson_name} in `Unit: {unit_name}` "
                    f"in `Course: {config.title}` using the JSON tool."
                ),
            ),
        ],
        LessonPlanResponse,
    )


def get_lesson_content(
    lesson_request: LessonContentRequest, config: BookConfig
) -> LessonContentResponse:
    system_prompt = (
        "You are an expert curriculum planner and content writer for the course:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```"
        f"You are now working on the unit: `{lesson_request.unit_name}`.\n"
        f"You are now working on the lesson: `{lesson_request.lesson_name}`.\n\n"
        "You return a complete, comprehensive, verbose lesson in markdown format. "
        "You are writing a lesson for a larger curriculum, so avoid excessive introductions or conclusions. "
        f"For markdown, follow the instructions:\n\n{MARKDOWN_CONTENT_INSTRUCTIONS}\n\n"
        f"Add images, where appropriate, using the format `{{IMAGE: descriptive alt text}}`. "
        "Only add images where they will enhance the content, don't force too many images."
        f"You start the markdown from `## {lesson_request.lesson_name}` with 2 `#`s. "
        "Write the lesson in a way that is easy to understand for the target audience, "
        "which is implied by the course title and subtitle."
    )
    if config.llm_instructions:
        system_prompt += f"\nAdditional instructions: {config.llm_instructions}"

    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=system_prompt,
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate a complete lesson in markdown format for the lesson: {lesson_request.lesson_name} "
                    f"in {lesson_request.unit_name} in {config.title} using the JSON tool. "
                    f"The summary of the lesson is:\n\n```{lesson_request.lesson_summary}```\n\n"
                    f"Use the JSON tool to return the complete markdown lesson content."
                ),
            ),
        ],
        LessonContentResponse,
    )


def get_exercise_content(
    exercise_request: ExerciseContentRequest, config: BookConfig
) -> ExerciseContentResponse:
    system_prompt = (
        "You are an expert curriculum planner and content writer for the course:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```\n\n"
        f"You are now working on the exercise: `{exercise_request.exercise_name}` "
        f"within the lesson: `{exercise_request.lesson_name}` "
        f"within the unit: `{exercise_request.unit_name}`.\n\n"
        "You return a complete, comprehensive, verbose exercise in markdown format. "
        f"For markdown, follow the instructions:\n\n{MARKDOWN_CONTENT_INSTRUCTIONS}\n"
        f"You start the markdown from `### {exercise_request.exercise_name}` with 3 `#`s. "
        "Write the exercise in a way that is easy to understand for the target audience, "
        "which is implied by the course title and subtitle."
    )
    if config.llm_instructions:
        system_prompt += f"\nAdditional instructions: {config.llm_instructions}"

    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=system_prompt,
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate a complete exercise in markdown format for the exercise: {exercise_request.exercise_name} "
                    f"in {exercise_request.lesson_name} in {exercise_request.unit_name} in {config.title} using the JSON tool. "
                    f"Use the JSON tool to return the complete markdown exercise content."
                ),
            ),
        ],
        ExerciseContentResponse,
    )


def get_study_content(
    lesson_request: LessonContentRequest, config: BookConfig
) -> LessonContentResponse:
    system_prompt = (
        "You are an expert at creating study guides for the course:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```\n\n"
        f"You are now working on the lesson: `{lesson_request.lesson_name}` "
        f"within the unit: `{lesson_request.unit_name}`. "
        "You return a concise, fact-dense study guide in markdown format, "
        "containing exactly what the student needs to know from the lesson to excel in the course. "
        f"For markdown, follow the instructions:\n\n{MARKDOWN_CONTENT_INSTRUCTIONS}\n"
        f"You start the markdown from `## {lesson_request.lesson_name}` with 2 `#`s. "
        "Write the study guide in a way that is easy to understand for the target audience, "
        "which is implied by the course title and subtitle. "
        "Avoid mentioning 'This study guide' and jump straight into the content, "
        "with no introduction or conclusion."
    )
    if config.llm_instructions:
        system_prompt += f"\nAdditional instructions: {config.llm_instructions}"

    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=system_prompt,
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate a complete study guide in markdown format for the lesson: {lesson_request.lesson_name} "
                    f"in {lesson_request.unit_name} in {config.title} using the JSON tool. "
                    f"The summary of the lesson is:\n\n```{lesson_request.lesson_summary}```\n\n"
                    f"Use the JSON tool to return the complete markdown study guide content."
                ),
            ),
        ],
        LessonContentResponse,
    )
