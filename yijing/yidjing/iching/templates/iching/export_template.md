{% autoescape off %}

{% for hex in hexagrams %}

# {{ hex.number }} {{ hex.name_zh }} ({{ hex.name_pinyin }}) - {{ hex.name_en }}

{% spaceless %}
\hexagram{{"{"}}{{ hex.binary|slice:"0:1" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"1:2" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"2:3" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"3:4" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"4:5" }}{{"}"}}{{"{"}}{{ hex.binary|slice:"5:6" }}{{"}"}}
{% endspaceless %}

\begin{center}
{\fontsize{50}{58}\selectfont {{ hex.name_zh }}} \\
\vspace{0.33cm}
{{ hex.name_pinyin }} \\
\vspace{0.33cm}
{{ hex.name_en }}
\end{center}

\vspace{0.66cm}

## Judgment

\begin{minipage}{\textwidth}
\begin{center}
{\Large {{ hex.judgment_zh }}} \\
\vspace{0.33cm}
{{ hex.judgment_pinyin }} \\
\vspace{0.33cm}
{{ hex.judgment_en }}
\end{center}
\end{minipage}

\vspace{0.66cm}

{% for line in hex.lines.all %}

## {{ line.line_number }}

\begin{minipage}{\textwidth}
\begin{center}
{\Large {{ line.text_zh }}} \\
\vspace{0.33cm}
{{ line.text_pinyin }} \\
\vspace{0.33cm}
{{ line.text_en }}
\end{center}
\end{minipage}

\vspace{0.66cm}

{% endfor %}

{% endfor %}

{% endautoescape %}
