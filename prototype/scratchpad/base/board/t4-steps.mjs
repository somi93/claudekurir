// T4: koliko dodira traje svaki zadatak NA PROTOTIPU (brojač obavija click/tap/key), plus redovi iznad pregiba na 1440x900 i raspored prve slike.
import fs from "node:fs";
import path from "node:path";
import { openProto, check, summary, sleep, here } from "./plib.mjs";

const P = await openProto({ name: "t4", width: 1480, height: 960 });
const A = "A('d')";
const R = {};
let clicks = 0, chars = 0, keys = 0;
const click = async (...a) => { clicks++; return P.click(...a); };
const typeText = async (s, ...a) => { chars += s.length; return P.typeText(s, ...a); };
const key = async (...a) => { keys++; return P.key(...a); };
const reset = () => { clicks = 0; chars = 0; keys = 0; };
const snap = () => ({ clicks, chars, keys });
const ready = () => P.waitFor(`(() => { const D = ${A}.ctx.D; return D.balances.state === 'ok' && D.pending.state === 'ok' && D.status.state === 'ok' && D.settings.state === 'ok'; })()`);
const fresh = async () => { await P.ev(`fresh('d', {}); 1`); await ready(); await sleep(300); await P.ev(`${A}.clearLog ? 1 : 1`); };
try {
  await P.ev(`(A('p') && A('p').destroy(), document.getElementById('p').style.display='none', 1)`);

  // redovi iznad pregiba (okvir 1440x900) i gdje počinje spisak
  await fresh();
  R.fold = await P.ev(`(() => { const f = document.getElementById('d').getBoundingClientRect(); const rows = [...document.querySelectorAll('#d .fc-row')].map((r) => r.getBoundingClientRect()); const l = document.querySelector('#d .fc-list').getBoundingClientRect(); return { rowsAbove: rows.filter((r) => r.bottom <= f.bottom).length, listTop: Math.round(l.top - f.top), frameH: Math.round(f.height), firstRowH: Math.round(rows[0].height) }; })()`);
  console.log("pregib:", JSON.stringify(R.fold));

  // T1: potvrdi predaju (isti iznos)
  await fresh(); reset();
  await P.clearLog();
  await click('#d .fc-qr [data-act="confirm"]', { nth: 3 });
  await P.waitFor(`!!document.querySelector('#d #fc-sheet')`); await sleep(250);
  await click('#d [data-act="sheet-submit"]');
  await P.waitFor(`!document.querySelector('#d #fc-sheet')`); await sleep(400);
  R.t1 = snap();
  check("T1: potvrda istog iznosa = 2 dodira, 0 znakova", R.t1.clicks === 2 && R.t1.chars === 0 && (await P.log()).some((e) => /confirm$/.test(e.path) && e.body.confirmed_amount === 95.24), JSON.stringify(R.t1));
  // T1b: isto sa tastaturom
  await fresh(); reset();
  await click('#d .fc-qr [data-act="confirm"]', { nth: 3 });
  await P.waitFor(`!!document.querySelector('#d #fc-sheet')`); await sleep(250);
  await key("Enter");
  await P.waitFor(`!document.querySelector('#d #fc-sheet')`); await sleep(300);
  R.t1b = snap();
  check("T1b: 1 dodir + Enter", R.t1b.clicks === 1 && R.t1b.keys === 1, JSON.stringify(R.t1b));

  // T2: puna uplata kuriru (izaberi, Evidentiraj uplatu, Evidentiraj)
  await fresh(); reset();
  await P.clearLog();
  await click('#d .fc-row[data-row="30234"]'); await sleep(300);
  await click('#d [data-act="receipt"]');
  await P.waitFor(`!!document.querySelector('#d #fc-sheet')`); await sleep(250);
  const prefill = await P.val("#d #fc-amt");
  await click('#d [data-act="sheet-submit"]');
  await P.waitFor(`!document.querySelector('#d #fc-sheet')`); await sleep(400);
  R.t2 = snap();
  const post = (await P.log()).filter((e) => e.method === "POST");
  check("T2: puna uplata = 3 dodira, 0 znakova, iznos = cijeli dug", R.t2.clicks === 3 && R.t2.chars === 0 && post.length === 1 && post[0].body.amount === 164 && prefill === "164.00", JSON.stringify({ ...R.t2, prefill, body: post[0] && post[0].body }));

  // T3: isplati zarade svima
  await fresh(); reset();
  await P.clearLog();
  await click('#d [data-act="batch"][data-fk="batch-kpi"]');
  await P.waitFor(`!!document.querySelector('#d #fc-sheet')`); await sleep(300);
  await click('#d [data-act="sheet-submit"]');
  await P.waitFor(`document.querySelector('#d #fc-sheet [data-fk="close2"]')`, { timeout: 12000 }); await sleep(300);
  R.t3 = snap();
  const n = (await P.log()).filter((e) => /payout$/.test(e.path)).length;
  R.t3.n = n;
  check("T3: isplata svima = 2 dodira, 0 znakova, po jedan poziv", R.t3.clicks === 2 && R.t3.chars === 0 && n === 10, JSON.stringify(R.t3));

  // T4: sve o jednom kuriru (predaje + isplate)
  await fresh(); reset();
  await P.clearLog();
  await click('#d .fc-row[data-row="30189"]');
  await P.waitFor(`document.querySelectorAll('#d .fc-ti').length > 0`); await sleep(200);
  R.t4 = snap();
  const tl = await P.count("#d .fc-ti");
  check("T4: sve o kuriru = 1 dodir, vidi se promet", R.t4.clicks === 1 && tl > 0, JSON.stringify({ ...R.t4, tl }));

  // T5: ko je preko limita
  await fresh(); reset();
  await click('#d [data-act="filter"][data-arg="limit"]'); await sleep(200);
  R.t5 = snap();
  check("T5: ko je blizu ili preko limita = 1 dodir", R.t5.clicks === 1 && (await P.count("#d .fc-row")) === 4, JSON.stringify(R.t5));

  // T6: šta je danas potvrđeno i isplaćeno
  await fresh(); reset();
  await click("#d #fc-tab-promet");
  await P.waitFor(`document.querySelectorAll('#d .fc-jr').length > 0`);
  await click('#d [data-act="period"][data-arg="today"]'); await sleep(500);
  R.t6 = snap();
  check("T6: zbir za danas = 2 dodira, zbirovi stoje", R.t6.clicks === 2 && (await P.count("#d .fc-tot .v")) === 3, JSON.stringify(R.t6));

  // T7: samo razlike za jednog kurira (spor)
  await fresh(); reset();
  await click("#d #fc-tab-promet");
  await P.waitFor(`document.querySelectorAll('#d .fc-jr').length > 0`);
  await click('#d [data-act="jdiff"]'); await sleep(200);
  R.t7 = snap();
  check("T7: samo razlike = 2 dodira", R.t7.clicks === 2 && (await P.count("#d .fc-jr")) >= 1, JSON.stringify(R.t7));
} catch (e) {
  console.log("PAD:", e.stack || e);
  check("test nije pao", false, String(e.message));
} finally {
  fs.writeFileSync(path.join(here, "t4-steps.json"), JSON.stringify(R, null, 1));
  await P.close();
}
const failed = summary();
process.exit(failed ? 1 : 0);
