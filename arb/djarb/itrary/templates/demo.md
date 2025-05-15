{% autoescape off %}

{{ course.summary }}

{% for unit in course.units.all|dictsort:"number" %}
{% if forloop.first %}
# {{ unit.name }}

{{ unit.intro_markdown }}
{% for lesson in unit.lessons.all|dictsort:"number" %}
{{ lesson.markdown }}
{% for exercise in lesson.exercises.all %}
{{ exercise.markdown }}
{% endfor %}
{% endfor %}

{% else %}

# {{ unit.name }} (Demo)

{{ unit.intro_markdown|slice:":300" }}...

{% for lesson in unit.lessons.all|dictsort:"number" %}
## {{ lesson.name }}

{% for exercise in lesson.exercises.all %}
### {{ exercise.name }}
{% endfor %}
{% endfor %}

{% endif %}
{% endfor %}

{% endautoescape %}
