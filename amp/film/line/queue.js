// Read-only review queue. Reviews belong to the review service.
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const clock = n => { const s = Math.round(n); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function row(film) {
  const row = el('div', 'q-row'), main = el('div', 'q-main'), side = el('div', 'q-side');
  const link = el('a', '', film.title);
  link.href = `${urls.review}?id=${encodeURIComponent(film.id)}&list=line`;
  main.append(link, el('div', 'q-meta', `${film.level} · ${clock(film.seconds)}`));
  const watch = el('a', 'q-watch', 'Watch'); watch.href = link.href; side.append(watch);
  row.append(main, side);
  return row;
}
async function load() {
  const waiting = document.getElementById('waiting');
  try {
    const get = async url => { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('Review queue unavailable'); return r.json(); };
    const [films, reviews] = await Promise.all([get(urls.queue), get(urls.reviews)]);
    const current = film => {
      const r = reviews[film.id];
      // An export answering notes preserves the release; a new release asks again.
      return r && typeof r.score === 'number' && Date.parse(r.at) >= Date.parse(film.released || film.added) ? r : null;
    };
    const w = films.filter(f => !current(f));
    waiting.replaceChildren(...w.map(row));
    if (!w.length) waiting.append(el('p', 'q-empty', 'Nothing is waiting. New films appear here when they are ready.'));
  } catch {
    waiting.textContent = 'Could not load the review queue. Reload to try again.';
  }
}
load();
addEventListener('pageshow', load);
