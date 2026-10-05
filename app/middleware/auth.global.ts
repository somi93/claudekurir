import { useSessionStore, SESSION_KEYS } from "~/stores/session"
import { ROLE_HOME } from "~/types/user"

// Jedini middleware koji odlucuje ko sme gde - spaja ono sto je ranije bilo
// auth.ts (mora token) + guest.ts (ulogovan ne sme na /login) + role.global.ts
// (zone po roli).
//
// Deny-by-default: sve rute su zasticene osim onih iz PUBLIC_ROUTES. Ranije
// je zastita bila opt-in (svaka stranica je morala rucno da doda "auth" u
// definePageMeta) - nova stranica bez tog dodatka bila je tiho javna. Ovako
// je obrnuto: nova stranica je automatski zasticena, javnost mora eksplicitno
// da se navede ovde.
//
// Async: ceka sessionStore.ensureUser() (poziva /me tacno jednom po sesiji,
// keširano u memoriji store-a - vidi stores/session.ts) pre nego sto odluci
// kuda sme dalje. Nuxt saceka da se route middleware zavrsi pre montiranja
// stranice, pa nema race izmedju "stranica se vec montirala" i "znamo ko je
// korisnik" (vidi docs/auth-permissions-review.md, Ozbiljno #3 - dok je
// redirekcija cekala /me network poziv kroz watcher u store-u umesto da ga
// middleware saceka, stranica je stigla da se montira i pocne fetch pre nego
// sto bi je izbacilo). Sam token (da li uopste postoji sesija) se cita
// direktno iz localStorage-a jer je to jedini podatak koji mora da prezivi
// refresh - sve ostalo (user, rola, courierId) zivi samo u store-u.
const PUBLIC_ROUTES = ["/login"]

// /r/:courierId je javna referral landing stranica - otvara je gost bez naloga
// (vidi services/courierReferralsService.ts#createPublicReferralLead), pa ne
// sme da ga middleware izbaci na /login.
const isPublicReferralLink = (path: string) => path.startsWith("/r/")

const isCourierArea = (path: string) => path === "/" || path.startsWith("/courier")

// Promjena lozinke je zajednička stranica svih rola. Kuriru je zona iznad ranije bila jedina
// dozvoljena (02.08), pa je traka "Promeni sada" (must_change_password, 16.08) vodila na
// /change-password, a middleware ga je vraćao na Dostave: kurir nije mogao da promijeni lozinku.
// Profil ima isti obrazac u donjem listu (?s=lozinka); ova ruta ostaje kao zaštitna mreža.
const CHANGE_PASSWORD_ROUTE = "/change-password"

// /dev/* su interni alati za ručno testiranje backenda (npr. /dev/api - API
// konzola). Dostupni SVAKOM ulogovanom nalogu podržanog tipa, van rolnih zona -
// kuriru treba isti alat kao dispečeru (npr. offer/socket testovi s kurirske
// strane). I dalje traži token (deny-by-default gore).
const isDevRoute = (path: string) => path === "/dev" || path.startsWith("/dev/")

// /admin/* - iskljucivo za pravi platform-admin nalog (AccountKind "admin",
// backend UserType::ADMIN = 0), NE za dispecera (AccountKind "dispatcher",
// UserType::ADMIN_DELIVERY = 12 - to je vec dispecerska "/dispatcher" zona).
// Namerno provjerava accountKind, ne role - admin ovamo sme uci i pre nego
// sto na /choose-role izabere dostava/dispatcher prikaz.
const isAdminOnlyRoute = (path: string) => path.startsWith("/admin")

// Nalog cijim tipom aplikacija jos ne zna da se bavi (customer, company,
// guest, supplier...) - vidi types/user.ts#AccountKind.
const NO_ACCESS_ROUTE = "/no-access"
// Admin (AccountKind "admin") nema svoj UI - bira ovde koji od tri prikaza
// hoce da gleda, vidi stores/session.ts#setAdminActiveRole.
const CHOOSE_ROLE_ROUTE = "/choose-role"

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  if (isPublicReferralLink(to.path)) return

  const hasToken = Boolean(localStorage.getItem(SESSION_KEYS.token))
  const isPublicRoute = PUBLIC_ROUTES.includes(to.path)

  if (!hasToken) {
    if (isPublicRoute) return
    return navigateTo("/login")
  }

  const sessionStore = useSessionStore()
  await sessionStore.ensureUser()
  const accountKind = sessionStore.accountKind

  if (isPublicRoute) {
    // Vec ulogovan - /login mu ne treba, salji ga na njegovu pocetnu.
    if (accountKind === "unsupported") return navigateTo(NO_ACCESS_ROUTE)
    if (accountKind === "admin" && !sessionStore.role) return navigateTo(CHOOSE_ROLE_ROUTE)
    return navigateTo(sessionStore.role ? ROLE_HOME[sessionStore.role] : "/login")
  }

  // Token postoji ali /me nije uspeo (istekao/nevazeci) - ensureUser je vec
  // ocistio sesiju i poslao na /login, ovde samo ne blokiraj tu redirekciju.
  if (!accountKind) return navigateTo("/login")

  if (accountKind === "unsupported") {
    if (to.path === NO_ACCESS_ROUTE) return
    return navigateTo(NO_ACCESS_ROUTE)
  }

  // Podrzan nalog ne treba da zavrsi na poruci o nepodrzanom nalogu.
  if (to.path === NO_ACCESS_ROUTE) {
    return navigateTo(sessionStore.role ? ROLE_HOME[sessionStore.role] : CHOOSE_ROLE_ROUTE)
  }

  // Dev alati - propusti svaki podrzan ulogovan nalog (kurir, dispecer, admin
  // bez izabrane role) prije rolnih zona.
  if (isDevRoute(to.path)) return

  if (isAdminOnlyRoute(to.path)) {
    if (accountKind === "admin") return
    return navigateTo(sessionStore.role ? ROLE_HOME[sessionStore.role] : "/login")
  }

  if (accountKind === "admin" && !sessionStore.role) {
    if (to.path === CHOOSE_ROLE_ROUTE) return
    return navigateTo(CHOOSE_ROLE_ROUTE)
  }

  if (to.path === CHOOSE_ROLE_ROUTE) {
    // Samo admin bira prikaz - ostali nalozi ovde nemaju sta da traze.
    if (accountKind === "admin") return
    return navigateTo(sessionStore.role ? ROLE_HOME[sessionStore.role] : "/login")
  }

  const role = sessionStore.role
  if (!role) return navigateTo("/login")

  if (role === "dostava") {
    if (isCourierArea(to.path) || to.path === CHANGE_PASSWORD_ROUTE) return
    return navigateTo(ROLE_HOME.dostava)
  }
})
