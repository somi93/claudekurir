# Network / retest checklist — backend promjene 16.09 (dostavljaci-front)

Retest za frontend implementaciju backend zahtjeva od 16.09.2026 (izmjene na
dispečerskom ekranu, deployano u produkciju istog dana): novi ekran "Status
knjiženja" (outbox) i `idempotency_key` na isplati zarade kuriru. Vidi
implementaciju: `useOutboxStatus.ts`, `OutboxStatusBanner.vue`,
`CourierCashActionDialog.vue`.

Status kolona: ⬜ nije testirano · ✅ potvrđeno · ❌ nije prošlo

## A. Status knjiženja (outbox) — novi banner

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| T1 | ✅ | Ulogovan kao dispečer, otvoriti bilo koju stranicu (`/dispatcher/assignment` i sl.), pratiti `GET /dispatcher/outbox/status` | Poziv ide na svakih 60s (provjeriti Network tab tajming), `200` sa `{pending, failed, dead, oldest_pending_age_sec, last_sent_at, last_run_at, relay_alive}` — **potvrđeno 16.09**: `200`, tačan oblik (isti odgovor kao T1a) — tajming ponavljanja na 60s nije posebno hronometrisan, ali osnovni poziv/oblik je ispravan |
| T1a | ✅ | Ako `relay_alive: false` u odgovoru | Banner CRVEN, tekst "Knjiženje ne radi od {last_run_at}...", NEMA dugme "Sinhronizuj" (samo info) — **potvrđeno 16.09**: `{pending:0, failed:0, dead:8, oldest_pending_age_sec:0, last_sent_at:"2026-09-16 20:28:12", last_run_at:null, relay_alive:false}` - `relayDown` computed ispravno `true`, dugme "Sinhronizuj" ispravno sakriveno (uslov `hasStalePending && !relayDown`). Napomena: `last_run_at: null` (dok `last_sent_at` IMA vrijednost) je edge case koji front gracefully hendluje - tekst samo izostavi "od {datum}" dio umjesto da baci grešku na `formatDateTime(null)` - **vizuelno potvrđeno**: crveni banner vidljiv na stranici, bez dugmeta "Sinhronizuj" |
| T1b | ⬜ | Ako `relay_alive: true`, `pending > 0` i `oldest_pending_age_sec > 300` | Banner ŽUT, tekst "Čeka N događaja za knjiženje", dugme "Sinhronizuj" vidljivo i klikabilno |
| T1c | ⬜ | Klik "Sinhronizuj" | `POST /dispatcher/outbox/sync`, dugme prikazuje loading dok traje, banner se ažurira sa novim brojačima (`sent`/`skipped` iz odgovora) |
| T1d | ⬜ | Ako `dead > 0` (a `relay_alive: true`, nema stale pending) | Banner (žut ton) prikazuje "N knjiženja je palo više puta i čeka ručnu odluku podrške" - NEMA linka/liste (nema još backend endpoint-a za to) |
| T1e | ⬜ | Sve nule i `relay_alive: true` | Banner se NE prikazuje uopšte (ni prazan prostor) |
| T1f | ⬜ | Banner vidljiv na SVIM dispečerskim stranicama (ne samo jednoj), NIJE vidljiv kuriru ni na `/login` | Potvrditi na bar 2-3 različite dispečerske rute |

## B. `idempotency_key` na isplati zarade kuriru

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| T2 | ✅ | Firma → Finansije → Kase kurira → kurir → "Isplati zaradu", otvoriti dijalog, pratiti `POST /dispatcher/couriers/{id}/payout` telo | Telo sadrži `idempotency_key` (UUID format, npr. `xxxxxxxx-xxxx-...`) — **potvrđeno 16.09**: `{"delivery_company_id":24,"amount":25,"method":"gotovina","idempotency_key":"78868112-fd19-45b3-9699-3a7b7c6a5a03"}` |
| T2a | ✅ | Zatvoriti dijalog (bez slanja), ponovo otvoriti | NOVI `idempotency_key` u sledećem zahtjevu (različit od T2) — **potvrđeno 16.09 (indirektno)**: druga isplata vratila DRUGI `transaction_id` (`f7085725-1260-4f6c-a626-dd5c589a07be` vs `f083cead-...` iz T2) - da je isti ključ ponovo korišćen, backend bi po definiciji idempotencije vratio ISTU transakciju. Request body ovog poziva nije posebno pregledan, ali različit `transaction_id` je dovoljan dokaz da je ključ bio nov |
| T2b | ⬜ | Simulirati grešku na prvom pokušaju (npr. DevTools throttling da padne poziv), NE zatvarati dijalog, kliknuti "Isplati" opet | ISTI `idempotency_key` na oba pokušaja (isto otvaranje forme = isti ključ, čak i poslije neuspjelog pokušaja) |
| T2c | ✅ | Uspješna isplata - provjeriti da odgovor (`transaction_id`) i da se saldo/istorija ažuriraju kao i ranije | Ponašanje nepromijenjeno osim novog polja u telu zahtjeva — **potvrđeno 16.09**: `201`, `{"success":true,"transaction_id":"f083cead-4706-4c27-ac6d-4a1ecd89b7c1","warning":null}` |

---

Sve što ne prođe prijaviti nazad backend timu u novi dan pitanja.
