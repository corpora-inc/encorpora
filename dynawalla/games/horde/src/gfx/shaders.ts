/* All GLSL for DEEPSWARM. No textures ship with the game: every shape is an
 * SDF evaluated in the fragment shader, and the one texture that exists (the
 * glyph atlas) is drawn into a canvas at boot. */

export const SPRITE_VS = /* glsl */ `#version 300 es
precision highp float;

// per-instance
layout(location=0) in vec2  i_pos;
layout(location=1) in vec2  i_half;
layout(location=2) in float i_rot;
layout(location=3) in vec4  i_col;
layout(location=4) in vec3  i_shape;   // shape id, p0, p1

uniform vec4 u_cam;        // camX, camY, 1/halfW, 1/halfH

out vec2  v_uv;
out vec4  v_col;
out vec3  v_shape;

void main() {
  // Unit quad from the vertex id — no vertex buffer at all.
  vec2 corner = vec2((gl_VertexID & 1) == 0 ? -1.0 : 1.0,
                     (gl_VertexID & 2) == 0 ? -1.0 : 1.0);
  v_uv = corner;
  v_col = i_col;
  v_shape = i_shape;

  float s = sin(i_rot), c = cos(i_rot);
  vec2 local = corner * i_half;
  vec2 world = i_pos + vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  gl_Position = vec4((world.x - u_cam.x) * u_cam.z, (world.y - u_cam.y) * u_cam.w, 0.0, 1.0);
}`

export const SPRITE_FS = /* glsl */ `#version 300 es
precision highp float;

in vec2  v_uv;
in vec4  v_col;
in vec3  v_shape;
out vec4 o_col;

float hexDist(vec2 p) {
  p = abs(p);
  // flat-top hexagon
  return max(p.x * 0.8660254 + p.y * 0.5, p.y);
}

void main() {
  int   id = int(v_shape.x + 0.5);
  float p0 = v_shape.y;
  float p1 = v_shape.z;
  vec2  uv = v_uv;
  float a  = 0.0;

  if (id == 0) {                                   // DISC — soft radial glow
    float r = length(uv);
    a = pow(max(0.0, 1.0 - r), max(0.35, p0));
  } else if (id == 1) {                            // RING
    float r = length(uv);
    float w = max(0.02, p0);
    a = smoothstep(w, 0.0, abs(r - (1.0 - w))) ;
    a *= smoothstep(1.02, 0.98, r);
  } else if (id == 2) {                            // SHARD — elongated diamond
    float d = abs(uv.x) + abs(uv.y);
    a = smoothstep(1.0, 1.0 - max(0.08, p0), d);
    a += 0.65 * smoothstep(0.55, 0.0, d);          // hot core
  } else if (id == 3) {                            // DART — triangle, +y nose
    float d = max(abs(uv.x) * 1.15 + (uv.y * 0.5 + 0.5) * 0.6 - 0.55, -uv.y - 0.95);
    a = smoothstep(0.06, -0.14, d);
    a += 0.5 * smoothstep(0.0, -0.5, d);
  } else if (id == 4) {                            // CHITIN — hex body + rim
    float h = hexDist(uv);
    float body = smoothstep(0.98, 0.90, h);
    float rim  = smoothstep(0.10, 0.0, abs(h - 0.90));
    float core = pow(max(0.0, 1.0 - length(uv) * 1.55), 2.2);
    a = body * 0.30 + rim * 1.0 + core * (0.55 + p0);
  } else if (id == 5) {                            // SPARK — 4-point flare
    float r = length(uv);
    float cross_ = pow(max(0.0, 1.0 - abs(uv.x) * (7.0 + p0 * 26.0)), 2.0)
                 + pow(max(0.0, 1.0 - abs(uv.y) * (7.0 + p0 * 26.0)), 2.0);
    a = pow(max(0.0, 1.0 - r), 3.0) * 1.35 + cross_ * max(0.0, 1.0 - r) * 0.9;
  } else if (id == 6) {                            // CAPSULE — tracer
    float d = length(vec2(max(abs(uv.x) - (1.0 - p0), 0.0), uv.y * (1.0 / max(0.05, p0))));
    a = smoothstep(1.0, 0.25, d);
    a += 0.8 * smoothstep(0.5, 0.0, d);
  } else if (id == 7) {                            // GEM — rhombus + rim
    float d = abs(uv.x) * 1.0 + abs(uv.y) * 0.78;
    a = smoothstep(0.14, 0.0, abs(d - 0.82)) * 1.2 + smoothstep(0.82, 0.1, d) * 0.55;
  } else {                                         // fallback: square-ish glow
    a = max(0.0, 1.0 - max(abs(uv.x), abs(uv.y)));
  }

  a *= v_col.a;
  if (a <= 0.002) discard;
  // Additive, premultiplied. p1 lifts the whole thing toward white so a
  // "hot" instance blooms without changing hue.
  vec3 rgb = mix(v_col.rgb, vec3(1.0), clamp(p1, 0.0, 1.0));
  o_col = vec4(rgb * a, a);
}`

export const GLYPH_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec2 i_pos;
layout(location=1) in vec2 i_half;
layout(location=2) in vec4 i_uv;     // u0,v0,u1,v1
layout(location=3) in vec4 i_col;
uniform vec4 u_cam;
out vec2 v_uv;
out vec4 v_col;
void main() {
  vec2 corner = vec2((gl_VertexID & 1) == 0 ? -1.0 : 1.0,
                     (gl_VertexID & 2) == 0 ? -1.0 : 1.0);
  v_uv = vec2(mix(i_uv.x, i_uv.z, corner.x * 0.5 + 0.5),
              mix(i_uv.w, i_uv.y, corner.y * 0.5 + 0.5));
  v_col = i_col;
  vec2 world = i_pos + corner * i_half;
  gl_Position = vec4((world.x - u_cam.x) * u_cam.z, (world.y - u_cam.y) * u_cam.w, 0.0, 1.0);
}`

export const GLYPH_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
in vec4 v_col;
uniform sampler2D u_tex;
out vec4 o_col;
void main() {
  float m = texture(u_tex, v_uv).a;
  if (m <= 0.004) discard;
  float a = m * v_col.a;
  o_col = vec4(v_col.rgb * a, a);
}`

/** Fullscreen triangle — no attributes. */
export const FS_TRI_VS = /* glsl */ `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

export const ABYSS_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_col;
uniform vec2  u_res;
uniform vec2  u_cam;
uniform float u_time;
uniform float u_intensity;   // 0..1 how deep the run has gone
uniform float u_scale;       // world units per pixel

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec2 frag = v_uv * u_res;
  vec2 world = (frag - u_res * 0.5) * u_scale + u_cam;

  // Deep water: indigo that warms very slightly as the run escalates.
  vec3 col = mix(vec3(0.016, 0.021, 0.055), vec3(0.045, 0.017, 0.062), u_intensity);

  // Slow caustic sheets, two octaves, drifting in opposite directions.
  float c1 = noise(world * 0.0032 + vec2(u_time * 0.019, -u_time * 0.011));
  float c2 = noise(world * 0.0071 - vec2(u_time * 0.013, u_time * 0.023));
  float caustic = pow(max(0.0, c1 * 0.65 + c2 * 0.5 - 0.44), 2.4);
  col += vec3(0.10, 0.26, 0.42) * caustic * (0.5 + u_intensity * 0.9);

  // The lattice. Two scales, the finer one fading out as you zoom.
  vec2 g = world * 0.0125;
  vec2 gf = abs(fract(g) - 0.5);
  float line = smoothstep(0.5, 0.47, max(gf.x, gf.y));
  col += vec3(0.05, 0.11, 0.20) * line * 0.55;

  vec2 g2 = world * 0.0025;
  vec2 gf2 = abs(fract(g2) - 0.5);
  float line2 = smoothstep(0.5, 0.485, max(gf2.x, gf2.y));
  col += vec3(0.08, 0.16, 0.30) * line2 * 0.7;

  // Marine snow: slow motes drifting through the beam.
  vec2 sp = world * 0.02 + vec2(0.0, u_time * 0.35);
  vec2 si = floor(sp);
  float m = hash(si);
  if (m > 0.986) {
    vec2 sf = fract(sp) - 0.5;
    float d = length(sf);
    col += vec3(0.35, 0.62, 0.85) * pow(max(0.0, 1.0 - d * 3.4), 5.0) * 0.55;
  }

  o_col = vec4(col, 1.0);
}`

export const BRIGHT_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_col;
uniform sampler2D u_tex;
uniform float u_threshold;
void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(0.0, l - u_threshold) / max(0.0001, l);
  o_col = vec4(c * k, 1.0);
}`

export const BLUR_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_col;
uniform sampler2D u_tex;
uniform vec2 u_dir;      // texel step
void main() {
  // 9-tap gaussian folded into 5 bilinear fetches.
  vec3 c = texture(u_tex, v_uv).rgb * 0.2270270270;
  c += texture(u_tex, v_uv + u_dir * 1.3846153846).rgb * 0.3162162162;
  c += texture(u_tex, v_uv - u_dir * 1.3846153846).rgb * 0.3162162162;
  c += texture(u_tex, v_uv + u_dir * 3.2307692308).rgb * 0.0702702703;
  c += texture(u_tex, v_uv - u_dir * 3.2307692308).rgb * 0.0702702703;
  o_col = vec4(c, 1.0);
}`

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_col;
uniform sampler2D u_scene;
uniform sampler2D u_bloom0;
uniform sampler2D u_bloom1;
uniform float u_bloomAmt0;
uniform float u_bloomAmt1;
uniform float u_aberration;
uniform float u_vignette;
uniform vec4  u_flash;      // rgb + strength
uniform float u_time;
uniform float u_desat;      // 1 while the Rift is open

vec3 tonemap(vec3 x) {
  // Filmic-ish. Keeps hue as things blow out instead of going magenta.
  x = max(vec3(0.0), x);
  return (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
}

void main() {
  vec2 uv = v_uv;
  vec2 off = (uv - 0.5) * u_aberration;

  vec3 scene;
  if (u_aberration > 0.0001) {
    scene.r = texture(u_scene, uv + off).r;
    scene.g = texture(u_scene, uv).g;
    scene.b = texture(u_scene, uv - off).b;
  } else {
    scene = texture(u_scene, uv).rgb;
  }

  vec3 bloom = texture(u_bloom0, uv).rgb * u_bloomAmt0
             + texture(u_bloom1, uv).rgb * u_bloomAmt1;

  vec3 col = scene + bloom;
  col = tonemap(col * 1.06);

  // Flash is additive and clamped; the caller rate-limits it.
  col += u_flash.rgb * u_flash.a;

  float r = length((uv - 0.5) * vec2(1.0, 0.92));
  col *= mix(1.0, smoothstep(0.95, 0.28, r), u_vignette);

  if (u_desat > 0.001) {
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, vec3(l) * vec3(0.72, 0.78, 1.05), u_desat);
  }

  // A whisper of grain so flat areas do not band on cheap panels.
  float g = fract(sin(dot(uv * u_time, vec2(12.9898, 78.233))) * 43758.5453);
  col += (g - 0.5) * 0.012;

  o_col = vec4(col, 1.0);
}`

export const STAIN_FADE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_col;
uniform sampler2D u_tex;
uniform float u_fade;
uniform vec2  u_shift;   // camera motion in uv space
void main() {
  vec3 c = texture(u_tex, v_uv + u_shift).rgb;
  o_col = vec4(max(vec3(0.0), c * u_fade - 0.0016), 1.0);
}`
