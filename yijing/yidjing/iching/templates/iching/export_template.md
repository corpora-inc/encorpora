{% for hex in hexagrams %}

# {{ hex.number }} {{ hex.chinese_name }} ({{ hex.pinyin }})

{% spaceless %}
\hexagram{{"{"}}{{ hex.binary|slice:"0:1" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"1:2" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"2:3" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"3:4" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"4:5" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"5:6" }}{{"}"}}
{% endspaceless %}

\begin{center}
{\Huge {{ hex.chinese_name }}}
\end{center}

## Judgment

\begin{center}
{\Large {{ hex.judgment_zh }}}
\end{center}

> {{ hex.judgment_en }}

{% for line in hex.lines.all %}

## Line {{ line.line_number }}

\begin{center}
{\Large {{ line.text_zh }}}
\end{center}

> {{ line.text_en }}

{% endfor %}


{% endfor %}
