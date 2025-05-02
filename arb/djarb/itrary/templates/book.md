# {{ course.name }}

{{ course.summary }}

{% for unit in course.units.all|dictsort:"number" %}

## {{ unit.name }}

> {{ unit.summary }}

{% for lesson in unit.lessons.all|dictsort:"number" %}

{{ lesson.markdown }}

{% for exercise in lesson.exercises.all %}

{{ exercise.markdown }}

{% endfor %}

{% endfor %}

{% endfor %}
