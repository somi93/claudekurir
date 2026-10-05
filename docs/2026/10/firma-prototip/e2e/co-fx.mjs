// Izmišljeni, ali dosljedni podaci za stranicu Firma (oblici tačno kao app/types/*.ts).
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, ".000000Z");
export function buildRestaurants(n = 12, { now = new Date() } = {}) {
  const base = [
    { name: "Роштиљница Лагуна", ac: true, ar: true, cur: "KM", phone: "051 312 445", email: "info@laguna.ba", addr: "Бранка Ћопића 12, Бањалука", cp: "Милан Лукић", started: "2023-08-02" },
    { name: "Krčma kod Ace", ac: true, ar: true, cur: "KM", phone: "051 330 100", email: null, addr: "Vase Pelagića 24, Banja Luka", cp: "Aca Petrović", started: "2023-11-07" },
    { name: "Urban Food Bordo Plus", ac: true, ar: true, cur: "EUR", phone: null, email: "bordo@urban.ba", addr: "Kralja Petra I Karađorđevića 90", cp: null, started: "2026-07-11" },
    { name: "Pizzeria Napoli", ac: true, ar: false, reason: "Dug za proviziju od avgusta", cur: "KM", phone: "065 411 220", email: "napoli@pizza.ba", addr: "Jevrejska 3, Banja Luka", cp: "Marko Ilić", started: "2024-02-03" },
    { name: "Pekara Zlatni klas", ac: false, ar: true, cur: "KM", phone: "051 220 330", email: null, addr: "Gundulićeva 8", cp: "Jovana Kos", started: "2024-11-07" },
    { name: "Ordera Burger Centar", ac: true, ar: true, internal: true, cur: "KM", phone: "051 999 000", email: "burger@ordera.app", addr: "Veselina Masleše 5", cp: "Ordera", started: "2025-01-20" },
    { name: "Restoran Kod Starog Mosta i Veliko Domaće Pečenje Sa Roštilja Banja Luka Centar", ac: true, ar: true, cur: "KM", phone: "051 777 123", email: "stari.most@primjer.ba", addr: "Trg Krajine 1", cp: "Dragan Vuković", started: "2025-03-14" },
    { name: "Sushi Bar Kyoto", ac: false, ar: false, reason: "Restoran je zatvoren zbog renoviranja do kraja oktobra", cur: "KM", phone: "066 100 200", email: "kyoto@sushi.ba", addr: "Zmaj Jovina 14", cp: "Ana Savić", started: "2025-05-02" },
    { name: "Burek i Jogurt Hodžić", ac: true, ar: true, cur: "KM", phone: "051 111 222", email: null, addr: "Ferhadija 30", cp: null, started: "2024-06-18", status: 0 },
    { name: "Slastičarna Medena", ac: true, ar: true, cur: "KM", phone: null, email: null, addr: null, cp: null, started: null },
    { name: "Gyros Express", ac: true, ar: true, cur: "BAM", phone: "065 222 333", email: "gyros@express.ba", addr: "Jovana Dučića 7", cp: "Nenad Gajić", started: "2025-09-01" },
    { name: "Ćevabdžinica Sarajevo 84", ac: true, ar: true, cur: "KM", phone: "051 456 789", email: "cevabi@primjer.ba", addr: "Kneza Miloša 40", cp: "Haris Delić", started: "2023-09-29" },
  ];
  const extra = [];
  for (let i = base.length; i < n; i++) {
    const b = base[i % base.length];
    extra.push({ ...b, name: `${b.name.slice(0, 22)} ${i + 1}`, internal: false, ac: i % 7 !== 0, ar: i % 5 !== 0, reason: i % 5 === 0 ? "Privremeno" : undefined });
  }
  return [...base, ...extra].map((r, i) => ({
    id: 600 + i,
    restaurant_id: 100 + i * 3,
    restaurant_name: r.name,
    active_restoran: r.ar,
    active_company: r.ac,
    cooperation_active: r.ar && r.ac && !r.internal,
    internal: Boolean(r.internal),
    suspension_reason: r.ar ? null : (r.reason ?? null),
    record_status: r.status ?? 1,
    restaurant_currency: r.cur,
    restaurant_address: r.addr,
    restaurant_phone: r.phone,
    restaurant_email: r.email,
    restaurant_contact_person: r.cp,
    restaurant_latitude: r.addr ? 44.77 + (i % 7) * 0.003 : null,
    restaurant_longitude: r.addr ? 17.19 + (i % 5) * 0.004 : null,
    restaurant_jib: i % 3 === 0 ? `4${String(100000000000 + i * 37)}`.slice(0, 13) : null,
    restaurant_pib: i % 3 === 0 ? `4${String(10000000 + i * 91)}`.slice(0, 9) : null,
    cooperation_started_at: r.started ? iso(new Date(r.started)) : null,
  }));
}
