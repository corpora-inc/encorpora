# history/agents.py
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime
from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage
from history.models import Course, Theme, Period, Place, Person, Event, Document

# Initialize XAI provider
llm = load_llm_provider("xai")


# Model Type Enum
class ModelType(str, Enum):
    theme = "theme"
    period = "period"
    place = "place"
    person = "person"
    event = "event"
    document = "document"


# Related Topic Model
class RelatedTopic(BaseModel):
    name: str
    type: ModelType


# Pydantic Schemas
class ThemeEntry(BaseModel):
    name: str
    description: str
    theme_names: List[str] = []


class PeriodEntry(BaseModel):
    name: str
    description: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    theme_names: List[str] = []


class PlaceEntry(BaseModel):
    name: str
    description: str
    period_names: List[str] = []
    theme_names: List[str] = []


class PersonEntry(BaseModel):
    name: str
    description: str
    birth_date: Optional[date] = None
    death_date: Optional[date] = None
    place_names: List[str] = []
    period_names: List[str] = []
    theme_names: List[str] = []


class EventEntry(BaseModel):
    name: str
    description: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    place_names: List[str] = []
    person_names: List[str] = []
    period_names: List[str] = []
    theme_names: List[str] = []
    related_event_names: List[str] = []


class DocumentEntry(BaseModel):
    name: str
    description: str
    publication_date: Optional[date] = None
    author: str = ""
    parent_name: Optional[str] = None
    event_names: List[str] = []
    person_names: List[str] = []
    place_names: List[str] = []
    period_names: List[str] = []
    theme_names: List[str] = []


class ThemeResponse(BaseModel):
    entry: ThemeEntry
    related_topics: List[RelatedTopic] = []


class PeriodResponse(BaseModel):
    entry: PeriodEntry
    related_topics: List[RelatedTopic] = []


class PlaceResponse(BaseModel):
    entry: PlaceEntry
    related_topics: List[RelatedTopic] = []


class PersonResponse(BaseModel):
    entry: PersonEntry
    related_topics: List[RelatedTopic] = []


class EventResponse(BaseModel):
    entry: EventEntry
    related_topics: List[RelatedTopic] = []


class DocumentResponse(BaseModel):
    entry: DocumentEntry
    related_topics: List[RelatedTopic] = []


# Database Service
@dataclass
class HistoricalDBService:
    def save_theme(self, entry: ThemeEntry, course: Course) -> List[str]:
        theme, created = Theme.objects.get_or_create(
            name=entry.name, defaults={"description": entry.description}
        )
        theme.courses.add(course)
        print(f"Saved Theme: {entry.name} (created: {created})")
        return entry.theme_names

    def save_period(self, entry: PeriodEntry, course: Course) -> List[str]:
        period, created = Period.objects.get_or_create(
            name=entry.name,
            defaults={
                "description": entry.description,
                "start_date": entry.start_date,
                "end_date": entry.end_date,
            },
        )
        period.courses.add(course)
        for theme_name in entry.theme_names:
            theme, _ = Theme.objects.get_or_create(name=theme_name)
            period.themes.add(theme)
        print(f"Saved Period: {entry.name} (created: {created})")
        return entry.theme_names

    def save_place(self, entry: PlaceEntry, course: Course) -> List[str]:
        place, created = Place.objects.get_or_create(
            name=entry.name, defaults={"description": entry.description}
        )
        place.courses.add(course)
        for period_name in entry.period_names:
            period, _ = Period.objects.get_or_create(name=period_name)
            place.periods.add(period)
        for theme_name in entry.theme_names:
            theme, _ = Theme.objects.get_or_create(name=theme_name)
            place.themes.add(theme)
        print(f"Saved Place: {entry.name} (created: {created})")
        return entry.period_names + entry.theme_names

    def save_person(self, entry: PersonEntry, course: Course) -> List[str]:
        person, created = Person.objects.get_or_create(
            name=entry.name,
            defaults={
                "description": entry.description,
                "birth_date": entry.birth_date,
                "death_date": entry.death_date,
            },
        )
        person.courses.add(course)
        for place_name in entry.place_names:
            place, _ = Place.objects.get_or_create(name=place_name)
            person.places.add(place)
        for period_name in entry.period_names:
            period, _ = Period.objects.get_or_create(name=period_name)
            person.periods.add(period)
        for theme_name in entry.theme_names:
            theme, _ = Theme.objects.get_or_create(name=theme_name)
            person.themes.add(theme)
        print(f"Saved Person: {entry.name} (created: {created})")
        return entry.place_names + entry.period_names + entry.theme_names

    def save_event(self, entry: EventEntry, course: Course) -> List[str]:
        event, created = Event.objects.get_or_create(
            name=entry.name,
            defaults={
                "description": entry.description,
                "start_date": entry.start_date,
                "end_date": entry.end_date,
            },
        )
        event.courses.add(course)
        for place_name in entry.place_names:
            place, _ = Place.objects.get_or_create(name=place_name)
            event.places.add(place)
        for person_name in entry.person_names:
            person, _ = Person.objects.get_or_create(name=person_name)
            event.people.add(person)
        for period_name in entry.period_names:
            period, _ = Period.objects.get_or_create(name=period_name)
            event.periods.add(period)
        for theme_name in entry.theme_names:
            theme, _ = Theme.objects.get_or_create(name=theme_name)
            event.themes.add(theme)
        for rel_event_name in entry.related_event_names:
            rel_event, _ = Event.objects.get_or_create(name=rel_event_name)
            event.related_events.add(rel_event)
        print(f"Saved Event: {entry.name} (created: {created})")
        return (
            entry.place_names
            + entry.person_names
            + entry.period_names
            + entry.theme_names
            + entry.related_event_names
        )

    def save_document(self, entry: DocumentEntry, course: Course) -> List[str]:
        document, created = Document.objects.get_or_create(
            name=entry.name,
            defaults={
                "description": entry.description,
                "publication_date": entry.publication_date,
                "author": entry.author,
            },
        )
        document.courses.add(course)
        if entry.parent_name:
            parent, _ = Document.objects.get_or_create(name=entry.parent_name)
            document.parent = parent
            document.save()
        for event_name in entry.event_names:
            event, _ = Event.objects.get_or_create(name=event_name)
            document.events.add(event)
        for person_name in entry.person_names:
            person, _ = Person.objects.get_or_create(name=person_name)
            document.people.add(person)
        for place_name in entry.place_names:
            place, _ = Place.objects.get_or_create(name=place_name)
            document.places.add(place)
        for period_name in entry.period_names:
            period, _ = Period.objects.get_or_create(name=period_name)
            document.periods.add(period)
        for theme_name in entry.theme_names:
            theme, _ = Theme.objects.get_or_create(name=theme_name)
            document.themes.add(theme)
        print(f"Saved Document: {entry.name} (created: {created})")
        return (
            ([entry.parent_name] if entry.parent_name else [])
            + entry.event_names
            + entry.person_names
            + entry.place_names
            + entry.period_names
            + entry.theme_names
        )


# Agents
class HistoricalAgent:
    def __init__(self, topic: str, course: Course, model_type: str):
        self.topic = topic
        self.course = course
        self.model_type = model_type

    def fetch_data(self, retries: int = 3) -> Optional[BaseModel]:
        model_prompts = {
            "theme": (
                f"You are an expert history teacher helping students master all material for a perfect score on their exam. "
                f"You are writing a snippet in a larger corpus. Provide only concise, fact-dense details about the Theme '{self.topic}', covering key concepts and exam-relevant details. "
                f"Do not include introductions, summaries, conclusions, or mention the course name in the description. "
                f"Use multiple paragraphs if needed for clarity. "
                f"Include related topics as a list of {{name: string, type: 'theme' | 'period' | 'place' | 'person' | 'event' | 'document'}} objects, suggesting any relevant types (e.g., {{name: 'American Revolution', type: 'event'}}). "
                f"Return structured JSON using function call/tools, containing only raw facts."
            ),
            "period": (
                f"You are an expert history teacher helping students master all material for a perfect score on their exam. "
                f"You are writing a snippet in a larger corpus. Provide only concise, fact-dense details about the Period '{self.topic}', including key events, characteristics, and exam-relevant details. "
                f"Do not include introductions, summaries, conclusions, or mention the course name in the description. "
                f"Include start_date, end_date (ISO format, e.g., '1491-01-01'), and related topics as a list of {{name: string, type: 'theme' | 'period' | 'place' | 'person' | 'event' | 'document'}} objects, suggesting any relevant types. "
                f"Use multiple paragraphs if needed for clarity. "
                f"For Periods, use descriptive historical names with years in parentheses (e.g., 'Colonial Era (1607-1754)', 'Reconstruction (1865-1877)'), not 'Period X: YYYY-YYYY'. "
                f"Return structured JSON using function call/tools, containing only raw facts."
            ),
            "place": (
                f"You are an expert history teacher helping students master all material for a perfect score on their exam. "
                f"You are writing a snippet in a larger corpus. Provide only concise, fact-dense details about the Place '{self.topic}', covering its historical significance and exam-relevant details. "
                f"Do not include introductions, summaries, conclusions, or mention the course name in the description. "
                f"Use multiple paragraphs if needed for clarity. "
                f"Include related topics as a list of {{name: string, type: 'theme' | 'period' | 'place' | 'person' | 'event' | 'document'}} objects, suggesting any relevant types. "
                f"For Periods, use descriptive historical names with years in parentheses (e.g., 'Colonial Era (1607-1754)', 'Reconstruction (1865-1877)'), not 'Period X: YYYY-YYYY'. "
                f"For Places, use specific, US-relevant locations tied to the place (e.g., 'Charleston' for Southern history, 'Atlanta' for Civil War, not 'Southern United States' or 'Americas'). "
                f"For Events, use significant historical occurrences (e.g., 'Invention of the Cotton Gin', not 'Cotton Gin'); for inventions, prefer 'document' or 'theme' types unless the invention marks a distinct event (e.g., {{name: 'Cotton Gin', type: 'document'}}). "
                f"Return structured JSON using function call/tools, containing only raw facts."
            ),
            "person": (
                f"You are an expert history teacher helping students master all material for a perfect score on their exam. "
                f"You are writing a snippet in a larger corpus. Provide only concise, fact-dense biographical details about the Person '{self.topic}', covering their contributions, roles, and exam-relevant details. "
                f"Do not include introductions, summaries, conclusions, or mention the course name in the description. "
                f"Use multiple paragraphs if needed for clarity. "
                f"Include birth_date, death_date in timezone-aware ISO format (e.g., '1732-02-22T00:00:00Z'), and related topics as a list of {{name: string, type: 'theme' | 'period' | 'place' | 'person' | 'event' | 'document'}} objects, suggesting any relevant types. "
                f"For Periods, use descriptive historical names with years in parentheses (e.g., 'Colonial Era (1607-1754)', 'Reconstruction (1865-1877)'), not 'Period X: YYYY-YYYY'. "
                f"For Places, use specific, US-relevant locations tied to the person (e.g., 'Mount Vernon' for George Washington, not 'Southern United States' or 'Americas'). "
                f"For Events, use significant historical occurrences (e.g., 'Invention of the Cotton Gin', not 'Cotton Gin'); for inventions, prefer 'document' or 'theme' types unless the invention marks a distinct event (e.g., {{name: 'Cotton Gin', type: 'document'}}). "
                f"Return structured JSON using function call/tools, containing only raw facts."
            ),
            "event": (
                f"You are an expert history teacher helping students master all material for a perfect score on their exam. "
                f"You are writing a snippet in a larger corpus. Provide only concise, fact-dense details about the Event '{self.topic}', covering causes, outcomes, and exam-relevant details. "
                f"Do not include introductions, summaries, conclusions, or mention the course name in the description. "
                f"Use multiple paragraphs if needed for clarity. "
                f"Include start_date, end_date in timezone-aware ISO format (e.g., '1861-04-12T00:00:00Z'), and related topics as a list of {{name: string, type: 'theme' | 'period' | 'place' | 'person' | 'event' | 'document'}} objects, suggesting any relevant types. "
                f"For Periods, use descriptive historical names with years in parentheses (e.g., 'Colonial Era (1607-1754)', 'Reconstruction (1865-1877)'), not 'Period X: YYYY-YYYY'. "
                f"For Places, use specific, US-relevant locations tied to the event (e.g., 'Gettysburg' for the Civil War, not 'Southern United States' or 'Americas'). "
                f"For Events, use significant historical occurrences (e.g., 'Invention of the Cotton Gin', not 'Cotton Gin'); for inventions, prefer 'document' or 'theme' types unless the invention marks a distinct event (e.g., {{name: 'Cotton Gin', type: 'document'}}). "
                f"Return structured JSON using function call/tools, containing only raw facts."
            ),
            "document": (
                f"You are an expert history teacher helping students master all material for a perfect score on their exam. "
                f"You are writing a snippet in a larger corpus. Provide only concise, fact-dense details about the Document '{self.topic}', covering its content, significance, and exam-relevant details. "
                f"Do not include introductions, summaries, conclusions, or mention the course name in the description. "
                f"Use multiple paragraphs if needed for clarity. "
                f"Include publication_date in timezone-aware ISO format (e.g., '1776-07-04T00:00:00Z'), author, parent_name (if applicable), and related topics as a list of {{name: string, type: 'theme' | 'period' | 'place' | 'person' | 'event' | 'document'}} objects, suggesting any relevant types. "
                f"For Periods, use descriptive historical names with years in parentheses (e.g., 'Colonial Era (1607-1754)', 'Reconstruction (1865-1877)'), not 'Period X: YYYY-YYYY'. "
                f"For Places, use specific, US-relevant locations tied to the document (e.g., 'Philadelphia' for the Declaration of Independence, not 'Southern United States' or 'Americas'). "
                f"For Events, use significant historical occurrences (e.g., 'Invention of the Cotton Gin', not 'Cotton Gin'); for inventions, prefer 'document' or 'theme' types unless the invention marks a distinct event (e.g., {{name: 'Cotton Gin', type: 'document'}}). "
                f"Return structured JSON using function call/tools, containing only raw facts."
            ),
        }
        messages = [
            ChatCompletionTextMessage(
                role="system", text=model_prompts[self.model_type]
            ),
            ChatCompletionTextMessage(
                role="user",
                text=(
                    f"Provide the exam-relevant facts about the {self.model_type} '{self.topic}' for a perfect score, "
                    f"including all related object names for further exploration as objects with name and type fields."
                ),
            ),
        ]

        response_classes = {
            "theme": ThemeResponse,
            "period": PeriodResponse,
            "place": PlaceResponse,
            "person": PersonResponse,
            "event": EventResponse,
            "document": DocumentResponse,
        }
        for attempt in range(retries):
            try:
                print(
                    f"Fetching {self.model_type} for topic: {self.topic} (attempt {attempt + 1})"
                )
                response = llm.get_data_completion(
                    messages, response_classes[self.model_type]
                )
                print(f"Fetched {self.model_type}: {response.entry.name}")
                return response
            except Exception as e:
                print(f"Failed to fetch {self.model_type} for {self.topic}: {e}")
                if attempt == retries - 1:
                    print(f"Exhausted retries for {self.model_type}: {self.topic}")
                    return None
        return None

    def process(self) -> List[RelatedTopic]:
        print(f"Processing {self.model_type}: {self.topic}")
        response = self.fetch_data()
        if not response:
            print(f"No data for {self.model_type}: {self.topic}")
            return []
        service = HistoricalDBService()
        save_methods = {
            "theme": service.save_theme,
            "period": service.save_period,
            "place": service.save_place,
            "person": service.save_person,
            "event": service.save_event,
            "document": service.save_document,
        }
        new_topics = save_methods[self.model_type](response.entry, self.course)
        # Convert related names to RelatedTopic objects, ensuring correct types
        entry_topics = []
        if self.model_type == "theme":
            for name in response.entry.theme_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.theme))
        elif self.model_type == "period":
            for name in response.entry.theme_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.theme))
        elif self.model_type == "place":
            for name in response.entry.period_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.period))
            for name in response.entry.theme_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.theme))
        elif self.model_type == "person":
            for name in response.entry.place_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.place))
            for name in response.entry.period_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.period))
            for name in response.entry.theme_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.theme))
        elif self.model_type == "event":
            for name in response.entry.place_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.place))
            for name in response.entry.person_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.person))
            for name in response.entry.period_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.period))
            for name in response.entry.theme_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.theme))
            for name in response.entry.related_event_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.event))
        elif self.model_type == "document":
            if response.entry.parent_name:
                entry_topics.append(
                    RelatedTopic(
                        name=response.entry.parent_name, type=ModelType.document
                    )
                )
            for name in response.entry.event_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.event))
            for name in response.entry.person_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.person))
            for name in response.entry.place_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.place))
            for name in response.entry.period_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.period))
            for name in response.entry.theme_names:
                entry_topics.append(RelatedTopic(name=name, type=ModelType.theme))
        # Combine with LLM-suggested related topics and include new_topics
        all_topics = (
            entry_topics
            + [
                RelatedTopic(name=name, type=ModelType[self.model_type])
                for name in new_topics
            ]
            + response.related_topics
        )
        # Deduplicate topics by (name, type) to avoid redundant spidering
        seen = set()
        deduplicated_topics = []
        for topic in all_topics:
            key = (topic.name, topic.type.value)
            if key not in seen:
                seen.add(key)
                deduplicated_topics.append(topic)
        print(
            f"New topics from {self.model_type} {self.topic}: {[(t.name, t.type.value) for t in deduplicated_topics]}"
        )
        return deduplicated_topics


class DirectorAgent:
    def __init__(self, course_name: str, max_topics: int):
        self.course, _ = Course.objects.get_or_create(
            name=course_name, defaults={"description": f"Course for {course_name}"}
        )
        self.max_topics = max_topics
        # Exclude objects with blank descriptions from processed_topics
        self.processed_topics = set()
        for model, model_type in [
            (Theme, "theme"),
            (Period, "period"),
            (Place, "place"),
            (Person, "person"),
            (Event, "event"),
            (Document, "document"),
        ]:
            names = (
                model.objects.filter(courses=self.course)
                .exclude(description="")
                .order_by()
                .values_list("name", flat=True)
            )
            self.processed_topics.update(f"{model_type}:{name}" for name in names)
        self.topic_queue = [
            RelatedTopic(name=course_name, type=ModelType.theme)
        ]  # Start with course as Theme
        self.processed_count = 0

    def process(self):
        print(
            f"Starting spidering for course: {self.course.name} (max_topics: {self.max_topics})"
        )
        while self.topic_queue and self.processed_count < self.max_topics:
            topic = self.topic_queue.pop(0)
            topic_key = f"{topic.type.value}:{topic.name}"
            if topic_key in self.processed_topics:
                print(f"Skipping processed topic: {topic_key}")
                continue
            self.processed_topics.add(topic_key)
            print(
                f"Processing topic {self.processed_count + 1}/{self.max_topics}: {topic_key}"
            )
            agent = HistoricalAgent(topic.name, self.course, topic.type.value)
            new_topics = agent.process()
            print(f"Queue size: {len(self.topic_queue)}, New topics: {len(new_topics)}")
            self.topic_queue.extend(new_topics)
            self.processed_count += 1
        print(f"Spidering complete: {self.processed_count} topics processed")
