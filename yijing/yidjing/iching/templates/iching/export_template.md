{% autoescape off %}

{% for hex in hexagrams %}

# {{ hex.number }} {{ hex.name_zh }} ({{ hex.name_pinyin }}) - {{ hex.name_en }}

{% spaceless %}
\hexagram{{"{"}}{{ hex.binary|slice:"0:1" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"1:2" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"2:3" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"3:4" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"4:5" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"5:6" }}{{"}"}}
{% endspaceless %}

\begin{center}
{\Huge {{ hex.name_zh }}} \\
\vspace{0.33cm}
{{ hex.name_pinyin }} \\
\vspace{0.33cm}
{{ hex.name_en }}
\vspace{0.33cm}
\end{center}

## Judgment

\begin{minipage}{\textwidth}
\begin{center}
{\Large {{ hex.judgment_zh }}} \\
\vspace{0.5cm}
{{ hex.judgment_pinyin }} \\
\vspace{0.5cm}
{{ hex.judgment_en }}
\end{center}
\end{minipage}


{% for line in hex.lines.all %}

## {{ line.line_number }}

\begin{minipage}{\textwidth}
\begin{center}
{\Large {{ line.text_zh }}} \\
\vspace{0.5cm}
{{ line.text_pinyin }} \\
\vspace{0.5cm}
{{ line.text_en }}
\end{center}
\end{minipage}


{% endfor %}

{% endfor %}

{% endautoescape %}
