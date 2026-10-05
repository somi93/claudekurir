<template>
  <FormDialog
    v-if="wide"
    :open="open"
    :title="title"
    hide-actions
    :max-width="460"
    @update:open="onOpen"
  >
    <div class="pdd" data-pricing="delete">
      <p class="pdd-p">
        {{ question[0] }}<b>{{ name }}</b>{{ question[1] }}<template v-if="note"> {{ note }}</template>
      </p>
      <TintAlert v-if="dependents.length" tone="warn" role="alert" :title="dependentsTitle">
        {{ dependentsText }}
      </TintAlert>
      <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da obrišem" data-pricing="delete-error">
        {{ error }}
      </TintAlert>
    </div>
    <template #actions>
      <AppButton variant="ghost" class="pdd-b" data-pricing="delete-cancel" :disabled="busy" @click="emit('update:open', false)">
        Otkaži
      </AppButton>
      <AppButton variant="danger" class="pdd-b" data-pricing="delete-confirm" :loading="busy" @click="emit('confirm')">
        {{ busy ? "Brišem…" : "Obriši" }}
      </AppButton>
    </template>
  </FormDialog>

  <AppSheet v-else :open="open" :title="title" @update:open="onOpen" @submit="emit('confirm')">
    <div class="pdd" data-pricing="delete">
      <p class="pdd-p">
        {{ question[0] }}<b>{{ name }}</b>{{ question[1] }}<template v-if="note"> {{ note }}</template>
      </p>
      <TintAlert v-if="dependents.length" tone="warn" role="alert" :title="dependentsTitle">
        {{ dependentsText }}
      </TintAlert>
      <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da obrišem" data-pricing="delete-error">
        {{ error }}
      </TintAlert>
    </div>
    <template #footer>
      <AppButton variant="danger" submit data-pricing="delete-confirm" :loading="busy">
        {{ busy ? "Brišem…" : "Obriši" }}
      </AppButton>
      <AppButton variant="ghost" data-pricing="delete-cancel" :disabled="busy" @click="emit('update:open', false)">
        Otkaži
      </AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import FormDialog from "~/components/common/FormDialog.vue";
import TintAlert from "~/components/common/TintAlert.vue";

// Potvrda brisanja doplate ili pravila (D7). Računar: dijalog, telefon: donji list (kao ostali
// editori). Za doplatu koju koriste pravila za vozila navodi koja se brišu zajedno sa njom; front
// ih briše prije doplate jer kaskadno brisanje nije potvrđeno (B4). Poruku o grešci pokazuje u
// dijalogu, ne iza njega, pa dispečer vidi zašto brisanje nije prošlo i dijalog ostaje otvoren.
const props = withDefaults(
  defineProps<{
    open: boolean;
    kind: "surcharge" | "rule";
    // Naziv doplate ili naslov pravila ("Zona: Centar").
    name: string;
    // Doplata je trenutno na snazi: kupci odmah prestaju da je plaćaju.
    active?: boolean;
    // Naslovi pravila koja se brišu zajedno sa doplatom (prazno za pravilo).
    dependents?: string[];
    wide: boolean;
    busy?: boolean;
    error?: string;
  }>(),
  { active: false, dependents: () => [], busy: false, error: "" }
);

const emit = defineEmits<{ "update:open": [value: boolean]; confirm: [] }>();

const title = computed(() => (props.kind === "surcharge" ? "Obriši doplatu" : "Obriši pravilo"));

// "Obrisati doplatu <naziv>?" sa nazivom podebljanim u predlošku.
const question = computed<[string, string]>(() =>
  props.kind === "surcharge" ? ["Obrisati doplatu ", "?"] : ["Obrisati pravilo ", "?"]
);

const note = computed(() =>
  props.kind === "surcharge"
    ? props.active
      ? "Trenutno je na snazi, pa kupci odmah prestaju da je plaćaju."
      : ""
    : "Narudžbe koje je koristilo padaju na sljedeće pravilo koje se poklopi."
);

const dependentsTitle = computed(() =>
  props.dependents.length === 1
    ? "Koristi je jedno pravilo za vozila"
    : `Koristi je ${props.dependents.length} pravila za vozila`
);

const dependentsText = computed(
  () =>
    `${props.dependents.map((d) => `„${d}“`).join(", ")} ${
      props.dependents.length === 1 ? "se briše" : "se brišu"
    } zajedno sa doplatom.`
);

// Dok brisanje traje dijalog se ne zatvara (poziv je već otišao).
const onOpen = (value: boolean) => {
  if (!value && props.busy) return;
  emit("update:open", value);
};
</script>

<style scoped>
.pdd {
  display: grid;
  gap: 12px;
}

.pdd-p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: #0b1220;
}

.pdd-b {
  width: auto;
  min-width: 120px;
}
</style>
