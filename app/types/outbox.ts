// GET /dispatcher/outbox/status, POST /dispatcher/outbox/sync - status
// knjiženja dostava u glavnu knjigu (outbox relay). Backend odgovor 16.09.2026
// (§1 dispečerski panel "Statusa knjiženja"). relay_alive: false znači da je
// servis/cron koji šalje knjiženja stao - to je kvar sistema, ne dispečerov
// posao, ali mora biti vidljivo.
export type OutboxStatus = {
  pending: number;
  failed: number;
  // Pala 8 puta, čeka ručnu odluku - backend za sad nema endpoint za listu
  // pojedinačnih "dead" stavki (samo brojač).
  dead: number;
  oldest_pending_age_sec: number;
  last_sent_at: string | null;
  last_run_at: string | null;
  relay_alive: boolean;
};

// POST /dispatcher/outbox/sync odgovor - isti brojači + rezultat SAME
// sinhronizacije koja je upravo izvršena (sent/skipped su novi, failed je
// isto polje kao u OutboxStatus - koliko od tog pokušaja SAD nije prošlo).
export type OutboxSyncResult = OutboxStatus & {
  sent: number;
  skipped: number;
};
