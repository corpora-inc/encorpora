-- math2svg.lua (fixed)

local utils = require 'pandoc.utils'
local sha1  = utils.sha1

-- Pure‑Lua Base64 encoder
local b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
local function base64enc(data)
  local bitstream = {}
  for i = 1, #data do
    local byte = data:byte(i)
    for bit = 7, 0, -1 do
      table.insert(bitstream, (byte >> bit) & 1)
    end
  end
  while #bitstream % 6 ~= 0 do table.insert(bitstream, 0) end
  local out = {}
  for i = 1, #bitstream, 6 do
    local val =  bitstream[i]*32 + bitstream[i+1]*16
              + bitstream[i+2]*8 + bitstream[i+3]*4
              + bitstream[i+4]*2 + bitstream[i+5]*1
    table.insert(out, b64chars:sub(val+1,val+1))
  end
  local pad = (#data % 3 == 1 and '==') or (#data % 3 == 2 and '=') or ''
  return table.concat(out) .. pad
end

-- Ensure cache directory
os.execute('mkdir -p svgcache')

local tex_tpl = [[
\documentclass[preview]{standalone}
\usepackage{amsmath}
\begin{document}
%s
\end{document}
]]

local function tex2svg_b64(kind, text)
  local key = sha1(kind..text)
  local svg = 'svgcache/'..key..'.svg'
  local tex = 'svgcache/'..key..'.tex'
  local dvi = 'svgcache/'..key..'.dvi'

  if not os.rename(svg, svg) then
    local f = io.open(tex,'w')
    f:write(tex_tpl:format(text))
    f:close()
    os.execute('latex -output-directory=svgcache -interaction=batchmode '..tex)
    os.execute('dvisvgm --no-fonts -n -o '..svg..' svgcache/'..key..'.dvi')
  end

  local raw = io.open(svg,'rb'):read('*all')
  return base64enc(raw)
end

function InlineMath(elem)
  local b64 = tex2svg_b64('InlineMath', elem.text)
  local tag = '<img src="data:image/svg+xml;base64,'..b64..
              '" class="math inline-math" alt="$'..elem.text..'$"/>'
  return pandoc.RawInline('html', tag)
end

function DisplayMath(elem)
  local b64 = tex2svg_b64('DisplayMath', elem.text)
  local tag = '<img src="data:image/svg+xml;base64,'..b64..
              '" class="math display-math" alt="$$'..elem.text..'$$"/>'
  return pandoc.RawBlock('html', tag)
end
