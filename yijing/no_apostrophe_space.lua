function RawInline(el)
    if el.format == "latex" then
      -- Replace \textquoteright followed by any whitespace with \textquoteright\unskip
      el.text = el.text:gsub("(\\textquoteright)%s+", "%1\\unskip")
      return el
    end
  end
