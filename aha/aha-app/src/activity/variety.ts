/**
 * Cross-batch variety memory. Each batch is a separate model call with no memory of earlier batches, so the
 * learner summary carries a compact digest of the most recent AI activities (`RECENT_CONTENT_WINDOW`, shown,
 * answered and queued): the contexts and objects they used, the number sets per skill, the figure types and
 * the question forms. The prompt tells the model not to repeat them.
 *
 * Privacy and trust: the digest is built from validated activity specs only, never from the learner's answers.
 * Every word in it comes from a closed vocabulary defined here (theme labels, object nouns, figure type names,
 * question-form names, skill ids) or is a number, so no model-written free text (names, sentences, an injected
 * instruction) is ever echoed into a later prompt.
 */
import type { ActivitySpec } from './spec';

/** How many recent activities the digest covers: about the last 40 the learner saw or has waiting. */
export const RECENT_CONTENT_WINDOW = 40;
/** The digest's JSON stays within this many characters (~250 tokens); lists are trimmed, least used first. */
export const RECENT_CONTENT_MAX_CHARS = 1000;

/** The digest sent as LEARNER.recentContent. Lists are ordered most used first. */
export interface RecentContent {
  /** Activities covered. */
  n: number;
  /** Real-world themes (closed vocabulary). */
  contexts: string[];
  /** Object nouns (closed vocabulary). */
  objects: string[];
  figures: string[];
  /** Question forms (closed vocabulary, see QUESTION_FORMS). */
  forms: string[];
  /** Per skill, the number sets its activities used, most recent first: "4,5" (a 4 by 5 rectangle, 4 groups of 5), "3/8". */
  numbers: Record<string, string[]>;
}

export const QUESTION_FORMS = ['odd_one_out', 'spot_error', 'fill_blank', 'estimate', 'explain', 'compare', 'order', 'plot', 'tap', 'select_all', 'write_expression', 'choose', 'find'] as const;
export type QuestionForm = typeof QUESTION_FORMS[number];

/**
 * Theme label → object words that signal it (singular; a plural is matched too). Only the label and the matched
 * vocabulary word ever leave this module. Math words that double as contexts (table, bar, pie, plot, line, square,
 * point, pattern, unit) are left out so a bar chart never reads as a "bar" context.
 */
const THEMES: Record<string, string> = {
  pizza: 'pizza', cookies: 'cookie|biscuit', cake: 'cake|cupcake|muffin|pie slice', baking: 'baker|bakery|bread|oven|loaf|flour|bagel|pretzel',
  fruit: 'fruit|apple|banana|grape|cherry|berry|strawberry|blueberry|mango|pear|melon|watermelon|lemon|orange|peach|plum|kiwi|pineapple',
  vegetables: 'vegetable|carrot|tomato|potato|bean|pea|corn|pumpkin|cucumber|pepper', cooking: 'recipe|chef|soup|pancake|kitchen|rice|noodle|dumpling|taco|tortilla|stew|salad|cup of flour',
  sweets: 'candy|ice cream|chocolate|chocolate bar|candy bar|lollipop|gumball|jelly bean|marshmallow|donut', drinks: 'juice|milk|lemonade|smoothie|tea|water bottle', picnic: 'picnic|sandwich|lunch|lunchbox',
  garden: 'garden|gardener|flower|seed|sprout|plant|tulip|rose|sunflower|flower bed|vegetable patch', forest: 'tree|forest|leaf|woods|acorn|pinecone|mushroom',
  ocean: 'ocean|sea|beach|seashell|shell|wave|whale|dolphin|crab|starfish|octopus', fish: 'fish|aquarium|goldfish', river: 'river|lake|pond|stream|waterfall',
  mountains: 'mountain|hill|hike|trail|camp|tent|campfire', weather: 'rain|rainfall|snow|snowfall|snowflake|weather|temperature|cloud|wind|storm|thermometer',
  zoo: 'zoo|lion|elephant|giraffe|monkey|tiger|penguin|bear|zebra|panda|kangaroo|koala', farm: 'farm|farmer|cow|chicken|hen|egg|sheep|goat|pig|horse|barn|tractor|duckling',
  pets: 'pet|dog|puppy|cat|kitten|rabbit|bunny|hamster|turtle|parrot|guinea pig', birds: 'bird|owl|duck|feather|nest|eagle|robin|pigeon',
  bugs: 'bug|ant|bee|beetle|ladybug|butterfly|caterpillar|snail|insect|spider', science: 'experiment|lab|magnet|scientist|microscope|rock|crystal|fossil|volcano|beaker',
  space: 'space|planet|rocket|astronaut|moon|orbit|comet|galaxy|telescope|satellite', stars: 'star',
  trains: 'train|railway|station|subway', buses: 'bus', cars: 'car|truck|parking lot|garage|taxi', bikes: 'bike|bicycle|scooter|skateboard',
  boats: 'boat|ship|sailboat|canoe|kayak|ferry', planes: 'plane|airplane|airport|flight|pilot|helicopter', travel: 'trip|journey|map|road|tourist|suitcase',
  soccer: 'soccer|soccer ball|goal', basketball: 'basketball|hoop', running: 'race|runner|relay|marathon|lap', swimming: 'swimmer|swimming pool|pool',
  sport: 'baseball|tennis|volleyball|cricket|hockey|gym|medal|trophy|athlete|team|jump rope', music: 'music|song|drum|piano|guitar|violin|flute|band|concert|choir|musician|note',
  dance: 'dance|dancer', art: 'artist|paint|painting|crayon|sketch|canvas|mural|poster|sculpture|gallery|paintbrush', crafts: 'craft|bead|ribbon|yarn|quilt|sticker|origami|string|necklace|bracelet',
  tiles: 'tile|mosaic', building: 'builder|brick|fence|wall|tower|bridge|house|room|floor|carpet|rug|playground|sandbox|patio|garden bed|window|door|shelf',
  books: 'book|library|bookshelf|page|comic', school: 'school|classroom|teacher|student|pencil|marker|notebook|eraser|ruler|backpack|crayon box',
  shopping: 'shop|store|market|cashier|coin|price|sale|ticket', party: 'party|birthday|gift|balloon|invitation|festival|parade|cupcake tray',
  games: 'puzzle|dice|card|board game|marble|chess|toy|kite|block|domino|yo-yo', movies: 'movie|film|photo|camera|theater|popcorn', clothes: 'shirt|sock|shoe|hat|button|scarf|mitten|glove',
  robots: 'robot|computer|coding|tablet', city: 'city|town|street|park|neighborhood|bakery shop',
};
/** Irregular plurals the simple rules below do not cover. */
const PLURALS: Record<string, string> = { leaf: 'leaves', mouse: 'mice', goose: 'geese', fish: 'fish', sheep: 'sheep', shelf: 'shelves', scarf: 'scarves', loaf: 'loaves', 'yo-yo': 'yo-yos' };
const plural = (w: string) => PLURALS[w] ?? (/[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : /(s|x|z|ch|sh|o)$/.test(w) ? `${w}es` : `${w}s`);
const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
/** Every object word, longest first so "chocolate bar" wins over "chocolate", with its theme. */
const OBJECTS: { word: string; theme: string; re: RegExp }[] = Object.entries(THEMES)
  .flatMap(([theme, words]) => words.split('|').map(word => ({ word, theme })))
  .sort((a, b) => b.word.length - a.word.length)
  .map(o => ({ ...o, re: new RegExp(`\\b(?:${escape(o.word)}|${escape(plural(o.word))})\\b`, 'i') }));

/** Keys whose string values are structure or metadata, not visible content. */
const SKIP_KEYS = new Set(['type', 'kind', 'id', 'figureId', 'region', 'color', 'tag', 'misconception', 'misconceptions', 'version', 'skillIds', 'keyCheck', 'answer', 'expr', 'variables', 'form', 'icon']);
function visibleText(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) for (const v of node) visibleText(v, out);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (!SKIP_KEYS.has(k)) visibleText(v, out);
  return out;
}
/** The learner-facing question: prompt text and math blocks (not hints, explanation or figure data). */
export function questionText(spec: ActivitySpec): string {
  return spec.prompt.map(b => b.type === 'text' ? b.text : b.type === 'math' ? b.tex : '').join(' ');
}
/** The visible words of an activity outside math: title, prompt, figure labels, options, picture icons. */
function surfaceText(spec: ActivitySpec): string {
  const icons = (spec.figures ?? []).flatMap(f => f.type === 'picture' ? f.groups.map(g => g.icon.replace(/_/g, ' ')) : f.type === 'array_grid' && f.icon ? [f.icon.replace(/_/g, ' ')] : []);
  return [...visibleText({ title: spec.title, prompt: spec.prompt, figures: spec.figures, response: spec.response }), ...icons].join(' ').replace(/\$[^$]*\$/g, ' ');
}

/** Object nouns (closed vocabulary) the activity shows, most specific first; a longer phrase hides the words inside it. */
export function objectsOf(spec: ActivitySpec): string[] {
  let text = surfaceText(spec);
  const out: string[] = [];
  for (const o of OBJECTS) if (o.re.test(text)) { out.push(o.word); text = text.replace(new RegExp(o.re.source, 'gi'), ' '); }
  return out;
}
/** Real-world themes (closed vocabulary). */
export function contextsOf(spec: ActivitySpec): string[] {
  const themes = new Map(OBJECTS.map(o => [o.word, o.theme]));
  return [...new Set(objectsOf(spec).map(w => themes.get(w)!))];
}
/** The main object of the question itself (the first vocabulary word in the prompt text), for reuse metrics. */
export function primaryObject(spec: ActivitySpec): string | undefined {
  const text = questionText(spec).replace(/\$[^$]*\$/g, ' ');
  let best: { word: string; at: number } | undefined;
  for (const o of OBJECTS) {
    const m = o.re.exec(text);
    if (m && (!best || m.index < best.at)) best = { word: o.word, at: m.index };
  }
  return best?.word;
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

const fmtNum = (n: number) => String(Math.round(n * 1000) / 1000);
/**
 * The number set an activity is built on, as one canonical key: the whole numbers, decimals and fractions in its
 * question text plus the quantities its figure draws (a rectangle's side lengths, an array's rows and columns,
 * picture group sizes, a fraction model's shaded/parts). Sorted, at most 4 values, so "5 by 3" and "3 by 5" are
 * the same set. The answer is not part of it. Undefined when the activity has no numbers.
 */
export function numberKey(spec: ActivitySpec): string | undefined {
  const values = new Set<string>();
  let text = questionText(spec);
  for (const m of text.matchAll(/\\frac\{(\d+)\}\{(\d+)\}|\b(\d+)\s*\/\s*(\d+)\b/g)) values.add(`${m[1] ?? m[3]}/${m[2] ?? m[4]}`);
  text = text.replace(/\\frac\{\d+\}\{\d+\}/g, ' ').replace(/\b\d+\s*\/\s*\d+\b/g, ' ');
  for (const m of text.matchAll(/\d+(?:,\d{3})*(?:\.\d+)?/g)) values.add(fmtNum(Number(m[0].replace(/,/g, ''))));
  for (const f of spec.figures ?? []) {
    if (f.type === 'geometry') {
      const unit = f.grid?.unit ?? 1;
      for (const s of f.shapes) {
        const rect = s.kind === 'polygon' ? rectangleSides(s.points) : undefined;
        if (rect) { values.add(fmtNum(rect.w / unit)); values.add(fmtNum(rect.h / unit)); }
      }
    } else if (f.type === 'array_grid') { values.add(String(f.rows)); values.add(String(f.cols)); }
    else if (f.type === 'picture') for (const g of f.groups) { values.add(String(g.count)); if ((g.repeat ?? 1) > 1) values.add(String(g.repeat)); }
    else if (f.type === 'fraction_model') values.add(`${f.shaded}/${f.parts}`);
  }
  if (!values.size) return undefined;
  const order = (v: string) => { const [a, b] = v.split('/'); return b ? Number(a) / Number(b) : Number(a); };
  return [...values].sort((a, b) => order(a) - order(b) || a.localeCompare(b)).slice(0, 4).join(',');
}

/** Side lengths of an axis-aligned rectangle (4 vertices on 2 distinct x and 2 distinct y values), else undefined. */
export function rectangleSides(points: readonly { x: number; y: number }[]): { w: number; h: number } | undefined {
  if (points.length !== 4) return undefined;
  const xs = [...new Set(points.map(p => p.x))], ys = [...new Set(points.map(p => p.y))];
  if (xs.length !== 2 || ys.length !== 2) return undefined;
  const corners = new Set(points.map(p => `${p.x},${p.y}`));
  if (corners.size !== 4 || !xs.every(x => ys.every(y => corners.has(`${x},${y}`)))) return undefined;
  return { w: Math.abs(xs[0]! - xs[1]!), h: Math.abs(ys[0]! - ys[1]!) };
}

/**
 * A rectangle whose two side lengths the key uses (a keyCheck of "3*5" over a 5 by 3 rectangle: area, perimeter,
 * counting square units) must show them: unit squares (`unitSquares` or graph paper `grid`) or both lengths labelled by
 * a dimension, label or polygon label. Figure data and the keyCheck only, never prose. Behind spec.ts `authoringErrors`.
 */
export function rectangleDimensionErrors(spec: ActivitySpec): string[] {
  const errors: string[] = [];
  const check = spec.keyCheck && 'value' in spec.keyCheck ? spec.keyCheck.value : undefined;
  if (!check || (spec.response.type !== 'numeric' && spec.response.type !== 'fraction')) return errors;
  const numbersIn = (t: string) => [...t.matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const keyNumbers = numbersIn(check);
  (spec.figures ?? []).forEach((f, i) => {
    if (f.type !== 'geometry') return;
    const unit = f.grid?.unit ?? 1;
    const texts = f.shapes.flatMap(s => s.kind === 'dimension' ? [s.label] : s.kind === 'label' ? [s.text] : s.kind === 'polygon' && s.label ? [s.label] : []);
    const labelled = (n: number) => texts.some(t => numbersIn(t).some(v => same(v, n)));
    const used = (n: number) => keyNumbers.some(v => same(v, n));
    f.shapes.forEach((s, k) => {
      if (s.kind !== 'polygon') return;
      const sides = rectangleSides(s.points);
      if (!sides) return;
      const w = sides.w / unit, h = sides.h / unit;
      if (!used(w) || !used(h) || s.unitSquares || f.grid || (labelled(w) && labelled(h))) return;
      errors.push(`figures[${i}].shapes[${k}]: the key uses this rectangle's ${fmtNum(w)} by ${fmtNum(h)} sides, but the figure shows neither unit squares (unitSquares or grid) nor labels for both lengths; never ask about what is not drawn.`);
    });
  });
  return errors;
}

/**
 * The prompt's template for reuse metrics (dev eval only, never sent to a model): the question text lowercased
 * with numbers as #, capitalized words (names) as N, and punctuation removed.
 */
export function templateKey(spec: ActivitySpec): string {
  return questionText(spec)
    .replace(/\\frac\{\d+\}\{\d+\}/g, '#').replace(/\d+(?:[.,]\d+)*/g, '#')
    .replace(/\b[A-Z][a-z]+\b/g, 'N').toLowerCase().replace(/[^a-z#\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const byFrequency = (xs: string[], limit: number) => {
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([x]) => x);
};

/**
 * Digest of the most recent activities (oldest first in `specs`; the last RECENT_CONTENT_WINDOW are used), within
 * RECENT_CONTENT_MAX_CHARS of JSON. Undefined when there is nothing to report.
 */
export function recentContentOf(specs: readonly ActivitySpec[]): RecentContent | undefined {
  const recent = specs.slice(-RECENT_CONTENT_WINDOW);
  if (!recent.length) return undefined;
  // Number sets per skill, most recent first, each set once.
  const numbers = new Map<string, string[]>();
  for (const s of [...recent].reverse()) {
    const key = numberKey(s);
    if (!key) continue;
    const list = numbers.get(s.skillIds[0]!) ?? numbers.set(s.skillIds[0]!, []).get(s.skillIds[0]!)!;
    if (!list.includes(key)) list.push(key);
  }
  const out: RecentContent = {
    n: recent.length,
    contexts: byFrequency(recent.flatMap(contextsOf), 12),
    objects: byFrequency(recent.flatMap(objectsOf), 20),
    figures: byFrequency(recent.flatMap(s => [...new Set((s.figures ?? []).map(f => f.type))]), 8),
    forms: byFrequency(recent.map(questionForm), 8),
    numbers: Object.fromEntries([...numbers].slice(0, 8).map(([id, sets]) => [id, sets.slice(0, 8)])),
  };
  // Trim to the size bound: the longest per-skill number list first, then the object and context tails.
  const size = () => JSON.stringify(out).length;
  while (size() > RECENT_CONTENT_MAX_CHARS) {
    const lists = Object.values(out.numbers);
    const longest = lists.reduce<string[] | undefined>((a, l) => !a || l.length > a.length ? l : a, undefined);
    if (longest && longest.length > 3) longest.pop();
    else if (out.objects.length > 8) out.objects.pop();
    else if (out.contexts.length > 6) out.contexts.pop();
    else { const ids = Object.keys(out.numbers); if (!ids.length) break; delete out.numbers[ids.at(-1)!]; }
  }
  return out;
}

/** Cheap guard for stored spec content (already validated at record and restore time). */
export function isSpecLike(v: unknown): v is ActivitySpec {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<ActivitySpec>;
  return Array.isArray(s.skillIds) && typeof s.skillIds[0] === 'string' && Array.isArray(s.prompt) && !!s.response && typeof s.response.type === 'string';
}
