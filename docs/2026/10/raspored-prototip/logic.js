/* Čista logika stranice "Raspored i zone" (prototip). Bez DOM-a: radi u pregledniku (prototip) i u običnom Node-u (logic-test.mjs).
   Sve što je ovdje služi kao izvor za portovanje u app/utils/*.ts. Pretpostavke o backendu su označene sa [PRETPOSTAVKA]. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SC = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- datumi ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseIso = (s) => {
    const [y, m, d] = String(s).split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (d, n) => {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() + n);
    return r;
  };
  const mondayOf = (d) => {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const w = r.getDay();
    r.setDate(r.getDate() + (w === 0 ? -6 : 1 - w));
    return r;
  };
  const wdIndex = (d) => (d.getDay() === 0 ? 6 : d.getDay() - 1);
  const weekIsos = (mon) => Array.from({ length: 7 }, (_, i) => iso(addDays(mon, i)));
  const diffDays = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 86400000);

  const WD_SHORT = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
  const WD_LONG = ["ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota", "nedjelja"];
  const MONTH = ["januar", "februar", "mart", "april", "maj", "juni", "juli", "avgust", "septembar", "oktobar", "novembar", "decembar"];

  // "5–11. oktobar 2026." ili "28. septembar – 4. oktobar 2026."
  const weekLabel = (mon) => {
    const e = addDays(mon, 6);
    if (mon.getMonth() === e.getMonth()) return `${mon.getDate()}–${e.getDate()}. ${MONTH[e.getMonth()]} ${e.getFullYear()}.`;
    return `${mon.getDate()}. ${MONTH[mon.getMonth()]} – ${e.getDate()}. ${MONTH[e.getMonth()]} ${e.getFullYear()}.`;
  };
  const dayLong = (isoDate) => {
    const d = parseIso(isoDate);
    return `${WD_LONG[wdIndex(d)]} ${d.getDate()}. ${MONTH[d.getMonth()]}`;
  };
  const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const plural = (n, one, few, many) => {
    const m100 = n % 100, m10 = n % 10;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  /* ---------- vrijeme u danu ---------- */
  // "11:30" -> 690; neispravno -> null. Prihvata i "9", "930", "0930", "17.30", "17,30".
  const parseTime = (raw) => {
    const t = String(raw == null ? "" : raw).trim().replace(/[.,]/, ":");
    let h, m;
    if (/^\d{1,2}:\d{1,2}$/.test(t)) [h, m] = t.split(":").map(Number);
    else if (/^\d{1,2}$/.test(t)) { h = Number(t); m = 0; }
    else if (/^\d{3,4}$/.test(t)) { h = Number(t.slice(0, -2)); m = Number(t.slice(-2)); }
    else return null;
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  };
  const fmtTime = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  const mm = (hhmm) => parseTime(hhmm);
  // "11:00" -> "11", "11:30" -> "11:30" (kratak oblik za pločicu)
  const short = (hhmm) => {
    const [h, m] = String(hhmm).split(":");
    return m === "00" ? String(Number(h)) : `${Number(h)}:${m}`;
  };
  const fmtWin = (a, b) => `${short(a)}–${short(b)}`;
  const fmtWinFull = (a, b) => `${a}–${b}`;
  const stepTime = (str, delta) => {
    const v = parseTime(str);
    if (v == null) return null;
    return fmtTime(Math.min(23 * 60 + 59, Math.max(0, v + delta)));
  };

  /* ---------- statusi ---------- */
  const STATUS = {
    understaffed: { key: "understaffed", label: "Ispod minimuma", rank: 0, tone: "bad" },
    below_target: { key: "below_target", label: "Ispod cilja", rank: 1, tone: "warn" },
    target_reached: { key: "target_reached", label: "Cilj dostignut", rank: 2, tone: "ok" },
    full: { key: "full", label: "Popunjeno", rank: 3, tone: "blue" },
  };
  // Server izvodi status iz kapaciteta; ista formula je u services/shiftTemplatesService.ts (deriveStatus).
  const statusOf = (min, target, max, booked) => {
    if (booked < min) return "understaffed";
    if (booked < target) return "below_target";
    if (max != null && booked >= max) return "full";
    return "target_reached";
  };

  const nowOf = (date) => ({ date: iso(date), min: date.getHours() * 60 + date.getMinutes() });
  // Smjena je završena kad je prošao njen kraj; tada status više nije radnja nego istorija.
  const phase = (s, now) => {
    if (s.date < now.date) return "past";
    if (s.date > now.date) return "upcoming";
    if (mm(s.end) <= now.min) return "past";
    if (mm(s.start) <= now.min) return "live";
    return "upcoming";
  };
  const decorate = (s, now) => ({ ...s, status: statusOf(s.min, s.target, s.max, s.booked), phase: phase(s, now) });

  // "Fale još 2 kurira do minimuma"
  const need = (s) => {
    if (s.booked < s.min) { const d = s.min - s.booked; return `Fale još ${d} ${plural(d, "kurir", "kurira", "kurira")} do minimuma`; }
    if (s.booked < s.target) { const d = s.target - s.booked; return `Fale još ${d} ${plural(d, "kurir", "kurira", "kurira")} do cilja`; }
    if (s.max != null && s.booked >= s.max) return "Popunjeno do maksimuma";
    return "Cilj dostignut";
  };
  // koliko kurira treba da bi se stiglo do cilja (za poruku)
  const missing = (s) => Math.max(0, s.target - s.booked);

  /* ---------- pretraga ---------- */
  const fold = (v) => String(v == null ? "" : v).toLowerCase().replace(/đ/g, "dj").normalize("NFD").replace(/[̀-ͯ]/g, "");

  /* ---------- sedmica ---------- */
  const byStart = (a, b) => mm(a.start) - mm(b.start) || mm(a.end) - mm(b.end) || a.id - b.id;
  const FILTERS = ["all", "understaffed", "below_target", "target_reached", "full"];

  // zones: [{id,name}], dates: 7 iso datuma. Redovi su SVE zone grada (ne samo one sa smjenom): prazna zona se može planirati.
  const weekModel = ({ shifts, zones, dates, now, zoneId = null, filter = "all" }) => {
    const inWeek = shifts.filter((s) => dates.includes(s.date) && (!zoneId || s.zoneId === zoneId)).map((s) => decorate(s, now));
    const matches = (s) => filter === "all" || (s.phase !== "past" && s.status === filter);
    inWeek.forEach((s) => { s.match = matches(s); });
    const counts = { all: 0, understaffed: 0, below_target: 0, target_reached: 0, full: 0, past: 0 };
    inWeek.forEach((s) => {
      if (s.phase === "past") { counts.past++; return; }
      counts.all++;
      counts[s.status]++;
    });
    const days = dates.map((date) => {
      const list = inWeek.filter((s) => s.date === date);
      const active = list.filter((s) => s.phase !== "past");
      return {
        date, slots: list.length,
        target: list.reduce((a, s) => a + s.target, 0), booked: list.reduce((a, s) => a + s.booked, 0),
        under: active.filter((s) => s.status === "understaffed").length, below: active.filter((s) => s.status === "below_target").length,
        past: date < now.date, today: date === now.date,
      };
    });
    const zoneList = zones.filter((z) => !zoneId || z.id === zoneId).slice().sort((a, b) => fold(a.name).localeCompare(fold(b.name)));
    const rows = zoneList.map((z) => {
      const cells = dates.map((date) => ({ date, shifts: inWeek.filter((s) => s.zoneId === z.id && s.date === date).sort(byStart) }));
      return { zone: z, cells, empty: cells.every((c) => c.shifts.length === 0) };
    });
    return { rows, days, counts, total: inWeek.length, shifts: inWeek };
  };

  // Smjene ispod minimuma koje još nisu završile, redom po vremenu: to su "problemi" (dugme "Sljedeći problem").
  const problemList = (model) =>
    model.shifts.filter((s) => s.phase !== "past" && s.status === "understaffed").sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : byStart(a, b)));
  const nextProblem = (model, currentId) => {
    const list = problemList(model);
    if (!list.length) return null;
    const i = list.findIndex((s) => s.id === currentId);
    return list[(i + 1) % list.length];
  };

  /* ---------- nove smjene ---------- */
  // Prečice za trajanje: najčešće (od, do) iz smjena koje firma već ima, sa najčešćim kapacitetom.
  const presetWindows = (shifts, n = 4) => {
    const by = new Map();
    shifts.forEach((s) => {
      const k = `${s.start}|${s.end}`;
      const e = by.get(k) || { start: s.start, end: s.end, count: 0, caps: new Map() };
      e.count++;
      const ck = `${s.min}|${s.target}|${s.max == null ? "" : s.max}`;
      e.caps.set(ck, (e.caps.get(ck) || 0) + 1);
      by.set(k, e);
    });
    return [...by.values()]
      .sort((a, b) => b.count - a.count || mm(a.start) - mm(b.start))
      .slice(0, n)
      .map((e) => {
        const [bk] = [...e.caps.entries()].sort((a, b) => b[1] - a[1])[0];
        const [min, target, max] = bk.split("|");
        return { start: e.start, end: e.end, count: e.count, min: Number(min), target: Number(target), max: max === "" ? null : Number(max) };
      });
  };

  const overlapsOf = (spec, shifts, ignoreId = null) =>
    shifts.filter((s) => s.id !== ignoreId && s.zoneId === spec.zoneId && s.date === spec.date && mm(s.start) < mm(spec.end) && mm(spec.start) < mm(s.end));

  const validateShift = (v) => {
    const e = {};
    const a = parseTime(v.start), b = parseTime(v.end);
    if (a == null) e.start = "Vrijeme upiši kao 17:30.";
    if (b == null) e.end = "Vrijeme upiši kao 22:00.";
    if (a != null && b != null && b <= a) e.end = "Kraj mora biti poslije početka (smjena preko ponoći nije podržana).";
    const mi = Number(v.min), ta = Number(v.target);
    if (!Number.isInteger(mi) || mi < 1) e.min = "Najmanje 1 kurir.";
    if (!Number.isInteger(ta) || ta < 1) e.target = "Cilj je najmanje 1 kurir.";
    else if (Number.isInteger(mi) && ta < mi) e.target = "Cilj ne može biti manji od minimuma.";
    if (v.max != null && v.max !== "") {
      const mx = Number(v.max);
      if (!Number.isInteger(mx) || mx < 1) e.max = "Unesi cijeli broj, najmanje 1.";
      else if (Number.isInteger(ta) && mx < ta) e.max = "Maksimum ne može biti manji od cilja.";
    }
    return e;
  };

  const MAX_BATCH = 60;
  // spec: {days:[iso], zones:[id], start,end,min,target,max,hot}. Svaka kombinacija dan×zona je jedan POST.
  const expandCreate = (spec, existing) => {
    const items = [];
    spec.zones.forEach((zoneId) => spec.days.forEach((date) => {
      const it = { zoneId, date, start: spec.start, end: spec.end, min: spec.min, target: spec.target, max: spec.max == null || spec.max === "" ? null : Number(spec.max), hot: !!spec.hot };
      it.dup = existing.some((s) => s.zoneId === zoneId && s.date === date && s.start === spec.start && s.end === spec.end);
      it.overlap = it.dup ? [] : overlapsOf(it, existing).map((s) => s.id);
      items.push(it);
    }));
    const create = items.filter((i) => !i.dup);
    return { items, create, dup: items.length - create.length, overlaps: create.filter((i) => i.overlap.length).length, tooMany: items.length > MAX_BATCH };
  };

  /* ---------- kopiranje ---------- */
  // [PRETPOSTAVKA] server preskače smjenu koja već postoji (ista zona, isti dan, isto vrijeme); pravilo nije dokumentovano.
  const copyWeekPlan = ({ src, tgt, srcMon, tgtMon, zoneId = null }) => {
    const off = diffDays(iso(srcMon), iso(tgtMon));
    const srcDates = weekIsos(srcMon);
    const list = src.filter((s) => srcDates.includes(s.date) && (!zoneId || s.zoneId === zoneId));
    const out = list.map((s) => {
      const date = iso(addDays(parseIso(s.date), off));
      const dup = tgt.some((t) => t.zoneId === s.zoneId && t.date === date && t.start === s.start && t.end === s.end);
      return { zoneId: s.zoneId, date, start: s.start, end: s.end, min: s.min, target: s.target, max: s.max, hot: s.hot, dup };
    });
    return { items: out, create: out.filter((i) => !i.dup), dup: out.filter((i) => i.dup).length, source: list.length };
  };
  // Kopiranje jednog dana na druge dane: isti kapacitet, isto vrijeme.
  const copyDayPlan = ({ src, fromIso, toIsos, zoneId = null, existing }) => {
    const list = src.filter((s) => s.date === fromIso && (!zoneId || s.zoneId === zoneId));
    const items = [];
    toIsos.filter((d) => d !== fromIso).forEach((date) => list.forEach((s) => {
      const dup = existing.some((t) => t.zoneId === s.zoneId && t.date === date && t.start === s.start && t.end === s.end);
      items.push({ zoneId: s.zoneId, date, start: s.start, end: s.end, min: s.min, target: s.target, max: s.max, hot: s.hot, dup });
    }));
    const create = items.filter((i) => !i.dup);
    return { items, create, dup: items.length - create.length, source: list.length, tooMany: items.length > MAX_BATCH };
  };

  /* ---------- pokrivenost u toku dana ---------- */
  // Rupe u jednoj zoni jednog dana: vrijeme između dvije smjene u kojem nema nijedne ("15–17").
  const gaps = (zoneDayShifts) => {
    const list = zoneDayShifts.map((s) => [mm(s.start), mm(s.end)]).sort((a, b) => a[0] - b[0]);
    const out = [];
    let end = null;
    list.forEach(([a, b]) => {
      if (end != null && a > end) out.push([end, a]);
      end = end == null ? b : Math.max(end, b);
    });
    return out.map(([a, b]) => ({ from: fmtTime(a), to: fmtTime(b), minutes: b - a }));
  };

  /* ---------- "Sada" ---------- */
  const nowPlan = ({ shifts, zoneId, now }) => {
    const today = shifts.filter((s) => s.zoneId === zoneId && s.date === now.date).map((s) => decorate(s, now)).sort(byStart);
    const current = today.filter((s) => s.phase === "live");
    const next = today.find((s) => s.phase === "upcoming") || null;
    const worst = current.slice().sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank)[0] || null;
    const minutesLeft = current.length ? Math.min(...current.map((s) => mm(s.end) - now.min)) : null;
    const minutesToNext = next ? mm(next.start) - now.min : null;
    return { today, current, next, worst, minutesLeft, minutesToNext };
  };
  const liveTotal = (l) => (l ? l.online + l.idle + l.delivering : 0);
  // Jedan znak po zoni; poredak kartica ide po `rank` (manji = hitnije). Ne poredi plan sa brojem na terenu osim u jednom slučaju:
  // smjena traje, a u zoni nema nikoga (online + idle + delivering = 0). Značenje polja online/idle nije dokumentovano.
  const zoneNow = (plan, live) => {
    if (plan.current.length) {
      if (liveTotal(live) === 0) return { code: "empty", tone: "bad", label: "Nikoga u zoni", rank: 0 };
      if (plan.worst.status === "understaffed") return { code: "under", tone: "bad", label: "Ispod minimuma", rank: 1 };
      if (plan.worst.status === "below_target") return { code: "below", tone: "warn", label: "Ispod cilja", rank: 3 };
      return { code: "ok", tone: "ok", label: "U redu", rank: 4 };
    }
    if (plan.next) {
      const d = decorate(plan.next, { date: plan.next.date, min: 0 });
      if (d.status === "understaffed") return { code: "next-under", tone: "warn", label: "Sljedeća smjena je ispod minimuma", rank: 2 };
      return { code: "next", tone: "idle", label: "Nema smjene sada", rank: 5 };
    }
    return { code: "none", tone: "idle", label: "Danas nema smjena", rank: 6 };
  };
  const ago = (sec) => (sec < 5 ? "upravo sada" : sec < 60 ? `prije ${Math.round(sec)} s` : `prije ${Math.floor(sec / 60)} min`);
  const inText = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? " " + (min % 60) + " min" : ""}`);

  /* ---------- provjera dostupnosti ---------- */
  // Procjena iz smjena koje sada traju: zbir `booked` (current_bookings). [PRETPOSTAVKA] server odlučuje po potvrđenim terminima kurira;
  // tačan broj bi dao zaseban odgovor (pitanje B8). Zato se u ekranu piše "procjena".
  const enforceImpact = ({ shifts, now, zones }) => {
    const live = shifts.filter((s) => phase(s, now) === "live").map((s) => decorate(s, now));
    const booked = live.reduce((a, s) => a + s.booked, 0);
    const name = (id) => (zones.find((z) => z.id === id) || {}).name || `Zona #${id}`;
    return {
      inProgress: live.length, booked, zeroShifts: live.filter((s) => s.booked === 0).length,
      lines: live.map((s) => ({ zone: name(s.zoneId), win: fmtWin(s.start, s.end), booked: s.booked, target: s.target })),
      level: live.length === 0 ? "none" : booked === 0 ? "zero" : live.some((s) => s.booked === 0) ? "partial" : "ok",
    };
  };

  /* ---------- poruka kuriru ---------- */
  const askDraft = (s, zoneName, now) => {
    const n = Math.max(1, missing(s) || 1);
    const when = s.date === now.date ? "danas" : dayLong(s.date);
    return {
      category: "announcement",
      title: `Treba nam još kurira: ${zoneName}, ${when} ${fmtWin(s.start, s.end)}`,
      body: `U zoni ${zoneName}, ${when} od ${s.start} do ${s.end}, treba nam još ${n} ${plural(n, "kurir", "kurira", "kurira")}. Ko može da radi neka potvrdi termin u aplikaciji (Radno vrijeme) ili javi dispečeru.`,
      selection: { kind: "preset", key: "active" },
    };
  };

  /* ---------- zone ---------- */
  const R_EARTH = 6371000;
  const distM = (a, b) => {
    const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.sqrt(h));
  };
  // Koliko se manji krug preklapa sa većim, u procentima manjeg (0–100).
  const overlapPct = (a, b) => {
    const d = distM(a, b), r1 = a.r, r2 = b.r;
    if (d >= r1 + r2) return 0;
    const small = Math.min(r1, r2), big = Math.max(r1, r2);
    if (d <= big - small) return 100;
    const A = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1)) + r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2)) - 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
    return Math.min(100, Math.round((A / (Math.PI * small * small)) * 100));
  };
  const areaKm2 = (r) => (Math.PI * r * r) / 1e6;
  const fmtKm = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1).replace(".", ",")} km` : `${m} m`);
  const overlaps = (zone, zones) =>
    zones.filter((z) => z.id !== zone.id && z.lat != null && z.lng != null && z.r != null && zone.lat != null)
      .map((z) => ({ zone: z, pct: overlapPct(zone, z) })).filter((x) => x.pct > 0).sort((a, b) => b.pct - a.pct);
  const TERRAIN = [
    { v: 1, label: "Ravno", hint: "1,0" },
    { v: 1.5, label: "Brdovito", hint: "1,5" },
    { v: 2, label: "Strmo", hint: "2,0" },
  ];
  const fmtNum = (n) => String(n).replace(".", ",");
  const searchZones = (zones, q) => {
    const n = fold(q).trim();
    return n ? zones.filter((z) => fold(z.name).includes(n)) : zones;
  };
  // Broj smjena u zoni od danas za `days` dana: za dijalog brisanja.
  const usage = (zoneId, shifts, now, days = 28) => {
    const end = iso(addDays(parseIso(now.date), days));
    return shifts.filter((s) => s.zoneId === zoneId && s.date >= now.date && s.date < end).length;
  };

  return {
    iso, parseIso, addDays, mondayOf, wdIndex, weekIsos, diffDays, WD_SHORT, WD_LONG, MONTH, weekLabel, dayLong, cap1, plural,
    parseTime, fmtTime, mm, short, fmtWin, fmtWinFull, stepTime,
    STATUS, statusOf, nowOf, phase, decorate, need, missing, fold,
    FILTERS, weekModel, problemList, nextProblem,
    presetWindows, overlapsOf, validateShift, MAX_BATCH, expandCreate, copyWeekPlan, copyDayPlan, gaps,
    nowPlan, liveTotal, zoneNow, ago, inText, enforceImpact, askDraft,
    distM, overlapPct, areaKm2, fmtKm, overlaps, TERRAIN, fmtNum, searchZones, usage,
  };
});
