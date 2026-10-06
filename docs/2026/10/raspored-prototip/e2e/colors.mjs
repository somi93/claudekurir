// Boje i kontrast teksta (WCAG) za provjere u pravom Chrome-u: stvarne boje iz stila, uz slojeve prozirnosti.
export const COLORS_FN = `(el) => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; } const s = c.match(/color\\(srgb ([0-9.]+) ([0-9.]+) ([0-9.]+)(?: \\/ ([0-9.]+))?\\)/); if (s) return { r: +s[1] * 255, g: +s[2] * 255, b: +s[3] * 255, a: s[4] === undefined ? 1 : +s[4] }; return null; };
  const cs = getComputedStyle(el);
  const fg = parse(cs.color);
  let bg = null, n = el, layers = [];
  while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) layers.push(c); if (c && c.a > 0.99) { bg = c; break; } n = n.parentElement; }
  let base = bg || { r: 255, g: 255, b: 255, a: 1 };
  // slojevi sa prozirnošću se slažu odozdo prema gore
  const stack = layers.slice(0, bg ? layers.length - 1 : layers.length).reverse();
  for (const l of stack) base = { r: l.r * l.a + base.r * (1 - l.a), g: l.g * l.a + base.g * (1 - l.a), b: l.b * l.a + base.b * (1 - l.a), a: 1 };
  let op = 1; n = el; while (n) { op *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
  let f = fg; if (f && op < 1) f = { r: f.r * op + base.r * (1 - op), g: f.g * op + base.g * (1 - op), b: f.b * op + base.b * (1 - op), a: 1 };
  return { fg: f, bg: base, size: parseFloat(cs.fontSize), weight: cs.fontWeight, text: (el.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 40) };
}`;
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
export const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const contrastOf = async (b, sel, nth = 0) => {
  const c = await b.evalJs(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; return el ? (${COLORS_FN})(el) : null; })()`);
  if (!c || !c.fg) return null;
  return { ...c, ratio: Math.round(ratio(c.fg, c.bg) * 100) / 100 };
};
