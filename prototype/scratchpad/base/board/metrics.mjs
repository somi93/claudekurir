// Sklapa metrics.json: "prije" iz mjerenja stare stranice (../e2e/*.json), "poslije" iz testova prototipa (t2/t3/t4 + logika).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const rj = (f) => JSON.parse(fs.readFileSync(path.join(here, f), "utf8"));
const d = rj("../e2e/a1-states-d.json"), p = rj("../e2e/a1-states-p.json"), a2 = rj("../e2e/a2-flows.json"), b = rj("../e2e/a3b-load.json"), a4 = rj("../e2e/a4-race.json"), a5 = rj("../e2e/a5-scale.json");
const t2 = rj("t2-metrics.json"), t4 = rj("t4-steps.json"), lg = rj("metrics-logic.json");
const t3 = ["desk", "phone", "phone320"].map((m) => rj(`t3-${m}.json`));
const M = {};
const dec = (n) => (Math.round(n * 100) / 100).toFixed(2);

// ---- prije: stara stranica
M.B_pollSec = a4.polling.seconds;
M.B_pollReq = a4.polling.requestsDuringWait.filter((x) => !/outbox/.test(x)).length;
M.B_srvPend = a4.polling.serverHasPending;
M.B_pagePend = a4.polling.badge;
const init = b.initial;
const iLoading = init.findIndex((f) => /Učitavanje/.test(f.txt));
M.B_falseMs = init[iLoading].t - init[0].t;
M.B_loadMs = init[init.length - 1].t - init[0].t;
M.B_rowW_bal = p.balances.rows[0].w; M.B_rowW_hist = p.history.rows[0].w; M.B_rowW_pay = p.payouts.rows[0].w; M.B_card_p = 326;
M.B_raceRows = a4.companySwitch.lateRowCount;
M.B_searchFound = a2.searchSummary.queriesFullyFound; M.B_searchTotal = a2.searchSummary.queries;
M.B_balRowH = d.balances.rows[0].h; M.B_hBal = d.balances.measure.docH; M.B_hHist = d.history.measure.docH; M.B_hPay = d.payouts.measure.docH;
M.B_foldBal = Math.floor((900 - d.balances.rows[0].y) / d.balances.rows[0].h);
M.B_tabbarP = Math.round(p.handovers.tabbar.h);
M.B_stopsBal = d.balances.stops.length; M.B_rowsBal = d.balances.rows.length;
M.B_minC_hand = dec(d.handovers.contrast.min); M.B_minC_bal = dec(d.balances.contrast.min); M.B_minC_hist = dec(d.history.contrast.min); M.B_minC_pay = dec(d.payouts.contrast.min);
M.B_minCAll = dec(Math.min(d.handovers.contrast.min, d.balances.contrast.min, d.history.contrast.min, d.payouts.contrast.min));
M.B_small_hand = d.handovers.small.length; M.B_small_bal = d.balances.small.length; M.B_small_hist = d.history.small.length; M.B_small_pay = d.payouts.small.length;
const ratioOf = (arr, re) => { const m = arr.find((s) => re.test(s)); return m ? m.split(" ")[0] : "?"; };
M.B_tabLabelC = ratioOf(d.handovers.contrast.bad, /tab-pill-label/);
M.B_tabLabelCp = ratioOf(p.balances.contrast.bad, /tab-pill-label/);
M.B_subC = ratioOf(d.handovers.contrast.bad, /panel-subtitle/);
M.B_idC = ratioOf(d.balances.contrast.bad, /balance-id/);
M.B_creditC = ratioOf(d.balances.contrast.bad, /cash-credit/);
M.B_chipC = ratioOf(d.history.contrast.bad, /v-chip/);
M.B_diffN = lg.diffN; M.B_confirmedN = lg.confirmedN;
const c1 = a5.cpu1x, c4 = a5.cpu4x;
M.B_scaleBalRows = c1.balancesRows; M.B_scaleBalNodes = c1.balancesNodes; M.B_scaleAllRows = c1.allRows; M.B_scaleAllNodes = c1.allNodes; M.B_scaleHistRows = c1.historyRows; M.B_scaleHistNodes = c1.historyNodes;
M.B_scaleBal4 = c4.balancesMs; M.B_scaleAll4 = c4.zeroToggleMs; M.B_scaleHist4 = c4.historyMs;
// stari tok za uplatu i isplatu (računato iz izmjerenog jednog toka)
const wages = [48, 6, 120, 97.37, 78.84, 12, 48.76, 86.4, 102.81, 33.5];
M.B_t2c = 4; M.B_t2k = 11;
M.B_t3c = 3 * wages.length; M.B_t3k = wages.reduce((s, w) => s + w.toFixed(2).length, 0);

// ---- poslije: prototip
M.A_searchFound = lg.searchFound; M.A_planN = lg.planN; M.A_planTotal = lg.planTotal.toFixed(2);
M.A_t1c = t4.t1.clicks; M.A_t2c = t4.t2.clicks; M.A_t2k = t4.t2.chars; M.A_t3c = t4.t3.clicks; M.A_t3n = t4.t3.n; M.A_t4c = t4.t4.clicks; M.A_t5c = t4.t5.clicks; M.A_t5n = 4; M.A_t6c = t4.t6.clicks;
M.A_fold = t4.fold.rowsAbove; M.A_listTop = t4.fold.listTop;
M.A_nodesStanje = t2.scale.cpu1x.nodes; M.A_nodesPromet = t2.scale.cpu1x.journalNodes; M.A_journal4 = t2.scale.cpu4x.journalMs;
const allScans = t3.flatMap((x) => x.scans);
M.A_minC = dec(Math.min(...allScans.map((s) => s.contrastMin)));
M.A_minFont = String(Math.round(Math.min(...allScans.map((s) => s.minFont)) * 100) / 100);
M.A_states = t3[0].scans.length; M.A_texts = allScans.reduce((s, x) => s + x.texts, 0);
M.A_stops = t3[0].M.tabStopsStanje;
// brojevi provjera (zadnji potpuni prolazi; ažuriraju se kad se paketi ponovo vode)
M.A_checksLogic = lg.checks;
M.A_checksFlows = Number(process.env.CHECKS_FLOWS || 269);
M.A_checksDevice = Number(process.env.CHECKS_DEVICE || 221);
M.A_checksSteps = Number(process.env.CHECKS_STEPS || 8);
// sama tabla: dimni test (telefon, komande, CSV) i poređenje stilova prototipa u tabli sa samostalnom stranicom
const sm = rj("board-smoke.json"), lk = rj("board-leak.json");
M.A_checksBoard = sm.checks;
M.A_leakPairs = lk.totalCompared; M.A_leakStates = lk.states; M.A_leakProps = lk.props;
if (lk.totalDiffs !== 0) throw new Error("poređenje stilova nije čisto: " + lk.totalDiffs + " razlika");
fs.writeFileSync(path.join(here, "metrics.json"), JSON.stringify(M, null, 1));
console.log(JSON.stringify(M));
