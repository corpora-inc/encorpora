/**
 * The renderer. One instanced-quad pipeline draws every enemy, projectile,
 * particle, gem and glyph in two draw calls; a persistent stain buffer keeps
 * the bioluminescent spill where the horde died; bloom does the rest.
 *
 * Nothing here allocates after `resize`. `sprite()` and `glyph()` write
 * straight into a preallocated Float32Array.
 */
import { buildAtlas, type Atlas } from "./glyphs.ts"
import {
  ABYSS_FS, BLUR_FS, BRIGHT_FS, COMPOSITE_FS, FS_TRI_VS,
  GLYPH_FS, GLYPH_VS, SPRITE_FS, SPRITE_VS, STAIN_FADE_FS,
} from "./shaders.ts"

export const SHAPE = {
  DISC: 0, RING: 1, SHARD: 2, DART: 3, CHITIN: 4, SPARK: 5, CAPSULE: 6, GEM: 7,
} as const

const SPRITE_STRIDE = 12 // x y hw hh rot r g b a shape p0 p1
const GLYPH_STRIDE = 12 // x y hw hh u0 v0 u1 v1 r g b a

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s)
    console.error("[horde] shader compile failed:", log, "\n", src.slice(0, 400))
    throw new Error(`horde: shader compile failed: ${log}`)
  }
  return s
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p)
    console.error("[horde] program link failed:", log)
    throw new Error(`horde: program link failed: ${log}`)
  }
  return p
}

type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }

export class Renderer {
  readonly gl: WebGL2RenderingContext
  readonly canvas: HTMLCanvasElement
  private atlas: Atlas
  private atlasTex!: WebGLTexture

  private pSprite!: WebGLProgram
  private pGlyph!: WebGLProgram
  private pAbyss!: WebGLProgram
  private pBright!: WebGLProgram
  private pBlur!: WebGLProgram
  private pComposite!: WebGLProgram
  private pStainFade!: WebGLProgram
  private pBlit!: WebGLProgram

  private uni = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>()

  private vaoSprite!: WebGLVertexArrayObject
  private vboSprite!: WebGLBuffer
  private vaoGlyph!: WebGLVertexArrayObject
  private vboGlyph!: WebGLBuffer
  private vaoEmpty!: WebGLVertexArrayObject

  private spriteData!: Float32Array
  private glyphData!: Float32Array
  private spriteN = 0
  private glyphN = 0
  private spriteCap = 0
  private glyphCap = 0

  /** Stain deposits are written into their own slice of the sprite array. */
  private stainData!: Float32Array
  private stainN = 0

  private scene!: Target
  private b0!: Target
  private b1!: Target
  private b2!: Target
  private b3!: Target
  private stainA!: Target
  private stainB!: Target

  private floatOk = false
  bloomOctaves = 2
  stainEnabled = true

  // camera
  camX = 0
  camY = 0
  halfW = 640
  halfH = 360
  private prevCamX = 0
  private prevCamY = 0

  w = 1
  h = 1
  dpr = 1

  constructor(canvas: HTMLCanvasElement, maxInstances: number) {
    this.canvas = canvas
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      desynchronized: true,
    })
    if (!gl) throw new Error("horde: WebGL2 is required")
    this.gl = gl
    this.floatOk = !!gl.getExtension("EXT_color_buffer_float")
    gl.getExtension("OES_texture_float_linear")

    this.pSprite = link(gl, SPRITE_VS, SPRITE_FS)
    this.pGlyph = link(gl, GLYPH_VS, GLYPH_FS)
    this.pAbyss = link(gl, FS_TRI_VS, ABYSS_FS)
    this.pBright = link(gl, FS_TRI_VS, BRIGHT_FS)
    this.pBlur = link(gl, FS_TRI_VS, BLUR_FS)
    this.pComposite = link(gl, FS_TRI_VS, COMPOSITE_FS)
    this.pStainFade = link(gl, FS_TRI_VS, STAIN_FADE_FS)
    this.pBlit = link(gl, FS_TRI_VS, `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o_col; uniform sampler2D u_tex;
void main(){ vec3 c = texture(u_tex, v_uv).rgb; o_col = vec4(c, 1.0); }`)

    this.atlas = buildAtlas()
    this.atlasTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas.canvas)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    this.vaoEmpty = gl.createVertexArray()!
    this.setCapacity(maxInstances)

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
    gl.enable(gl.BLEND)
  }

  /** Re-sizes the instance arrays. Called on boot and on a tier change only. */
  setCapacity(maxInstances: number): void {
    const gl = this.gl
    this.spriteCap = maxInstances
    this.glyphCap = Math.max(512, Math.floor(maxInstances * 0.22))
    this.spriteData = new Float32Array(this.spriteCap * SPRITE_STRIDE)
    this.stainData = new Float32Array(Math.max(256, Math.floor(this.spriteCap * 0.18)) * SPRITE_STRIDE)
    this.glyphData = new Float32Array(this.glyphCap * GLYPH_STRIDE)

    if (!this.vboSprite) {
      this.vboSprite = gl.createBuffer()!
      this.vaoSprite = gl.createVertexArray()!
      this.vboGlyph = gl.createBuffer()!
      this.vaoGlyph = gl.createVertexArray()!
    }

    gl.bindVertexArray(this.vaoSprite)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboSprite)
    gl.bufferData(gl.ARRAY_BUFFER, this.spriteData.byteLength, gl.DYNAMIC_DRAW)
    const S = SPRITE_STRIDE * 4
    const attr = (loc: number, n: number, off: number) => {
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, S, off * 4)
      gl.vertexAttribDivisor(loc, 1)
    }
    attr(0, 2, 0); attr(1, 2, 2); attr(2, 1, 4); attr(3, 4, 5); attr(4, 3, 9)

    gl.bindVertexArray(this.vaoGlyph)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboGlyph)
    gl.bufferData(gl.ARRAY_BUFFER, this.glyphData.byteLength, gl.DYNAMIC_DRAW)
    const G = GLYPH_STRIDE * 4
    const gattr = (loc: number, n: number, off: number) => {
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, G, off * 4)
      gl.vertexAttribDivisor(loc, 1)
    }
    gattr(0, 2, 0); gattr(1, 2, 2); gattr(2, 4, 4); gattr(3, 4, 8)
    gl.bindVertexArray(null)
  }

  private makeTarget(w: number, h: number, hdr: boolean): Target {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    const useF = hdr && this.floatOk
    gl.texImage2D(
      gl.TEXTURE_2D, 0, useF ? gl.RGBA16F : gl.RGBA, Math.max(1, w), Math.max(1, h), 0,
      gl.RGBA, useF ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { fb, tex, w: Math.max(1, w), h: Math.max(1, h) }
  }

  private free(t: Target | undefined): void {
    if (!t) return
    this.gl.deleteFramebuffer(t.fb)
    this.gl.deleteTexture(t.tex)
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    const w = Math.max(2, Math.round(cssW * dpr))
    const h = Math.max(2, Math.round(cssH * dpr))
    if (w === this.w && h === this.h && dpr === this.dpr) return
    this.w = w
    this.h = h
    this.dpr = dpr
    this.canvas.width = w
    this.canvas.height = h
    this.canvas.style.width = `${cssW}px`
    this.canvas.style.height = `${cssH}px`

    for (const t of [this.scene, this.b0, this.b1, this.b2, this.b3, this.stainA, this.stainB]) this.free(t)
    this.scene = this.makeTarget(w, h, true)
    const hw = Math.max(2, w >> 1)
    const hh = Math.max(2, h >> 1)
    this.b0 = this.makeTarget(hw, hh, true)
    this.b1 = this.makeTarget(hw, hh, true)
    this.b2 = this.makeTarget(Math.max(2, w >> 2), Math.max(2, h >> 2), true)
    this.b3 = this.makeTarget(Math.max(2, w >> 2), Math.max(2, h >> 2), true)
    this.stainA = this.makeTarget(Math.max(2, w >> 1), Math.max(2, h >> 1), true)
    this.stainB = this.makeTarget(Math.max(2, w >> 1), Math.max(2, h >> 1), true)
    // Clear the fresh stain buffers so garbage never blooms on the first frame.
    const gl = this.gl
    for (const t of [this.stainA, this.stainB]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /* ------------------------------------------------------------- writing */

  beginFrame(camX: number, camY: number, halfW: number, halfH: number): void {
    this.prevCamX = this.camX
    this.prevCamY = this.camY
    this.camX = camX
    this.camY = camY
    this.halfW = halfW
    this.halfH = halfH
    this.spriteN = 0
    this.glyphN = 0
    this.stainN = 0
  }

  get spriteCount(): number {
    return this.spriteN
  }

  sprite(
    x: number, y: number, hw: number, hh: number, rot: number,
    r: number, g: number, b: number, a: number,
    shape: number, p0 = 1, p1 = 0,
  ): void {
    if (this.spriteN >= this.spriteCap) return
    const d = this.spriteData
    let i = this.spriteN * SPRITE_STRIDE
    d[i++] = x; d[i++] = y; d[i++] = hw; d[i++] = hh; d[i++] = rot
    d[i++] = r; d[i++] = g; d[i++] = b; d[i++] = a
    d[i++] = shape; d[i++] = p0; d[i] = p1
    this.spriteN++
  }

  /** A permanent-ish deposit of light in the world where something died. */
  stain(x: number, y: number, rad: number, r: number, g: number, b: number, a: number): void {
    if (!this.stainEnabled) return
    const cap = this.stainData.length / SPRITE_STRIDE
    if (this.stainN >= cap) return
    const d = this.stainData
    let i = this.stainN * SPRITE_STRIDE
    d[i++] = x; d[i++] = y; d[i++] = rad; d[i++] = rad; d[i++] = 0
    d[i++] = r; d[i++] = g; d[i++] = b; d[i++] = a
    d[i++] = SHAPE.DISC; d[i++] = 1.6; d[i] = 0
    this.stainN++
  }

  /** @returns the width drawn, in world units. */
  text(
    s: string, x: number, y: number, size: number,
    r: number, g: number, b: number, a: number, centred = true,
  ): number {
    const m = this.atlas.metrics
    let total = 0
    for (let i = 0; i < s.length; i++) {
      const gm = m.get(s[i])
      total += gm ? gm.aw * size : size * 0.5
    }
    let cx = centred ? x - total / 2 : x
    for (let i = 0; i < s.length; i++) {
      const gm = m.get(s[i])
      if (!gm) { cx += size * 0.5; continue }
      const adv = gm.aw * size
      if (this.glyphN < this.glyphCap && s[i] !== " ") {
        const d = this.glyphData
        let k = this.glyphN * GLYPH_STRIDE
        // The cell is square; centre the glyph on its advance box.
        d[k++] = cx + adv / 2; d[k++] = y; d[k++] = size * 0.72; d[k++] = size * 0.72
        d[k++] = gm.u0; d[k++] = gm.v0; d[k++] = gm.u1; d[k++] = gm.v1
        d[k++] = r; d[k++] = g; d[k++] = b; d[k] = a
        this.glyphN++
      }
      cx += adv
    }
    return total
  }

  measure(s: string, size: number): number {
    const m = this.atlas.metrics
    let total = 0
    for (let i = 0; i < s.length; i++) {
      const gm = m.get(s[i])
      total += gm ? gm.aw * size : size * 0.5
    }
    return total
  }

  /* ------------------------------------------------------------- drawing */

  private u(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = this.uni.get(p)
    if (!m) { m = new Map(); this.uni.set(p, m) }
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name))
    return m.get(name)!
  }

  private fsPass(prog: WebGLProgram, target: Target | null): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null)
    gl.viewport(0, 0, target ? target.w : this.w, target ? target.h : this.h)
    gl.useProgram(prog)
    gl.bindVertexArray(this.vaoEmpty)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private bindTex(prog: WebGLProgram, name: string, tex: WebGLTexture, unit: number): void {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(this.u(prog, name), unit)
  }

  endFrame(opts: {
    time: number
    intensity: number
    flashR: number; flashG: number; flashB: number; flashA: number
    aberration: number
    vignette: number
    desat: number
    bloom: number
  }): void {
    const gl = this.gl
    const camVec = [this.camX, this.camY, 1 / this.halfW, 1 / this.halfH] as const

    /* --- 1. stain: fade + world-lock shift, ping-pong ------------------- */
    if (this.stainEnabled) {
      const dxUv = ((this.camX - this.prevCamX) / (this.halfW * 2))
      const dyUv = -((this.camY - this.prevCamY) / (this.halfH * 2))
      gl.disable(gl.BLEND)
      gl.useProgram(this.pStainFade)
      this.bindTex(this.pStainFade, "u_tex", this.stainA.tex, 0)
      gl.uniform1f(this.u(this.pStainFade, "u_fade"), 0.968)
      gl.uniform2f(this.u(this.pStainFade, "u_shift"), dxUv, dyUv)
      this.fsPass(this.pStainFade, this.stainB)
      const t = this.stainA; this.stainA = this.stainB; this.stainB = t

      if (this.stainN > 0) {
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.stainA.fb)
        gl.viewport(0, 0, this.stainA.w, this.stainA.h)
        gl.useProgram(this.pSprite)
        gl.uniform4f(this.u(this.pSprite, "u_cam"), camVec[0], camVec[1], camVec[2], camVec[3])
        gl.bindVertexArray(this.vaoSprite)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vboSprite)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.stainData, 0, this.stainN * SPRITE_STRIDE)
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.stainN)
      }
    }

    /* --- 2. background -------------------------------------------------- */
    gl.disable(gl.BLEND)
    gl.useProgram(this.pAbyss)
    gl.uniform2f(this.u(this.pAbyss, "u_res"), this.w, this.h)
    gl.uniform2f(this.u(this.pAbyss, "u_cam"), this.camX, this.camY)
    gl.uniform1f(this.u(this.pAbyss, "u_time"), opts.time)
    gl.uniform1f(this.u(this.pAbyss, "u_intensity"), opts.intensity)
    gl.uniform1f(this.u(this.pAbyss, "u_scale"), (this.halfW * 2) / this.w)
    this.fsPass(this.pAbyss, this.scene)

    /* --- 3. stain into the scene ---------------------------------------- */
    if (this.stainEnabled) {
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE)
      gl.useProgram(this.pBlit)
      this.bindTex(this.pBlit, "u_tex", this.stainA.tex, 0)
      this.fsPass(this.pBlit, this.scene)
    }

    /* --- 4. sprites ------------------------------------------------------ */
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb)
    gl.viewport(0, 0, this.scene.w, this.scene.h)
    if (this.spriteN > 0) {
      gl.useProgram(this.pSprite)
      gl.uniform4f(this.u(this.pSprite, "u_cam"), camVec[0], camVec[1], camVec[2], camVec[3])
      gl.bindVertexArray(this.vaoSprite)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vboSprite)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.spriteData, 0, this.spriteN * SPRITE_STRIDE)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.spriteN)
    }

    /* --- 5. glyphs ------------------------------------------------------- */
    if (this.glyphN > 0) {
      gl.useProgram(this.pGlyph)
      gl.uniform4f(this.u(this.pGlyph, "u_cam"), camVec[0], camVec[1], camVec[2], camVec[3])
      this.bindTex(this.pGlyph, "u_tex", this.atlasTex, 0)
      gl.bindVertexArray(this.vaoGlyph)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vboGlyph)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glyphData, 0, this.glyphN * GLYPH_STRIDE)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.glyphN)
    }

    /* --- 6. bloom -------------------------------------------------------- */
    gl.disable(gl.BLEND)
    let amt0 = 0
    let amt1 = 0
    if (this.bloomOctaves >= 1) {
      gl.useProgram(this.pBright)
      this.bindTex(this.pBright, "u_tex", this.scene.tex, 0)
      gl.uniform1f(this.u(this.pBright, "u_threshold"), 0.42)
      this.fsPass(this.pBright, this.b0)

      gl.useProgram(this.pBlur)
      this.bindTex(this.pBlur, "u_tex", this.b0.tex, 0)
      gl.uniform2f(this.u(this.pBlur, "u_dir"), 1 / this.b0.w, 0)
      this.fsPass(this.pBlur, this.b1)
      this.bindTex(this.pBlur, "u_tex", this.b1.tex, 0)
      gl.uniform2f(this.u(this.pBlur, "u_dir"), 0, 1 / this.b0.h)
      this.fsPass(this.pBlur, this.b0)
      amt0 = 0.95 * opts.bloom

      if (this.bloomOctaves >= 2) {
        gl.useProgram(this.pBlit)
        this.bindTex(this.pBlit, "u_tex", this.b0.tex, 0)
        this.fsPass(this.pBlit, this.b2)
        gl.useProgram(this.pBlur)
        this.bindTex(this.pBlur, "u_tex", this.b2.tex, 0)
        gl.uniform2f(this.u(this.pBlur, "u_dir"), 2.4 / this.b2.w, 0)
        this.fsPass(this.pBlur, this.b3)
        this.bindTex(this.pBlur, "u_tex", this.b3.tex, 0)
        gl.uniform2f(this.u(this.pBlur, "u_dir"), 0, 2.4 / this.b2.h)
        this.fsPass(this.pBlur, this.b2)
        amt1 = 0.75 * opts.bloom
      }
    }

    /* --- 7. composite ---------------------------------------------------- */
    const P = this.pComposite
    gl.useProgram(P)
    this.bindTex(P, "u_scene", this.scene.tex, 0)
    this.bindTex(P, "u_bloom0", (this.bloomOctaves >= 1 ? this.b0 : this.scene).tex, 1)
    this.bindTex(P, "u_bloom1", (this.bloomOctaves >= 2 ? this.b2 : this.scene).tex, 2)
    gl.uniform1f(this.u(P, "u_bloomAmt0"), amt0)
    gl.uniform1f(this.u(P, "u_bloomAmt1"), amt1)
    gl.uniform1f(this.u(P, "u_aberration"), opts.aberration)
    gl.uniform1f(this.u(P, "u_vignette"), opts.vignette)
    gl.uniform4f(this.u(P, "u_flash"), opts.flashR, opts.flashG, opts.flashB, opts.flashA)
    gl.uniform1f(this.u(P, "u_time"), opts.time)
    gl.uniform1f(this.u(P, "u_desat"), opts.desat)
    this.fsPass(P, null)
    gl.bindVertexArray(null)
  }

  clearStain(): void {
    const gl = this.gl
    for (const t of [this.stainA, this.stainB]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  destroy(): void {
    const gl = this.gl
    for (const t of [this.scene, this.b0, this.b1, this.b2, this.b3, this.stainA, this.stainB]) this.free(t)
    gl.deleteBuffer(this.vboSprite)
    gl.deleteBuffer(this.vboGlyph)
    gl.deleteVertexArray(this.vaoSprite)
    gl.deleteVertexArray(this.vaoGlyph)
    gl.deleteVertexArray(this.vaoEmpty)
    gl.deleteTexture(this.atlasTex)
    for (const p of [this.pSprite, this.pGlyph, this.pAbyss, this.pBright, this.pBlur, this.pComposite, this.pStainFade, this.pBlit]) {
      gl.deleteProgram(p)
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext()
  }
}
