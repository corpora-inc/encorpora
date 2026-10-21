import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  bandLabel,
  crystal,
  layout,
  type MapSkill,
  type Evidence,
} from "./model";

type Props = {
  skills: MapSkill[];
  evidence: Evidence[];
  selected: string;
  onSelect: (id: string) => void;
  range: { lo: number; hi: number; level: number } | null;
};
/** The route is lazy-loaded; no continuous animation loop or automatic camera movement. */
export function Graph({ skills, evidence, selected, onSelect, range }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const selection = useRef(onSelect);
  selection.current = onSelect;
  const focus = useRef<(id: string) => void>(() => {});
  const reset = useRef<() => void>(() => {});
  const zoom = useRef<(factor: number) => void>(() => {});
  const [failed, setFailed] = useState(false);
  const [theme, setTheme] = useState(0);
  useEffect(() => {
    const refresh = () => setTheme((t) => t + 1);
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", refresh);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", refresh);
    };
  }, []);
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.minDistance = 4;
    controls.maxDistance = 250;
    const styles = getComputedStyle(el);
    const color = (role: string) =>
      new THREE.Color(styles.getPropertyValue(`--color-${role}`).trim());
    const neutral = color("border-strong"),
      accent = color("primary"),
      strong = color("success-accent");
    scene.add(
      new THREE.HemisphereLight(
        color("surface-raised"),
        color("on-surface"),
        2,
      ),
    );
    const light = new THREE.DirectionalLight(color("surface-raised"), 3);
    light.position.set(10, 30, 50);
    scene.add(light);
    const points = layout(skills);
    const byId = new Map(points.map((p) => [p.skill.id, p]));
    const labels: THREE.Texture[] = [];
    for (let grade = 0; grade < 13; grade++) {
      const canvas = document.createElement("canvas");
      canvas.width = 384;
      canvas.height = 72;
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.font = "500 36px sans-serif";
      context.fillStyle = styles.getPropertyValue("--color-muted-text").trim();
      const name = [
        "K",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "algebra-1",
        "geometry",
        "algebra-2",
        "precalculus",
      ][grade]!;
      context.fillText(bandLabel(name), 4, 48);
      const texture = new THREE.CanvasTexture(canvas);
      labels.push(texture);
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          depthTest: false,
          transparent: true,
        }),
      );
      label.position.set(
        Math.min(...points.map((p) => p.position[0])) - 9,
        (grade - 6) * 6,
        0,
      );
      label.scale.set(14, 2.6, 1);
      scene.add(label);
    }
    const stats = new Map(evidence.map((s) => [s.skillId, s]));
    const geometries = [
      new THREE.SphereGeometry(0.46, 8, 6),
      new THREE.OctahedronGeometry(0.7),
      new THREE.OctahedronGeometry(0.9),
      new THREE.IcosahedronGeometry(1.05),
    ];
    const meshes: THREE.Mesh[] = [];
    for (const { skill, position } of points) {
      const earned = crystal(stats.get(skill.id));
      const tint = earned.stage ? (earned.strong ? strong : accent) : neutral;
      const material = new THREE.MeshStandardMaterial({
        color: tint,
        emissive: tint,
        emissiveIntensity: earned.strong ? 0.6 : 0.03,
        metalness: 0.25,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(geometries[earned.stage], material);
      mesh.position.set(...position);
      mesh.userData.id = skill.id;
      scene.add(mesh);
      meshes.push(mesh);
    }
    const edges: THREE.ArrowHelper[] = [];
    for (const { skill, position } of points)
      for (const id of skill.prerequisites) {
        const from = byId.get(id);
        if (!from) continue;
        const origin = new THREE.Vector3(...from.position),
          delta = new THREE.Vector3(...position).sub(origin);
        const arrow = new THREE.ArrowHelper(
          delta.clone().normalize(),
          origin,
          delta.length() - 0.4,
          neutral,
          0.65,
          0.3,
        );
        arrow.userData = { from: id, to: skill.id };
        for (const object of [arrow.line, arrow.cone]) {
          const material = object.material as THREE.Material;
          material.transparent = true;
          material.opacity = 0.15;
        }
        scene.add(arrow);
        edges.push(arrow);
      }
    if (range) {
      const lo = Math.max(-0.5, Math.min(12.5, range.lo)),
        hi = Math.max(lo, Math.min(12.5, range.hi));
      const width =
        Math.max(...points.map((p) => p.position[0])) -
        Math.min(...points.map((p) => p.position[0])) +
        5;
      const depth =
        Math.max(...points.map((p) => p.position[2])) -
        Math.min(...points.map((p) => p.position[2])) +
        5;
      const volume = new THREE.Mesh(
        new THREE.BoxGeometry(width, Math.max(0.3, (hi - lo) * 6), depth),
        new THREE.MeshBasicMaterial({
          color: color("info-accent"),
          transparent: true,
          opacity: 0.055,
          depthWrite: false,
        }),
      );
      volume.position.set(0, ((hi + lo) / 2 - 6) * 6, 0);
      scene.add(volume);
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(volume.geometry),
        new THREE.LineBasicMaterial({
          color: color("info-accent"),
          transparent: true,
          opacity: 0.45,
        }),
      );
      outline.position.copy(volume.position);
      scene.add(outline);
    }
    const ringGeometry = new THREE.TorusGeometry(1.2, 0.06, 8, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: accent });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.visible = false;
    scene.add(ring);
    const render = () => {
      ring.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
    };
    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      render();
    };
    reset.current = () => {
      controls.target.set(0, 0, 0);
      camera.position.set(18, 9, Math.max(115, 145 / camera.aspect));
      controls.update();
      render();
    };
    zoom.current = (factor) => {
      camera.position
        .sub(controls.target)
        .multiplyScalar(factor)
        .add(controls.target);
      controls.update();
      render();
    };
    focus.current = (id) => {
      const point = byId.get(id);
      ring.visible = !!point;
      if (point) {
        ring.position.set(...point.position);
        controls.target.set(...point.position);
        camera.position.set(
          point.position[0] + 6,
          point.position[1] + 4,
          point.position[2] + 22,
        );
        controls.update();
      }
      for (const arrow of edges) {
        const active = arrow.userData.from === id || arrow.userData.to === id;
        arrow.setColor(active ? accent : neutral);
        for (const object of [arrow.line, arrow.cone])
          (object.material as THREE.Material).opacity = active ? 0.9 : 0.08;
      }
      render();
    };
    let down = { x: 0, y: 0 };
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray.intersectObjects(meshes)[0];
      if (hit) selection.current(hit.object.userData.id);
    };
    const lost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    controls.addEventListener("change", render);
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    reset.current();
    return () => {
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((m) => m.dispose());
        }
      });
      geometries.forEach((g) => g.dispose());
      ringGeometry.dispose();
      ringMaterial.dispose();
      labels.forEach((texture) => texture.dispose());
      scene.traverse((object) => {
        if (object instanceof THREE.Sprite) object.material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      focus.current = () => {};
      reset.current = () => {};
      zoom.current = () => {};
    };
  }, [skills, evidence, theme, range?.lo, range?.hi]);
  useEffect(() => {
    if (selected) focus.current(selected);
  }, [selected, skills, evidence, theme, range?.lo, range?.hi]);
  return (
    <section className="pathways-viewport" aria-label="3D skill map">
      <div ref={host} className="pathways-canvas" />
      {skills.find((s) => s.id === selected) && (
        <p className="pathways-selection">
          {skills.find((s) => s.id === selected)!.title} ·{" "}
          {bandLabel(skills.find((s) => s.id === selected)!.gradeBand)}
        </p>
      )}
      {failed && (
        <p className="pathways-fallback" role="status">
          3D is unavailable on this device. Use the skill list below to explore
          every pathway.
        </p>
      )}
      <div className="pathways-camera">
        <button disabled={failed} onClick={() => reset.current()}>
          Whole map
        </button>
        <button
          disabled={failed}
          aria-label="Zoom in"
          onClick={() => zoom.current(0.8)}
        >
          +
        </button>
        <button
          disabled={failed}
          aria-label="Zoom out"
          onClick={() => zoom.current(1.25)}
        >
          −
        </button>
      </div>
      <p className="pathways-gesture">
        Drag to rotate · Pinch or scroll to zoom · Arrows lead to the next skill
      </p>
    </section>
  );
}
