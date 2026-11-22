// Circle packing. Items: { n (name), a (amount) } plus anything, largest first.
const GAP = 0.03, FLOOR = 0.3;
// Softened on purpose: the order is kept, but the smallest circle still has room for its name.
export const radius = (a, max) => FLOOR + (1 - FLOOR) * Math.sqrt(a / max);

// wide: how much wider than tall the group may be.
export function pack(list, wide = 1) {
  const P = [], max = Math.max(...list.map((it) => it.a));
  list.forEach((it, i) => {
    const r = radius(it.a, max);
    if (i === 0) return void P.push({ it, r, x: 0, y: 0 });
    if (i === 1) return void P.push({ it, r, x: P[0].r + r + GAP, y: 0 });
    const w = P.reduce((s, p) => s + p.r * p.r, 0), cx = P.reduce((s, p) => s + p.x * p.r * p.r, 0) / w, cy = P.reduce((s, p) => s + p.y * p.r * p.r, 0) / w;
    let best = null;
    for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) {
      const A = P[a], B = P[b], ra = A.r + r + GAP, rb = B.r + r + GAP, dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d > ra + rb || d === 0) continue;
      const t = (ra * ra - rb * rb + d * d) / (2 * d), h2 = ra * ra - t * t;
      if (h2 < 0) continue;
      for (const s of [1, -1]) {
        const x = A.x + (t * dx - s * Math.sqrt(h2) * dy) / d, y = A.y + (t * dy + s * Math.sqrt(h2) * dx) / d;
        if (P.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + r + GAP - 0.001)) continue;
        const cost = Math.hypot((x - cx) / wide, y - cy);
        if (!best || cost < best.cost) best = { x, y, cost };
      }
    }
    // Amounts far apart can leave no touching spot: the circle then goes just outside the group.
    if (!best) best = { x: Math.max(...P.map((p) => p.x + p.r)) + r + GAP, y: cy };
    P.push({ it, r, x: best.x, y: best.y });
  });
  return P;
}

// The name in lines that fit inside the circle. Under 11 px there is no text.
export function label(name, r) {
  const lines = [];
  for (const w of name.split(' ')) lines.length && w.length < 3 ? (lines[lines.length - 1] += ' ' + w) : lines.push(w);
  const cut = lines.slice(0, 3).map((l) => (l.length > 14 ? l.slice(0, 13) + '…' : l));
  if (lines.length > 3) cut[2] += '…';
  const long = Math.max(...cut.map((l) => l.length));
  const fs = Math.floor(Math.min(30, (0.92 * r) / Math.hypot(long * 0.29, cut.length * 0.56)));
  return fs < 11 ? { lines: [], fs: 0 } : { lines: cut, fs };
}

export function layout(list, W, H, most = 190) {
  if (!list.length) return { w: 0, h: 0, balls: [] };
  const P = pack(list, W / H);
  const x0 = Math.min(...P.map((p) => p.x - p.r)), x1 = Math.max(...P.map((p) => p.x + p.r)), y0 = Math.min(...P.map((p) => p.y - p.r)), y1 = Math.max(...P.map((p) => p.y + p.r));
  const k = Math.min(W / (x1 - x0), H / (y1 - y0), most);
  return {
    w: Math.ceil(k * (x1 - x0)), h: Math.ceil(k * (y1 - y0)),
    balls: P.map((p) => ({ ...p.it, left: Math.round(k * (p.x - p.r - x0)), top: Math.round(k * (p.y - p.r - y0)), d: Math.floor(2 * k * p.r), ...label(p.it.n, k * p.r) })),
  };
}
