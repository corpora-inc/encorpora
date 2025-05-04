{% autoescape off %}

{% for unit in course.units.all|dictsort:"number" %}

# {{ unit.name }}

> {{ unit.summary }}

{% for lesson in unit.lessons.all|dictsort:"number" %}
{{ lesson.study_markdown }}
{% endfor %}

{% endfor %}
{% endautoescape %}
