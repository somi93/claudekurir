<template>
  <AppSheet
    :open="open"
    :title="title"
    :subtitle="`${courier.name} · #${courier.id}`"
    @update:open="emit('update:open', $event)"
  >
    <TintAlert tone="warn" title="Lozinka se više neće prikazati">
      Sistem ne šalje email ni SMS. Kopiraj podatke i pošalji ih kuriru. Pri prvoj prijavi mora da
      promijeni lozinku.
    </TintAlert>

    <dl class="cr" aria-label="Podaci za prijavu">
      <div>
        <dt>Korisničko ime</dt>
        <dd data-cred="login">{{ courier.email || "—" }}</dd>
      </div>
      <div>
        <dt>Lozinka</dt>
        <dd class="pw" data-cred="password">{{ password }}</dd>
      </div>
      <div>
        <dt>Aplikacija</dt>
        <dd data-cred="app">{{ APP_URL }}</dd>
      </div>
    </dl>

    <p v-if="failed" class="cr-fail" role="status">
      Kopiranje nije dozvoljeno u ovom pregledaču. Označi podatke iznad i kopiraj ih ručno.
    </p>

    <template #footer>
      <AppButton icon="mdi-content-copy" data-sheet="copy-all" data-autofocus @click="copy('all')">
        {{ copied === "all" ? "Kopirano" : "Kopiraj podatke za prijavu" }}
      </AppButton>
      <div class="cr-row">
        <AppButton variant="ghost" data-sheet="copy-password" @click="copy('pw')">
          {{ copied === "pw" ? "Kopirano" : "Samo lozinku" }}
        </AppButton>
        <AppButton
          v-if="created"
          variant="ghost"
          data-sheet="again"
          @click="emit('again')"
        >
          Dodaj još jednog
        </AppButton>
        <AppButton v-else variant="ghost" data-sheet="done" @click="emit('update:open', false)">
          Gotovo
        </AppButton>
      </div>
      <AppButton v-if="created" variant="ghost" data-sheet="open-profile" @click="emit('openProfile')">
        Otvori profil kurira
      </AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { copyText } from "~/utils/clipboard";
import { APP_URL, credText, type RosterCourier } from "~/utils/courierRoster";
import { toLatin } from "~/utils/toLatin";

// Kartica sa podacima za prijavu, poslije kreiranja kurira i poslije nove lozinke. Sistem ne šalje
// ni email ni SMS, pa je ovo jedino mjesto gdje se lozinka vidi: "Kopiraj podatke" pravi gotov tekst
// za poruku kuriru. Poslije zatvaranja lozinka se ne može ponovo vidjeti.
const props = defineProps<{
  open: boolean;
  courier: RosterCourier;
  password: string;
  // true poslije kreiranja (nudi "Dodaj još jednog"), false poslije nove lozinke.
  created: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  again: [];
  openProfile: [];
}>();

const title = computed(() => (props.created ? "Kurir je dodat" : "Lozinka je postavljena"));

const copied = ref<"all" | "pw" | null>(null);
const failed = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const copy = async (what: "all" | "pw") => {
  const text =
    what === "all"
      ? credText({ login: props.courier.email ?? "", password: props.password, first: toLatin(props.courier.first) })
      : props.password;
  const ok = await copyText(text);
  failed.value = !ok;
  if (!ok) return;
  copied.value = what;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    copied.value = null;
  }, 1600);
};

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      copied.value = null;
      failed.value = false;
    }
  }
);

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<style scoped>
.cr {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 14px;
  border-radius: 16px;
  background: #0b1220;
  color: #fff;
}

.cr > div {
  display: grid;
  gap: 2px;
}

.cr dt {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #aeb7c6;
}

.cr dd {
  margin: 0;
  font: 700 1.05rem ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.04em;
  overflow-wrap: anywhere;
  user-select: all;
}

.cr dd.pw {
  font-size: 1.35rem;
  letter-spacing: 0.12em;
}

.cr-fail {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #9a4a07;
}

.cr-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>
