// Ponašanje accept() endpoint-a kad je kurir preko cash_limit_amount (vidi
// cash-limit-frontend.textile): BLOCK - accept() baca 409, kurir ne može da
// prihvati dok ne preda pazar. NOTIFY_ONLY (default) - accept() uspijeva,
// samo stiže warning polje u odgovoru.
export type CashLimitEnforcement = "BLOCK" | "NOTIFY_ONLY";

// Način dodjele nove narudžbe kuririma. Prošireni model - vidi Uputstvo za
// frontend 02.09.2026 i docs/2026/09/04_09_2026_Frontend_pitanja_za_backend.textile.
//   ALL     (default) - svi kuriri firme vide narudžbu istovremeno, prvi koji
//                       prihvati je dobija
//   NEAREST           - samo najbliži kurir dobija prvu ponudu
//   TOP_N             - prvih N najbližih kurira dobija ponudu istovremeno
//                       (N = assignment_courier_count)
// BEST_MATCH je STARA vrijednost - i dalje živi u bazi za firme koje su je ranije
// podesile; front je prihvata pri čitanju i ne gubi je kroz PATCH, ali je NE
// nudi kao izbor novim firmama (vidi modeOptions u utils/companySettings.ts).
// NAPOMENA: kao i ranije, cijeli prošireni model se ČUVA kroz PATCH ali TRENUTNO
// NEMA stvarnog efekta na dodjelu (nije povezan sa NotifyCouriersOrderAccepted
// Job) - stvarna logika dolazi u odvojenoj, koordinisanoj sesiji.
export type AssignmentMode = "ALL" | "NEAREST" | "TOP_N" | "BEST_MATCH";

// Šta se dešava ako niko ne prihvati u okviru offer_timeout_seconds. Relevantno
// SAMO kad je assignment_mode "NEAREST" ili "TOP_N" (za "ALL" se ignoriše, polje
// se u UI-ju krije). Backend default "NEXT_NEAREST".
//   NEXT_NEAREST - šalje ponudu sljedećem najbližem kuriru
//   OPEN_TO_ALL  - otvara narudžbu svim kuririma
export type AssignmentTimeoutAction = "NEXT_NEAREST" | "OPEN_TO_ALL";

// Koje kurire uzeti u obzir pri dodjeli. UVIJEK relevantno, nezavisno od
// assignment_mode. Backend default "ALL_ACTIVE".
//   ALL_ACTIVE      - sve aktivne kurire firme, bez provjere dostupnosti
//   AVAILABLE_NOW   - samo one koji su trenutno označili "dostupan za rad"
//   SCHEDULED_SHIFT - samo one sa prijavljenom smjenom za ovo vrijeme (plan
//                     angažovanja)
export type AssignmentCourierPool =
  | "ALL_ACTIVE"
  | "AVAILABLE_NOW"
  | "SCHEDULED_SHIFT";

// GET/PATCH /dispatcher/delivery-companies/{id}/finance-settings - vidi
// Uputstvo_finansije_i_saradnja_frontend_cirilica.md. Polja ostaju u
// snake_case (isto kao Pricing u types/pricing.ts) jer se objekat vraća i
// šalje nazad skoro nepromenjen, bez potrebe za camelCase mapiranjem.
export type FinanceSettings = {
  delivery_company_id: number;
  // READ-ONLY za dispečera - Ordera admin ga trenutno postavlja direktno
  // preko baze, dok ne dobije poseban admin panel. `commission_percentage_editable`
  // dolazi sa backenda da front ne mora sam da hardkoduje pravilo, ali PATCH
  // ionako prima samo četiri polja ispod (vidi FinanceSettingsUpdate) - polje se
  // zato uvek prikazuje kao zaključano, bez obzira na vrednost fleg-a.
  // null = admin još nije postavio (viđeno uživo 30.08) - polje se prikazuje prazno.
  commission_percentage: number | null;
  commission_percentage_editable: boolean;
  // null = bez limita. 0 je backendom potvrđena stroga vrednost ("kurir ne
  // sme da drži nikakvu gotovinu"), ne tretira se kao null - vidi
  // 26_08_2026_odgovori-cash-limit.textile, tačka 5. Toggle u
  // Editor limita (CompanySettings) drži ovo razdvojeno da dispečer ne upiše 0 misleći
  // "bez limita".
  cash_limit_amount: number | null;
  cash_limit_enforcement: CashLimitEnforcement;
  payout_period_days: number;
  // Valuta firme za dostavu - slobodan string ("KM", "BAM", "EUR", "RSD"...),
  // NIJE ISO-4217 (odgovor 01.09, 1.1: zadržan postojeći obrazac "KM", živi u
  // settings->currency JSON polju). Opciono jer stariji odgovori nemaju polje -
  // potrošači padaju na "KM" (utils/currency.ts DEFAULT_CURRENCY).
  currency?: string | null;
  // Kanonski set dozvoljenih valuta - GET i PATCH finance-settings ga vraćaju
  // (odgovor 2.1, deployano i provjereno uživo 09.09: ["KM","BAM","EUR","RSD"]).
  // Dio ugovora, zato NIJE opciono. Editor valute (CompanySettings) njime puni izbor
  // listu - front NE hardkoduje set. PATCH vraća 422 (errors.currency) za
  // vrijednost van seta. OTVORENO: je li set globalan ili po firmi/gradu/državi,
  // je li redoslijed značajan (vidi
  // docs/2026/09/09_09_2026_Frontend_pitanja_za_backend.textile §2.1).
  available_currencies: string[];
  // Opciono - može ostati prazno ("" u formi, null ka backendu).
  daily_handover_time: string | null;
  // Backend default "ALL". Opciono jer stariji odgovori možda još nemaju polje -
  // panel pada na "ALL".
  assignment_mode?: AssignmentMode;
  // integer 1-50, nullable. Broj kurira koji dobijaju ponudu istovremeno.
  // Relevantno SAMO kad je assignment_mode = "TOP_N"; inače null (panel ga tada
  // i skriva). Opciono - stariji odgovori nemaju polje.
  assignment_courier_count?: number | null;
  // Relevantno SAMO za "NEAREST"/"TOP_N". Panel pada na "NEXT_NEAREST".
  assignment_timeout_action?: AssignmentTimeoutAction;
  // Uvijek relevantno. Panel pada na "ALL_ACTIVE".
  assignment_courier_pool?: AssignmentCourierPool;
  // integer 5-120, nullable. Vrijeme čekanja odgovora kurira (u sekundama) prije
  // nego se primijeni assignment_timeout_action. Polje je postojalo i ranije
  // (koristi ga sendOffer() endpoint), sada je izloženo i na ovom ekranu.
  offer_timeout_seconds?: number | null;
  // true (backend default) - kupac pri pregledu cene dostave (pre potvrde
  // narudžbe) vidi detaljan raspis: osnovna cena + cena po kilometru + svaka
  // naplata (gužva/noć/kiša) ponaosob. false - kupac vidi samo ukupan iznos.
  // Direktno utiče na odgovor delivery-price-preview endpointa na app.ordera.
  // Opciono jer stariji odgovori možda još nemaju polje - panel pada na true.
  show_price_breakdown?: boolean;
};

// PATCH prihvata ova polja - commission_percentage se namerno ne šalje (tiho se
// ignoriše na backendu i tako dokumentovano).
export type FinanceSettingsUpdate = {
  cash_limit_amount: number | null;
  cash_limit_enforcement: CashLimitEnforcement;
  payout_period_days: number;
  // Valuta firme - PATCH je prima od 01.09 (odgovor 1.1). Slobodan string.
  currency: string;
  daily_handover_time: string | null;
  assignment_mode: AssignmentMode;
  // null kad assignment_mode nije "TOP_N" (vidi validaciona pravila u Uputstvu).
  assignment_courier_count: number | null;
  assignment_timeout_action: AssignmentTimeoutAction;
  assignment_courier_pool: AssignmentCourierPool;
  // null = bez izmjene / nije postavljeno (5-120 inače).
  offer_timeout_seconds: number | null;
  show_price_breakdown: boolean;
};
