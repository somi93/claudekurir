<template>
  <v-autocomplete
    class="global-field"
    :variant="variant"
    :flat="flat"
    :density="density"
    :items="items"
    :item-title="itemTitle"
    :item-value="itemValue"
    :multiple="multiple"
    :model-value="modelValue"
    v-bind="wrappedAttrs"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- "Izaberi sve" kao prva stavka u meniju (samo uz select-all + multiple).
         Ostaje vidljiva i dok se pretražuje jer nije dio `items`. -->
    <template v-if="showSelectAll" #prepend-item>
      <v-list-item :title="selectAllText" @click="toggleSelectAll">
        <template #prepend>
          <v-checkbox-btn
            :model-value="allSelected"
            :indeterminate="anySelected && !allSelected"
            tabindex="-1"
            @click.stop="toggleSelectAll"
          />
        </template>
      </v-list-item>
      <v-divider class="my-1" />
    </template>

    <template v-for="(_, name) in forwardedSlots" #[name]="slotProps" :key="name">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
import { computed, useAttrs, useSlots } from "vue";
import type { GlobalFieldStyleProps } from "./globalField";

// Transparentan wrapper nad v-autocomplete (vidi GlobalTextField). Dodatno:
// `select-all` ubacuje "Izaberi sve" stavku na vrh menija koja čekira/odčekira
// sve ponuđene opcije odjednom (radi samo uz `multiple`).
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    GlobalFieldStyleProps & {
      items?: unknown[];
      modelValue?: unknown;
      itemTitle?: string;
      itemValue?: string;
      multiple?: boolean;
      selectAll?: boolean;
      selectAllText?: string;
    }
  >(),
  {
    variant: "solo",
    flat: true,
    density: "comfortable",
    items: () => [],
    modelValue: undefined,
    itemTitle: undefined,
    itemValue: undefined,
    multiple: false,
    selectAll: false,
    selectAllText: "Izaberi sve",
  }
);

const emit = defineEmits<{ "update:modelValue": [value: unknown] }>();

// `update:modelValue` iz $attrs bi se spojio uz naš eksplicitni handler i
// dvaput ažurirao v-model - izbacujemo ga i sami emitujemo.
const wrappedAttrs = computed(() => {
  const { "onUpdate:modelValue": _drop, ...rest } = useAttrs();
  return rest;
});

const showSelectAll = computed(() => props.selectAll && props.multiple);

// "prepend-item" renderujemo sami kad je select-all aktivan - da ga ne bismo
// dva puta iscrtali, izuzimamo ga iz proslijeđenih slotova.
const forwardedSlots = computed(() => {
  const slots = { ...useSlots() };
  if (showSelectAll.value) delete slots["prepend-item"];
  return slots;
});

const optionValues = computed(() =>
  props.items.map((item) =>
    props.itemValue && item && typeof item === "object"
      ? (item as Record<string, unknown>)[props.itemValue]
      : item
  )
);

const selectedValues = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue : []
);

const allSelected = computed(
  () =>
    optionValues.value.length > 0 &&
    selectedValues.value.length >= optionValues.value.length
);

const anySelected = computed(() => selectedValues.value.length > 0);

const toggleSelectAll = () => {
  emit("update:modelValue", allSelected.value ? [] : [...optionValues.value]);
};
</script>
