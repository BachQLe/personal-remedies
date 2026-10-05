// Merge hand-verified Unsplash picks into itemImages.generated.json.
// Every URL must pass a live check (HTTP 200 + image/* content-type); existing entries are never overwritten.
import fs from 'node:fs';
const OUT = new URL('../src/data/cache/itemImages.generated.json', import.meta.url);
const picks = JSON.parse(fs.readFileSync(new URL('./item-image-picks.json', import.meta.url), 'utf8'));
const data = JSON.parse(fs.readFileSync(OUT, 'utf8'));
let added = 0;
for (const [id, p] of Object.entries(picks)) {
  if (data[id]) continue;
  const imageFile = `https://images.unsplash.com/photo-${p}?w=600&q=80&auto=format&fit=crop`;
  const r = await fetch(imageFile);
  if (r.status !== 200 || !r.headers.get('content-type')?.startsWith('image/')) { console.error('FAIL', id, r.status); continue; }
  data[id] = { imageFile }; added++;
}
const sorted = Object.fromEntries(Object.entries(data).sort((a, b) => a[0] - b[0]));
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 1) + '\n');
console.log('added', added, 'total', Object.keys(sorted).length);
