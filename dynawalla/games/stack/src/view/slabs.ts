/**
 * The monument itself, and the value plaques hanging off it.
 *
 * A fixed pool of boxes is mapped onto whichever courses are currently near the
 * camera; the rest of the tower is swallowed by fog, so the pool boundary is
 * never visible. Each course keeps the colour of the stratum it was built in,
 * which turns the tower into a record of the climb.
 *
 * Plaques are billboards at a FIXED WORLD SIZE, so a value is the same number
 * of screen pixels wherever it is — the legibility rule, enforced by geometry
 * rather than by hoping.
 */

import {
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Camera,
  type Texture,
} from "three";
import { numeralTexture } from "./textures.ts";

const BOX = new BoxGeometry(1, 1, 1);
const PLANE = new PlaneGeometry(1, 1);

export class SlabPool {
  readonly group = new Group();
  readonly meshes: Mesh<BoxGeometry, MeshStandardMaterial>[] = [];

  constructor(count: number, shadows: boolean) {
    for (let i = 0; i < count; i++) this.grow(shadows);
  }

  private grow(shadows: boolean): void {
    const m = new Mesh(
      BOX,
      new MeshStandardMaterial({ roughness: 0.62, metalness: 0.03, flatShading: false }),
    );
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    m.visible = false;
    m.matrixAutoUpdate = true;
    this.meshes.push(m);
    this.group.add(m);
  }

  resize(count: number, shadows: boolean): void {
    while (this.meshes.length < count) this.grow(shadows);
    for (const m of this.meshes) {
      m.castShadow = shadows;
      m.receiveShadow = shadows;
    }
    if (this.meshes.length > count) {
      for (let i = count; i < this.meshes.length; i++) this.meshes[i]!.visible = false;
    }
  }

  hideFrom(i: number): void {
    for (let k = i; k < this.meshes.length; k++) this.meshes[k]!.visible = false;
  }

  dispose(): void {
    for (const m of this.meshes) m.material.dispose();
    this.meshes.length = 0;
    this.group.clear();
  }
}

export class Plaque {
  readonly group = new Group();
  private plate: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private glyph: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private value = " ";
  private plateC = new Color();
  private glyphC = new Color();

  constructor() {
    this.plate = new Mesh(
      PLANE,
      new MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, side: DoubleSide, toneMapped: false, fog: false }),
    );
    this.glyph = new Mesh(
      PLANE,
      new MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, side: DoubleSide, toneMapped: false, fog: false }),
    );
    this.plate.renderOrder = 10;
    this.glyph.renderOrder = 11;
    this.glyph.position.z = 0.001;
    this.group.add(this.plate, this.glyph);
    this.group.visible = false;
    this.group.renderOrder = 10;
  }

  /** `h` is plaque height in world units; the plate is 2:1. */
  set(
    value: string,
    h: number,
    plate: number,
    glyph: number,
    opacity: number,
    plateOpacity = 1,
  ): void {
    if (value !== this.value) {
      this.value = value;
      const t: Texture = numeralTexture(value);
      this.glyph.material.map = t;
      this.glyph.material.needsUpdate = true;
    }
    this.plate.scale.set(h * 2, h, 1);
    this.glyph.scale.set(h * 2, h, 1);
    this.plateC.setHex(plate);
    this.glyphC.setHex(glyph);
    this.plate.material.color.copy(this.plateC);
    this.glyph.material.color.copy(this.glyphC);
    this.plate.material.opacity = opacity * plateOpacity;
    this.glyph.material.opacity = opacity;
    this.group.visible = opacity > 0.01;
  }

  face(cam: Camera): void {
    this.group.quaternion.copy(cam.quaternion);
  }

  hide(): void {
    this.group.visible = false;
  }

  dispose(): void {
    this.plate.material.dispose();
    this.glyph.material.dispose();
  }
}

export function disposeSharedGeometry(): void {
  BOX.dispose();
  PLANE.dispose();
}
