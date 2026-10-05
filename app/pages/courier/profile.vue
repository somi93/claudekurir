<template>
  <DeliveryPage :max-width="560">
    <template #header>
      <PageHeader title="Moj profil" back-to="/" back-label="Nazad na početnu" />
    </template>

    <div class="pf-body">
      <ProfileSkeleton v-if="state === 'loading'" />

      <InboxEmptyState
        v-else-if="state === 'error'"
        tone="error"
        icon="mdi-alert-circle-outline"
        title="Ne mogu da učitam profil"
      >
        Provjeri vezu i pokušaj ponovo. Tvoji podaci nisu promijenjeni.
        <template #action>
          <GlobalButtonPrimary @click="retry">
            <v-icon icon="mdi-refresh" size="18" class="mr-1" />
            Pokušaj ponovo
          </GlobalButtonPrimary>
        </template>
      </InboxEmptyState>

      <template v-else-if="profile">
        <ProfileIdentity
          :profile="profile"
          :companies="companies"
          :show-nudge="!hasEmergencyContact"
          @vehicle="openSheet('vozilo')"
          @nudge="openSheet('licni', 'ecName')"
        />

        <ProfileSection title="Kontakt podaci">
          <ProfileRow
            icon="mdi-account-outline"
            label="Ime i prezime"
            :value="nameValue"
            :empty="!nameValue"
            :end-text="nameValue ? undefined : 'Dodaj'"
            interactive
            :aria-label="rowLabel('Ime i prezime', nameValue, !nameValue)"
            @click="openSheet('kontakt', 'name')"
          />
          <ProfileRow
            icon="mdi-phone-outline"
            label="Telefon"
            :value="profile.phone || 'Nije dodat'"
            :empty="!profile.phone"
            :end-text="profile.phone ? undefined : 'Dodaj'"
            interactive
            :aria-label="rowLabel('Telefon', profile.phone, !profile.phone)"
            @click="openSheet('kontakt', 'phone')"
          />
        </ProfileSection>

        <ProfileSection title="Lični podaci">
          <ProfileRow
            icon="mdi-cake-variant"
            label="Datum rođenja"
            :value="dobValue"
            :empty="!profile.dateOfBirth"
            :end-text="profile.dateOfBirth ? undefined : 'Dodaj'"
            interactive
            :aria-label="rowLabel('Datum rođenja', dobValue, !profile.dateOfBirth)"
            @click="openSheet('licni', 'dob')"
          />
          <ProfileRow
            icon="mdi-account-alert-outline"
            label="Hitni kontakt"
            :value="emergencyValue"
            :empty="!hasEmergencyContact"
            wrap
            :end-text="hasEmergencyContact ? undefined : 'Dodaj'"
            interactive
            :aria-label="rowLabel('Hitni kontakt', emergencyValue, !hasEmergencyContact)"
            @click="openSheet('licni', 'ecName')"
          />
          <ProfileRow
            icon="mdi-bank-outline"
            label="IBAN"
            :value="ibanValue"
            :empty="!profile.iban"
            :end-text="profile.iban ? undefined : 'Dodaj'"
            interactive
            :aria-label="rowLabel('IBAN', ibanValue, !profile.iban)"
            @click="openSheet('licni', 'iban')"
          />
        </ProfileSection>

        <ProfileSection title="Vozilo">
          <ProfileRow
            :icon="vehicleView.icon"
            label="Tip vozila"
            :value="vehicleView.label"
            :hint="vehicleHint"
            :icon-ink="vehicleView.ink"
            :icon-tint="vehicleView.tint"
            :end-text="profile.vehicle ? undefined : 'Izaberi'"
            interactive
            :aria-label="`Vozilo: ${vehicleValue}. Promijeni`"
            @click="openSheet('vozilo')"
          />
        </ProfileSection>

        <ProfileSection :title="companies.length > 1 ? 'Firme' : 'Firma'">
          <template v-if="companiesLoaded">
            <ProfileRow
              v-for="company in companies"
              :key="company.id"
              icon="mdi-domain"
              :label="companies.length > 1 ? 'Firma' : 'Dostavna firma'"
              :value="toLatin(company.name)"
            />
            <TintAlert
              v-if="companies.length === 0"
              class="pf-tint"
              tone="info"
              title="Nisi vezan ni za jednu firmu"
            >
              Obrati se dispečeru da te veže za firmu.
            </TintAlert>
          </template>
          <TintAlert
            v-else-if="companiesError"
            class="pf-tint"
            tone="warn"
            role="status"
            title="Ne mogu da učitam firmu"
          >
            Ostalo je na ekranu. Firma se pojavi čim stigne.
            <template #action>
              <button type="button" class="pf-act" @click="retryCompanies">Pokušaj ponovo</button>
            </template>
          </TintAlert>
          <ProfileRow v-else icon="mdi-domain" label="Dostavna firma" value="Učitavam…" empty />
          <template #foot>Firmu mijenja dispečer.</template>
        </ProfileSection>

        <ProfileAppSection :courier-id="courierId" />

        <ProfileSection title="Nalog">
          <ProfileRow
            icon="mdi-lock-outline"
            label="Lozinka"
            value="Promijeni lozinku"
            data-row="lozinka"
            interactive
            aria-label="Lozinka: promijeni lozinku"
            @click="openSheet('lozinka')"
          >
            <template #end>
              <ProfileChip v-if="mustChangePassword" tone="warn">Privremena</ProfileChip>
              <v-icon icon="mdi-chevron-right" size="20" />
            </template>
          </ProfileRow>
          <ProfileRow
            icon="mdi-gift-outline"
            label="Preporuči prijatelja"
            :value="`${REFERRAL_REWARD_AMOUNT} KM za oboje`"
            :hint="`Kad prijatelj odradi ${REFERRAL_REWARD_DELIVERIES} dostava.`"
            to="/courier/referral"
            :aria-label="`Preporuči prijatelja: ${REFERRAL_REWARD_AMOUNT} KM za oboje. Otvori`"
          />
          <ProfileRow
            icon="mdi-email-outline"
            label="Prijava (email)"
            :value="profile.email"
            interactive
            :aria-label="`Prijava: ${profile.email}. Kopiraj`"
            @click="copyEmail"
          >
            <template #end>
              <ProfileChip aria-hidden="true">
                <v-icon :icon="emailCopied ? 'mdi-check' : 'mdi-content-copy'" size="14" />
                {{ emailCopied ? "Kopirano" : "Kopiraj" }}
              </ProfileChip>
            </template>
          </ProfileRow>
          <template #after>
            <button type="button" class="pf-logout" @click="openSheet('odjava')">
              <v-icon icon="mdi-logout" size="20" />
              Odjavi se
            </button>
            <p v-if="profile.createdAt" class="pf-cap">
              Nalog otvoren {{ isoLong(profile.createdAt) }}
            </p>
            <span class="pf-sr" role="status">{{ emailCopied ? "Email je kopiran." : "" }}</span>
          </template>
        </ProfileSection>
      </template>
    </div>

    <template v-if="profile && values">
      <ContactSheet
        :open="sheetKind === 'kontakt'"
        :saved="values"
        :save="save"
        :focus="sheetFocus"
        @update:open="onSheetOpen"
      />
      <PersonalSheet
        :open="sheetKind === 'licni'"
        :saved="values"
        :save="save"
        :focus="sheetFocus"
        @update:open="onSheetOpen"
      />
      <VehicleSheet
        :open="sheetKind === 'vozilo'"
        :saved="values"
        :save="save"
        @update:open="onSheetOpen"
      />
    </template>
    <PasswordSheet :open="sheetKind === 'lozinka'" :focus="sheetFocus" @update:open="onSheetOpen" />
    <LogoutSheet :open="sheetKind === 'odjava'" :courier-id="courierId" @update:open="onSheetOpen" />
  </DeliveryPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Moj profil" });

import { computed, onBeforeUnmount, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { storeToRefs } from "pinia";
import PageHeader from "~/components/common/PageHeader.vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import DeliveryPage from "~/components/layout/DeliveryPage.vue";
import InboxEmptyState from "~/components/inbox/InboxEmptyState.vue";
import ContactSheet from "~/components/courier/profile/ContactSheet.vue";
import LogoutSheet from "~/components/courier/profile/LogoutSheet.vue";
import PasswordSheet from "~/components/courier/profile/PasswordSheet.vue";
import PersonalSheet from "~/components/courier/profile/PersonalSheet.vue";
import ProfileAppSection from "~/components/courier/profile/ProfileAppSection.vue";
import ProfileChip from "~/components/courier/profile/ProfileChip.vue";
import ProfileIdentity from "~/components/courier/profile/ProfileIdentity.vue";
import ProfileRow from "~/components/courier/profile/ProfileRow.vue";
import ProfileSection from "~/components/courier/profile/ProfileSection.vue";
import ProfileSkeleton from "~/components/courier/profile/ProfileSkeleton.vue";
import VehicleSheet from "~/components/courier/profile/VehicleSheet.vue";
import { useProfileSheet } from "~/composables/useProfileSheet";
import { useProfileSource } from "~/composables/useProfileSource";
import { interceptLeaving } from "~/composables/useSheetGuard";
import { REFERRAL_REWARD_AMOUNT, REFERRAL_REWARD_DELIVERIES } from "~/config/referral";
import { useSessionStore } from "~/stores/session";
import { copyText } from "~/utils/clipboard";
import {
  VEHICLE_CHOICES,
  ageOn,
  ageText,
  choiceOf,
  formatIban,
  fullName,
  isoLong,
  toProfileValues,
} from "~/utils/profileForm";
import { toLatin } from "~/utils/toLatin";

// Moj profil: pregled umjesto duge forme. Zaglavlje identiteta, grupe redova sa vrijednostima
// (čitaju se bez dodira) i donji list za svaku izmjenu, kao u Novčaniku i Istoriji. Šalje se samo
// ono što je kurir promijenio, a prazno vozilo ("Pješice") ostaje prazno. Podaci žive u
// stores/profile.ts (dijele ih Dostave za rutu); stanje otvorenog lista je u adresi (?s=).
// Stara stranica Podešavanja je ovdje kao grupa "Aplikacija".
const sessionStore = useSessionStore();
const courierId = computed(() => Number(sessionStore.courierId));
const { user } = storeToRefs(sessionStore);

const {
  profile,
  companies,
  loaded,
  error,
  companiesLoaded,
  companiesError,
  retry,
  retryCompanies,
  save,
} = useProfileSource(courierId);

// Dok profila nema, ekran je skeleton istog oblika; forma koja bi mogla da se snimi sa
// praznim vrijednostima ne postoji.
const state = computed<"loading" | "error" | "ready">(() => {
  if (loaded.value) return "ready";
  return error.value ? "error" : "loading";
});

const values = computed(() => (profile.value ? toProfileValues(profile.value) : null));

// --- Vrijednosti u redovima ---------------------------------------------------------------

const nameValue = computed(() =>
  profile.value ? fullName(toLatin(profile.value.name), toLatin(profile.value.lastname)) : ""
);

const dobValue = computed(() => {
  const iso = profile.value?.dateOfBirth;
  if (!iso) return "Nije dodato";
  const age = ageOn(iso, new Date());
  return age === null ? isoLong(iso) : `${isoLong(iso)} · ${ageText(age)}`;
});

const hasEmergencyContact = computed(() =>
  Boolean(profile.value?.emergencyContactName || profile.value?.emergencyContactPhone)
);
const emergencyValue = computed(() => {
  const parts = [profile.value?.emergencyContactName, profile.value?.emergencyContactPhone].filter(
    Boolean
  );
  return parts.length ? parts.join(" · ") : "Nije dodat";
});

const ibanValue = computed(() => (profile.value?.iban ? formatIban(profile.value.iban) : "Nije dodat"));

const vehicleView = computed(() => VEHICLE_CHOICES[choiceOf(profile.value?.vehicle)]);
// Model i registracija idu u red ispod (ne skraćuju se, a visina reda ne zavisi od podataka):
// tekst je uvijek tu, ili objašnjava šta fali.
const vehicleHint = computed(() => {
  if (!profile.value?.vehicle) return "Dispečer te vodi kao pješaka. Voziš li?";
  return profile.value.vehicleNote || "Model i registracija nisu dodati";
});
const vehicleValue = computed(() => {
  const note = profile.value?.vehicle ? profile.value.vehicleNote : "";
  return note ? `${vehicleView.value.label}, ${note}` : vehicleView.value.label;
});

const rowLabel = (label: string, value: string, empty: boolean) =>
  `${label}: ${empty ? "nije dodato" : value}. Uredi`;

const mustChangePassword = computed(() => Boolean(user.value?.must_change_password));

// --- Email: kopiranje -----------------------------------------------------------------------

const emailCopied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const copyEmail = async () => {
  if (!profile.value || !(await copyText(profile.value.email))) return;
  emailCopied.value = true;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (emailCopied.value = false), 1600);
};

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer);
});

// --- Listovi (?s=) ----------------------------------------------------------------------------

const { kind, focus: sheetFocus, open: openSheet, close: closeSheet } = useProfileSheet();

// Dok profil ne stigne, list za izmjenu se ne otvara (nema šta da se mijenja); lozinka i
// odjava ne zavise od profila.
const sheetKind = computed(() => {
  const current = kind.value;
  if (!current) return null;
  const needsProfile = current === "kontakt" || current === "licni" || current === "vozilo";
  return needsProfile && !profile.value ? null : current;
});

const onSheetOpen = (open: boolean) => {
  if (open) return;
  const closing = kind.value;
  closeSheet();
  // Lozinka se često otvara iz trake "privremena lozinka", koja nestane čim se lozinka promijeni:
  // list nema kome da vrati fokus, pa ga dobija red Lozinka (inače bi fokus otišao na vrh stranice).
  if (closing === "lozinka") {
    setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      document.querySelector<HTMLElement>("[data-row='lozinka']")?.focus({ preventScroll: true });
    }, 150);
  }
};

// Veza ?s=kontakt kad se profil nije mogao učitati: adresa se čisti tiho.
watch([kind, state], ([current, screen]) => {
  if (current && current !== "lozinka" && current !== "odjava" && screen === "error") {
    closeSheet();
  }
});

// Dugme Nazad (i odlazak sa stranice) dok list ima neosnimljen unos: list pita, ne gubi ga.
onBeforeRouteUpdate((to, from) => {
  if (from.query.s && !to.query.s && interceptLeaving()) return false;
});
onBeforeRouteLeave(() => {
  if (interceptLeaving()) return false;
});
</script>

<style scoped>
.pf-body {
  display: grid;
  gap: 14px;
  align-content: start;
}

.pf-tint {
  margin: 2px 12px 12px;
}

/* Radnja u tonu mora biti meta od 44 px (TintAlert je ostavlja nižom). */
.pf-act {
  min-height: 44px;
  margin: -8px 0;
}

.pf-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 52px;
  border: 1.5px solid #f3c9c7;
  border-radius: 14px;
  background: #fff;
  color: #b42318;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
}

.pf-logout:active {
  background: #fdf0ef;
}

.pf-logout:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.pf-cap {
  margin: 0;
  padding: 0 4px;
  text-align: center;
  font-size: 0.76rem;
  line-height: 1.5;
  color: #5b6676;
}

.pf-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
