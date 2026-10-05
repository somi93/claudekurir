export type OrderaUser = {
  id: number;
  name: string;
  lastname: string;
  email: string;
  type: string;
  // Novo polje (16.08) - true dok korisnik ne promeni privremenu/početnu
  // lozinku (npr. kurir kog je dispečer upravo kreirao). Uspešan
  // PUT /me/password ga sam gasi na backendu - front lokalno prati kopiju u
  // sessionStore.user da podsetnik nestane bez čekanja na sledeći /me poziv.
  must_change_password: boolean;
};

// Svi tipovi korisnika koje backend vraca u users.type (Laravel enum na
// serveru, kao string). Aplikacija trenutno ima UI samo za dostava/
// dispatcher/admin - admin bira koji prikaz hoce (vidi AccountKind ispod),
// svi ostali tipovi vide poruku o nepodrzanom nalogu (pages/no-access.vue).
export const USER_TYPE = {
  ADMIN: "TYPE_ADMIN",
  RESTAURANT: "TYPE_RESTAURANT",
  CUSTOMER: "TYPE_CUSTOMER",
  COMPANY: "TYPE_COMPANY",
  PAYMENT: "TYPE_PAYMENT",
  RECIPIENT: "TYPE_RECIPIENT",
  GUEST: "TYPE_GUEST",
  REPORT: "TYPE_REPORT",
  REPORT_GUEST: "TYPE_REPORT_GUEST",
  WAREHOUSE: "TYPE_WAREHOUSE",
  DELIVERY: "TYPE_DELIVERY",
  DOSTAVA: "TYPE_COURIER",
  ADMIN_DELIVERY: "TYPE_ADMIN_DELIVERY",
  SHOP: "TYPE_SHOP",
  TABLE: "TYPE_TABLE",
  WORKER_MORE_RESTAURANTS: "TYPE_WORKER_MORE_RESTAURANTS",
  SUPPLIER: "TYPE_SUPPLIER",
} as const;

// Kojoj "vrsti" naloga korisnik pripada. "admin" nema svoj UI - on bira koji
// od preostala dva prikaza (dostava/dispatcher) hoce da gleda,
// vidi useSessionStore().role. "dispatcher" je poseban nalog (TYPE_ADMIN_DELIVERY)
// koji uvek gleda dispecerski prikaz, bez biranja. "unsupported" pokriva sve
// tipove kojima aplikacija jos ne sluzi (customer, company, guest, supplier,
// restaurant - izvestaji restorana su migrirani u drugi projekat...).
export type AccountKind = "dostava" | "dispatcher" | "admin" | "unsupported";

export const getAccountKind = (type: string): AccountKind => {
  if (type === USER_TYPE.DOSTAVA) return "dostava";
  if (type === USER_TYPE.ADMIN_DELIVERY) return "dispatcher";
  if (type === USER_TYPE.ADMIN) return "admin";
  return "unsupported";
};

// Aktivan prikaz u aplikaciji - za dostava nalog je uvek isti kao
// AccountKind, za admina je to ono sto je izabrao na /choose-role.
export type AppRole = "dostava" | "dispatcher";

// Jedini izvor istine za "pocetnu" rutu po roli - koriste ga login.vue i
// middleware/auth.global.ts, da se mapiranje ne duplira na dva mesta.
export const ROLE_HOME: Record<AppRole, string> = {
  dostava: "/courier/deliveries",
  dispatcher: "/",
};
