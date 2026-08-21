import * as THREE from "three"

/**
 * The post chain: threshold → downsample → separable blur → composite.
 *
 * Written by hand rather than assembled from `EffectComposer` because the tier
 * governor needs to change the pass count and the render-target scale at
 * runtime without rebuilding a pipeline, and because the composite is where
 * three of the game's best effects live — the ripple, the aberration and the
 * flash — and they want to share one full-screen pass, not three.
 */

const FS_TRI = new Float32Array([-1, -1, 3, -1, -1, 3])

function fullscreen(material: THREE.Material): THREE.Mesh {
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(FS_TRI, 2))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
  const m = new THREE.Mesh(g, material)
  m.frustumCulled = false
  return m
}

const VS = /* glsl */ `
attribute vec2 position;
varying vec2 vUv;
void main(){ vUv = position*0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`

export class Post {
  private readonly renderer: THREE.WebGLRenderer
  scene!: THREE.WebGLRenderTarget
  private a!: THREE.WebGLRenderTarget
  private b!: THREE.WebGLRenderTarget
  private readonly quadScene = new THREE.Scene()
  private readonly quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  private readonly thresholdMat: THREE.RawShaderMaterial
  private readonly blurMat: THREE.RawShaderMaterial
  private readonly compositeMat: THREE.RawShaderMaterial
  private readonly quad: THREE.Mesh

  private w = 2
  private h = 2
  private scale = 0.5
  passes = 2
  dispersion = true

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    const half = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType

    const mk = (w: number, h: number): THREE.WebGLRenderTarget =>
      new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
        type: half,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
        colorSpace: THREE.LinearSRGBColorSpace,
      })
    this.scene = mk(2, 2)
    this.a = mk(2, 2)
    this.b = mk(2, 2)

    this.thresholdMat = new THREE.RawShaderMaterial({
      uniforms: {
        uTex: { value: null },
        uThreshold: { value: 0.78 },
        uKnee: { value: 0.30 },
        uTexel: { value: new THREE.Vector2() },
      },
      vertexShader: VS,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTex;
        uniform float uThreshold, uKnee;
        uniform vec2 uTexel;
        vec3 tap(vec2 o){ return texture2D(uTex, vUv + o*uTexel).rgb; }
        void main(){
          // 4-tap box while downsampling: cheaper than a separate pass and it
          // kills the shimmer you would otherwise get on a moving highlight.
          vec3 c = (tap(vec2(-1.0,-1.0)) + tap(vec2(1.0,-1.0)) + tap(vec2(-1.0,1.0)) + tap(vec2(1.0,1.0))) * 0.25;
          float l = max(c.r, max(c.g, c.b));
          float s = max(0.0, l - uThreshold);
          s = s*s / (s + uKnee);
          gl_FragColor = vec4(c * (s / max(l, 1e-4)), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })

    this.blurMat = new THREE.RawShaderMaterial({
      uniforms: {
        uTex: { value: null },
        uDir: { value: new THREE.Vector2(1, 0) },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: 1 },
      },
      vertexShader: VS,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTex;
        uniform vec2 uDir, uTexel;
        uniform float uRadius;
        void main(){
          // 9-tap gaussian with linear-sampling pairs — 5 fetches, 9 taps.
          vec2 o = uDir * uTexel * uRadius;
          vec3 c = texture2D(uTex, vUv).rgb * 0.227027;
          c += (texture2D(uTex, vUv + o*1.3846).rgb + texture2D(uTex, vUv - o*1.3846).rgb) * 0.316216;
          c += (texture2D(uTex, vUv + o*3.2308).rgb + texture2D(uTex, vUv - o*3.2308).rgb) * 0.070270;
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })

    this.compositeMat = new THREE.RawShaderMaterial({
      uniforms: {
        uScene: { value: null },
        uBloom: { value: null },
        uIntensity: { value: 1.15 },
        uAberration: { value: 0 },
        uFlash: { value: 0 },
        uFlashColor: { value: new THREE.Vector3(1, 1, 1) },
        uRipple: { value: new THREE.Vector4(0, 0, 0, 0) }, // cx, cy, t01, amp
        uAspect: { value: 1 },
        uVignette: { value: 0.34 },
        uDispersion: { value: 1 },
        uDesat: { value: 0 },
      },
      vertexShader: VS,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uScene, uBloom;
        uniform float uIntensity, uAberration, uFlash, uAspect, uVignette, uDispersion, uDesat;
        uniform vec3 uFlashColor;
        uniform vec4 uRipple;

        // Filmic-ish curve. Keeps the neon from clipping to flat white the
        // moment three highlights overlap, which is what makes cheap bloom
        // look cheap.
        vec3 tonemap(vec3 x){
          x *= 1.02;
          vec3 a = x*(2.51*x + 0.03);
          vec3 b = x*(2.43*x + 0.59) + 0.14;
          return clamp(a/b, 0.0, 1.0);
        }

        void main(){
          vec2 uv = vUv;
          vec2 c = vec2((uv.x-0.5)*uAspect, uv.y-0.5);

          // Shock ripple: a travelling annulus of refraction. One line of maths
          // and it is the single most physical-feeling thing in the game.
          if (uRipple.w > 0.0001) {
            vec2 d = c - vec2(uRipple.x*uAspect, uRipple.y);
            float r = length(d);
            float front = uRipple.z;
            float w = 0.12;
            float band = exp(-pow((r - front)/w, 2.0));
            uv += normalize(d + 1e-6) * band * uRipple.w * (1.0 - front) * 0.055;
          }

          float ab = uAberration;
          vec3 col;
          if (ab > 0.0005) {
            vec2 dir = normalize(c + 1e-6) * ab;
            col.r = texture2D(uScene, uv + dir*1.0).r;
            col.g = texture2D(uScene, uv).g;
            col.b = texture2D(uScene, uv - dir*1.0).b;
          } else {
            col = texture2D(uScene, uv).rgb;
          }

          vec3 bl;
          if (uDispersion > 0.5) {
            // Bloom fringing: the glow disperses outward slightly per channel.
            vec2 dir = (uv - 0.5) * 0.0016;
            bl.r = texture2D(uBloom, uv + dir).r;
            bl.g = texture2D(uBloom, uv).g;
            bl.b = texture2D(uBloom, uv - dir).b;
          } else {
            bl = texture2D(uBloom, uv).rgb;
          }
          col += bl * uIntensity;

          col = mix(col, vec3(dot(col, vec3(0.299,0.587,0.114))), uDesat);
          col += uFlashColor * uFlash;
          col = tonemap(col);
          // The filmic curve desaturates highlights, which is exactly wrong for
          // bioluminescence. Put the chroma back after the curve, not before.
          float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = clamp(mix(vec3(lum), col, 1.34), 0.0, 1.0);

          float v = 1.0 - dot(c,c) * uVignette;
          col *= clamp(v, 0.0, 1.0);

          gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0/2.2)), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    })

    this.quad = fullscreen(this.thresholdMat)
    this.quadScene.add(this.quad)
  }

  resize(w: number, h: number, scale: number): void {
    this.w = Math.max(2, Math.floor(w))
    this.h = Math.max(2, Math.floor(h))
    this.scale = scale
    this.scene.setSize(this.w, this.h)
    const bw = Math.max(2, Math.floor(this.w * scale))
    const bh = Math.max(2, Math.floor(this.h * scale))
    this.a.setSize(bw, bh)
    this.b.setSize(bw, bh)
    ;(this.compositeMat.uniforms.uAspect as THREE.IUniform).value = this.w / this.h
  }

  setScale(scale: number): void {
    if (Math.abs(scale - this.scale) < 0.001) return
    this.resize(this.w, this.h, scale)
  }

  get composite(): THREE.RawShaderMaterial {
    return this.compositeMat
  }

  private draw(mat: THREE.Material, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = mat
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.quadScene, this.quadCam)
  }

  /** Runs the bloom chain and composites to the screen. */
  run(): void {
    const bw = this.a.width
    const bh = this.a.height

    if (this.passes <= 0) {
      ;(this.compositeMat.uniforms.uBloom as THREE.IUniform).value = null
      ;(this.compositeMat.uniforms.uScene as THREE.IUniform).value = this.scene.texture
      ;(this.compositeMat.uniforms.uIntensity as THREE.IUniform).value = 0
      this.draw(this.compositeMat, null)
      return
    }

    const tu = this.thresholdMat.uniforms
    ;(tu.uTex as THREE.IUniform).value = this.scene.texture
    ;(tu.uTexel as THREE.IUniform).value.set(1 / this.w, 1 / this.h)
    this.draw(this.thresholdMat, this.a)

    const bu = this.blurMat.uniforms
    ;(bu.uTexel as THREE.IUniform).value.set(1 / bw, 1 / bh)
    // H then V leaves the result back in `src`, so each pass is self-contained
    // and the two targets never need swapping — only the radius widens.
    const src = this.a
    const dst = this.b
    for (let p = 0; p < this.passes; p++) {
      ;(bu.uRadius as THREE.IUniform).value = 1 + p * 1.9
      ;(bu.uTex as THREE.IUniform).value = src.texture
      ;(bu.uDir as THREE.IUniform).value.set(1, 0)
      this.draw(this.blurMat, dst)
      ;(bu.uTex as THREE.IUniform).value = dst.texture
      ;(bu.uDir as THREE.IUniform).value.set(0, 1)
      this.draw(this.blurMat, src)
    }

    const cu = this.compositeMat.uniforms
    ;(cu.uScene as THREE.IUniform).value = this.scene.texture
    ;(cu.uBloom as THREE.IUniform).value = src.texture
    ;(cu.uDispersion as THREE.IUniform).value = this.dispersion ? 1 : 0
    this.draw(this.compositeMat, null)
  }

  dispose(): void {
    this.scene.dispose()
    this.a.dispose()
    this.b.dispose()
    this.thresholdMat.dispose()
    this.blurMat.dispose()
    this.compositeMat.dispose()
    this.quad.geometry.dispose()
  }
}
