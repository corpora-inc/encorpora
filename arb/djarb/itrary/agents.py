from pydantic import BaseModel
from typing import List


from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage

from itrary.models import Exercise, Lesson, Unit
from itrary.utils import BookConfig

llm = load_llm_provider("xai")


MARKDOWN_CONTENT_INSTRUCTIONS = """
You are writing a specific section of a larger book, such as a lesson, exercise, or study guide. Write as a seamless, standalone narrative, diving directly into the content without referencing the course, unit, lesson, or curriculum structure (e.g., avoid "In this lesson," "In this unit," "This chapter"). The reader already knows their context, so avoid introductions or conclusions that restate the context.

Follow these markdown formatting rules:
- Add a blank line before and after lists (bullet or numbered).
- Use `$` for inline math and `$$` for display math.
- Avoid special Unicode characters (e.g., ≠, α, ≈) unless in LaTeX math mode (e.g., `$\neq$`, `$\alpha$`, `$\approx$`).
- Insert image placeholders only where visuals significantly enhance understanding or engagement, using the format `{{IMAGE: publication-quality caption}}` on its own line, surrounded by blank lines. The caption must be:
  - Concise, descriptive, and suitable as a figure caption in the final book.
  - Free of style directives (e.g., no "black-and-white," "sketch") or separate captions (e.g., no "Caption: ...").
  - Simple and consistent, using plain text or LaTeX for math-related captions when appropriate.
  - Example for history: "Savannah's first square in 1733."
  - Example for math: "Graph of $y = x^2$ showing a parabola."
  - Example for literature: "Heathcliff wandering the moors at dusk."

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
    current_units = Unit.objects.filter(course__name=config.title).values_list(
        "name", flat=True
    )

    system_prompt = (
        "You are an expert curriculum planner for the course:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```\n\n"
        f"Course configuration: {config.units} units\n\n"
        "You specialize in creating a list of unit names for the course, breaking it into {config.units} units. "
        "Do not number the units in the names (e.g., avoid 'Unit 1: Foo'). "
        "We already have the following units: "
        f"{', '.join(current_units) if current_units else 'NO CURRENT UNITS'}. "
        "Construct the complete list of units for the course, reusing existing unit names exactly if present. "
        "If no units exist, create a full list. "
        "Provide a concise summary of the course and the list of units. "
        "Return standalone, understandable titles for each unit and use the JSON tool to include the unit number for ordering."
    )
    if config.llm_instructions:
        system_prompt += f"\nAdditional instructions:\n\n{config.llm_instructions}"

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


def get_unit_plan(unit_name: str, config: BookConfig) -> UnitPlanResponse:
    current_lessons = Lesson.objects.filter(unit__name=unit_name).values_list(
        "name", flat=True
    )

    system_prompt = (
        "You are an expert curriculum planner for the course:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```\n\n"
        f"Unit configuration: {config.lessons_per_unit} lessons\n\n"
        f"You are working on the unit: `{unit_name}`. "
        "Use the JSON tool to provide a summary of the unit and a list of lessons. "
        f"Break the unit into {config.lessons_per_unit} lessons. "
        "We already have the following lessons: "
        f"{', '.join(current_lessons) if current_lessons else 'NO CURRENT LESSONS'}. "
        "Construct the complete list of lessons for the unit, reusing existing lesson names exactly if present. "
        "If no lessons exist, create a full list. "
        "Do not number the lessons in the names (e.g., avoid 'Lesson 1: Foo'). "
        "Return standalone, understandable titles for each lesson and use the JSON tool to include the lesson number for ordering."
    )
    if config.llm_instructions:
        system_prompt += f"\nAdditional instructions:\n\n{config.llm_instructions}"

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
        f"```\n{config.title}\n{config.subtitle}\n```\n\n"
        f"Lesson configuration: {config.exercises_per_lesson} exercises\n\n"
        f"You are working on the unit: `{unit_name}` and the lesson: `{lesson_name}`. "
        "Use the JSON tool to provide a summary of the lesson and a list of exercises. "
        f"Create {config.exercises_per_lesson} exercises for the lesson. "
        "We already have the following exercises: "
        f"{', '.join(current_exercises) if current_exercises else 'NO CURRENT EXERCISES'}. "
        "Construct the complete list of exercises, reusing existing exercise names exactly if present. "
        "If no exercises exist, create a full list. "
        "Do not number the exercises in the names (e.g., avoid 'Exercise 1: Foo'). "
        "Return standalone, understandable titles for each exercise and use the JSON tool to include the exercise details."
    )
    if config.llm_instructions:
        system_prompt += f"\nAdditional instructions:\n\n{config.llm_instructions}"

    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=system_prompt,
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate the lesson summary and exercise names for the lesson: {lesson_name} "
                    f"in unit: {unit_name} in course: {config.title} using the JSON tool."
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
        f"```\n{config.title}\n{config.subtitle}\n```\n\n"
        f"You are writing the lesson: `{lesson_request.lesson_name}` in the unit: `{lesson_request.unit_name}`. "
        "Generate a complete, comprehensive lesson in markdown format, adhering to the following instructions:\n\n"
        f"{MARKDOWN_CONTENT_INSTRUCTIONS}\n"
        f"- Produce no more than {config.max_images_per_lesson} images. "
        "Feel free to use 0 images if the content is better without them. "
        f"Start the markdown with `## {lesson_request.lesson_name}` using 2 `#`s. "
        "Write for the target audience implied by the course title and subtitle, ensuring clarity and engagement."
    )
    if config.llm_instructions:
        system_prompt += f"\nAdditional instructions:\n\n{config.llm_instructions}"

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
                    f"in unit: {lesson_request.unit_name} in course: {config.title} using the JSON tool. "
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
        f"You are writing the exercise: `{exercise_request.exercise_name}` "
        f"in the lesson: `{exercise_request.lesson_name}` "
        f"in the unit: `{exercise_request.unit_name}`. "
        "Generate a complete, comprehensive exercise in markdown format, adhering to the following instructions:\n\n"
        f"{MARKDOWN_CONTENT_INSTRUCTIONS}\n"
        f"- Produce no more than {config.max_images_per_lesson} images. "
        "Feel free to use 0 images if the content is better without them. "
        f"Start the markdown with `### {exercise_request.exercise_name}` using 3 `#`s. "
        "Write for the target audience implied by the course title and subtitle, ensuring clarity and engagement. "
    )
    if config.llm_instructions:
        system_prompt += f"\nAdditional instructions:\n\n{config.llm_instructions}"

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
                    f"in lesson: {exercise_request.lesson_name} in unit: {exercise_request.unit_name} "
                    f"in course: {config.title} using the JSON tool. "
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
        f"You are writing a study guide for the lesson: `{lesson_request.lesson_name}` "
        f"in the unit: `{lesson_request.unit_name}`. "
        "Generate a concise, fact-dense study guide in markdown format, containing only the essential information "
        "students need to excel in the course, adhering to the following instructions:\n\n"
        f"{MARKDOWN_CONTENT_INSTRUCTIONS}\n"
        f"- Produce no more than {config.max_images_per_lesson} images. "
        "Feel free to use 0 images if the content is better without them. "
        f"Start the markdown with `## {lesson_request.lesson_name}` using 2 `#`s. "
        "Write for the target audience implied by the course title and subtitle, ensuring clarity and focus. "
    )
    if config.llm_instructions:
        system_prompt += f"\nAdditional instructions:\n\n{config.llm_instructions}"

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
                    f"in unit: {lesson_request.unit_name} in course: {config.title} using the JSON tool. "
                    f"The summary of the lesson is:\n\n```{lesson_request.lesson_summary}```\n\n"
                    f"Use the JSON tool to return the complete markdown study guide content."
                ),
            ),
        ],
        LessonContentResponse,
    )
