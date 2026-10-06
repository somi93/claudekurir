/* Izmišljeni svijet za prototip stranice "Raspored i zone": jedna firma u Banjoj Luci, sedam zona, smjene za četiri sedmice, stanje uživo.
   "Sada" je zaključano na ponedjeljak 5. oktobar 2026. u 14:20, da brojke u tekstu table ostanu iste pri svakom otvaranju.
   Svi brojevi su probni podaci; ništa u ovom fajlu nije dokaz o pravom backendu. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./logic.js"));
  else root.SCW = factory(root.SC);
})(typeof self !== "undefined" ? self : this, function (SC) {
  "use strict";

  const NOW = new Date(2026, 9, 5, 14, 20, 0);

  const ZONES = () => [
    { id: 11, name: "Centar", tf: 1.0, lat: 44.7722, lng: 17.191, r: 1500 },
    { id: 12, name: "Starčevica", tf: 1.4, lat: 44.7861, lng: 17.2105, r: 1800 },
    { id: 13, name: "Lauš", tf: 1.1, lat: 44.7501, lng: 17.2012, r: 2000 },
    { id: 14, name: "Obilićevo", tf: 1.0, lat: 44.7402, lng: 17.1801, r: 2200 },
    { id: 15, name: "Borik", tf: 1.2, lat: 44.7845, lng: 17.1783, r: 1400 },
    { id: 16, name: "Petrićevac", tf: 1.5, lat: 44.796, lng: 17.23, r: 1900 },
    { id: 17, name: "Zalužani", tf: 1.3, lat: null, lng: null, r: null },
  ];

  // [zona, dani (0 = ponedjeljak), od, do, min, cilj, max|null, hitni dani]
  const PATTERN = [
    [11, [0, 1, 2, 3, 4, 5, 6], "11:00", "15:00", 2, 4, 6, []],
    [11, [0, 1, 2, 3, 4, 5, 6], "17:00", "22:00", 3, 6, 8, [4, 5]],
    [12, [0, 1, 2, 3, 4, 5, 6], "12:00", "20:00", 1, 2, 3, []],
    [13, [0, 1, 2, 3, 4, 5], "17:00", "22:00", 1, 2, null, []],
    [14, [0, 1, 2, 3, 4, 5], "08:00", "11:00", 1, 1, null, []],
    [14, [0, 1, 2, 3, 4, 5], "11:00", "21:00", 1, 2, null, []],
    [15, [0, 1, 2, 3, 4, 5, 6], "16:00", "22:00", 1, 2, null, []],
    [16, [5, 6], "18:00", "22:00", 1, 1, null, []],
  ];

  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  };

  // Ručno zadate popunjenosti (priča o ponedjeljku, danas) pregaze izračunate.
  const FIXED = {
    "11|0|11:00": 1, "11|0|17:00": 3, "12|0|12:00": 0, "13|0|17:00": 0, "14|0|08:00": 1, "14|0|11:00": 2,
    "11|4|17:00": 3, "11|5|17:00": 6, "13|3|17:00": 0, "15|1|16:00": 2,
  };

  const build = () => {
    const zones = ZONES();
    const mon0 = SC.mondayOf(NOW);
    const shifts = [];
    let id = 1000;
    for (const w of [-1, 0]) {
      for (const [zoneId, days, from, to, min, target, max, hot] of PATTERN) {
        for (const d of days) {
          // sedmica 0 ima rupu: Lauš u utorak nema smjenu
          if (w === 0 && zoneId === 13 && d === 1) continue;
          const date = SC.iso(SC.addDays(mon0, w * 7 + d));
          const key = `${zoneId}|${d}|${from}`;
          let booked;
          if (w === 0 && key in FIXED) booked = FIXED[key];
          else if (w === -1) booked = Math.min(max == null ? target + 1 : max, Math.max(min, target - (hash(date + key) < 0.3 ? 1 : 0)));
          else {
            const h = hash(date + key);
            if (h < 0.14) booked = Math.max(0, min - 1);
            else if (h < 0.4) booked = Math.max(min, target - 1);
            else if (h < 0.88) booked = target;
            else booked = max == null ? target + 1 : max;
          }
          shifts.push({ id: id++, zoneId, date, start: from, end: to, min, target, max, booked, hot: hot.includes(d) });
        }
      }
    }
    // sedmica +2: dispečer je već počeo planirati
    shifts.push({ id: id++, zoneId: 11, date: SC.iso(SC.addDays(mon0, 14)), start: "11:00", end: "15:00", min: 2, target: 4, max: 6, booked: 0, hot: false });
    shifts.push({ id: id++, zoneId: 12, date: SC.iso(SC.addDays(mon0, 15)), start: "12:00", end: "20:00", min: 1, target: 2, max: 3, booked: 1, hot: false });
    return {
      company: { id: 24, name: "Ordera Dostava Banja Luka", city: "Banja Luka", cityId: 1 },
      zones, shifts, nextShiftId: id, nextZoneId: 40,
      // [PRETPOSTAVKA] značenje: delivering = u dostavi, online = slobodni, idle = neaktivni (u repou nije dokumentovano)
      live: { 11: { delivering: 5, online: 2, idle: 1 }, 12: { delivering: 0, online: 0, idle: 0 }, 13: { delivering: 0, online: 0, idle: 0 }, 14: { delivering: 2, online: 1, idle: 1 }, 15: { delivering: 0, online: 3, idle: 2 }, 16: { delivering: 0, online: 0, idle: 0 } },
      rules: [{ id: 702, zoneId: 12, text: "Zona: Starčevica" }, { id: 703, zoneId: 11, text: "Zona: Centar" }],
      enforcement: false,
    };
  };

  return { NOW, build };
});
