/**
 * All GLSL for POLARITY.
 *
 * The register is a vector monitor: everything is drawn as a signed-distance
 * shape with an additive halo, so nothing is a sprite and nothing is a texture
 * except the numerals. Polarity is carried on four independent channels at
 * once — SHAPE (diamond vs ring), GLYPH (a cut-out + or −), COLOUR (amber vs
 * cyan) and, on anything big enough to print, the NUMERAL's own sign. Colour is
 * therefore never load-bearing on its own.
 */

export const COMMON = /* glsl */ `
  #define TAU 6.28318530718
  vec3 POS_A = vec3(1.00, 0.80, 0.28);
  vec3 POS_B = vec3(1.00, 0.38, 0.06);
  vec3 NEG_A = vec3(0.22, 0.86, 1.00);
  vec3 NEG_B = vec3(0.44, 0.28, 1.00);
  vec3 NEU_A = vec3(0.80, 0.83, 0.92);

  vec3 polA(float p){ return p > 0.5 ? POS_A : (p < -0.5 ? NEG_A : NEU_A); }
  vec3 polB(float p){ return p > 0.5 ? POS_B : (p < -0.5 ? NEG_B : NEU_A); }

  float sdDiamond(vec2 p){ return abs(p.x) + abs(p.y); }
  float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return min(max(d.x,d.y),0.0) + length(max(d,0.0)); }
  // regular n-gon, returned as a radius-like scalar (compare against a radius)
  float ngon(vec2 p, float n, float rot){
    float a = atan(p.y, p.x) - rot;
    float k = TAU / n;
    float m = mod(a + k * 0.5, k) - k * 0.5;
    return length(p) * cos(m) / cos(k * 0.5);
  }
  float plusMask(vec2 p, float len, float th){
    float a = sdBox(p, vec2(len, th));
    float b = sdBox(p, vec2(th, len));
    return min(a, b);
  }
  float aa(float d, float w){ return 1.0 - smoothstep(-w, w, d); }
  float hash21(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
`;

// ---------------------------------------------------------------------------
// backdrop — a slow, deep, breathing field. Never competes with the bullets.
// ---------------------------------------------------------------------------

export const BACKDROP_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const BACKDROP_FRAG =
  COMMON +
  /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uPol;       // -1..1, smoothed
  uniform float uHeat;      // 0..1 escalation
  uniform float uAspect;
  uniform float uLoad;      // 0..1 core band load
  uniform float uAlive;     // 1 playing, 0 frozen/dead
  uniform float uMotion;    // 0 when prefers-reduced-motion
  uniform vec2 uField;      // playfield half-extent in NDC — the cabinet rails

  void main(){
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0) * 2.0;

    // deep base, pushed very slightly toward the current polarity
    vec3 col = mix(vec3(0.012,0.016,0.036), vec3(0.026,0.014,0.030), uHeat);
    col += polA(uPol) * 0.030 * (0.55 + 0.45 * sin(uTime * 0.35));

    // receding field lines: the floor of the shaft you are flying down
    float t = uTime * (0.06 + 0.05 * uHeat) * uMotion;
    float depth = 1.0 / max(0.06, 1.0 - uv.y * 0.92);
    float rows = fract(depth * 1.1 - t * 3.0);
    float rowLine = smoothstep(0.965, 1.0, rows) * smoothstep(1.0, 0.35, depth * 0.30);
    float cols = abs(fract((uv.x - 0.5) * depth * 5.0 + 0.5) - 0.5);
    float colLine = smoothstep(0.035, 0.0, cols) * smoothstep(1.0, 0.30, depth * 0.30);
    vec3 grid = mix(vec3(0.10,0.34,0.62), polA(uPol), 0.35);
    col += grid * (rowLine * 0.16 + colLine * 0.10);

    // drifting nebula bands
    float n = sin(p.x * 1.7 + uTime * 0.19 * uMotion) * sin(p.y * 1.1 - uTime * 0.13 * uMotion);
    col += polB(uPol) * 0.022 * (0.5 + 0.5 * n);

    // band-load bloom from the bottom: the closer to overload, the hotter the floor
    float floorGlow = smoothstep(0.55, 0.0, uv.y) * uLoad * uLoad;
    col += mix(polA(uPol), vec3(1.0,0.25,0.30), smoothstep(0.7,1.0,uLoad)) * floorGlow * 0.22;

    // static grain keeps the black from banding on cheap panels
    col += (hash21(uv * 900.0 + fract(uTime)) - 0.5) * 0.014;

    // vignette + a dead-run desaturation
    float vig = smoothstep(1.55, 0.30, length(p));
    col *= 0.35 + 0.65 * vig;
    col = mix(vec3(dot(col, vec3(0.33))), col, 0.30 + 0.70 * uAlive);

    // the cabinet: everything outside the playfield falls away, and the rails
    // that bound it glow. On a wide desktop this is what stops the shmup from
    // looking like a stretched phone game.
    vec2 n = abs((vUv - 0.5) * 2.0);
    float outside = max(step(uField.x, n.x), step(uField.y, n.y));
    col *= mix(1.0, 0.30, outside);
    float railX = smoothstep(0.010, 0.0, abs(n.x - uField.x)) * step(n.y, uField.y + 0.02);
    float railY = smoothstep(0.010, 0.0, abs(n.y - uField.y)) * step(n.x, uField.x + 0.02);
    col += mix(vec3(0.35, 0.55, 0.95), polA(uPol), 0.5) * (railX + railY * 0.6) * 0.55;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// bullets
// ---------------------------------------------------------------------------

export const BULLET_VERT = /* glsl */ `
  attribute vec2 iPos;
  attribute float iSize;
  attribute float iRot;
  attribute float iKind;
  attribute float iPol;
  attribute float iPull;
  attribute float iGrow;
  varying vec2 vP;
  varying float vKind;
  varying float vPol;
  varying float vPull;
  varying float vAA;
  uniform float uBoost;
  uniform float uPx;
  void main(){
    vP = position.xy * 2.0;
    vKind = iKind;
    vPol = iPol;
    vPull = iPull;
    float s = iSize * uBoost * (1.0 + iGrow * 0.55) * (1.0 + iPull * 0.22);
    vAA = clamp(uPx / max(0.001, s), 0.004, 0.9);
    float c = cos(iRot), sn = sin(iRot);
    vec2 q = vec2(position.x * c - position.y * sn, position.x * sn + position.y * c);
    // halo needs room outside the body
    gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos + q * s * 3.0, 0.0, 1.0);
  }
`;

export const BULLET_FRAG =
  COMMON +
  /* glsl */ `
  varying vec2 vP;
  varying float vKind;
  varying float vPol;
  varying float vPull;
  varying float vAA;

  void main(){
    vec2 p = vP * 1.5;              // body occupies |p| < 1
    float r = length(p);
    if (r > 3.0) discard;
    float w = max(0.012, vAA * 1.6);

    vec3 A = polA(vPol);
    vec3 B = polB(vPol);
    float body = 0.0;
    float glyph = 0.0;
    float rim = 0.0;

    if (vKind < 0.5) {
      // CHAFF — polarity decides the silhouette outright
      if (vPol > 0.0) {
        float d = sdDiamond(p) - 0.95;
        body = aa(d, w);
        rim  = aa(abs(d) - 0.10, w);
        glyph = aa(plusMask(p, 0.44, 0.13), w);
      } else {
        float d = abs(r - 0.72) - 0.26;
        body = aa(d, w);
        rim  = aa(abs(r - 0.98) - 0.06, w);
        glyph = aa(sdBox(p, vec2(0.40, 0.11)), w);
      }
    } else if (vKind < 1.5) {
      // CHARGE — a heavy plate that carries a printed numeral
      float d = (vPol > 0.0) ? (ngon(p, 4.0, 0.785) - 0.92) : (r - 0.92);
      body = aa(d, w) * 0.80;
      rim  = aa(abs(d) - 0.10, w);
    } else if (vKind < 2.5) {
      // SEAL ORB — big, slow, unmistakable, with a counter-rotating collar
      float d = (vPol > 0.0) ? (ngon(p, 6.0, 0.0) - 0.86) : (r - 0.86);
      body = aa(d, w) * 0.68;
      rim  = aa(abs(d) - 0.075, w) * 1.4;
      float coll = abs(r - 1.16) - 0.045;
      rim += aa(coll, w) * (0.5 + 0.5 * sin(atan(p.y, p.x) * 8.0));
    } else if (vKind < 3.5) {
      // PLAYER SHOT — a hot little bolt
      float d = sdBox(p, vec2(0.16, 0.62)) - 0.12;
      body = aa(d, w);
      rim = body;
    } else if (vKind < 4.5) {
      // DART — released charge, seeking
      float d = ngon(p, 3.0, -1.5708) - 0.86;
      body = aa(d, w);
      rim = aa(abs(d) - 0.09, w);
    } else {
      // LANCE — a fast needle
      float d = sdBox(p, vec2(0.14, 0.95)) - 0.08;
      body = aa(d, w);
      rim = aa(abs(d) - 0.07, w);
    }

    float halo = exp(-max(0.0, r - 0.9) * 2.6) * 0.55;
    vec3 col = B * body * 0.9 + A * rim * 1.5 + A * halo * (0.5 + vPull);
    col += vec3(1.0) * glyph * 1.25;
    col += A * vPull * 0.7 * body;

    float a = clamp(max(max(body, rim * 1.1), halo) + glyph, 0.0, 1.0);
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, a);
  }
`;

// ---------------------------------------------------------------------------
// enemies
// ---------------------------------------------------------------------------

export const ENEMY_VERT = /* glsl */ `
  attribute vec2 iPos;
  attribute float iSize;
  attribute float iRot;
  attribute float iKind;
  attribute float iPol;
  attribute float iFlash;
  attribute float iHp;
  varying vec2 vP;
  varying float vKind;
  varying float vPol;
  varying float vFlash;
  varying float vHp;
  varying float vAA;
  uniform float uPx;
  void main(){
    vP = position.xy * 2.0;
    vKind = iKind; vPol = iPol; vFlash = iFlash; vHp = iHp;
    vAA = clamp(uPx / max(0.001, iSize), 0.003, 0.6);
    float c = cos(iRot), sn = sin(iRot);
    vec2 q = vec2(position.x * c - position.y * sn, position.x * sn + position.y * c);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos + q * iSize * 3.0, 0.0, 1.0);
  }
`;

export const ENEMY_FRAG =
  COMMON +
  /* glsl */ `
  varying vec2 vP;
  varying float vKind;
  varying float vPol;
  varying float vFlash;
  varying float vHp;
  varying float vAA;
  uniform float uTime;

  void main(){
    vec2 p = vP * 1.5;
    float r = length(p);
    if (r > 2.4) discard;
    float w = max(0.010, vAA * 1.5);
    vec3 A = polA(vPol);
    vec3 B = polB(vPol);

    float shell = 0.0, core = 0.0, mark = 0.0;
    if (vKind < 0.5) {                       // MOTE
      float d = ngon(p, 3.0, 1.5708) - 0.86;
      shell = aa(abs(d) - 0.10, w); core = aa(d + 0.30, w) * 0.5;
    } else if (vKind < 1.5) {                // WEAVER
      float d = ngon(p, 3.0, -1.5708) - 0.92;
      shell = aa(abs(d) - 0.09, w);
      core = aa(ngon(p, 3.0, -1.5708) - 0.42, w) * 0.7;
    } else if (vKind < 2.5) {                // SPINNER
      float d = abs(ngon(p, 6.0, 0.0) - 0.80) - 0.10;
      shell = aa(d, w);
      mark = aa(abs(ngon(p, 3.0, uTime) - 0.34) - 0.07, w);
    } else if (vKind < 3.5) {                // BATTERY
      float o = ngon(p, 6.0, 0.5236) - 0.94;
      shell = aa(abs(o) - 0.12, w);
      core = aa(ngon(p, 6.0, 0.5236) - 0.50, w) * 0.85;
      mark = aa(sdBox(p, vec2(0.44, 0.055)), w);
    } else if (vKind < 4.5) {                // LANCER
      float d = ngon(vec2(p.x * 1.7, p.y), 3.0, -1.5708) - 0.95;
      shell = aa(abs(d) - 0.10, w); core = aa(d + 0.35, w) * 0.6;
    } else if (vKind < 5.5) {                // BEARER
      float o = ngon(p, 6.0, 0.0) - 0.94;
      shell = aa(abs(o) - 0.085, w);
      float ring2 = abs(r - 0.62) - 0.05;
      shell += aa(ring2, w) * 0.8;
      mark = aa(abs(ngon(p, 3.0, -uTime * 0.7) - 0.34) - 0.06, w);
    } else {                                  // WARDEN
      float o = ngon(p, 8.0, 0.0) - 1.0;
      shell = aa(abs(o) - 0.075, w);
      shell += aa(abs(ngon(p, 4.0, uTime * 0.4) - 0.70) - 0.045, w) * 0.9;
      shell += aa(abs(r - 0.34) - 0.05, w);
      mark = aa(plusMask(p, 0.22, 0.055), w) * step(0.0, vPol);
    }

    // damage: the hull darkens and the seams glow as hp drops
    float hurt = 1.0 - vHp;
    vec3 col = A * shell * (1.3 + hurt * 0.9) + B * core * 0.55 + vec3(1.0) * mark * 0.9;
    col += mix(vec3(0.0), vec3(1.0, 0.35, 0.32), hurt * 0.5) * shell * 0.5;
    col += vec3(1.0) * vFlash * (shell + core) * 1.8;
    float halo = exp(-max(0.0, r - 0.95) * 3.0) * 0.30;
    col += A * halo;

    float a = clamp(max(max(shell, core * 0.9), mark) + halo + vFlash * 0.3, 0.0, 1.0);
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, a);
  }
`;

// ---------------------------------------------------------------------------
// particles
// ---------------------------------------------------------------------------

export const PART_VERT = /* glsl */ `
  attribute vec2 iPos;
  attribute float iSize;
  attribute float iSize2;
  attribute vec3 iCol;
  attribute float iAlpha;
  attribute float iRot;
  attribute float iKind;
  attribute float iT;
  varying vec2 vP;
  varying vec3 vCol;
  varying float vAlpha;
  varying float vKind;
  varying float vT;
  varying float vRatio;
  void main(){
    vP = position.xy * 2.0;
    vCol = iCol; vAlpha = iAlpha; vKind = iKind; vT = iT;
    float s = iSize;
    vRatio = 1.0;
    if (iKind > 1.5 && iKind < 2.5) { s = iSize + iSize2; vRatio = iSize2 / max(0.001, s); }
    float c = cos(iRot), sn = sin(iRot);
    vec2 q = vec2(position.x * c - position.y * sn, position.x * sn + position.y * c);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos + q * s * 3.2, 0.0, 1.0);
  }
`;

export const PART_FRAG =
  COMMON +
  /* glsl */ `
  varying vec2 vP;
  varying vec3 vCol;
  varying float vAlpha;
  varying float vKind;
  varying float vT;
  varying float vRatio;
  void main(){
    vec2 p = vP * 1.6;
    float r = length(p);
    float a;
    if (vKind < 0.5) {
      a = exp(-r * r * 3.4);
    } else if (vKind < 1.5) {
      // shard: a stretched sliver that shortens as it dies
      float d = abs(p.y) * (2.6 + vT * 6.0) + abs(p.x) * 0.55;
      a = exp(-d * d * 1.6) * exp(-r * 0.8);
    } else if (vKind < 2.5) {
      // ring: expands and thins
      float rr = mix(0.20, 1.0, vT);
      float th = max(0.03, vRatio * (1.0 - vT) * 0.9);
      a = exp(-pow(abs(r - rr) / th, 2.0));
    } else {
      float d = abs(p.x) * 6.0 + abs(p.y) * 0.5;
      a = exp(-d * d);
    }
    a *= vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vCol * (0.75 + a * 0.9), a);
  }
`;

// ---------------------------------------------------------------------------
// numerals
// ---------------------------------------------------------------------------

export const LABEL_VERT = /* glsl */ `
  attribute vec2 iPos;
  attribute float iSize;
  attribute float iTile;
  attribute float iAlpha;
  attribute vec3 iCol;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vCol;
  uniform vec2 uGrid;
  // Cells are wider than they are tall, so a four-digit answer is drawn WIDE
  // rather than squeezed: iSize is the numeral's height, always.
  uniform float uAspect;
  void main(){
    float col = mod(iTile, uGrid.x);
    float row = floor(iTile / uGrid.x);
    vUv = (uv + vec2(col, uGrid.y - 1.0 - row)) / uGrid;
    vAlpha = iAlpha; vCol = iCol;
    vec2 quad = position.xy * vec2(iSize * uAspect, iSize);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos + quad, 0.0, 1.0);
  }
`;

export const LABEL_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vCol;
  uniform sampler2D uMap;
  void main(){
    vec4 t = texture2D(uMap, vUv);
    float a = t.a * vAlpha;
    if (a < 0.005) discard;
    // the baked dark rim stays dark; the face takes the instance tint
    vec3 col = mix(vec3(0.0), vCol, t.r);
    gl_FragColor = vec4(col, a);
  }
`;

// ---------------------------------------------------------------------------
// player
// ---------------------------------------------------------------------------

export const PLAYER_VERT = /* glsl */ `
  varying vec2 vP;
  uniform vec2 uPos;
  uniform float uScale;
  void main(){
    vP = position.xy * 2.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(uPos + position.xy * uScale, 0.0, 1.0);
  }
`;

export const PLAYER_FRAG =
  COMMON +
  /* glsl */ `
  varying vec2 vP;
  uniform float uPol;      // -1..1 morph
  uniform float uPx;
  uniform float uTime;
  uniform float uInvuln;
  uniform float uAura;     // absorb radius in local units
  uniform float uLoad;     // 0..1
  uniform float uRecoil;
  uniform float uStun;
  uniform float uAlive;

  void main(){
    vec2 p = vP * 1.5;
    float r = length(p);
    float w = max(0.02, uPx * 1.4);
    vec3 A = polA(uPol > 0.0 ? 1.0 : -1.0);
    vec3 B = polB(uPol > 0.0 ? 1.0 : -1.0);
    vec3 col = vec3(0.0);
    float a = 0.0;

    // --- absorb aura: the exact reach of the magnet, so it is never a mystery
    float ring = abs(r - uAura) - (0.010 + 0.006 * sin(uTime * 4.0));
    float aur = aa(ring, w * 1.6);
    float pulse = 0.35 + 0.30 * sin(uTime * 3.2 - r * 12.0);
    col += A * aur * pulse * 1.5 * uAlive;
    a = max(a, aur * 0.55 * uAlive);
    // dashes around the aura so it reads without relying on colour
    float ang = atan(p.y, p.x);
    float dash = step(0.45, fract(ang / TAU * 18.0 + uTime * 0.10));
    col += A * aur * dash * 0.9 * uAlive;

    // --- hull: a wedge that inverts with polarity
    float sc = 1.0 / (0.16 + 0.02 * uRecoil);
    vec2 q = p * sc;
    float wedge = ngon(vec2(q.x * 0.86, q.y), 3.0, 1.5708) - 1.0;
    float hull = aa(wedge, w * sc);
    float edge = aa(abs(wedge) - 0.13, w * sc);
    float fillAmt = uPol > 0.0 ? 1.0 : 0.16;   // positive is solid, negative is hollow
    col += B * hull * fillAmt * 0.85;
    col += A * edge * 2.1;

    // sign cut into the hull
    float g = uPol > 0.0 ? plusMask(q, 0.42, 0.13) : sdBox(q, vec2(0.40, 0.12));
    float glyph = aa(g, w * sc) * step(wedge, 0.0);
    col += vec3(1.0) * glyph * 1.5;
    a = max(a, max(hull * max(fillAmt, 0.55), max(edge, glyph)));

    // --- the lethal dot: always drawn, never a mystery
    float dot_ = aa(r - 0.036, w * 0.9);
    col += mix(vec3(1.0), vec3(1.0, 0.30, 0.34), uLoad) * dot_ * 2.6;
    a = max(a, dot_);

    // --- state overlays
    float flick = uInvuln > 0.0 ? (0.35 + 0.65 * step(0.5, fract(uTime * 9.0))) : 1.0;
    float stunRing = uStun > 0.0 ? aa(abs(r - 0.20 - 0.05 * sin(uTime * 22.0)) - 0.012, w) : 0.0;
    col += vec3(1.0, 0.28, 0.30) * stunRing * 2.0;
    a = max(a, stunRing);

    col *= flick;
    a *= flick;
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`;

// ---------------------------------------------------------------------------
// shockwaves
// ---------------------------------------------------------------------------

export const WAVE_VERT = /* glsl */ `
  attribute vec2 iPos;
  attribute float iT;
  attribute float iStrength;
  attribute float iPol;
  varying vec2 vP;
  varying float vT;
  varying float vS;
  varying float vPol;
  void main(){
    vP = position.xy * 2.0;
    vT = iT; vS = iStrength; vPol = iPol;
    float s = (4.0 + iT * 90.0 * iStrength);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos + position.xy * s, 0.0, 1.0);
  }
`;

export const WAVE_FRAG =
  COMMON +
  /* glsl */ `
  varying vec2 vP;
  varying float vT;
  varying float vS;
  varying float vPol;
  void main(){
    float r = length(vP);
    float th = mix(0.16, 0.02, vT);
    float a = exp(-pow(abs(r - 0.92) / th, 2.0)) * (1.0 - vT) * (1.0 - vT);
    // a second, offset ring gives the wave a chromatic leading edge
    float a2 = exp(-pow(abs(r - 0.86) / (th * 1.6), 2.0)) * (1.0 - vT) * 0.5;
    vec3 col = polA(vPol) * a + polB(vPol) * a2;
    float al = clamp(a + a2, 0.0, 1.0) * 0.9 * vS;
    if (al < 0.004) discard;
    gl_FragColor = vec4(col, al);
  }
`;

// ---------------------------------------------------------------------------
// foreground composite (flash, scanline, edge burn) — one full-screen quad
// ---------------------------------------------------------------------------

export const FRONT_VERT = BACKDROP_VERT;

export const FRONT_FRAG =
  COMMON +
  /* glsl */ `
  varying vec2 vUv;
  uniform float uFlash;
  uniform vec3 uFlashCol;
  uniform float uTime;
  uniform float uLoad;
  uniform float uScan;
  uniform float uAspect;
  void main(){
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
    vec3 col = uFlashCol * uFlash;
    // overload pressure burns in from the frame edge — readable without colour
    float edge = smoothstep(0.55, 1.5, length(p));
    col += mix(vec3(0.25,0.45,1.0), vec3(1.0,0.22,0.26), smoothstep(0.6,1.0,uLoad))
         * edge * uLoad * uLoad * 0.34 * (0.75 + 0.25 * sin(uTime * (4.0 + uLoad * 12.0)));
    float scan = (0.5 + 0.5 * sin(vUv.y * 900.0)) * uScan * 0.035;
    col += vec3(scan) * 0.5;
    float a = clamp(max(uFlash, max(edge * uLoad * uLoad * 0.34, scan)), 0.0, 1.0);
    if (a < 0.003) discard;
    gl_FragColor = vec4(col, a);
  }
`;

// ---------------------------------------------------------------------------
// final grade (mid + ultra): chromatic aberration, grain, soft vignette
// ---------------------------------------------------------------------------

export const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as unknown },
    uAmount: { value: 0 },
    uTime: { value: 0 },
    uGrain: { value: 0.05 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader:
    COMMON +
    /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uTime;
    uniform float uGrain;
    void main(){
      vec2 c = vUv - 0.5;
      float k = uAmount * 0.006 * (0.3 + dot(c, c) * 3.0);
      vec4 col;
      col.r = texture2D(tDiffuse, vUv + c * k).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - c * k).b;
      col.a = 1.0;
      col.rgb += (hash21(vUv * 1024.0 + fract(uTime * 7.0)) - 0.5) * uGrain;
      col.rgb *= 0.72 + 0.28 * smoothstep(1.25, 0.25, length(c) * 2.0);
      gl_FragColor = col;
    }
  `,
};
