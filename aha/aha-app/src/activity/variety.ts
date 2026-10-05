/**
 * Cross-batch variety signal. Each batch is a separate model call with no memory of earlier
 * batches, so the learner summary carries a compact fingerprint of the most recent AI activities:
 * which contexts, figure types, question forms, response types and number ranges they used.
 *
 * Privacy and trust: the fingerprint is built from validated activity specs only, never from the
 * learner's answers. Every word in it comes from a closed vocabulary defined here (theme labels,
 * figure/response type names, question-form names, skill ids, number forms), so no model-written
 * free text, and therefore no personal data or injected instruction, is ever echoed into a later
 * prompt.
 */
import type { ActivitySpec } from './spec';

/** How many recent activities the fingerprint covers: about three batches. */
export const RECENT_CONTENT_WINDOW = 12;

/** The fingerprint sent as LEARNER.recentContent. Lists are ordered most-used first. */
export interface RecentContent {
  /** Activities covered. */
  n: number;
  /** Real-world themes the activities used (closed vocabulary). */
  contexts: string[];
  figures: string[];
  /** Question forms (closed vocabulary, see QUESTION_FORMS). */
  forms: string[];
  responses: string[];
  /** Per skill: number forms and ranges used, e.g. "whole 3-48; fractions /4/8". */
  numbers: Record<string, string>;
}

export const QUESTION_FORMS = ['odd_one_out', 'spot_error', 'fill_blank', 'estimate', 'explain', 'compare', 'order', 'plot', 'tap', 'select_all', 'write_expression', 'choose', 'find'] as const;
export type QuestionForm = typeof QUESTION_FORMS[number];

/**
 * Theme label → words that signal it (singular; a plural s/es is matched too). Only the label ever
 * leaves this module. Math words that double as contexts (table, bar, pie, plot, line, square,
 * point, pattern) are left out so a bar chart never reads as a "bar" context.
 */
const THEMES: Record<string, string> = {
  pizza: 'pizza', cookies: 'cookie|biscuit', cake: 'cake|cupcake|muffin', baking: 'bake|baker|bakery|bread|oven|loaf|flour',
  fruit: 'fruit|apple|banana|grape|cherry|cherries|berry|berries|strawberry|strawberries|mango|mangoes|pear|melon|lemon|peach',
  vegetables: 'vegetable|carrot|tomato|tomatoes|potato|potatoes|bean|corn|pumpkin', cooking: 'recipe|cook|cooking|chef|soup|pancake|kitchen|rice|noodle|dumpling|taco|tortilla|stew',
  sweets: 'candy|candies|ice cream|chocolate|lollipop', drinks: 'juice|milk|lemonade|smoothie|tea', picnic: 'picnic|sandwich|lunch',
  garden: 'garden|gardener|flower|seed|sprout|plant|tulip|rose|sunflower', forest: 'tree|forest|leaf|leaves|woods|acorn',
  ocean: 'ocean|sea|beach|seashell|shell|wave|whale|dolphin|crab', fish: 'fish|aquarium', river: 'river|lake|pond|stream',
  mountains: 'mountain|hill|hike|hiking|trail|camp|camping|tent|campfire', weather: 'rain|rainfall|snow|snowfall|snowflake|weather|temperature|cloud|wind|storm',
  zoo: 'zoo|lion|elephant|giraffe|monkey|tiger|penguin|bear|zebra|panda|kangaroo', farm: 'farm|farmer|cow|chicken|hen|egg|sheep|goat|pig|horse|barn|tractor',
  pets: 'pet|dog|puppy|puppies|cat|kitten|rabbit|bunny|bunnies|hamster|turtle|paw', birds: 'bird|owl|duck|parrot|feather|nest|eagle',
  bugs: 'bug|ant|bee|beetle|ladybug|butterfly|butterflies|caterpillar|snail|insect', science: 'experiment|lab|magnet|scientist|microscope|rock|crystal|fossil|volcano|volcanoes',
  space: 'space|planet|rocket|astronaut|moon|orbit|comet|galaxy|galaxies|telescope', stars: 'star',
  trains: 'train|railway|station', buses: 'bus|buses', cars: 'car|truck|parking|garage', bikes: 'bike|bicycle|scooter|skateboard',
  boats: 'boat|ship|sail|sailboat|canoe|kayak|ferry|ferries', planes: 'plane|airplane|airport|flight|pilot', travel: 'trip|travel|journey|map|road|tourist',
  soccer: 'soccer', basketball: 'basketball|hoop', running: 'race|runner|relay|marathon|jog', swimming: 'swim|swimmer|swimming|pool',
  sport: 'sport|baseball|tennis|volleyball|cricket|hockey|gym|medal|trophy|trophies|athlete|team', music: 'music|song|drum|piano|guitar|violin|flute|band|concert|choir|rhythm|musician',
  dance: 'dance|dancer', art: 'art|artist|paint|painting|crayon|sketch|canvas|mural|poster|sculpture|gallery|galleries', crafts: 'craft|bead|ribbon|yarn|knit|quilt|sticker|origami|string',
  tiles: 'tile|mosaic', building: 'build|builder|brick|fence|wall|tower|bridge|house|room|floor|carpet|playground|sandbox|construction|patio',
  books: 'book|library|libraries|reading|bookshelf|bookshelves', school: 'school|class|classroom|teacher|student|pencil|marker|notebook',
  shopping: 'shop|store|market|buy|sell|price|cost|coin|sale|cashier', party: 'party|parties|birthday|gift|balloon|invitation|celebration|festival|parade',
  games: 'puzzle|dice|card|board game|marble|chess|toy|kite|game', movies: 'movie|film|photo|camera|theater', clothes: 'shirt|sock|shoe|hat|button|scarf|scarves',
  robots: 'robot|computer|coding', city: 'city|cities|town|street|park|neighborhood',
};
const THEME_RES = Object.entries(THEMES).map(([label, words]) => [label, new RegExp(`\\b(?:${words})(?:s|es)?\\b`, 'i')] as const);

/** Keys whose string values are structure or metadata, not visible content. */
const SKIP_KEYS = new Set(['type', 'kind', 'id', 'figureId', 'region', 'color', 'tag', 'misconception', 'misconceptions', 'version', 'skillIds', 'keyCheck', 'answer', 'expr', 'variables', 'form']);
function visibleText(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) for (const v of node) visibleText(v, out);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (!SKIP_KEYS.has(k)) visibleText(v, out);
  return out;
}
/** The learner-facing question: prompt text and math blocks (not hints, explanation or figure data). */
function questionText(spec: ActivitySpec): string {
  return spec.prompt.map(b => b.type === 'text' ? b.text : b.type === 'math' ? b.tex : '').join(' ');
}

export function contextsOf(spec: ActivitySpec): string[] {
  const text = visibleText({ title: spec.title, prompt: spec.prompt, figures: spec.figures, response: spec.response }).join(' ').replace(/\$[^$]*\$/g, ' ');
  return THEME_RES.filter(([, re]) => re.test(text)).map(([label]) => label);
}

/** The single most specific question form of an activity. */
export function questionForm(spec: ActivitySpec): QuestionForm {
  const q = questionText(spec);
  const r = spec.response;
  if (/doesn[’']?t belong|does not belong|odd one out/i.test(q)) return 'odd_one_out';
  if (/\b(mistake|error|wrong|incorrect)\b|who is right|is (she|he|they) (right|correct)/i.test(q)) return 'spot_error';
  if (/\\square|\\boxed|_{2,}/.test(q)) return 'fill_blank';
  if (/\b(estimate|about how|roughly|closest to|round(ed)? to)\b/i.test(q) || (r.type === 'numeric' && r.tolerance)) return 'estimate';
  if ((r.type === 'multiple_choice' || r.type === 'multi_select') && /\b(why|explain|which (statement|reason|explanation|is true)|true)\b/i.test(q)) return 'explain';
  if (/\b(compare|greater|less|more than|fewer than|larger|smaller|bigger|longer|shorter|heavier|lighter|longest|shortest|most|least)\b|[<>]|\\[lg]t\b/i.test(q)) return 'compare';
  switch (r.type) {
    case 'ordering': return 'order';
    case 'plot_point': return 'plot';
    case 'tap_region': return 'tap';
    case 'multi_select': return 'select_all';
    case 'expression': return 'write_expression';
    case 'multiple_choice': return 'choose';
    default: return 'find';
  }
}

interface NumberUse { whole: number[]; denominators: Set<number>; decimals: boolean; money: boolean; negatives: boolean }
function numberUse(spec: ActivitySpec, into: NumberUse) {
  const q = questionText(spec);
  const r = spec.response;
  for (const m of q.matchAll(/\\frac\{(\d+)\}\{(\d+)\}|\b(\d+)\s*\/\s*(\d+)\b/g)) into.denominators.add(Number(m[2] ?? m[4]));
  if (r.type === 'fraction') into.denominators.add(r.denominator);
  if (/\\\$/.test(q)) into.money = true;
  if (/(^|[^\w.])\d+\.\d+/.test(q) || (r.type === 'numeric' && !Number.isInteger(r.answer))) into.decimals = true;
  if (/(^|[\s($=(,])[−-]\s?\d/.test(q) || (r.type === 'numeric' && r.answer < 0)) into.negatives = true;
  const plain = q.replace(/\\frac\{\d+\}\{\d+\}/g, ' ').replace(/\d+\s*\/\s*\d+/g, ' ').replace(/\d+\.\d+/g, ' ');
  for (const m of plain.matchAll(/\d+(?:,\d{3})*/g)) into.whole.push(Number(m[0].replace(/,/g, '')));
  if (r.type === 'numeric' && Number.isInteger(r.answer)) into.whole.push(Math.abs(r.answer));
}
function describeNumbers(u: NumberUse): string {
  const parts: string[] = [];
  const whole = u.whole.filter(n => Number.isFinite(n));
  if (whole.length) { const lo = Math.min(...whole), hi = Math.max(...whole); parts.push(lo === hi ? `whole ${lo}` : `whole ${lo}-${hi}`); }
  if (u.denominators.size) parts.push(`fractions /${[...u.denominators].sort((a, b) => a - b).slice(0, 4).join('/')}`);
  if (u.decimals) parts.push('decimals');
  if (u.money) parts.push('money');
  if (u.negatives) parts.push('negatives');
  return parts.join('; ');
}

const byFrequency = (xs: string[], limit: number) => {
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([x]) => x);
};

/**
 * Fingerprint of the most recent activities (oldest first in `specs`; the last RECENT_CONTENT_WINDOW
 * are used). Returns undefined when there is nothing to report. Kept to roughly 150 tokens.
 */
export function recentContentOf(specs: readonly ActivitySpec[]): RecentContent | undefined {
  const recent = specs.slice(-RECENT_CONTENT_WINDOW);
  if (!recent.length) return undefined;
  const numbers = new Map<string, NumberUse>();
  for (const s of recent) {
    const skill = s.skillIds[0]!;
    const use = numbers.get(skill) ?? numbers.set(skill, { whole: [], denominators: new Set(), decimals: false, money: false, negatives: false }).get(skill)!;
    numberUse(s, use);
  }
  // Most recently practised skills first.
  const skillOrder = [...new Set(recent.map(s => s.skillIds[0]!).reverse())].slice(0, 4);
  return {
    n: recent.length,
    contexts: byFrequency(recent.flatMap(contextsOf), 12),
    figures: byFrequency(recent.flatMap(s => [...new Set((s.figures ?? []).map(f => f.type))]), 8),
    forms: byFrequency(recent.map(questionForm), 8),
    responses: byFrequency(recent.map(s => s.response.type), 8),
    numbers: Object.fromEntries(skillOrder.flatMap(id => { const d = describeNumbers(numbers.get(id)!); return d ? [[id, d]] : []; })),
  };
}

/** Cheap guard for stored spec content (already validated at record and restore time). */
export function isSpecLike(v: unknown): v is ActivitySpec {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<ActivitySpec>;
  return Array.isArray(s.skillIds) && typeof s.skillIds[0] === 'string' && Array.isArray(s.prompt) && !!s.response && typeof s.response.type === 'string';
}
