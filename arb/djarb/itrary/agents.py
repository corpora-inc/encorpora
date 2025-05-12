from pydantic import BaseModel
from typing import List

from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage, LLMBaseInterface

from itrary.models import (
    Exercise,
    Lesson,
    NewUnitMarkdownModel,
    Unit,
    UnitMarkdownModel,
)
from itrary.utils import BookConfig

# TODO: hrm .. this required XAI_API_KEY to be set ..
# I guess we want to always pass in the llm provider to the agent?
llm = load_llm_provider("xai")
openai = load_llm_provider("openai")


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

Do not add `---`.

The content will be processed by pandoc to generate PDF, EPUB, and other formats, so ensure compatibility.
"""


def no_repetitions(lessons: List[str]) -> str:
    return (
        "You don't need to cover anything that would be covered in the other lessons: "
        f"{', '.join(lessons)}. "
        "Instead of covering boilerplate content that would be covered in the other lessons, "
        "focus on going extremely deep into the unique content of this lesson. "
    )


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
    lessons: List[UnitPlanLesson]
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


class CourseOutlineExercise(BaseModel):
    name: str


class CourseOutlineLesson(BaseModel):
    name: str
    number: float
    summary: str
    exercises: List[CourseOutlineExercise]


class CourseOutlineUnit(BaseModel):
    name: str
    number: float
    summary: str
    lessons: List[CourseOutlineLesson]


class CourseOutlineResponse(BaseModel):
    summary: str
    units: List[CourseOutlineUnit]


def get_course_outline(config: BookConfig) -> CourseOutlineResponse:
    """Get Complete Course Outline with Lessons and summaries"""
    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    "You are an expert curriculum planner for the course:\n\n"
                    f"```\n{config.title}\n{config.subtitle}\n```\n\n"
                    f"The purpose of the course is: {config.purpose}\n\n"
                    "You are going to generate a complete course outline with lessons and summaries. "
                    f"You will break the course into {config.units} units. "
                    f"You will break each unit into {config.lessons_per_unit} lessons. "
                    f"Each lesson will have {config.exercises_per_lesson} exercises. "
                    "Generate a complete course outline with names, lesson summaries and exercises. "
                    "Do NOT number the units, lessons, or exercises in the names (e.g., avoid 'Unit 1: Foo'). "
                    "Use the JSON tool to return the complete course outline."
                ),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate the complete course outline for the course: {config.title} "
                    f"using the JSON tool."
                ),
            ),
        ],
        CourseOutlineResponse,
    )


def get_course_plan(config: BookConfig) -> CoursePlanResponse:
    current_units = Unit.objects.filter(course__name=config.title).values_list(
        "name", flat=True
    )

    system_prompt = (
        "You are an expert curriculum planner for the course:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```\n\n"
        f"The purpose of the course is: {config.purpose}\n\n"
        f"You specialize in creating a list of unit names for the course, breaking it into {config.units} units. "
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
    lesson_request: LessonContentRequest,
    config: BookConfig,
) -> LessonContentResponse:
    other_lessons = [
        lesson.name
        for lesson in lesson_request.lessons
        if lesson.name != lesson_request.lesson_name
    ]

    system_prompt = (
        "You are an expert curriculum planner and content writer for the course:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```\n\n"
        f"You are writing the lesson: `{lesson_request.lesson_name}` in the unit: `{lesson_request.unit_name}`. "
        f"{no_repetitions(other_lessons)}"
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
    lesson_request: LessonContentRequest,
    config: BookConfig,
) -> LessonContentResponse:
    other_lessons = [
        lesson.name
        for lesson in lesson_request.lessons
        if lesson.name != lesson_request.lesson_name
    ]
    system_prompt = (
        "You are an expert at creating study guides for the course:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```\n\n"
        f"You are writing a study guide for the lesson: `{lesson_request.lesson_name}` "
        f"in the unit: `{lesson_request.unit_name}`. "
        f"{no_repetitions(other_lessons)}"
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


def edit_unit(
    unit_name: str,
    instructions: str,
    config: BookConfig,
    llm: LLMBaseInterface = llm,
) -> None:
    """
    Feed the entire unit into a large model, apply the instructions,
    make the changes. This is a destructive operation. Back up the database.
    """
    unit = Unit.objects.get(name=unit_name)

    unit_markdown_model = unit.get_full_markdown()
    unit_markdown = unit_markdown_model.model_dump_json(exclude_none=True)

    system_prompt = (
        "You are editing an entire unit of a book:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```\n\n"
        f"The purpose of the course is: {config.purpose}\n\n"
        f"You follow the general instructions for the book:\n\n"
        f"```\n{config.llm_instructions}\n```\n\n"
        f"You are working on the unit: `{unit_name}`.\n\n"
        f"Here is the current draft of the unit:\n\n"
        f"```\n{unit_markdown}\n```\n\n"
        f"You job is return the entire unit, the markdown content of "
        "the Lessons and Exercises, **almost exactly the same**, "
        "in the same format as the input, using the JSON tool. "
        f"You will follow the mardown formatting rules:\n\n"
        f"```\n{MARKDOWN_CONTENT_INSTRUCTIONS}\n```\n\n"
        "You will make changes to the content of the lessons and exercises in the unit "
        "according to the following specific instructions:\n\n"
        f"```\n{instructions}\n```"
    )
    new_unit_markdown = llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=system_prompt,
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Edit the unit: {unit_name} using the JSON tool to return "
                    "the lessons and exercises markdown content. "
                    "Your job is not to dramatically change the content, "
                    "but to make and editorial pass on the content. "
                    "You are making the following changes:\n\n"
                    f"{instructions}"
                    "Return the edited lessons and exercises markdown content in the same format as the input, "
                    "using the JSON tool."
                ),
            ),
        ],
        UnitMarkdownModel,
    )
    unit.rewrite_full_markdown(new_unit_markdown)
    # don't really need to pass it back but might as well?
    return unit_markdown_model


def get_unit(
    unit_name: str,
    course_outline: CourseOutlineResponse,
    config: BookConfig,
) -> NewUnitMarkdownModel:
    """
    Use a large model to get the lesson and exercise
    markdown content for the whole unit.
    """
    # unit = Unit.objects.get(name=unit_name)
    # all_units = [unit.name for unit in Unit.objects.filter(course__name=config.title)]

    unit = next((unit for unit in course_outline.units if unit.name == unit_name), None)
    if unit is None:
        raise ValueError(f"Unit {unit_name} not found in course outline.")

    # TODO: max_images_per_lesson or we just put that in llm_instructions?
    system_prompt = (
        "You are an expert curriculum planner and content writer for the course:\n\n"
        f"```\n{config.title}\n{config.subtitle}\n```\n\n"
        f"With the purpose: {config.purpose}\n\n"
        f"The units are: {', '.join([unit.name for unit in course_outline.units])}\n\n"
        f"You are working on the SPECIFIC UNIT: `{unit_name}`. "
        f"The outline of the unit is:\n\n"
        f"```\n{unit.model_dump_json(indent=2)}\n```\n\n"
        f"Follow the markdown formatting rules:\n\n"
        f"```\n{MARKDOWN_CONTENT_INSTRUCTIONS}\n```\n\n"
        f"Return the markdown content of the unit, including all lessons and exercises. "
        "Return the EXACT SAME NAMES of the lessons and exercises as they are in the outline. "
        "Start each lesson.markdown with `## {lesson.name}` using 2 `#`s. "
        "Start each exercise.markdown with `### {exercise.name}` using 3 `#`s. "
        f"Add up to {config.max_images_per_lesson} images per lesson. "
        "You are writing the full markdown content using rich markdown features. "
        "Use bold, italics, and blockquotes to make key points stand out. "
        "Generate a complete, comprehensive, verbose unit using the JSON tool. "
        "Write for the target audience implied by the course title and subtitle, "
        "ensuring clarity and engagement."
    )

    if config.llm_instructions:
        system_prompt += f"\nFollow the instructions:\n\n{config.llm_instructions}"

    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=system_prompt,
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate the complete unit content for the unit: {unit_name} "
                    f"in course: {config.title} using the JSON tool."
                ),
            ),
        ],
        NewUnitMarkdownModel,
    )


class UnitIntroResponse(BaseModel):
    intro_markdown: str


def get_unit_intro(
    unit: Unit,
    config: BookConfig,
    llm: LLMBaseInterface = llm,
) -> UnitIntroResponse:
    """
    Use a large model to get the lesson and exercise
    markdown content for the whole unit.
    """
    unit_markdown = unit.get_full_markdown()
    units = ", ".join(
        [unit.name for unit in Unit.objects.filter(course__name=config.title)]
    )

    return llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    "You are an expert curriculum planner and content writer for the course:\n\n"
                    f"```\n{config.title}\n{config.subtitle}\n```\n\n"
                    f"With the purpose: {config.purpose}\n\n"
                    f"The units are: {units}\n\n"
                    f"You are working on the SPECIFIC UNIT: `{unit.name}`. "
                    f"The lessons and exercises in full are:\n\n"
                    f"```\n{unit_markdown.model_dump_json(indent=2)}\n```\n\n"
                    "You are going to write an INTRODUCTION to the unit in markdown. "
                    f"Follow the general markdown formatting rules:\n\n"
                    f"```\n{MARKDOWN_CONTENT_INSTRUCTIONS}\n```\n\n"
                    "In addition, for the unit introduction specifically, "
                    "DO NOT USE ANY headers. "
                    "DO NOT USE ANY IMAGE tags. "
                    "Use bold, italics, blockquotes, and bullets to make key points stand out. "
                    "For the introduction, "
                    "we need to give an overview of the prequisite knowledge and GENERAL CONTEXT "
                    "that the students need to have to begin the unit. "
                    "Give a complete, verbose, introduction for the unit, "
                    "including where it fits into the course: "
                    "where it comes from and where it leads to. "
                    "Give SPECIFIC background information that puts the unit into context "
                    "and prepares the reader for the content of the unit. "
                    "You are writing a verbose, comprehensive introduction "
                    "but, you still make it concise and fact-dense. "
                    "Do not waste words with fluffy boilerplate or formulaic filler. "
                    "Write for the target audience implied by the course title and subtitle."
                ),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Generate the comprehensive, publication-quality introdution for the unit: {unit.name} "
                    f"in course: {config.title} using the JSON tool."
                ),
            ),
        ],
        UnitIntroResponse,
    )
