// Read-only review queue. Reviews belong to the review service.
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const clock = n => { const s = Math.round(n); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function row(film, review) {
  const row = el('div', 'q-row'), main = el('div', 'q-main'), side = el('div', 'q-side');
  const link = el('a', '', film.title);
  link.href = `${urls.review}?id=${encodeURIComponent(film.id)}&list=line`;
  main.append(link, el('div', 'q-meta', `${film.level} · ${clock(film.seconds)}`));
  if (review?.summary) main.append(el('div', 'q-note', review.summary.trim().split('\n')[0].slice(0, 220)));
  if (review) side.append(el('div', 'q-score', String(review.score)), el('div', '', 'of 10'));
  else { const watch = el('a', 'q-watch', 'Watch'); watch.href = link.href; side.append(watch); }
  row.append(main, side);
  return row;
}
async function load() {
  const waiting = document.getElementById('waiting'), scored = document.getElementById('scored');
  try {
    const get = async url => { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('Review queue unavailable'); return r.json(); };
    const [films, reviews] = await Promise.all([get(urls.queue), get(urls.reviews)]);
    const current = film => {
      const r = reviews[film.id];
      return r && Number.isFinite(r.score) && r.score >= 0 && r.score <= 10 && (!r.added || r.added === film.added) ? r : null;
    };
    const w = films.filter(f => !current(f)), s = films.filter(current).reverse();
    waiting.replaceChildren(...w.map(f => row(f, null)));
    scored.replaceChildren(...s.map(f => row(f, current(f))));
    if (!w.length) waiting.append(el('p', '', 'Nothing is waiting. New films appear here when they are ready.'));
    if (!s.length) scored.append(el('p', '', 'No film scored yet.'));
  } catch {
    waiting.textContent = 'Could not load the review queue. Reload to try again.';
    scored.replaceChildren();
  }
}
load();
addEventListener('pageshow', load);
