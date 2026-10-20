import { levelRange } from "../../../learning/level-check";
import { strandNames } from "../../BirthYearPrompt";
import { gradeName, rangeName } from "../../Home";
import { levelScale, scaleAt } from "../../ui/LevelChart";
import type { LevelCardData } from "./share-data";

/** The card's size: 4:5 portrait, which every major feed shows uncropped. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

/** The words printed on a card: whole sentences, translated as units. */
export const cardCopy = {
  title: "What’s your level?",
  eyebrow: (answered: number) => `Level check · ${answered} answered`,
  bestGuess: "Best guess",
  likely: (range: string) => `likely ${range}`,
  areas: "By area",
  invite: "Find yours, free",
};

/** A role colour from the theme tokens, so the card matches the app. */
function token(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
const sans =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif';
const serif = '"Iowan Old Style", "Palatino Linotype", Georgia, serif';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
}

/** One estimate on a track: band = likely range, dot = best guess. */
function track(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  estimate: { level: number; sd: number },
  scale: ReturnType<typeof levelScale>,
  hue: string,
) {
  const colors = {
    sunken: token("--color-surface-sunken"),
    border: token("--color-border"),
    raised: token("--color-surface-raised"),
  };
  roundRect(ctx, box.x, box.y, box.w, box.h, box.h / 2);
  ctx.fillStyle = colors.sunken;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.border;
  ctx.stroke();
  const [from, to] = levelRange(estimate);
  const left = box.x + scaleAt(scale, from) * box.w;
  const right = box.x + scaleAt(scale, to) * box.w;
  ctx.save();
  ctx.globalAlpha = 0.34;
  roundRect(ctx, left, box.y, Math.max(box.h, right - left), box.h, box.h / 2);
  ctx.fillStyle = hue;
  ctx.fill();
  ctx.restore();
  const cx = box.x + scaleAt(scale, estimate.level) * box.w;
  const cy = box.y + box.h / 2;
  const radius = box.h * 0.95;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = colors.raised;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.68, 0, Math.PI * 2);
  ctx.fillStyle = hue;
  ctx.fill();
}

/** Draws the card on a canvas and returns it as a PNG. Only `data` and the
 * public link's host are drawn; the caller cannot pass anything else. */
export async function renderLevelCard(
  data: LevelCardData,
  host: string,
): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the level card.");
  const ink = token("--color-on-surface-raised");
  const muted = token("--color-muted-text");
  const subtle = token("--color-subtle-text");
  const primary = token("--color-primary");
  const border = token("--color-border");
  const pad = 88;
  const inner = CARD_WIDTH - 2 * pad;

  ctx.fillStyle = token("--color-surface-raised");
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, CARD_WIDTH, 14);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = primary;
  ctx.font = `800 52px ${sans}`;
  ctx.letterSpacing = "-2px";
  ctx.fillText("AMP", pad, 150);
  ctx.letterSpacing = "0px";
  ctx.font = `700 30px ${sans}`;
  ctx.textAlign = "right";
  ctx.fillText(cardCopy.eyebrow(data.answered), CARD_WIDTH - pad, 148);
  ctx.textAlign = "left";

  ctx.fillStyle = ink;
  ctx.font = `400 92px ${serif}`;
  ctx.fillText(cardCopy.title, pad, 300);

  // The overall level: best guess, likely range and its band.
  const panelY = 360;
  roundRect(ctx, pad, panelY, inner, 330, 28);
  ctx.fillStyle = token("--color-surface-sunken");
  ctx.fill();
  ctx.fillStyle = muted;
  ctx.font = `600 30px ${sans}`;
  ctx.fillText(cardCopy.bestGuess, pad + 48, panelY + 76);
  const [from, to] = levelRange(data.overall);
  ctx.fillStyle = ink;
  ctx.font = `750 104px ${sans}`;
  ctx.fillText(gradeName(data.overall.level), pad + 44, panelY + 190);
  ctx.fillStyle = muted;
  ctx.font = `500 34px ${sans}`;
  ctx.textAlign = "right";
  ctx.fillText(
    cardCopy.likely(rangeName(from, to)),
    CARD_WIDTH - pad - 48,
    panelY + 186,
  );
  ctx.textAlign = "left";
  const scale = levelScale(Math.round(data.overall.level));
  track(
    ctx,
    { x: pad + 48, y: panelY + 238, w: inner - 96, h: 22 },
    data.overall,
    scale,
    primary,
  );
  ctx.fillStyle = subtle;
  ctx.font = `600 24px ${sans}`;
  ctx.fillText(gradeName(scale.lo), pad + 48, panelY + 306);
  ctx.textAlign = "right";
  ctx.fillText(
    `${gradeName(scale.hi)}${scale.hi < 13 ? "+" : ""}`,
    CARD_WIDTH - pad - 48,
    panelY + 306,
  );
  ctx.textAlign = "left";

  // Each practiced area on the same scale.
  let y = panelY + 400;
  if (data.strands.length) {
    ctx.fillStyle = subtle;
    ctx.font = `700 28px ${sans}`;
    ctx.fillText(cardCopy.areas, pad, y);
    y += 24;
  }
  const nameWidth = 300;
  for (const area of data.strands) {
    y += 56;
    const hue = token(`--color-strand-${area.strand}`) || primary;
    ctx.fillStyle = hue;
    ctx.beginPath();
    ctx.arc(pad + 9, y - 10, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = `600 32px ${sans}`;
    ctx.fillText(strandNames[area.strand] ?? area.strand, pad + 32, y);
    track(
      ctx,
      { x: pad + nameWidth, y: y - 21, w: inner - nameWidth, h: 16 },
      area,
      scale,
      hue,
    );
  }

  // The invitation: the public address of a fresh level check.
  const footY = CARD_HEIGHT - 150;
  ctx.fillStyle = border;
  ctx.fillRect(pad, footY - 40, inner, 2);
  ctx.fillStyle = muted;
  ctx.font = `600 30px ${sans}`;
  ctx.fillText(cardCopy.invite, pad, footY + 14);
  ctx.fillStyle = primary;
  ctx.font = `750 40px ${sans}`;
  ctx.fillText(`${host}/level`, pad, footY + 70);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The level card could not be drawn.")),
      "image/png",
    ),
  );
}
