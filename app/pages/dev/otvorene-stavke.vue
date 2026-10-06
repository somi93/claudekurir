<template>
  <GlobalPage :max-width="1100">
    <template #header>
      <PageHeader title="Dev · Otvorene stavke" back-to="/" back-label="Nazad na početnu">
        <template #actions>
          <v-chip size="small" color="warning" variant="flat">DEV ALAT</v-chip>
        </template>
      </PageHeader>
    </template>

    <PageAlert type="info" class="mb-4">
      Pregled svega što čeka backend ili zajednički dogovor - detaljnija verzija
      <code>docs/2026/09/otvorene-stavke-tracker.md</code>. "Rešeno" se pamti samo u ovom
      browseru (localStorage), ne na serveru - služi isključivo za tvoje lično praćenje.
      Pun kontekst/dokaz za svaku stavku je u dnevnim <code>*_Frontend_pitanja_za_backend*.textile</code>
      fajlovima navedenim uz svaku stavku.
    </PageAlert>

    <div class="d-flex ga-2 flex-wrap mb-4 align-center">
      <v-chip size="small" variant="tonal">{{ openCount }} otvoreno</v-chip>
      <v-chip size="small" variant="tonal" color="success">{{ resolvedCount }} rešeno</v-chip>
      <v-spacer />
      <v-checkbox
        v-model="showResolved"
        label="Prikaži rešene"
        hide-details
        density="compact"
        class="show-resolved-toggle"
      />
      <v-btn size="small" variant="text" @click="resolvedIds.clear(); persist()">
        Resetuj "rešeno"
      </v-btn>
    </div>

    <section v-for="group in groups" :key="group.key" class="group-section">
      <h2 class="group-title">
        <span :class="`dot dot--${group.key}`" />
        {{ group.label }}
        <span class="group-count">{{ group.items.length }}</span>
      </h2>

      <div class="item-list">
        <div
          v-for="item in group.items"
          :key="item.id"
          class="item-card"
          :class="{ 'item-card--resolved': isItemResolved(item) }"
        >
          <v-checkbox
            v-if="!item.solved"
            :model-value="resolvedIds.has(item.id)"
            hide-details
            density="compact"
            class="item-checkbox"
            @update:model-value="toggleResolved(item.id)"
          />
          <v-icon v-else class="item-checkbox solved-icon" icon="mdi-check-circle" color="success" />
          <div class="item-body">
            <div class="item-head">
              <span class="item-title">{{ item.title }}</span>
              <v-chip v-if="item.solved" size="x-small" color="success" variant="flat">
                Rešeno
              </v-chip>
              <v-chip size="x-small" :color="priorityMeta[item.priority].color" variant="flat">
                {{ priorityMeta[item.priority].label }}
              </v-chip>
            </div>

            <div class="item-meta">
              <span class="meta-row">
                <v-icon icon="mdi-monitor-screenshot" size="14" />
                <strong>Stranica:</strong>
                <span v-if="item.pages.length === 0">-</span>
                <code v-for="page in item.pages" :key="page">{{ page }}</code>
              </span>
              <span class="meta-row">
                <v-icon icon="mdi-api" size="14" />
                <strong>API poziv:</strong>
                <span v-if="item.api.length === 0">- (nema/nije backend pitanje)</span>
                <code v-for="call in item.api" :key="call">{{ call }}</code>
              </span>
            </div>

            <p class="item-description">{{ item.description }}</p>

            <p class="item-source">
              Izvor: <code>{{ item.source }}</code>
            </p>
          </div>
        </div>
      </div>
    </section>
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Dev · Otvorene stavke" });

import { computed, onMounted, reactive, ref } from "vue";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";

type Priority = "bug" | "backend" | "decision";

type OpenItem = {
  id: string;
  title: string;
  // Ruta(e) u aplikaciji koje stavka pogađa - prazan niz ako je čisto backend/
  // infra pitanje bez direktnog UI ekrana.
  pages: string[];
  // Backend endpoint(i) - prazan niz ako pitanje nema konkretan API poziv
  // (npr. čisto UX pitanje za zajednički dogovor).
  api: string[];
  description: string;
  priority: Priority;
  // Dnevni fajl gde je nalaz prvi put/najdetaljnije opisan.
  source: string;
  // true = potvrđeno rešeno uživo (upisano u kodu, ne u localStorage kao
  // resolvedIds ispod) - sakriveno inicijalno, vidljivo samo kad se uključi
  // "Prikaži rešene". Za razliku od resolvedIds (lično, po browseru), ovo je
  // deo istog izvora istine kao opis/description.
  solved?: boolean;
};

const priorityMeta: Record<Priority, { label: string; color: string }> = {
  bug: { label: "Bag", color: "error" },
  backend: { label: "Čeka backend", color: "warning" },
  decision: { label: "Za dogovor", color: "info" },
};

// Ručno održavana lista - ogledalo docs/2026/09/otvorene-stavke-tracker.md, samo
// sa više detalja (stranica + API + duži opis) za dev-konzolu. Ažurirati oba kad
// se nešto reši ili doda.
const ITEMS: OpenItem[] = [
  {
    id: "siri-ispad-500",
    title: "ŠIRI ISPAD: couriers-status/courier-locations/inbox-summary vraćaju 500",
    pages: ["/dispatcher/couriers", "/dispatcher/notifications"],
    api: ["GET .../couriers-status", "GET .../courier-locations", "GET .../inbox-summary"],
    description:
      "Potvrđeno uživo 16.09 (~23:20): sve tri rute vraćaju 500 {message: \"Server Error\"} (APP_DEBUG isključen, nema stack trace-a) na VIŠE stranica - \"Kuriri uživo\" (mapa, potpuno nefunkcionalna, \"Ne mogu da učitam lokacije dostavljača\") i \"Obaveštenja\". couriers-status je RANIJE ISTOG DANA radio ispravno na /dispatcher/finance (21 kurira, čisto) - ovo je noviji ispad, ne stari poznati problem. Preporuka: stati sa daljim retestom dok backend ne potvrdi da je stabilno.",
    priority: "bug",
    source: "16_09_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "automatska-dodjela-round-null",
    title: "Automatska dodjela (TOP_N/NEAREST) se nikad ne pokreće - round: null",
    pages: ["/dispatcher/company", "/dispatcher/assignment"],
    api: ["PATCH .../finance-settings (assignment_mode)", "GET /dispatcher/orders/{id}/offers"],
    description:
      "REŠENO 21.09 (propušteno da se ovdje upiše do 28.09). Potvrđeno da se runda sad automatski otvara (is_automatic:true, status:\"active\", narudžba #3974) - dodatno potvrđeno 28.09 kroz R6/R9 retestove.",
    priority: "bug",
    source: "16_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "admin-nalozi-offer-runda",
    title: "Admin/dispečerski nalozi dobijaju stvarne ponude u offer rundi",
    pages: ["/dispatcher/assignment"],
    api: ["POST /dispatcher/orders/{id}/offer"],
    description:
      "REŠENO 21.09 (propušteno da se ovdje upiše do 28.09). candidate_ids (15 stavki) i offers[] na automatskoj rundi (narudžba #3974) NE sadrže nijedan admin/dispečerski nalog (30369/30700/30722/30188) - vidi 21_09_2026_Network_checklist_sve-otvorene-stavke.md red R3.",
    priority: "bug",
    source: "14_09_2026_Frontend_pitanja_za_backend_kriticne-stavke.textile + 15_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "offer-round-changed-timeout",
    title: "offer.round.changed se ne emituje za automatski istek kandidata",
    pages: ["/dispatcher/assignment"],
    api: ["WS private-orders.{orderId}, event .offer.round.changed"],
    description:
      "REŠENO 28.09 - OBOREN raniji nalaz. Uhvaćena DVA offer.round.changed frame-a na istoj rundi (active→exhausted), ~23s razmaka, BEZ ijedne ručne akcije između njih (order 4183, Network tab filtriran na Socket) - automatski istek SAD broadcast-uje. Ili je backend popravio u međuvremenu, ili je 14.09 dijagnoza bila pogrešna. Vidi 21_09_2026_Network_checklist_sve-otvorene-stavke.md red R6.",
    priority: "bug",
    source: "14_09_2026_Frontend_pitanja_za_backend_kriticne-stavke.textile",
    solved: true,
  },
  {
    id: "broadcasting-auth-403",
    title: "POST /broadcasting/auth intermitentno vraća 403 (ne-JSON telo)",
    pages: ["/dispatcher/assignment"],
    api: ["POST /broadcasting/auth"],
    description:
      "REŠENO/OBJAŠNJENO 28.09 - NIJE bag, NIJE intermitentno. Deterministički vezano za stanje runde: 403 DOSLJEDNO (10/10 pokušaja) kad runda nije aktivna, 200 dosljedno kad jeste - backend logično odbija pretplatu na kanal bez čega da se broadcast-uje. Raniji \"prvi pokušaj padne, drugi prođe\" nalazi su se slučajno poklopili sa ovim obrascem, ne sa infra flakiness-om. Frontend bug ispravljen: useOrderOfferRound.ts watchOrder() je pokušavao subscribe i za rešene runde - sad se drži samo dok je roundStatus active.",
    priority: "bug",
    source: "14_09_2026_Frontend_pitanja_za_backend_kriticne-stavke.textile",
    solved: true,
  },
  {
    id: "couriers-balance-nepoznati-nalozi",
    title: "couriers-balance vraća 4 ID-ja koja couriers-status ne vraća - ko su ti nalozi?",
    pages: ["/dispatcher/finance", "/dispatcher/couriers"],
    api: ["GET .../couriers-balance", "GET .../couriers-status"],
    description:
      "REŠENO 21.09 (backend objasnio, propušteno da se ovdje upiše do 28.09) - NIJE bag, namjerno: couriers-balance uključuje i neaktivne kurire da dispečer vidi eventualni dug i poslije deaktivacije/uklanjanja, couriers-status prikazuje samo aktivne. Razlika u broju redova je očekivana. (16.09 fix da admin nalozi 30369/30700/30722 ne budu tu ostaje na snazi.)",
    priority: "backend",
    source: "16_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "resolve-restaurant-status-podpitanja",
    title: "resolve-restaurant-status accept - preostala pod-pitanja",
    pages: ["/dispatcher/assignment"],
    api: ["POST /api/dispatcher/orders/{id}/resolve-restaurant-status"],
    description:
      "Glavni bug (narudžba nestane sa svih tabova poslije accept-a) je potvrđeno sređen. Ostaje nepotvrđeno: u koje tačno stanje accept prebacuje narudžbu, ima li GET /dispatcher/orders/waiting serverski vremenski prozor (kao pending-restaurant-confirmation) koji bi izbacio zaostalu (>3h) narudžbu, i da li se push \"Nova narudzba\" i dalje šalje dispečeru koji je sam uradio accept.",
    priority: "backend",
    source: "14_09_2026_Frontend_pitanja_za_backend_kriticne-stavke.textile",
  },
  {
    id: "open-to-all-ne-radi",
    title: "assignment_timeout_action: OPEN_TO_ALL ne radi (regresija)",
    pages: ["/dispatcher/company", "/dispatcher/assignment"],
    api: ["PATCH .../finance-settings (assignment_timeout_action)", "POST /dispatcher/orders/{id}/offer"],
    description:
      "REŠENO 28.09, u ispravnom NEAREST modu (raniji 21.09 test greškom rađen u TOP_N): potvrđen pun tok - ponuda prvo najbližem, po isteku otvara SVIM preostalim, po njihovom isteku tek onda exhausted. Regresija ispravljena.",
    priority: "bug",
    source: "15_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "cash-limit-unavailable-reason",
    title: "candidate-couriers ne vraća razlog unapred (cash limit, itd.)",
    pages: ["/dispatcher/assignment"],
    api: ["GET /dispatcher/orders/{id}/candidate-couriers"],
    description:
      "Dispečer i dalje mora da klikne \"Pošalji ponudu\"/\"Dodeli odmah\" da bi saznao da je kandidat preko cash limita - greška sad bar stiže ODMAH (potvrđeno 15.09, N3a), ne posle punog timeout-a, ali nema proaktivnog polja (npr. cash_over_limit ili opštiji unavailable_reason) da front prikaže chip unapred, kao za neodgovarajuće vozilo. Ponovo potvrđeno 28.09, i šire nego samo prikaz: kandidat preko BLOCK limita SVEJEDNO dobija ponudu (backend ga tek na accept-u ispravno odbije sa 409) - kandidat pool za slanje ponude ga ne isključuje unaprijed. Vidi 28_09_2026_Frontend_pitanja_za_backend.textile.",
    priority: "backend",
    source: "15_09_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "inbox-summary-oblik",
    title: "inbox-summary - prefiks rute i oblik odgovora nepotvrđeni",
    pages: ["/dispatcher/notifications"],
    api: ["GET /dispatcher/delivery-companies/{companyId}/inbox-summary (pretpostavljeno)"],
    description:
      "Backend je potvrdio da ruta postoji, ali odgovor nije naveo /dispatcher/ prefiks (koji ima sestrinski broadcast endpoint) ni konkretan JSON oblik. Frontend implementirao na pretpostavku ({courier_id, last_message:{title,sent_at,category,sender}|null, dispatcher_unread_count}) - nije provereno uživo, prvi realan poziv treba da potvrdi ili obori pretpostavku.",
    priority: "backend",
    source: "15_09_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dodeli-odmah-push",
    title: "\"Dodeli odmah\" - kurir ne vidi dodelu odmah (nema push)",
    pages: ["/dispatcher/assignment", "/courier/deliveries"],
    api: ["POST /orders/{id}/accept (dispečerski hard-assign)"],
    description:
      "REŠENO 29.09. Isti endpoint koji kurir sam zove kad prihvati narudžbu - kurirska strana nekad nije imala push/WS vezu za ovaj tok (samo poll 15s). Kurirski socket kanal (App.Models.User.{courierId}) je sad proširen i na direktnu dodjelu, ne samo na offer-round.",
    priority: "backend",
    source: "15_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "paying-type-pivot-ne-radi",
    title: "paying_type/paying/contract_signed_at/contract_active_from se i dalje ne čuvaju",
    pages: ["/dispatcher/couriers"],
    api: ["POST /dispatcher/delivery-companies/{companyId}/couriers", "PATCH .../couriers/{courierId}"],
    description:
      "REŠENO. POST potvrđen 21.09 (kurir 30742), PATCH potvrđen 28.09 (kurir 30189) - oba endpointa sad vraćaju sva 4 pivot polja tačno kako su poslata, i u odgovoru i u naknadnom couriers-status GET-u. UserDetail strana (lični podaci) je RADILA već od 14.09 večernje.",
    priority: "bug",
    source: "14_09_2026_Frontend_pitanja_za_backend_prosirena-forma-kurira.textile",
    solved: true,
  },
  {
    id: "image-path-upload",
    title: "image_path upload - plan odložen na backendu",
    pages: ["/dispatcher/couriers"],
    api: ["POST/PATCH .../couriers (image_path) - endpoint još ne postoji"],
    description:
      "Backend nije rešio 14.09, obećao da će javiti konkretan plan naknadno. Frontend ostaje read-only prikaz putanje u \"Izmeni kurira\" formi, bez ijednog upload UI-ja - nema se na šta ugledati ni u ostatku projekta (nijedan drugi image/file-upload endpoint ne postoji).",
    priority: "backend",
    source: "14_09_2026_Frontend_pitanja_za_backend_prosirena-forma-kurira.textile",
  },
  {
    id: "hours-online",
    title: "/earnings ne vraća hours_online / KM po satu",
    pages: ["/courier/wallet"],
    api: ["GET /couriers/{id}/earnings"],
    description:
      "Čeka novi \"sesije\" sistem na backendu (procena 1.5-2.5h rada kad krene). Tab \"Zarada\" u kurirskom Novčaniku trenutno prikazuje broj dostava i prosjek umesto \"h online\"/\"KM po satu\" iz originalnog #223636 mockup-a. Ponovo potvrđeno 28.09 (živ odgovor, 18 stavki), polje i dalje ne postoji.",
    priority: "backend",
    source: "01_09_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "payouts-produkcija",
    title: "payouts.created_at - treba potvrda s produkcije",
    pages: ["/dispatcher/finance", "/courier/wallet"],
    api: ["GET .../payouts"],
    description:
      "REŠENO 28.09. Namjerno testiran slučaj preko granice ponoći (22:11 UTC = 00:11 sledećeg dana po Beogradu) - ekran \"Isplate\" prikazao tačno \"17. sep 00:11\", nema pomaka ni preko dana.",
    priority: "backend",
    source: "13_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "idor-druge-rute",
    title: "IDOR fix - pokriva li i druge courier-scoped rute?",
    pages: [],
    api: ["GET /orders/driver/{id} (potvrđen fix)", "ostale /courier/* rute (nepotvrđeno)"],
    description:
      "Potvrđeno da je GET /orders/driver/{id} popravljen (403 na tuđi courier_id). Nije odgovoreno da li je ista provera vlasništva primenjena i na druge slične courier-scoped rute koje uzimaju tuđi ID iz putanje. 28.09: dva dodatna primjera potvrđena (GET /couriers/{id} i .../earnings sa tuđim ID-om → 403) - obrazac ide u prilog generičkoj provjeri, ali većina /couriers/{id}/... ruta (wallet-balance, availability, inbox, payouts, quests, referrals, scoring, sessions, zones, companies, history) i dalje nije pojedinačno testirana.",
    priority: "backend",
    source: "14_09_2026_Frontend_pitanja_za_backend_kriticne-stavke.textile",
  },
  {
    id: "ponuda-vise-kandidata-all-or-nothing",
    title: "Ručna ponuda sa više kandidata - jedan nevažeći obara CIJEL zahtjev (422)",
    pages: ["/dispatcher/assignment"],
    api: ["POST /dispatcher/orders/{id}/offer"],
    description:
      "REŠENO 28.09. Isti test-set kandidata (30189/30742/30577/30576, 30576 nevažeći - \"vozi drugu dostavu\") sad vraća 200, candidate_ids sadrži samo validne, top-level skipped:[\"Kurir #30576 trenutno vozi drugu dostavu.\"] objašnjava izostavljenog. Frontend je ovo već ispravno parsirao (extractSkipped/skippedNotes, kod od 21.09) - nije trebalo ništa mijenjati.",
    priority: "decision",
    source: "16_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "dugme-radim",
    title: "IDEJA: dugme \"Radim\" / \"Prestao sam da radim\" za kurira",
    pages: ["/courier/availability", "/courier/deliveries"],
    api: ["nema još - novi endpoint ako se prihvati"],
    description:
      "currently_available (koristi ga assignment_courier_pool: AVAILABLE_NOW) trenutno isključivo puni \"Radno vrijeme\" (unapred planirani termini po danu/zoni) - nema live \"sad sam dostupan\" prekidač nezavisan od rasporeda, kao Uber/Bolt \"idi online\" dugme. Otvoreno za zajednički dogovor, ne odluka.",
    priority: "decision",
    source: "15_09_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "posalji-ponudu-klikabilno",
    title: "\"Pošalji ponudu\" dugme klikabilno i za kandidate koji sigurno ne mogu primiti",
    pages: ["/dispatcher/assignment"],
    api: ["POST /orders/{id}/accept", "GET .../candidate-couriers"],
    description:
      "CandidateListItem.vue ne onemogućava dugme ni za Na isporuci/Nedostupan/Ne odgovara vozilu - dispečer mora da proba. Tri pitanja za dogovor: da li on_delivery uvek treba blokirati ponudu, da li dodati filter \"samo oni kojima se može poslati\", i da li generalizovati u unavailable_reason polje (povezano sa cash-limit stavkom iznad).",
    priority: "decision",
    source: "15_09_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kurirski-prikaz-ponude",
    title: "Kurirski prikaz ponude ('Nova ponuda' banner) - mnogo manje info od obične narudžbe",
    pages: ["/courier/deliveries"],
    api: ["GET /courier/offers"],
    description:
      "REŠENO 25.09. Banner na vrhu zamijenjen OfferCard.vue komponentom ispod mape, istog izgleda kao ostale kartice (DeliveryRoutePoints za rutu, cena iz delivery_price, Odbij/Prihvati velika dugmad).",
    priority: "decision",
    source: "15_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "moj-profil-prosirena-polja",
    title: "Moj profil (kurirska strana) - 13.09 proširena polja nedostupna kuriru",
    pages: ["/courier/profile"],
    api: ["GET/PUT /couriers/:id"],
    description:
      "REŠENO 28.09. GET /couriers/:id sad vraća detail objekat (lični podaci - ranije detail: string|null, praktično neiskorišćen). Dodata sekcija 'Lični podaci' u profile.vue (datum rođenja, IBAN, hitni kontakt), kurir ih sam uređuje preko istog PUT obrasca kao dispečerski PATCH. Naplata/ugovor namjerno ostaje nedostupno kuriru (vezano za firmu, ne za osobu).",
    priority: "decision",
    source: "15_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "dodeli-odmah-vs-offer-runda",
    title: "\"Dodeli odmah\" - hard-assign vs. offer-runda (arhitekturno pitanje)",
    pages: ["/dispatcher/assignment"],
    api: ["POST /orders/{id}/accept"],
    description:
      "Alternativa razmatrana uz push pitanje iznad: da li bi \"Dodeli odmah\" trebalo da otvori offer-rundu sa jednim kandidatom umesto direktnog hard-assign-a - nasledio bi već izgrađenu i testiranu push/WS infrastrukturu, po ceni da kurir mora eksplicitno da prihvati umesto trenutne dodele.",
    priority: "decision",
    source: "15_09_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kurir-socket-automatska-dodela",
    title: "Kurirski socket ne javlja ništa za AUTOMATSKU dodelu, samo za ručnu",
    pages: ["/courier/deliveries"],
    api: ["WS private-App.Models.User.{courierId}, event .courier.offers.changed"],
    description:
      "REŠENO 29.09. Potvrđeno uživo 25.09 da kanal radi pouzdano za ručnu ponudu; 28.09 nalaz da automatska runda ne javlja ništa je sad obrnut - kurirski kanal radi i za automatsku dodelu.",
    priority: "backend",
    source: "28_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "predlozeni-kuriri-stara-lista-vidljiva",
    title: "\"Predloženi kuriri\" - stara lista ostaje vidljiva kad nova narudžba padne na grešku",
    pages: ["/dispatcher/assignment"],
    api: ["GET /dispatcher/orders/{id}/candidate-couriers"],
    description:
      "REŠENO 28.09 (nađeno i ispravljeno isti dan). Kad se unese ID narudžbe koja ne može da učita kandidate, candidates.value se nikad nije čistio - dispečer je vidio grešku gore, ali ispod i dalje kompletnu listu kandidata i AKTIVNA \"Pošalji ponudu\" dugmad od PRETHODNE narudžbe, kao da važe za novu. useCandidateCouriers.ts sad prazni listu na grešku.",
    priority: "bug",
    source: "28_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "posalji-ponudu-aktivno-za-nepoznatu-narudzbu",
    title: "\"Pošalji ponudu\" dugmad aktivna za narudžbu koja nije ni u jednoj board listi",
    pages: ["/dispatcher/assignment"],
    api: [],
    description:
      "REŠENO 28.09 (nađeno i ispravljeno isti dan). buildOrderStateNote je za \"unknown\" stanje (narudžba van svih board lista) već ispisivao upozorenje \"slanje ponude vjerovatno neće uspjeti\", ali offersDisabledForContext to stanje nije gasilo - dugmad ostajala klikabilna uprkos upozorenju. Ispravljeno da \"unknown\" sad gasi i dugmad.",
    priority: "bug",
    source: "28_09_2026_Frontend_pitanja_za_backend.textile",
    solved: true,
  },
  {
    id: "couriers-id-nova-polja",
    title: "GET /couriers/:id - nova, neobjašnjena polja",
    pages: ["/courier/profile"],
    api: ["GET /couriers/:id"],
    description:
      "Potvrđeno uživo 28.09: odgovor sad ima private_email, address, state, city_id, created_at koja ranije nisu postojala/nisu bila u tipu. Značenje nepotvrđeno (npr. da li je state isti record_status enum 0/1/2 viđen drugdje) - dodato u CourierProfileDto, namjerno bez UI-ja dok se ne potvrdi.",
    priority: "backend",
    source: "28_09_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "notify-only-ne-upozorava-kurira",
    title: "NOTIFY_ONLY (cash limit) ne upozorava NIKOGA kad kurir sam prihvati ponudu",
    pages: ["/courier/deliveries"],
    api: ["POST /orders/{id}/offer-response"],
    description:
      "Potvrđeno uživo 28.09: odgovor ({success,message,data:<narudžba>}) nema warning/current_cash_amount/cash_limit_amount, za razliku od starog /accept odgovora. Kurir danas nema NIJEDAN preostali tok kojim bi saznao da je prešao limit gotovine - jedini koji je to radio (self-accept sa liste dostupnih narudžbi) obrisan je 25.09. Ni direktna dodela ('Dodeli odmah') ne pomaže - kurir nije taj koji zove taj endpoint pa ne vidi ni njegov warning.",
    priority: "bug",
    source: "28_09_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-unread-count",
    title: "Poruke: nema broja nepročitanih za bedž",
    pages: ["/courier/inbox", "/"],
    api: ["GET /couriers/{id}/inbox", "GET /couriers/{id}/inbox/unread-count (traži se)"],
    description:
      "03.10: front broj nepročitanih računa iz učitanih stranica (do 4×50 po sesiji + stranica 1 svakog minuta), pa nepročitana prava poruka iza tog prozora ostaje neuračunata. Ponude (15 od 16 poruka) popune prvu stranicu. Traži se endpoint unread-count (total + by_category) ili ?unread=1&exclude_category=offer.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-offer-poruke",
    title: "Poruke: offer poruke nastaju nepročitane, ostaju zauvijek i bez veze sa ponudom",
    pages: ["/courier/inbox"],
    api: ["GET /couriers/{id}/inbox (category: \"offer\")"],
    description:
      "03.10: trag ponude (prihvata se na ekranu Dostave) ostaje read:false danima i lista raste svaki dan. Front ih više ne broji i skuplja po danu, ali server ih drži nepročitanim. Traži se: kreirati kao pročitane (ili označiti kad se runda riješi), retencija, i order_id/offer_id/offer_status/expires_at u DTO-u da se pokaže stvarni ishod i živa kartica.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-push-tip",
    title: "Poruke: push za inbox poruku - postoji li i koji je data.type",
    pages: ["/courier/inbox"],
    api: ["FCM data.type / data.inbox_id"],
    description:
      "03.10: klik na notifikaciju (firebase-messaging-sw.js) sad vodi po data: url, order_offer → /courier/deliveries, inbox_message + inbox_id → /courier/inbox?m=ID. Backend nije potvrdio da dispečerova poruka (pojedinačna ni grupna) uopšte šalje push, niti koji je tip.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-ovlascenja-kurira",
    title: "Poruke: PUT read:false, DELETE za kurira i provjera vlasništva",
    pages: ["/courier/inbox"],
    api: ["PUT /inbox/{id} (read:false)", "DELETE /inbox/{id}"],
    description:
      "03.10: \"Označi kao nepročitano\" šalje {read:false} (nepotvrđeno, pri grešci vraća stanje). Brisanje za kurira nije nuđeno dok se ne zna ko smije da ga pozove. /inbox/{id} nije ispod /couriers/{id}, pa IDOR zaštita potvrđena 28.09 ne mora da važi - netestirano.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-kategorija-i-jedna-poruka",
    title: "Poruke: ?category= i NULL kategorija, per_page max, redoslijed; GET jedne poruke",
    pages: ["/courier/inbox"],
    api: ["GET /couriers/{id}/inbox?category=&page=&per_page=", "GET /inbox/{id} (ne postoji)"],
    description:
      "03.10: da li ?category=announcement vraća i redove sa category NULL, koji je najveći per_page (front šalje 50), da li je redoslijed stabilan, i može li postojati GET jedne poruke po ID-u za deep link iz push-a (front danas pretražuje do 12 stranica unazad).",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-socket-dogadjaj",
    title: "Poruke: socket događaj za novu poruku (opciono)",
    pages: ["/courier/inbox", "/"],
    api: ["WS private-App.Models.User.{courierId}, npr. .courier.inbox.changed"],
    description:
      "03.10: dok je aplikacija otvorena, nova poruka stiže do bedža tek kroz poll (do 60 s) ili foreground push. Događaj na istom kanalu koji već radi za ponude bi to ubrzao.",
    priority: "decision",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-posiljalac-i-todo",
    title: "Poruke: ime/telefon pošiljaoca i \"Urađeno\" za todo",
    pages: ["/courier/inbox"],
    api: ["DTO poruke: sender_name, sender_phone, done_at"],
    description:
      "03.10: otvorena poruka piše samo \"Dispečer\", a za todo poruke nema kuda da se odgovori (dugme \"Pozovi dispečera\" traži telefon u DTO-u). Treba li todo da bude pravi zadatak sa ishodom (done_at) ili ostaje obična poruka? Do odluke front ne radi ništa.",
    priority: "decision",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-naplata",
    title: "Dostave: iznos za naplatu, način plaćanja i iznos koji kurir plaća restoranu",
    pages: ["/courier/deliveries"],
    api: ["GET /orders/driver/{id}", "GET /courier/offers"],
    description:
      "03.10: stavka 3 iz 30_09_2026_Frontend_pitanja_za_backend.textile je još otvorena. Kurir na vratima vidi samo cijenu dostave; front je spreman da prikaže 'Naplati X KM' čim stignu amount_to_collect i payment_method. Novo: za 'Kurir plaća restoranu pri preuzimanju' treba i iznos hrane koji se plaća na šanku (amount_to_pay_restaurant).",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-telefoni",
    title: "Dostave: telefon restorana, ime i telefon kupca",
    pages: ["/courier/deliveries"],
    api: ["GET /orders/driver/{id}", "GET /courier/offers"],
    description:
      "03.10: kurirski nalog i ponuda nemaju telefon ni ime kupca (dispečerske liste imaju restaurant_phone). Front čita restaurant_phone, customer_name, customer_phone i pokazuje dugme 'Pozovi' čim stignu.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-koordinate-ponuda",
    title: "Dostave: udaljenosti u ponudi (distance_km / pickup_distance_m) i koordinate restorana i kupca",
    pages: ["/courier/deliveries"],
    api: ["GET /courier/offers"],
    description:
      "03.10, uživo (ponuda #4269): panel ponude nema nijednu udaljenost ni pin na mapi, pa kurir bira naslijepo. Front ih prikaže čim ponuda nosi distance_km / trip_distance_m / pickup_distance_m ili koordinate restorana i kupca (tada zračnom linijom, sa '≈'). Backend distance_km već ima na orders/waiting.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-zarada",
    title: "Dostave: zarada kurira za dostavu (courier_earning)",
    pages: ["/courier/deliveries"],
    api: ["GET /orders/driver/{id}", "GET /courier/offers"],
    description:
      "03.10: veliki iznos na kartici je cijena dostave, ne zarada kurira (30.09: wage 2.00 uz delivery_collected 177.98). Dok polje ne stigne, front piše 'cijena dostave'; kad stigne, piše 'tvoja zarada'.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-napomena-kupca",
    title: "Dostave: napomena kupca (customer_note)",
    pages: ["/courier/deliveries"],
    api: ["GET /orders/driver/{id}"],
    description:
      "03.10: kupac napomenu piše, kurir je ne dobija. Front je prikazuje u proširenom panelu čim polje stigne.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-spremnost-hrane",
    title: "Dostave: spremnost hrane (ready_at / prep_status), opciono",
    pages: ["/courier/deliveries"],
    api: ["GET /orders/driver/{id}"],
    description:
      "03.10: kurir čeka u restoranu bez informacije koliko još. Ako backend nema taj podatak, front ne radi ništa.",
    priority: "decision",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-geofence-stanja",
    title: "Dostave: geofence stanja COURIER_AT_RESTAURANT / COURIER_ARRIVED",
    pages: ["/courier/deliveries"],
    api: ["state", "POST /orders/{id}/pickup", "POST /orders/{id}/deliver"],
    description:
      "03.10: front ih već tretira kao aktivnu dostavu (ranije bi nalog nestao sa ekrana i mape). Pitanje je da li i kad backend počinje da ih upisuje i rade li pickup/deliver iz tih stanja.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-problem-na-dostavi",
    title: "Dostave: prijava problema na dostavi (-> delivery_failed)",
    pages: ["/courier/deliveries"],
    api: ["POST /orders/{id}/problem (ideja)"],
    description:
      "03.10: kupac se ne javlja, pogrešna adresa, restoran zatvoren. Danas se to rješava telefonom. Do odgovora front nema dugme. Isto dugme bi stajalo i u detalju dostave u Istoriji (stavka 28).",
    priority: "decision",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-server-now",
    title: "Dostave: server_now / expires_in uz ponudu",
    pages: ["/courier/deliveries"],
    api: ["GET /courier/offers", "WS .courier.offers.changed"],
    description:
      "03.10: odbrojavanje ponude se računa iz sata telefona; pogrešan sat pomjeri odbrojavanje.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-offer-response-i-exceeded",
    title: "Dostave: odgovor na prihvatanje (data) i exceeded na GET /courier/offers",
    pages: ["/courier/deliveries"],
    api: ["POST /orders/{id}/offer-response", "GET /courier/offers"],
    description:
      "03.10: front odmah prikaže prihvaćenu dostavu iz data (rezerva: nalog iz ponude). Pita se da li je data uvijek tu u obliku reda iz /orders/driver i da li GET /courier/offers nosi exceeded (viđeno samo u socket događaju).",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-danas",
    title: "Dostave: 'Danas' - dan u /earnings i trenutak upisa zarade poslije deliver",
    pages: ["/courier/deliveries"],
    api: ["GET /couriers/{id}/earnings?from=", "GET /couriers/{id}/wallet-balance"],
    description:
      "03.10: da li je daily[].date lokalni dan (Sarajevo) ili UTC, i da li se red sa zaradom i novo stanje gotovine pojave odmah poslije POST /orders/{id}/deliver.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "dostave-format-adrese",
    title: "Dostave: format apartment / floor / firm / zip",
    pages: ["/courier/deliveries"],
    api: ["GET /orders/driver/{id}"],
    description:
      "03.10: polja već stižu i od sada se prikazuju kao čipovi ('Stan 12', 'Sprat 3'). Front dodaje riječ samo kad je vrijednost goli broj.",
    priority: "decision",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "istorija-paginacija",
    title: "Istorija: /history bez straničenja i filtera po datumu",
    pages: ["/courier/history"],
    api: ["GET /couriers/{id}/history (?from= ?to= ?page= ?per_page= meta.total)"],
    description:
      "03.10: jedan poziv, cijeli skup (probni podaci: 3 036 dostava ≈ 2.5 MB; stvarnu veličinu ne znamo). Front iscrtava 24 reda i podnosi, ali period 'Sve' vuče cijelu istoriju. Traži se from/to, page/per_page + meta.total, po želji summary { count, wage }.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "istorija-zarada-po-redu",
    title: "Istorija: zarada i način plaćanja uz red istorije (courier_earning, collected_from_customer, payment_type)",
    pages: ["/courier/history"],
    api: ["GET /couriers/{id}/history", "GET /couriers/{id}/earnings"],
    description:
      "03.10: front spaja istoriju i /earnings po order_id. Stari ekran je sabirao delivery_price ('Cijena dostava': 180.70 KM naspram zarade 6.00 KM za #4258/#4260/#4261, ako /history nosi iste cijene kao /earnings). Pita se je li delivery_price isto što delivery_collected; courier_earning front čita od danas kad za dostavu nema reda u /earnings.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "istorija-kilometri",
    title: "Istorija: kilometri po dostavi (distance_km)",
    pages: ["/courier/history"],
    api: ["GET /couriers/{id}/history"],
    description:
      "03.10: front ga čita - u detalju dostave '3.4 km', u sažetku 'Pređeno oko N km', ali samo kad ga imaju SVE dostave u izabranom periodu. Backend brojku već ima (orders/waiting, pricing/calculate). Rutna ili zračna?",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "istorija-vremena",
    title: "Istorija: accepted_at / picked_up_at uz delivered_at",
    pages: ["/courier/history"],
    api: ["GET /couriers/{id}/history"],
    description:
      "03.10: front picked_up_at čita - u detalju dostave 'Preuzeto 15:02 → dostavljeno 15:18 · 16 min'; accepted_at samo u modelu. Postoje li ta dva trenutka u bazi?",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "istorija-oblik-polja",
    title: "Istorija: oblik delivered_at i iznosa; isti trenutak kao date u /earnings?",
    pages: ["/courier/history", "/courier/wallet"],
    api: ["GET /couriers/{id}/history", "GET /couriers/{id}/earnings"],
    description:
      "03.10: stvaran odgovor /history poslije promjene nije viđen. Front podnosi '...Z', 'YYYY-MM-DD HH:MM:SS', prazno i nečitljivo vrijeme te iznos kao tekst. Istorija period računa po delivered_at, Novčanik po date - pita se jesu li isti trenutak i u kojoj zoni je date.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "istorija-mjesecna-plata",
    title: "Istorija: kurir sa mjesečnom platom - šta stiže u wage",
    pages: ["/courier/history", "/courier/wallet"],
    api: ["GET /couriers/{id}/earnings (wage, pay_rate_label, pay_model)"],
    description:
      "03.10: front mjesečni model prepoznaje samo po pay_rate_label: null i tada ne prikazuje KM (glavni broj je broj dostava). Traži se potvrda šta stiže u wage (0, null, izostavljeno) ili stabilan pay_model.",
    priority: "backend",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "istorija-earnings-to",
    title: "Istorija: ?to= na /earnings",
    pages: ["/courier/history"],
    api: ["GET /couriers/{id}/earnings?to="],
    description:
      "03.10: simetrično sa ?from=; gornju granicu front filtrira sam. Koristi kad se uvede straničenje istorije (stavka 22).",
    priority: "decision",
    source: "03_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "novcanik-cash-effect",
    title: "Novčanik: efekat dostave na dug (cash_effect) po redu /earnings",
    pages: ["/courier/wallet","/courier/history"],
    api: ["GET /couriers/{id}/earnings (cash_effect, payment_type)"],
    description:
      "04.10: ponovljeno pitanje od 30.09 (stavka 4). Za kurira 30189 naplaćeno 212.70 KM, a dug 180.70 KM (razlika 32.00 = hrana koju je kurir platio restoranu); lista ne može da objasni stanje. Front čita cash_effect (red '+1.36 KM', pločica 'ušlo u dug', detalj dostave) čim stigne; do tada pomoć 'Šta ulazi u dug?' (pravilo izvedeno, nepotvrđeno).",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "novcanik-ledger",
    title: "Novčanik: jedinstven ledger po računu",
    pages: ["/courier/wallet"],
    api: ["GET /couriers/{id}/ledger?account=cash|wage&from&to&page (novo)"],
    description:
      "04.10: front sklapa listu iz tri izvora (dostave u prozoru od 31 dan, predaje, isplate), pa ne može da pokaže stanje poslije knjiženja ni korekcije, a zbir u listi se ne može provjeriti naspram wallet-balance.",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "novcanik-cash-receipt-u-listi",
    title: "Novčanik: dispečerov direktan unos gotovine (cash-receipt) u listi predaja kurira",
    pages: ["/courier/wallet"],
    api: ["GET /couriers/{id}/cash-handovers","POST /dispatcher/couriers/{id}/cash-receipt"],
    description:
      "04.10: pitanje iz 29.08 (2.4) - kreira li unos red u kurirskoj listi predaja - nikad nije eksplicitno odgovoreno. Ako ne, dug padne bez traga u listi i ekran ne može da objasni zašto je stanje manje. Isto za isplatu koju dispečer evidentira.",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "novcanik-push-potvrda",
    title: "Novčanik: push / poruka / socket kad dispečer potvrdi predaju ili evidentira isplatu",
    pages: ["/courier/wallet"],
    api: ["FCM","GET /couriers/{id}/inbox","WS App.Models.User.{courierId}"],
    description:
      "04.10: dok predaja čeka, ekran sam provjerava saldo i predaje svakih 20 s (samo dok je otvoren). Ne pomaže kad je aplikacija zatvorena. Front razumije /courier/wallet?o=h<id> (predaja) i ?o=p<id> (isplata).",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "novcanik-povlacenje-prijave",
    title: "Novčanik: povlačenje i odbijanje prijave predaje",
    pages: ["/courier/wallet"],
    api: ["DELETE /cash-handovers/{id}","GET /couriers/{id}/cash-handovers (status rejected, reject_reason)"],
    description:
      "04.10: danas samo pending i confirmed; kurir ne može da ispravi grešku u iznosu, a dok prijava čeka druga se ne prima. Front izostavlja svaki nepoznat status (da ne izgleda kao predaja na čekanju).",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "novcanik-wallet-balance-dopune",
    title: "Novčanik: dopune wallet-balance (pending_handover_amount, last_handover_at, pay_model, currency)",
    pages: ["/courier/wallet"],
    api: ["GET /couriers/{id}/wallet-balance"],
    description:
      "04.10: čekanje se računa iz druge liste, mjesečna plata iz pay_rate_label: null, valuta je tvrdo 'KM'. Front ih čita čim stignu.",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "novcanik-pravila-prijave",
    title: "Novčanik: pravila prijave predaje (status kôd, granice iznosa, iznos veći od duga, dupli dodir)",
    pages: ["/courier/wallet"],
    api: ["POST /cash-handovers/report"],
    description:
      "04.10: poznata je samo poruka 'Već imate zahtjev na čekanju od X KM.', status kôd nije potvrđen. Front ne zabranjuje ništa što ne mora (iznos > 0, najviše dvije decimale; iznos veći od duga samo upozorava). Pita se i da li potvrđeno manje od prijavljenog ostavlja razliku u dugu (front tako piše).",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "novcanik-liste-from-to",
    title: "Novčanik: ?from= / ?to= i straničenje na /cash-handovers i /payouts",
    pages: ["/courier/wallet"],
    api: ["GET /couriers/{id}/cash-handovers","GET /couriers/{id}/payouts"],
    description:
      "04.10: obje liste vraćaju sve unose jednim pozivom; predaje se povlače i pri provjeri svakih 20 s dok predaja čeka. Front iscrtava prvih 24 stavke.",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "novcanik-kontakt-i-raspored-isplate",
    title: "Novčanik: kontakt dispečera, raspored isplate, method isplate kao ključ",
    pages: ["/courier/wallet"],
    api: ["GET /me / wallet-balance","GET /couriers/{id}/payouts"],
    description:
      "04.10: nema dugmeta 'Pozovi dispečera' ni 'Sljedeća isplata'. Smije li se telefon dispečera pokazati kuriru i postoji li raspored isplate koji se može čitati?",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "profil-put-djelimicno",
    title: "Profil: PUT /couriers/{id} — djelimično tijelo i vehicle_type: null",
    pages: ["/courier/profile","/courier/deliveries"],
    api: ["PUT /couriers/{id} (djelimično tijelo, vehicle_type: null)"],
    description:
      "04.10: front od danas šalje samo izmijenjeno (do danas svih 9 polja, uz vehicle_type: \"car\" i za kurira bez vozila). \"Pješice\" je vehicle_type: null; izmjena samo napomene šalje i tip. Ako server na 422 traži name/lastname/phone, front jednom ponovi sa njima i pamti na uređaju. Nepotvrđeno uživo: prima li PUT djelimično tijelo, briše li null vozilo na PUT-u (potvrđeno samo za dispečerski PATCH). Stavka 10, jedini blokator.",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "profil-racun-za-isplatu",
    title: "Profil: račun za isplatu — detail.iban kurira ili bank_account firme",
    pages: ["/courier/profile","/courier/wallet"],
    api: ["PUT /couriers/{id} (iban)","bank_account (pivot, dispečer)"],
    description:
      "04.10: kurir unosi IBAN (detail.iban), dispečer bank_account (firma-specifično, kurir ga ne vidi). Ne znamo koji se koristi za isplatu. Backend je 14.09 vratio i 11-1111111111-111, pa front samo UPOZORAVA na format (20 znakova BiH, mod-97), ne zabranjuje. Stavka 11.",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "profil-referral-link",
    title: "Profil: link za preporuku — detail.referral_url naspram kurir.ordera.app/r/{id}",
    pages: ["/courier/referral","/courier/profile"],
    api: ["GET /couriers/{id} (detail.referral_url, referral_short_url)"],
    description:
      "04.10: referral_url/referral_short_url su u viđenom odgovoru (14.09) null, a ekran Preporuči prijatelja gradi link iz ID-a (https://kurir.ordera.app/r/{id}). Ne znamo da li link radi, kada se polja popunjavaju, ni jesu li 30 KM / 20 dostava tačni. Stavka 12.",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "profil-firma-telefon-grad",
    title: "Profil: telefon firme / dispečera i naziv grada u /couriers/{id}/companies",
    pages: ["/courier/profile","/courier/wallet"],
    api: ["GET /couriers/{id}/companies (city_name, phone)"],
    description:
      "04.10: odgovor ima samo id/name/city_id, pa Profil ne može da kaže grad firme ni broj dispečera (ista potreba kao kontakt dispečera u Novčaniku). Čim polja stignu, front dodaje red Pozovi dispečera. Stavka 13.",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "profil-slika",
    title: "Profil: slika profila — osnova image_path i otpremanje",
    pages: ["/courier/profile"],
    api: ["GET /couriers/{id} (image_path)","upload slike (nepoznato)"],
    description:
      "04.10: ista stavka kao 'image_path upload' u ovom spisku, sada i za Profil kurira: zaglavlje pokazuje inicijale, dugme Promijeni sliku ne postoji dok se ne zna osnova adrese i endpoint. Stavka 14.",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "profil-neobjasnjena-polja",
    title: "Profil: created_at (Nalog otvoren), private_email, address, state, city_id",
    pages: ["/courier/profile"],
    api: ["GET /couriers/{id} (created_at, private_email, address, state, city_id)"],
    description:
      "04.10: stavka od 28.09 ('nova, neobjašnjena polja') sada ima posljedicu na ekranu: red 'Nalog otvoren 14. septembra 2026.' koristi created_at; ako to nije dan otvaranja naloga, kuriru govori pogrešno. Ostala polja se ne prikazuju. Stavka 15.",
    priority: "backend",
    source: "04_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kuriri-patch-jedno-polje",
    title: "Kuriri: PATCH .../couriers/{id} sa jednim poljem (samo izmijenjeno)",
    pages: ["/dispatcher/couriers", "/courier/profile"],
    api: ["PATCH .../delivery-companies/{id}/couriers/{courierId}"],
    description:
      "05.10: front od danas šalje samo izmijenjena polja (do danas 14 polja za jedan telefon). Provjereno nad probnim odgovorima, ne uživo. Treba potvrda: prima li tijelo sa samo phone / note / password / vehicle_type bez 422 za name/lastname, ne mijenja li ništa što nije poslato, briše li vehicle_type: null vozilo. Stavka 1.",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kuriri-prijava-url-lozinka",
    title: "Kuriri: adresa aplikacije za prijavu, šalje li backend lozinku, must_change_password",
    pages: ["/dispatcher/couriers"],
    api: ["POST .../couriers (temporary_password)", "PATCH .../couriers/{id} (password)"],
    description:
      "05.10: kartica 'Podaci za prijavu' (poslije kreiranja i nove lozinke) ima tvrdo upisanu adresu https://kurir.ordera.app. Je li prava? Šalje li backend kuriru mail/SMS sa lozinkom (pretpostavljamo da ne)? Mora li kurir da promijeni lozinku pri prvoj prijavi? Stavka 2.",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kuriri-telefon-format",
    title: "Kuriri: telefon u formatu 062/519-315 (kosa crta, tačka)",
    pages: ["/dispatcher/couriers", "/courier/profile"],
    api: ["PATCH/POST .../couriers", "PUT /couriers/{id}"],
    description:
      "05.10: front od danas prihvata ^[+]?[\\d\\s()./-]{6,20}$ (i u kurirovom Moj profil). Prihvata li backend takav zapis bez 422, čuva li ga kakav jeste ili normalizuje (u kom obliku vraća), ima li u bazi broj koji pravilo i dalje ne propušta? Stavka 3.",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kuriri-inbox-summary-ruta",
    title: "Kuriri: inbox-summary — ruta i oblik odgovora nisu potvrđeni uživo",
    pages: ["/dispatcher/couriers"],
    api: ["GET /dispatcher/delivery-companies/{id}/inbox-summary"],
    description:
      "05.10: ruta je pretpostavljena (odgovor 15.09. nije naveo prefiks). Front očekuje courier_id, last_message {title, sent_at, category, sender}, dispatcher_unread_count. Bez njega je filter 'Nepročitane poruke' onemogućen, a redovi bez oznake poruka. Stavka 4.",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kuriri-server-pretraga",
    title: "Kuriri: server-side pretraga i straničenje couriers-status (+ meta.counts)",
    pages: ["/dispatcher/couriers"],
    api: ["GET .../couriers-status?q=&page=&per_page="],
    description:
      "05.10: front čita cijeli spisak i filtrira ga u browseru (580 DOM elemenata na 500 kurira jer se ispisuje 12 redova), ali se pri svakom učitavanju vuče cijeli odgovor. Nije hitno; ne mijenjati oblik poziva bez parametara. Stavka 5.",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kuriri-duplikat-422",
    title: "Kuriri: duplikat telefona/emaila pri kreiranju — oblik 422",
    pages: ["/dispatcher/couriers"],
    api: ["POST .../couriers"],
    description:
      "05.10: front upozori prije slanja (provjera nad spiskom). Ako backend odbije, treba errors.phone[] / errors.email[] i tekst poruke. Je li duplikat telefona uopšte greška (jedan broj, dva naloga)? Stavka 6.",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kuriri-inbox-filter-sender",
    title: "Kuriri: filter po pošiljaocu na GET /couriers/{id}/inbox",
    pages: ["/dispatcher/couriers"],
    api: ["GET /couriers/{id}/inbox?sender=dispatcher"],
    description:
      "05.10: detalj kurira traži zadnje tri dispečerske poruke; /inbox vraća i ponude, pa front čita do 5 stranica po 20 pri svakom otvaranju. Prijedlog: ?sender=dispatcher. Stavka 7.",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kuriri-lokacije-last-seen",
    title: "Kuriri: courier-locations — kurir bez pozicije (null ili izostavljen) i last_seen_at",
    pages: ["/dispatcher/couriers"],
    api: ["GET .../courier-locations"],
    description:
      "05.10: front kuriru koga nema u odgovoru piše 'Bez signala'. Vraća li backend location: null ili ga izostavlja, i postoji li last_seen_at nezavisno od pozicije (da 'nema lokacije' ne izgleda isto kao 'nije otvorio aplikaciju sedam dana')? Stavka 8.",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kuriri-nova-lozinka-sesije",
    title: "Kuriri: nova lozinka (PATCH password) — poništava li aktivne sesije kurira",
    pages: ["/dispatcher/couriers"],
    api: ["PATCH .../couriers/{id} (password)"],
    description:
      "05.10: od toga zavisi šta kartica kaže dispečeru ('kurir će morati ponovo da se prijavi' ili ne). Stavka 9.",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kuriri-cash-receipt-idempotency",
    title: "Kuriri: cash-receipt nema idempotency_key (payout ima) + oblik warning-a",
    pages: ["/dispatcher/couriers"],
    api: ["POST /dispatcher/couriers/{id}/cash-receipt", "POST /dispatcher/couriers/{id}/payout"],
    description:
      "05.10: prekid veze usred zahtjeva i ponovni pokušaj mogu dvaput evidentirati istu uplatu. Prima li cash-receipt isti ključ? Je li warning (iznos veći od duga/zarade) uvijek običan tekst i je li akcija tada stvarno evidentirana? Stavka 10.",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "kuriri-suspended-by-slika",
    title: "Kuriri: suspended_by i osnova adrese za image_path u couriers-status",
    pages: ["/dispatcher/couriers"],
    api: ["GET .../couriers-status"],
    description:
      "05.10: detalj pokazuje razlog i vrijeme suspenzije, ali ne ko je suspendovao, i inicijale umjesto slike. Ništa ne blokira. Stavka 11.",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-inbox-summary-ponude",
    title: "Poruke: inbox-summary ne smije računati ponude (+ šta broji dispatcher_unread_count)",
    pages: ["/dispatcher/couriers", "/dispatcher/notifications"],
    api: ["GET .../inbox-summary"],
    description:
      "05.10: u stvarnom odgovoru (21.09, R11) svi primjeri su 'offer'; last_message i broj nepročitanih su pogrešni. Ekran Poruke ga ne čita, Kuriri 'Zadnja poruka' ne prikazuje ponudu. Stavka 12 (Dio 2).",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-paket-poruke",
    title: "Poruke: paket poruke (message_id u odgovoru slanja i na redu sandučića, lista poslatog, primaoci, brisanje po poruci)",
    pages: ["/dispatcher/notifications"],
    api: ["POST .../broadcast", "GET /couriers/{id}/inbox"],
    description:
      "05.10: bez toga praćenje čitanja traži do 40 zahtjeva i poklapanje po tekstu, 'Poslato' je samo za ovu sesiju, a povlačenje je jedno brisanje po sandučiću. Najmanje što pomaže: message_id. Stavka 13 (Dio 2).",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-inbox-filter-posiljalac",
    title: "Poruke: filter inboxa po pošiljaocu / exclude_category=offer (diže stavku 7 na 🟠)",
    pages: ["/dispatcher/notifications", "/dispatcher/couriers"],
    api: ["GET /couriers/{id}/inbox"],
    description:
      "05.10: istorija poruka kurira i praćenje čitanja čitaju tri kategorije posebno jer ponude gomilaju prvu stranicu. Koji pošiljalac stoji na ponudi u sandučiću (dispatcher ili platform)? Stavka 14 (Dio 2).",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-push-dispecer",
    title: "Poruke: šalje li dispečerova poruka push i koji je data.type",
    pages: ["/dispatcher/notifications"],
    api: ["FCM"],
    description:
      "05.10: ponovo stavka 3 iz 03.10 (bez odgovora). Natpis na ekranu: 'Kurir vidi poruku kad otvori aplikaciju.' Stavka 15 (Dio 2).",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-all-couriers-skipped",
    title: "Poruke: značenje all_couriers:true i skipped[]",
    pages: ["/dispatcher/notifications"],
    api: ["POST .../broadcast"],
    description:
      "05.10: uključuje li 'svi' suspendovane; može li odgovor da nosi skipped[{courier_id, reason}]. Front šalje izričit spisak id-jeva. Stavka 16 (Dio 2).",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-rate-limit",
    title: "Poruke: ograničenje brzine za dispečera (429, Retry-After)",
    pages: ["/dispatcher/notifications"],
    api: ["GET /couriers/{id}/inbox"],
    description:
      "05.10: praćenje čitanja je do 40 zahtjeva, 6 istovremeno. Stavka 17 (Dio 2).",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-max-duzina",
    title: "Poruke: najveća dužina naslova i teksta",
    pages: ["/dispatcher/notifications"],
    api: ["POST .../broadcast", "POST /couriers/{id}/inbox"],
    description:
      "05.10: brojač znakova bez ograničenja dok ne stigne. Stavka 18 (Dio 2).",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "poruke-sabloni-firma",
    title: "Poruke: zajednički šabloni po firmi (opciono)",
    pages: ["/dispatcher/notifications"],
    api: [],
    description:
      "05.10: lični šabloni su u pregledaču dispečera i ne dijele se. Stavka 19 (Dio 2).",
    priority: "backend",
    source: "05_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "finansije-evidentirana-uplata-lista",
    title: "Finansije: evidentirana uplata i isplata u listama",
    pages: ["/dispatcher/finance"],
    api: ["POST /dispatcher/couriers/{id}/cash-receipt", "GET .../cash-handovers", "GET .../payouts"],
    description:
      "06.10: Pravi li evidentirana uplata (cash-receipt) red u cash-handovers i pojavi li se isplata koju evidentira dispečer uvijek u payouts? Bez toga Promet i zbir 'Potvrđene predaje' ne obuhvataju gotovinu koju je dispečer sam primio (zbir to piše na stranici). Predlog: source 'dispatcher_entry' + entered_by_name. Stavka 1.",
    priority: "backend",
    source: "06_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "finansije-isplata-ko-i-nacin",
    title: "Finansije: isplata — ko je isplatio i način isplate kao polje",
    pages: ["/dispatcher/finance"],
    api: ["GET .../payouts"],
    description:
      "06.10: Red isplate nema ko je isplatio, a način je samo u tekstu napomene. Predlog: paid_by_id, paid_by_name, method 'cash'|'bank_transfer'. Do tada front čita način iz teksta napomene (nestaje bez greške ako se tekst promijeni), a 'Ko je isplatio' piše da server to ne vraća. Stavka 2.",
    priority: "backend",
    source: "06_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "finansije-stranicenje-redoslijed",
    title: "Finansije: straničenje, redoslijed i from/to na cash-handovers, payouts, couriers-balance",
    pages: ["/dispatcher/finance"],
    api: ["GET .../cash-handovers", "GET .../payouts", "GET .../couriers-balance"],
    description:
      "06.10: Sve se vraća odjednom, redoslijed nije dokumentovan, from/to: UTC ili lokalni dan, uključiv? Predlog: page, per_page, meta.total/last_page, najnovije prvo, lokalni dan uključivo. Do tada front sortira u pregledniku i prikazuje 40 stavki + 'Prikaži još'. Veže se na 04.10. stavka 8. Stavka 3.",
    priority: "backend",
    source: "06_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "finansije-cash-summary",
    title: "Finansije: zbirni podaci za pločice i značku (cash-summary)",
    pages: ["/dispatcher/finance"],
    api: ["GET .../delivery-companies/{id}/cash-summary"],
    description:
      "06.10: Pločice i značka računaju se iz cijelih lista (balans svake minute za sve kurire). Predlog: cash_owed_total, wage_owed_total, over_limit_count, pending_count, pending_total, oldest_pending_at. Do tada se računa u pregledniku. Stavka 4.",
    priority: "backend",
    source: "06_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "finansije-dogadjaj-predaja",
    title: "Finansije: događaj za dispečera kad kurir prijavi predaju",
    pages: ["/dispatcher/finance"],
    api: ["WS kanal dispečera: handover.reported"],
    description:
      "06.10: Nema događaja; stranica provjerava pending svakih 30 s, a značka u meniju svake minute. Predlog: događaj { handover_id, courier_id, amount } i/ili push. Veže se na 04.10. stavka 4. Stavka 5.",
    priority: "backend",
    source: "06_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "finansije-confirm-saldo-warning",
    title: "Finansije: confirm — novi saldo i warning u odgovoru",
    pages: ["/dispatcher/finance"],
    api: ["POST /dispatcher/cash-handovers/{id}/confirm"],
    description:
      "06.10: Odgovor je { success, handover } bez salda; ne znamo da li je potvrda većeg iznosa od prijavljenog/duga dozvoljena i vraća li warning. Predlog: cash_owed_to_company + opcioni warning. Do tada front čita balans ponovo, upozorava prije slanja i dopušta. Stavka 6.",
    priority: "backend",
    source: "06_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "finansije-odbijanje-prijave",
    title: "Finansije: odbijanje prijave predaje (rejected + razlog)",
    pages: ["/dispatcher/finance"],
    api: ["POST .../cash-handovers/{id}/reject (nova)"],
    description:
      "06.10: Postoje samo pending i confirmed; dispečer ne može da odbije prijavu, kurir ne može da je povuče (04.10. stavka 5). Do tada nema 'Odbij'; potvrda se ne može poništiti. Stavka 7.",
    priority: "backend",
    source: "06_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "finansije-rate-limit-receipt-kljuc",
    title: "Finansije: ograničenje brzine za 'Isplati sve' + idempotency_key za cash-receipt",
    pages: ["/dispatcher/finance"],
    api: ["POST /dispatcher/couriers/{id}/payout", "POST /dispatcher/couriers/{id}/cash-receipt"],
    description:
      "06.10: 'Isplati sve' šalje do 3 istovremena payout poziva; ograničenje brzine i oblik 429/Retry-After nisu poznati (front: jedna konstanta, može na 1). cash-receipt nema ključ (05.10. stavka 10). Stavka 8.",
    priority: "backend",
    source: "06_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "finansije-ledger-dispecer",
    title: "Finansije: šta je iza duga — ledger ili čitanje earnings za dispečera",
    pages: ["/dispatcher/finance"],
    api: ["GET /couriers/{id}/earnings"],
    description:
      "06.10: Dispečer vidi samo predaje i isplate kurira, ne dostave koje su napravile dug. Predlog: dozvola čitanja za kurire svoje firme ili ledger sa balance_after (04.10. stavka 2). Stavka 9.",
    priority: "backend",
    source: "06_10_2026_Frontend_pitanja_za_backend.textile",
  },
  {
    id: "finansije-balance-account-type",
    title: "Finansije: couriers-balance — account_type i link_active",
    pages: ["/dispatcher/finance"],
    api: ["GET .../couriers-balance"],
    description:
      "06.10: Odgovor sadrži dispečerske naloge i kurire koji više nisu u firmi, bez oznake. Predlog: account_type i link_active. Do tada se nulti redovi kriju, a 'Nije u firmi' se izvodi iz couriers-status. Stavka 10.",
    priority: "backend",
    source: "06_10_2026_Frontend_pitanja_za_backend.textile",
  },
];

const GROUP_ORDER: { key: Priority; label: string }[] = [
  { key: "bug", label: "Bag, potvrđen uživo" },
  { key: "backend", label: "Čeka backend" },
  { key: "decision", label: "Za zajednički dogovor" },
];

// Rešeno = ili upisano u kod (item.solved, trajno) ili ručno čekirano lokalno
// (resolvedIds ispod, po browseru). Oba sakrivaju stavku dok se ne uključi
// "Prikaži rešene".
const isItemResolved = (item: OpenItem) => Boolean(item.solved) || resolvedIds.has(item.id);

const showResolved = ref(false);

const groups = computed(() =>
  GROUP_ORDER.map((g) => ({
    ...g,
    items: ITEMS.filter(
      (item) => item.priority === g.key && (showResolved.value || !isItemResolved(item))
    ),
  })).filter((g) => g.items.length > 0)
);

// "Rešeno" (ručno čekirano) je čisto lokalno (localStorage) - ovo je dev alat
// bez backend perzistencije, isti obrazac kao /dev/api (ništa se ne pamti na
// serveru). `item.solved` (upisano u kod) je odvojeno - ne čuva se ovdje.
const STORAGE_KEY = "dev-otvorene-stavke-resolved";
const resolvedIds = reactive(new Set<string>());

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...resolvedIds]));
  } catch {
    // best-effort
  }
};

const toggleResolved = (id: string) => {
  if (resolvedIds.has(id)) resolvedIds.delete(id);
  else resolvedIds.add(id);
  persist();
};

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const ids = JSON.parse(raw) as string[];
    ids.forEach((id) => resolvedIds.add(id));
  } catch {
    // best-effort
  }
});

const openCount = computed(() => ITEMS.filter((item) => !isItemResolved(item)).length);
const resolvedCount = computed(() => ITEMS.filter(isItemResolved).length);
</script>

<style scoped>
.group-section {
  margin-bottom: 28px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 800;
  margin: 0 0 12px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}

.dot--bug {
  background: #e5484d;
}

.dot--backend {
  background: #e0a100;
}

.dot--decision {
  background: #2f6fed;
}

.group-count {
  font-size: 0.75rem;
  font-weight: 700;
  color: #9aa4b2;
  background: rgba(11, 18, 32, 0.06);
  padding: 2px 8px;
  border-radius: 999px;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item-card {
  display: flex;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #e7e9ee;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.03);
}

.item-card--resolved {
  opacity: 0.5;
}

.item-card--resolved .item-title {
  text-decoration: line-through;
}

.item-checkbox {
  flex: none;
  margin-top: -6px;
}

.solved-icon {
  margin-top: 2px;
}

.show-resolved-toggle {
  flex: none;
}

.show-resolved-toggle :deep(.v-selection-control) {
  min-height: 0;
}

.item-body {
  flex: 1 1 auto;
  min-width: 0;
}

.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.item-title {
  font-weight: 700;
  font-size: 0.95rem;
}

.item-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 8px;
}

.meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.78rem;
  color: #6b7685;
}

.meta-row code {
  background: #f2f3f7;
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 0.76rem;
}

.item-description {
  margin: 0 0 8px;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #384049;
}

.item-source {
  margin: 0;
  font-size: 0.72rem;
  color: #9aa4b2;
}

.item-source code {
  background: transparent;
  color: inherit;
}
</style>
