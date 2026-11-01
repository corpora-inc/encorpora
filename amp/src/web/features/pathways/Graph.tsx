import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  bandLabel,
  bands,
  connections,
  crystal,
  layout,
  neighborhood,
  neighborhoods,
  relatedSkills,
  type MapSkill,
  type Evidence,
} from "./model";

import { overviewCamera, overviewCallouts } from "./overview";

type Props = {
  skills: MapSkill[];
  evidence: Evidence[];
  selected: string;
  onSelect: (id: string) => void;
  range: { lo: number; hi: number; level: number } | null;
  rangeStrand?: string;
};
type Label = {
  id: string;
  title: string;
  x: number;
  y: number;
  area?: boolean;
  anchorX?: number;
  anchorY?: number;
};
/** GPU-rendered atlas. Geometry is stable; continuous motion stops when hidden or reduced. */
/** Height of the map toolbar plus its inset; callouts stay below it. */
const TOOLBAR_CLEARANCE = 64;

export function Graph({
  skills,
  evidence,
  selected,
  onSelect,
  range,
  rangeStrand,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const selection = useRef(onSelect);
  selection.current = onSelect;
  const focus = useRef<(id: string, move?: boolean) => void>(() => {});
  const reset = useRef<() => void>(() => {});
  const zoom = useRef<(factor: number) => void>(() => {});
  const rotate = useRef<(value: boolean) => void>(() => {});
  const cameraMemory = useRef<{
    position: [number, number, number];
    target: [number, number, number];
    fit: boolean;
  } | null>(null);
  const lastFocused = useRef("");
  const earnedMemory = useRef(new Map<string, number>());
  const [failed, setFailed] = useState(false);
  const [orbit, setOrbit] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const changed = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const [labels, setLabels] = useState<Label[]>([]);
  const [labelsMoving, setLabelsMoving] = useState(false);
  const [hover, setHover] = useState("");
  const [motion, setMotion] = useState(
    () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setMotion(!media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      setLabels([]);
      setHover("");
      setFailed(true);
      return;
    }
    setFailed(false);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1200);
    const controls = new OrbitControls(camera, renderer.domElement);
    const saved = cameraMemory.current;
    let fitView = saved?.fit ?? true;
    if (saved) {
      camera.position.fromArray(saved.position);
      controls.target.fromArray(saved.target);
      controls.update();
    }
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.enableRotate = false;
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.minDistance = 13;
    controls.maxDistance = 650;
    const points = layout(skills);
    const byId = new Map(points.map((p) => [p.skill.id, p]));
    const stats = new Map(evidence.map((s) => [s.skillId, s]));
    const styles = getComputedStyle(el);
    const paintRole = (role: string) => styles.getPropertyValue(role).trim();
    const colors = neighborhoods.map(
      (n) => new THREE.Color(paintRole(n.color)),
    );
    const textures: THREE.Texture[] = [];
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 128;
    const ctx = glowCanvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, paintRole("--atlas-light"));
    gradient.addColorStop(0.08, paintRole("--atlas-halo-core"));
    gradient.addColorStop(0.22, paintRole("--atlas-halo-edge"));
    gradient.addColorStop(1, paintRole("--atlas-transparent"));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    textures.push(glowTexture);
    const geometries = [
      new THREE.IcosahedronGeometry(0.48),
      new THREE.OctahedronGeometry(0.72),
      new THREE.OctahedronGeometry(0.92),
      new THREE.IcosahedronGeometry(1.12),
    ];
    scene.add(new THREE.AmbientLight(paintRole("--atlas-light"), 2));
    const light = new THREE.DirectionalLight(paintRole("--atlas-area-0"), 4);
    light.position.set(-30, 50, 80);
    scene.add(light);
    const growth: { mesh: THREE.Mesh; from: number; to: number }[] = [];
    const growthStarted = performance.now();
    const meshes: THREE.Mesh[] = [],
      glows: THREE.Sprite[] = [];
    for (const p of points) {
      const earned = crystal(stats.get(p.skill.id));
      const color = colors[Math.max(0, neighborhood(p.skill))]!;
      const material = new THREE.MeshStandardMaterial({
        color: earned.stage
          ? color
          : color
              .clone()
              .lerp(new THREE.Color(paintRole("--atlas-light")), 0.22)
              .multiplyScalar(0.8),
        emissive: color,
        emissiveIntensity: earned.intensity,
        metalness: 0.5,
        roughness: 0.25,
      });
      const mesh = new THREE.Mesh(geometries[earned.stage], material);
      mesh.position.set(...p.position);
      const targetScale = 1 + earned.score / 20;
      const previous = earnedMemory.current.get(p.skill.id);
      const fromScale =
        previous === undefined ? targetScale : 1 + previous / 20;
      mesh.scale.setScalar(motion ? fromScale : targetScale);
      if (fromScale < targetScale)
        growth.push({ mesh, from: fromScale, to: targetScale });
      earnedMemory.current.set(p.skill.id, earned.score);
      mesh.rotation.set(0.4, 0.5, 0.2);
      mesh.userData.id = p.skill.id;
      mesh.userData.radius = [0.48, 0.72, 0.92, 1.12][earned.stage];
      mesh.userData.score = earned.score;
      mesh.userData.renderScale = motion ? fromScale : targetScale;
      scene.add(mesh);
      meshes.push(mesh);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color,
          transparent: true,
          opacity: earned.glow,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      sprite.position.copy(mesh.position);
      sprite.scale.setScalar(earned.stage ? 9 + earned.stage * 2 : 5);
      scene.add(sprite);
      glows.push(sprite);
    }
    const areaCenters: THREE.Vector3[] = [];
    neighborhoods.forEach((_, i) => {
      const group = points.filter((p) => neighborhood(p.skill) === i);
      const center = group
        .reduce(
          (v, p) => v.add(new THREE.Vector3(...p.position)),
          new THREE.Vector3(),
        )
        .divideScalar(Math.max(1, group.length));
      areaCenters.push(center.clone());
      const cloud = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: colors[i],
          transparent: true,
          opacity: 0.07,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      cloud.position.copy(center);
      cloud.position.z = -12;
      cloud.scale.set(95, 80, 1);
      scene.add(cloud);
    });
    const edges: {
      from: string;
      to: string;
      curve: THREE.CubicBezierCurve3;
      lit: boolean;
    }[] = [];
    for (const p of points)
      for (const id of p.skill.prerequisites) {
        const prior = byId.get(id);
        if (!prior) continue;
        const from = new THREE.Vector3(...prior.position),
          to = new THREE.Vector3(...p.position);
        const delta = to.clone().sub(from);
        const bend = new THREE.Vector3(-delta.y, delta.x, 0).multiplyScalar(
          0.13,
        );
        edges.push({
          from: id,
          to: p.skill.id,
          curve: new THREE.CubicBezierCurve3(
            from,
            from.clone().addScaledVector(delta, 0.33).add(bend),
            from.clone().addScaledVector(delta, 0.67).add(bend),
            to,
          ),
          lit:
            !!stats.get(id)?.independentCorrect &&
            !!stats.get(p.skill.id)?.independentCorrect,
        });
      }
    const edgePositions: number[] = [],
      edgeColors: number[] = [];
    const steps = 20;
    for (const edge of edges)
      for (let j = 0; j < steps; j++)
        for (const t of [j / steps, (j + 1) / steps]) {
          edgePositions.push(...edge.curve.getPoint(t).toArray());
          edgeColors.push(0.12, 0.17, 0.24);
        }
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(edgePositions, 3),
    );
    const colorAttribute = new THREE.Float32BufferAttribute(edgeColors, 3);
    edgeGeometry.setAttribute("color", colorAttribute);
    const lines = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(lines);
    const pulseGeometry = new THREE.BufferGeometry();
    const pulsePosition = new Float32Array(edges.length * 3),
      pulseColor = new Float32Array(edges.length * 3);
    pulseGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(pulsePosition, 3),
    );
    pulseGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(pulseColor, 3),
    );
    const pulses = new THREE.Points(
      pulseGeometry,
      new THREE.PointsMaterial({
        map: glowTexture,
        size: 3.2,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(pulses);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.055, 8, 64),
      new THREE.MeshBasicMaterial({
        color: paintRole("--atlas-light"),
        transparent: true,
        opacity: 0.85,
      }),
    );
    ring.visible = false;
    scene.add(ring);
    // Outline mapped skills in the estimated grade range; earned light remains separate.
    if (range) {
      const inRange = points.filter((p) => {
        const grade = bands.indexOf(p.skill.gradeBand);
        return (
          (!rangeStrand || p.skill.strand === rangeStrand) &&
          grade >= range.lo &&
          grade <= range.hi
        );
      });
      const outlineCanvas = document.createElement("canvas");
      outlineCanvas.width = outlineCanvas.height = 128;
      const context = outlineCanvas.getContext("2d")!;
      context.strokeStyle = paintRole("--atlas-light");
      context.lineWidth = 5;
      context.beginPath();
      context.arc(64, 64, 48, 0, Math.PI * 2);
      context.stroke();
      const texture = new THREE.CanvasTexture(outlineCanvas);
      textures.push(texture);
      const geometry = new THREE.BufferGeometry().setFromPoints(
        inRange.map((p) => new THREE.Vector3(...p.position)),
      );
      scene.add(
        new THREE.Points(
          geometry,
          new THREE.PointsMaterial({
            map: texture,
            color: paintRole("--atlas-area-0"),
            size: 4.2,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
          }),
        ),
      );
    }
    const lateralGeometry = new THREE.BufferGeometry().setFromPoints([]);
    const lateralLines = new THREE.LineSegments(
      lateralGeometry,
      new THREE.LineDashedMaterial({
        color: paintRole("--atlas-muted"),
        dashSize: 0.45,
        gapSize: 0.7,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    scene.add(lateralLines);
    let width = 1,
      height = 1,
      current = "",
      tween: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;
    let frame = 0,
      disposed = false;
    let labelTimer: ReturnType<typeof setTimeout> | undefined;
    let interacting = false,
      labelsHidden = false;
    const project = (position: THREE.Vector3) => {
      const p = position.clone().project(camera);
      return {
        x: ((p.x + 1) * width) / 2,
        y: ((1 - p.y) * height) / 2,
        visible: p.z > -1 && p.z < 1,
      };
    };
    // Choose callouts in the fitted view once, then keep them in world space.
    // Only six DOM positions follow the same camera as the canvas.
    let areaPositions: THREE.Vector3[] = [];
    const placeAreas = () => {
      const fitted = overviewCamera(
        points.map((p) => p.position),
        width,
        height,
      );
      const reference = camera.clone();
      reference.position.set(...fitted.position);
      reference.up.set(0, 1, 0);
      reference.lookAt(new THREE.Vector3(...fitted.target));
      reference.updateMatrixWorld();
      const anchors = areaCenters.map((center, i) => {
        const p = center.clone().project(reference);
        return {
          i,
          x: ((p.x + 1) * width) / 2,
          y: ((1 - p.y) * height) / 2,
          z: p.z,
        };
      });
      areaPositions = [];
      for (const p of overviewCallouts(anchors, width, height))
        areaPositions[p.i] = new THREE.Vector3(
          (p.x / width) * 2 - 1,
          1 - (p.y / height) * 2,
          p.z,
        ).unproject(reference);
    };
    const moveAreas = () => {
      if (!labelHost.current) return;
      camera.updateMatrixWorld();
      areaPositions.forEach((position, i) => {
        const label = labelHost.current!.querySelector<HTMLElement>(
          `[data-area="${i}"]`,
        );
        const leader = labelHost.current!.querySelector<SVGLineElement>(
          `[data-leader="${i}"]`,
        );
        if (!label || !leader) return;
        const p = project(position),
          anchor = project(areaCenters[i]!);
        label.style.left = `${p.x}px`;
        label.style.top = `${p.y}px`;
        // A callout shows whole or not at all: never cut by the map's edge
        // or under its toolbar when the camera is close in.
        const half = label.offsetWidth / 2,
          tall = label.offsetHeight / 2;
        const inside =
          p.x - half >= 4 &&
          p.x + half <= width - 4 &&
          p.y - tall >= TOOLBAR_CLEARANCE &&
          p.y + tall <= height - 4;
        const shown = p.visible && inside;
        label.style.visibility = shown ? "visible" : "hidden";
        leader.style.visibility =
          shown && anchor.visible ? "visible" : "hidden";
        leader.setAttribute("x1", String(anchor.x));
        leader.setAttribute("y1", String(anchor.y));
        leader.setAttribute("x2", String(p.x));
        leader.setAttribute("y2", String(p.y));
      });
    };
    let areaLabelsShown = false;
    const updateLabels = () => {
      // Projection must use this camera pose, not the preceding rendered frame.
      camera.updateMatrixWorld();
      const close = camera.position.distanceTo(controls.target) < 105;
      const result: Label[] = [];
      areaLabelsShown = !close || fitView;
      if (!close || fitView) {
        neighborhoods.forEach((area, i) => {
          const p = project(areaPositions[i]!);
          const anchor = project(areaCenters[i]!);
          result.push({
            id: `area-${i}`,
            title: area.title,
            ...p,
            area: true,
            anchorX: anchor.x,
            anchorY: anchor.y,
          });
        });
      }
      if (close && !fitView) {
        const candidates = [...points].sort(
          (a, b) =>
            Number(b.skill.id === current) - Number(a.skill.id === current),
        );
        for (const node of candidates) {
          const p = project(new THREE.Vector3(...node.position));
          if (
            !p.visible ||
            p.x < 85 ||
            p.x > width - 85 ||
            p.y < 80 ||
            p.y > height - 85
          )
            continue;
          if (
            result.some(
              (l) => Math.abs(l.x - p.x) < 160 && Math.abs(l.y - p.y) < 38,
            )
          )
            continue;
          result.push({
            id: node.skill.id,
            title: node.skill.title,
            x: p.x,
            y: p.y,
          });
          if (result.length >= 16) break;
        }
      }
      setLabels(result);
    };
    const hideLabels = () => {
      clearTimeout(labelTimer);
      if (!labelsHidden) {
        labelsHidden = true;
        setLabelsMoving(true);
        setHover("");
      }
    };
    const settleLabels = () => {
      hideLabels();
      if (disposed || interacting || pointers.size || tween) return;
      labelTimer = setTimeout(() => {
        if (disposed || interacting || pointers.size || tween) return;
        updateLabels();
        labelsHidden = false;
        setLabelsMoving(false);
      }, 70);
    };
    const paint = () => {
      // Keep the smallest nodes legible in CSS pixels; earned size/glow remains separate.
      const unitsPerPixel =
        (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height;
      for (const mesh of meshes) {
        const pixels = mesh.userData.score
          ? 2 + mesh.userData.score * 0.06
          : 1.5;
        const minimum =
          (camera.position.distanceTo(mesh.position) * unitsPerPixel * pixels) /
          mesh.userData.radius;
        mesh.scale.setScalar(Math.max(mesh.userData.renderScale, minimum));
      }
      (lines.material as THREE.LineBasicMaterial).opacity = fitView
        ? 0.38
        : 0.65;
      ring.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
      if (
        !areaLabelsShown &&
        (fitView || camera.position.distanceTo(controls.target) >= 105)
      )
        updateLabels();
      moveAreas();
    };
    const recolor = (id: string) => {
      current = id;
      const paths = connections(skills, id);
      const related = relatedSkills(skills, id),
        relatedIds = new Set(related.map((s) => s.id));
      const lateralPoints: THREE.Vector3[] = [];
      const origin = byId.get(id);
      if (origin)
        for (const skill of related) {
          const target = byId.get(skill.id)!;
          const from = new THREE.Vector3(...origin.position),
            to = new THREE.Vector3(...target.position),
            delta = to.clone().sub(from);
          const bend = new THREE.Vector3(-delta.y, delta.x, 0).multiplyScalar(
            0.1,
          );
          const curve = new THREE.CubicBezierCurve3(
            from,
            from.clone().addScaledVector(delta, 0.33).add(bend),
            from.clone().addScaledVector(delta, 0.67).add(bend),
            to,
          );
          for (let j = 0; j < 20; j++)
            lateralPoints.push(
              curve.getPoint(j / 20),
              curve.getPoint((j + 1) / 20),
            );
        }
      lateralGeometry.setFromPoints(lateralPoints);
      lateralLines.computeLineDistances();
      edges.forEach((edge, i) => {
        const ancestor =
          (edge.to === id || paths.prerequisites.has(edge.to)) &&
          paths.prerequisites.has(edge.from);
        const descendant =
          (edge.from === id || paths.dependents.has(edge.from)) &&
          paths.dependents.has(edge.to);
        const tint = id
          ? ancestor
            ? new THREE.Color(paintRole("--atlas-prerequisite"))
            : descendant
              ? new THREE.Color(paintRole("--atlas-dependent"))
              : new THREE.Color(paintRole("--atlas-border"))
          : edge.lit
            ? colors[
                Math.max(0, neighborhood(byId.get(edge.to)!.skill))
              ]!.clone().multiplyScalar(0.25)
            : new THREE.Color(paintRole("--atlas-border")).multiplyScalar(0.8);
        for (let k = 0; k < steps * 2; k++)
          colorAttribute.setXYZ(i * steps * 2 + k, tint.r, tint.g, tint.b);
        const lit = id ? ancestor || descendant : edge.lit;
        pulseColor.set(lit ? tint.toArray() : [0, 0, 0], i * 3);
      });
      colorAttribute.needsUpdate = true;
      pulseGeometry.attributes.color!.needsUpdate = true;
      meshes.forEach((mesh, i) => {
        const idHere = mesh.userData.id;
        const active =
          !id ||
          idHere === id ||
          paths.prerequisites.has(idHere) ||
          paths.dependents.has(idHere) ||
          relatedIds.has(idHere);
        const earned = crystal(stats.get(idHere));
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = active
          ? earned.intensity
          : 0.015;
        glows[i]!.material.opacity = active ? earned.glow : 0.025;
      });
    };
    focus.current = (id, move = true) => {
      recolor(id);
      const p = byId.get(id);
      ring.visible = !!p;
      if (p) {
        const target = new THREE.Vector3(...p.position);
        ring.position.copy(target);
        if (move) fitView = false;
        if (move)
          tween = {
            target,
            position: target
              .clone()
              .add(new THREE.Vector3(0, 0, Math.max(42, 65 / camera.aspect))),
          };
      }
      if (!motion && tween) {
        camera.position.copy(tween.position);
        controls.target.copy(tween.target);
        tween = null;
        controls.update();
      }
      settleLabels();
      paint();
    };
    reset.current = () => {
      fitView = true;
      const overview = overviewCamera(
        points.map((p) => p.position),
        width,
        height,
      );
      camera.up.set(0, 1, 0);
      tween = {
        position: new THREE.Vector3(...overview.position),
        target: new THREE.Vector3(...overview.target),
      };
      if (!motion) {
        camera.position.copy(tween.position);
        controls.target.copy(tween.target);
        tween = null;
        controls.update();
      }
      recolor(current);
      ring.visible = !!byId.get(current);
      settleLabels();
      paint();
    };
    zoom.current = (factor) => {
      fitView = false;
      tween = null;
      const distance = THREE.MathUtils.clamp(
        camera.position.distanceTo(controls.target) * factor,
        controls.minDistance,
        controls.maxDistance,
      );
      camera.position
        .sub(controls.target)
        .setLength(distance)
        .add(controls.target);
      controls.update();
      settleLabels();
      paint();
    };
    rotate.current = (value) => {
      controls.enableRotate = value;
      controls.mouseButtons.LEFT = value ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
      controls.touches.ONE = value ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
      if (!value) {
        camera.position.set(
          controls.target.x,
          controls.target.y,
          controls.target.z + camera.position.distanceTo(controls.target),
        );
        camera.up.set(0, 1, 0);
        controls.update();
        settleLabels();
        paint();
      }
    };
    const resize = () => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      width = box.width;
      height = box.height;
      camera.aspect = width / height;
      const fitted = overviewCamera(
        points.map((p) => p.position),
        width,
        height,
      );
      controls.maxDistance = fitted.maxDistance;
      camera.far = fitted.far;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      placeAreas();
      if (fitView) {
        const overview = overviewCamera(
          points.map((p) => p.position),
          width,
          height,
        );
        camera.position.set(...overview.position);
        controls.target.set(...overview.target);
        tween = null;
        controls.update();
      }
      settleLabels();
      paint();
    };
    let down = { x: 0, y: 0 },
      pointers = new Set<number>(),
      multiple = false;
    const pointerDown = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      multiple = pointers.size > 1;
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      settleLabels();
      if (multiple || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6)
        return;
      camera.updateMatrixWorld();
      const box = el.getBoundingClientRect();
      const x = e.clientX - box.left,
        y = e.clientY - box.top;
      let nearest = "",
        distance = 18;
      for (const mesh of meshes) {
        const p = project(mesh.position);
        const d = Math.hypot(p.x - x, p.y - y);
        if (p.visible && d < distance) {
          nearest = mesh.userData.id;
          distance = d;
        }
      }
      if (nearest) {
        focus.current(nearest);
        selection.current(nearest);
      }
    };
    const pointerMove = (e: PointerEvent) => {
      if (pointers.size || labelsHidden) return;
      camera.updateMatrixWorld();
      const box = el.getBoundingClientRect();
      let nearest = "",
        distance = 14;
      for (const mesh of meshes) {
        const p = project(mesh.position);
        const d = Math.hypot(
          p.x - (e.clientX - box.left),
          p.y - (e.clientY - box.top),
        );
        if (p.visible && d < distance) {
          nearest = mesh.userData.id;
          distance = d;
        }
      }
      renderer.domElement.style.cursor = nearest ? "pointer" : "grab";
      setHover(nearest);
    };
    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(frame);
      disposed = true;
      clearTimeout(labelTimer);
      controls.enabled = false;
      setLabels([]);
      setHover("");
      setFailed(true);
    };
    const changed = () => {
      settleLabels();
      paint();
    };
    const start = () => {
      interacting = true;
      hideLabels();
      fitView = false;
      tween = null;
    };
    const end = () => {
      interacting = false;
      settleLabels();
    };
    const cancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      multiple = true;
      settleLabels();
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("webglcontextlost", lost);
    controls.addEventListener("change", changed);
    controls.addEventListener("start", start);
    controls.addEventListener("end", end);
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    if (!saved) reset.current();
    const vector = new THREE.Vector3();
    let lastFrame = 0;
    const animate = (time: number) => {
      if (disposed) return;
      if (!document.hidden && time - lastFrame >= 1000 / 30) {
        lastFrame = time;
        const growthPhase =
          1 -
          Math.pow(
            1 - THREE.MathUtils.clamp((time - growthStarted) / 700, 0, 1),
            3,
          );
        growth.forEach(
          ({ mesh, from, to }) =>
            (mesh.userData.renderScale = THREE.MathUtils.lerp(
              from,
              to,
              growthPhase,
            )),
        );
        if (tween) {
          camera.position.lerp(tween.position, 0.22);
          controls.target.lerp(tween.target, 0.22);
          controls.update();
          if (camera.position.distanceTo(tween.position) < 0.1) {
            camera.position.copy(tween.position);
            controls.target.copy(tween.target);
            tween = null;
            controls.update();
            settleLabels();
          }
        }
        edges.forEach((edge, i) => {
          edge.curve.getPoint((time * 0.00013 + i * 0.137) % 1, vector);
          pulsePosition.set(vector.toArray(), i * 3);
        });
        pulseGeometry.attributes.position!.needsUpdate = true;
        glows.forEach((sprite, i) => {
          if (stats.get(points[i]!.skill.id)?.independentCorrect)
            sprite.material.rotation = Math.sin(time * 0.0003 + i) * 0.08;
        });
        paint();
      }
      frame = requestAnimationFrame(animate);
    };
    if (motion) frame = requestAnimationFrame(animate);
    else pulses.visible = false;
    recolor("");
    return () => {
      cameraMemory.current = {
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
        fit: fitView,
      };
      disposed = true;
      clearTimeout(labelTimer);
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.removeEventListener("change", changed);
      controls.removeEventListener("start", start);
      controls.removeEventListener("end", end);
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", cancel);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      const resources = new Set<THREE.BufferGeometry | THREE.Material>();
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.Points
        ) {
          resources.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            resources.add(m),
          );
        }
        if (o instanceof THREE.Sprite) resources.add(o.material);
      });
      geometries.forEach((g) => resources.add(g));
      resources.forEach((r) => r.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      focus.current = () => {};
      reset.current = () => {};
      zoom.current = () => {};
      rotate.current = () => {};
    };
  }, [skills, evidence, motion, range?.lo, range?.hi, rangeStrand]);
  useEffect(() => {
    focus.current(selected, selected !== lastFocused.current);
    lastFocused.current = selected;
    rotate.current(orbit);
  }, [
    selected,
    skills,
    evidence,
    motion,
    range?.lo,
    range?.hi,
    rangeStrand,
    orbit,
  ]);
  return (
    <section
      className="pathways-viewport"
      aria-label="Interactive curriculum map"
    >
      <div ref={host} className="pathways-canvas" />
      <div
        ref={labelHost}
        className="pathways-map-labels"
        data-moving={labelsMoving}
        aria-hidden="true"
      >
        <svg className="pathways-label-leaders" aria-hidden="true">
          {labels
            .filter((l) => l.area)
            .map((l) => (
              <line
                key={l.id}
                data-leader={l.id.slice(5)}
                x1={l.anchorX}
                y1={l.anchorY}
                x2={l.x}
                y2={l.y}
              />
            ))}
        </svg>
        {labels.map((l) =>
          l.area ? (
            <span
              className="area-label"
              data-area={l.id.slice(5)}
              key={l.id}
              style={{ left: l.x, top: l.y }}
            >
              {l.title}
            </span>
          ) : (
            <span
              key={l.id}
              className="skill-label"
              style={{ left: l.x, top: l.y }}
            >
              {l.title}
            </span>
          ),
        )}
      </div>
      {hover && (
        <p className="pathways-hover">
          {skills.find((s) => s.id === hover)?.title}{" "}
          <small>
            {bandLabel(skills.find((s) => s.id === hover)!.gradeBand)}
          </small>
        </p>
      )}
      {failed && (
        <p className="pathways-fallback" role="status">
          3D is unavailable on this device. Use the skill list to explore every
          pathway.
        </p>
      )}
      <div className="pathways-camera">
        {document.fullscreenEnabled && (
          <button
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            onClick={() => {
              const action = document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen();
              void action?.catch(() => setFailed(false));
            }}
          >
            <span className="camera-wide">
              {fullscreen ? "Exit full screen" : "Full screen"}
            </span>
            <svg
              className="camera-narrow"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M7 3H3v4M13 3h4v4M3 13v4h4M17 13v4h-4" />
            </svg>
          </button>
        )}
        <button
          disabled={failed}
          aria-label="Whole map"
          onClick={() => reset.current()}
        >
          <span className="camera-wide">Whole map</span>
          <span className="camera-narrow" aria-hidden="true">
            All
          </span>
        </button>
        <button
          disabled={failed}
          aria-label="Zoom in"
          onClick={() => zoom.current(0.72)}
        >
          +
        </button>
        <button
          disabled={failed}
          aria-label="Zoom out"
          onClick={() => zoom.current(1.4)}
        >
          −
        </button>
        <button
          disabled={failed}
          aria-label="3D orbit"
          aria-pressed={orbit}
          onClick={() => setOrbit((v) => !v)}
        >
          <span className="camera-wide">3D orbit</span>
          <span className="camera-narrow" aria-hidden="true">
            3D
          </span>
        </button>
        <button
          disabled={failed}
          aria-label={motion ? "Pause motion" : "Enable motion"}
          aria-pressed={!motion}
          onClick={() => setMotion((v) => !v)}
        >
          <span className="camera-wide">
            {motion ? "Pause motion" : "Enable motion"}
          </span>
          <svg className="camera-narrow" viewBox="0 0 20 20" aria-hidden="true">
            {motion ? (
              <path d="M7 4v12M13 4v12" />
            ) : (
              <path d="M6 3l10 7-10 7z" />
            )}
          </svg>
        </button>
      </div>
      <p className="pathways-gesture">
        {orbit ? "Drag to orbit" : "Drag to explore"} · Pinch or scroll to zoom
        · Select a skill
      </p>
    </section>
  );
}
