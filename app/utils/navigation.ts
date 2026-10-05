export type NavItem = {
  to: string;
  title: string;
  subtitle: string;
  icon: string;
};

// Sanduče kurira - na njega upućuju pločica na početnoj i stavka navigacije, pa
// im bedž nepročitanih poruka prepoznaje ovu putanju.
export const COURIER_INBOX_PATH = "/courier/inbox";

export type BottomNavItem = {
  to: string;
  label: string;
  icon: string;
  // Broj na ikoni (npr. nepročitane poruke). 0/izostavljeno = bez bedža. Računa
  // se u app.vue, ne ovde - lista ispod je statična.
  badge?: number;
  // Tačka uz ikonu (npr. gotovina blizu / preko limita). Računa se u app.vue.
  dot?: "near" | "over" | null;
};

// Stavke bottom menija po roli. Odjava NIJE u navigaciji (jedan promašaj od
// slučajnog izlaska) - nalazi se na dnu Profila, uz potvrdu.
export const courierBottomNavItems: BottomNavItem[] = [
  { to: "/", label: "Početna", icon: "mdi-home-outline" },
  { to: "/courier/deliveries", label: "Dostave", icon: "mdi-moped-outline" },
  { to: "/courier/wallet", label: "Novčanik", icon: "mdi-wallet-outline" },
  { to: "/courier/history", label: "Istorija", icon: "mdi-history" },
  { to: COURIER_INBOX_PATH, label: "Poruke", icon: "mdi-bell-outline" },
  { to: "/courier/profile", label: "Profil", icon: "mdi-account-outline" },
];

// Deljeno između AppTopbar dropdown menija i DispatcherHome kartica na početnoj.
export const dispatcherNavItems: NavItem[] = [
  {
    to: "/dispatcher",
    title: "Kuriri uživo",
    subtitle: "Pregled i mapa",
    icon: "mdi-map-marker-radius-outline",
  },
  {
    to: "/dispatcher/couriers",
    title: "Kuriri",
    subtitle: "Lista kurira firme - dodaj, izmeni, suspenduj",
    icon: "mdi-account-group-outline",
  },
  {
    to: "/dispatcher/assignment",
    title: "Dodela narudžbi",
    subtitle: "Predlog i slanje ponude kuriru",
    icon: "mdi-account-search-outline",
  },
  {
    to: "/dispatcher/finance",
    title: "Finansije",
    subtitle: "Kase kurira - predaje, balansi, isplate",
    icon: "mdi-cash-register",
  },
  {
    to: "/dispatcher/scheduling",
    title: "Raspored i zone",
    subtitle: "Zone, smjene i popunjenost",
    icon: "mdi-calendar-clock-outline",
  },
  {
    to: "/dispatcher/pricing",
    title: "Cenovnik",
    subtitle: "Cene, naknade, pravila za vozila",
    icon: "mdi-cash-multiple",
  },
  {
    to: "/dispatcher/company",
    title: "Firma",
    subtitle: "Finansijske postavke i saradnja sa restoranima",
    icon: "mdi-domain",
  },
  {
    to: "/dispatcher/notifications",
    title: "Obaveštenja",
    subtitle: "Grupno slanje poruka i istorija po kuriru",
    icon: "mdi-bell-outline",
  },
];

// Kurirske podstranice (trenutno prazni stub-ovi, vidi docs/glovo-rider-features.md).
export const courierNavItems: NavItem[] = [
  {
    to: "/courier/profile",
    title: "Moj profil",
    subtitle: "Podaci, vozilo i nalog",
    icon: "mdi-account-outline",
  },
  {
    to: "/courier/sessions",
    title: "Sesije",
    subtitle: "Raspored rada i rezervacije",
    icon: "mdi-calendar-clock-outline",
  },
  {
    to: "/courier/availability",
    title: "Radno vrijeme",
    subtitle: "Kada si dostupan za rad",
    icon: "mdi-calendar-check-outline",
  },
  {
    to: COURIER_INBOX_PATH,
    title: "Poruke",
    subtitle: "Od dispečera i platforme",
    icon: "mdi-bell-outline",
  },
  {
    to: "/courier/history",
    title: "Istorija dostava",
    subtitle: "Zarada i dostave po danima",
    icon: "mdi-history",
  },
  {
    to: "/courier/wallet",
    title: "Novčanik",
    subtitle: "Gotovina, zarada i isplate",
    icon: "mdi-wallet-outline",
  },
  {
    to: "/courier/quests",
    title: "Kvestovi",
    subtitle: "Bonus zarada",
    icon: "mdi-trophy-outline",
  },
  {
    to: "/courier/referral",
    title: "Preporuči prijatelja",
    subtitle: "Referral link",
    icon: "mdi-account-plus-outline",
  },
  {
    to: "/courier/scoring",
    title: "Scoring / Batch",
    subtitle: "Nedeljni rezultat",
    icon: "mdi-chart-line",
  },
];

