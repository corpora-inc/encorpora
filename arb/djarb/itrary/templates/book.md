{% autoescape off %}

{{ course.summary }}

{% for unit in course.units.all|dictsort:"number" %}

# {{ unit.name }}

{{ unit.intro_markdown }}

{% for lesson in unit.lessons.all|dictsort:"number" %}

{{ lesson.markdown }}

{% for exercise in lesson.exercises.all %}

{{ exercise.markdown }}

{% endfor %}

{% endfor %}

{% endfor %}

{% endautoescape %}
