// Fixture "svijet" za dispečerski ekran Obaveštenja (probni podaci, oblici tačno kao u types/inbox.ts).
// Pretpostavke koje dokumenti potvrđuju (a ne izmišljaju):
//  - 21.09 R11: u stvarnom inbox-summary SVI primjeri su imali last_message.category "offer", sender "dispatcher";
//  - 03.10: ponude nastaju kao read:false, ostaju zauvijek, a prvu stranicu GET /couriers/{id}/inbox popune u potpunosti.
// Deterministički (seed), pa su brojevi u tabelama ponovljivi.
import { buildCouriers, buildLocations, buildBalances, IDS } from "./fx.mjs";

const mulberry = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const iso = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, ".000000Z");
const H = 3600_000;
const D = 24 * H;

export { IDS };

// Poruke koje je dispečer slao (isti tekst ide svim primaocima grupne poruke).
export const BROADCASTS = [
  { key: "M1", ago: 21 * D + 3 * H, category: "announcement", title: "Dobrodošli u Ordera Dostava", body: "Dobrodošli u tim! Aplikaciju držite otvorenu dok radite. Pitanja: javite se dispečeru." , to: "all" },
  { key: "M2", ago: 12 * D + 5 * H, category: "todo", title: "Predaj gotovinu do petka", body: "Ko ima više od 100 KM kod sebe neka preda gotovinu u poslovnici do petka u 16h.", to: "debt" },
  { key: "M3", ago: 9 * D + 2 * H, category: "promotion", title: "Vikend bonus +1.00 KM po dostavi", body: "Ovog vikenda svaka dostava nosi 1.00 KM bonusa. Važi subota i nedjelja od 12 do 22h.", to: "all" },
  { key: "M4", ago: 6 * D + 7 * H, category: "announcement", title: "Nova zona Starčevica", body: "Od ponedjeljka Starčevica je u našoj zoni. Mapa zona je u dispečerskom pregledu.", to: "all" },
  { key: "M5", ago: 2 * D + 4 * H, category: "announcement", title: "Pada kiša, pazite na put", body: "Kiša cijeli dan. Vozite oprezno, nemojte žuriti zbog vremena dostave.", to: "all" },
  { key: "M6", ago: 26 * H, category: "todo", title: "Provjeri vozilo prije smjene", body: "Prije smjene provjeri kočnice i svjetla. Ko ima kvar neka javi dispečeru prije prijave.", to: "some" },
  { key: "M7", ago: 3 * H + 10 * 60_000, category: "todo", title: "Javi se dispečeru", body: "Molim te da se javiš na broj dispečera čim završiš trenutnu dostavu.", to: "few" },
];

// Ko je dobio koju grupnu poruku (po rednom broju kurira u listi).
const recipientsOf = (b, idx, courier, balances, r) => {
  if (b.to === "all") return true;
  if (b.to === "debt") return (balances.get(courier.courier_id) ?? 0) > 0;
  if (b.to === "some") return idx % 2 === 0;
  if (b.to === "few") return [0, 2, 4, 7, 9].includes(idx);
  return false;
};

// Sanduče jednog kurira: dispečerske poruke + ponude (category "offer", sender "dispatcher" kao u R11).
// `starve` = kurir sa pretrpanim sandučetom: 22 najnovije poruke su ponude pa prva stranica (20) nema nijednu poruku dispečera.
export function buildWorld({ n = 28, now = new Date(), offerSender = "dispatcher" } = {}) {
  const couriers = buildCouriers(n, { now });
  const locations = buildLocations(couriers, { now });
  const balances = buildBalances(couriers);
  const cashOf = new Map(balances.map((b) => [b.courier_id, b.cash_owed_to_company]));
  const r = mulberry(4242);
  const inbox = new Map();
  let nextId = 700000;
  const nowMs = now.getTime();

  couriers.forEach((c, idx) => {
    const rows = [];
    // grupne poruke
    BROADCASTS.forEach((b, bi) => {
      if (!recipientsOf(b, idx, c, cashOf, r)) return;
      // grupna poruka: red za svakog primaoca, sekunda razlike između redova
      const sentAt = nowMs - b.ago + idx * 1000;
      const age = nowMs - sentAt;
      // starije od 5 dana uglavnom pročitano; najnovije djelimično
      const readChance = age > 5 * D ? 0.96 : age > 24 * H ? 0.8 : age > 6 * H ? 0.6 : 0.35;
      const read = r() < readChance;
      rows.push({ id: nextId++, sender: "dispatcher", category: b.category, title: b.title, body: b.body, sent_at: iso(sentAt), read, _batch: b.key });
    });
    // ponude: sve nepročitane osim malog broja najnovijih (03.10: ostaju nepročitane danima)
    const starve = c.courier_id === IDS.main;
    const offerCount = starve ? 63 : 4 + Math.floor(r() * 36);
    const span = starve ? 3 * H : 20 * D;
    for (let i = 0; i < offerCount; i++) {
      // ponude gusto prema sadašnjosti
      const frac = starve ? i / offerCount : Math.pow(i / offerCount, 1.6);
      const ago = Math.floor(frac * span) + 120_000 + Math.floor(r() * 60_000);
      rows.push({
        id: nextId++, sender: offerSender, category: "offer", title: "Nova ponuda za dostavu",
        body: `Restoran ${100 + i} — Vuka Karadžića ${i + 1} · ${(3 + (i % 5) * 0.5).toFixed(2)} KM`,
        sent_at: iso(nowMs - ago), read: r() < 0.04, _batch: null,
      });
    }
    rows.sort((a, b) => b.sent_at.localeCompare(a.sent_at));
    inbox.set(c.courier_id, rows);
  });

  // inbox-summary onako kako ga backend (po dokumentu 21.09) vraća: zadnja poruka bilo koje vrste, broj nepročitanih od pošiljaoca "dispatcher"
  const summary = couriers.map((c) => {
    const rows = inbox.get(c.courier_id);
    const last = rows[0] ?? null;
    return {
      courier_id: c.courier_id,
      last_message: last ? { title: last.title, sent_at: last.sent_at, category: last.category, sender: last.sender } : null,
      dispatcher_unread_count: rows.filter((m) => m.sender === "dispatcher" && !m.read).length,
    };
  });
  // varijanta "backend ispravljen": bez ponuda
  const summaryClean = couriers.map((c) => {
    const rows = inbox.get(c.courier_id).filter((m) => m.category !== "offer");
    const last = rows[0] ?? null;
    return {
      courier_id: c.courier_id,
      last_message: last ? { title: last.title, sent_at: last.sent_at, category: last.category, sender: last.sender } : null,
      dispatcher_unread_count: rows.filter((m) => !m.read).length,
    };
  });

  return { couriers, locations, balances, inbox, summary, summaryClean, nextId: () => nextId++ };
}

// GET /couriers/{id}/inbox kao backend: opcioni ?category=, ?page=, ?per_page= (meta samo uz ?page=)
export function inboxResponse(rows, params) {
  let list = rows;
  const cat = params.get("category");
  if (cat) list = list.filter((x) => x.category === cat);
  const page = Number(params.get("page") || 0);
  const per = Number(params.get("per_page") || 50);
  const strip = ({ _batch, ...m }) => m;
  if (page) {
    const last = Math.max(1, Math.ceil(list.length / per));
    return { success: true, data: list.slice((page - 1) * per, page * per).map(strip), meta: { current_page: page, last_page: last, total: list.length } };
  }
  return { success: true, data: list.map(strip) };
}
