import {
  crystal,
  layout,
  neighborhood,
  neighborhoods,
  type MapSkill,
  type Evidence,
} from "./model";

export type ShareMap = { skills: MapSkill[]; evidence: Evidence[] };
/** A whole-map image from saved evidence. No name, identifier, token or response is drawn. */
export async function mapShareImage(
  { skills, evidence }: ShareMap,
  level: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable");
  const styles = getComputedStyle(document.documentElement);
  const color = (role: string) => styles.getPropertyValue(role).trim();
  const surface = color("--atlas-surface"),
    ink = color("--atlas-on-surface"),
    muted = color("--atlas-muted"),
    accent = color("--atlas-accent");
  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, 1200, 630);
  const haze = ctx.createRadialGradient(880, 315, 0, 880, 315, 360);
  haze.addColorStop(0, color("--atlas-vignette"));
  haze.addColorStop(1, surface);
  ctx.fillStyle = haze;
  ctx.fillRect(490, 0, 710, 630);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(56, 65);
  ctx.bezierCurveTo(62, 43, 68, 43, 74, 65);
  ctx.bezierCurveTo(80, 87, 86, 87, 92, 65);
  ctx.bezierCurveTo(98, 43, 104, 43, 110, 65);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.font = "500 19px system-ui, sans-serif";
  ctx.fillText("ADAPTIVE MATH PATHWAYS", 130, 72);
  ctx.font = "500 46px system-ui, sans-serif";
  ctx.fillText("My math", 56, 180);
  ctx.fillText("pathways", 56, 235);
  ctx.fillStyle = accent;
  ctx.font = "500 30px system-ui, sans-serif";
  ctx.fillText(level, 56, 298, 420);
  const known = new Set(skills.map((s) => s.id));
  const earned = evidence.filter(
    (e) => known.has(e.skillId) && e.independentCorrect > 0,
  ).length;
  ctx.fillStyle = ink;
  ctx.font = "400 22px system-ui, sans-serif";
  ctx.fillText(`${earned} skills illuminated`, 56, 348);
  ctx.fillStyle = muted;
  ctx.font = "400 15px system-ui, sans-serif";
  ctx.fillText("My current estimate, earned through practice.", 56, 383);
  ctx.font = "400 20px system-ui, sans-serif";
  ctx.fillText("Think you’re good at math?", 56, 480);
  ctx.fillText("Explore your pathways.", 56, 510);
  ctx.fillStyle = accent;
  ctx.font = "500 17px system-ui, sans-serif";
  ctx.fillText("amp.corpora.inc/try", 56, 574);
  const points = layout(skills),
    byId = new Map(points.map((p) => [p.skill.id, p])),
    stats = new Map(evidence.map((e) => [e.skillId, e]));
  const project = ([x, y]: number[]) => ({
    x: 875 + x! * 2.7,
    y: 315 - y! * 2.7,
  });
  for (const p of points)
    for (const prior of p.skill.prerequisites) {
      const from = byId.get(prior);
      if (!from) continue;
      const a = project(from.position),
        b = project(p.position),
        dx = b.x - a.x,
        dy = b.y - a.y;
      const lit =
        !!stats.get(prior)?.independentCorrect &&
        !!stats.get(p.skill.id)?.independentCorrect;
      ctx.globalAlpha = lit ? 0.65 : 0.42;
      ctx.strokeStyle = lit
        ? color(neighborhoods[neighborhood(p.skill)]!.color)
        : color("--atlas-border");
      ctx.lineWidth = lit ? 0.9 : 0.6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.bezierCurveTo(
        a.x + dx / 3 + dy * 0.13,
        a.y + dy / 3 - dx * 0.13,
        a.x + (dx * 2) / 3 + dy * 0.13,
        a.y + (dy * 2) / 3 - dx * 0.13,
        b.x,
        b.y,
      );
      ctx.stroke();
    }
  for (const p of points) {
    const point = project(p.position),
      earned = crystal(stats.get(p.skill.id)),
      tint = color(neighborhoods[neighborhood(p.skill)]!.color);
    const radius = earned.stage
      ? (1.6 + earned.stage * 0.7) * (1 + earned.score / 20)
      : 1.2;
    ctx.globalAlpha = earned.stage ? 1 : 0.55;
    ctx.fillStyle = earned.stage ? tint : muted;
    ctx.shadowColor = tint;
    ctx.shadowBlur = earned.stage ? 14 : 0;
    ctx.beginPath();
    if (earned.stage) {
      const sides = earned.stage === 3 ? 6 : 4;
      for (let i = 0; i < sides; i++) {
        const angle = (i * Math.PI * 2) / sides - Math.PI / 2;
        const x = point.x + Math.cos(angle) * radius,
          y = point.y + Math.sin(angle) * radius;
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image export failed")),
      "image/png",
    ),
  );
}
