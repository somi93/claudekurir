<template>
  <div class="global-table-wrap">
    <div v-if="loading" class="table-skeleton">
      <v-skeleton-loader v-for="n in skeletonRows" :key="n" type="list-item" />
    </div>
    <template v-else>
      <div class="table-scroll">
        <v-table class="global-table">
          <thead>
            <tr>
              <th
                v-for="header in headers"
                :key="header.key"
                :class="{ num: header.align === 'end', sortable: header.sortable }"
                @click="toggleSort(header)"
              >
                <slot :name="`header.${header.key}`" :header="header">{{ header.label }}</slot>
                <v-icon v-if="header.sortable" size="14" class="sort-icon">
                  {{ sortIcon(header) }}
                </v-icon>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in sortedItems"
              :key="resolveKey(item, index)"
              class="global-table-row"
              :class="{ 'global-table-row--clickable': clickable }"
              @click="onRowClick(item)"
            >
              <td
                v-for="header in headers"
                :key="header.key"
                :class="{ num: header.align === 'end' }"
              >
                <slot
                  :name="`item.${header.key}`"
                  :item="item"
                  :value="cellValue(item, header.key)"
                  :index="index"
                >{{ cellValue(item, header.key) }}</slot>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
      <slot v-if="items.length === 0" name="empty" />
    </template>
  </div>
</template>

<script setup lang="ts" generic="T extends object">
import { computed, getCurrentInstance, ref } from "vue";

export interface GlobalTableHeader {
  key: string;
  label: string;
  align?: "start" | "end";
  sortable?: boolean;
}

const props = withDefaults(
  defineProps<{
    headers: GlobalTableHeader[];
    items: T[];
    itemKey?: string;
    loading?: boolean;
    skeletonRows?: number;
  }>(),
  {
    itemKey: "id",
    loading: false,
    skeletonRows: 4,
  }
);

const emit = defineEmits<{
  "row-click": [item: T];
}>();

// Slot imena su dinamička (item.<key> / header.<key>, po headers propu), pa
// Volar ne može da izvede tipove automatski iz <slot :name="..."> - bez ovoga
// bi "item" u svakom pozivnom template-u ispao "any".
defineSlots<
  {
    empty?: () => unknown;
  } & {
    [K in `item.${string}`]?: (props: { item: T; value: unknown; index: number }) => unknown;
  } & {
    [K in `header.${string}`]?: (props: { header: GlobalTableHeader }) => unknown;
  }
>();

// @row-click je opcion - red dobija pointer/hover samo ako je listener zaista
// zakačen (isto poređenje kao $slots.x u GlobalCard), da tabele bez akcije
// ne dobiju lažni "klikabilan" izgled.
const instance = getCurrentInstance();
const clickable = computed(() => !!instance?.vnode.props?.onRowClick);

const onRowClick = (item: T) => {
  if (clickable.value) emit("row-click", item);
};

const asRecord = (item: T) => item as unknown as Record<string, unknown>;

const cellValue = (item: T, key: string) => asRecord(item)[key];

// Sortiranje po sirovoj vrednosti polja iz item objekta (cellValue) - ne po
// prikazanom slot sadrzaju (npr. GlobalTableHeader.sortable na koloni cija
// #item.<key> slot prikazuje izvedeni tekst i dalje sortira po sirovom polju).
// Klik ciklus: bez sort -> asc -> desc -> bez sort.
const sortKey = ref<string | null>(null);
const sortDir = ref<"asc" | "desc">("asc");

const toggleSort = (header: GlobalTableHeader) => {
  if (!header.sortable) return;
  if (sortKey.value !== header.key) {
    sortKey.value = header.key;
    sortDir.value = "asc";
  } else if (sortDir.value === "asc") {
    sortDir.value = "desc";
  } else {
    sortKey.value = null;
  }
};

const sortIcon = (header: GlobalTableHeader) => {
  if (sortKey.value !== header.key) return "mdi-unfold-more-horizontal";
  return sortDir.value === "asc" ? "mdi-arrow-up" : "mdi-arrow-down";
};

const sortedItems = computed(() => {
  if (!sortKey.value) return props.items;
  const key = sortKey.value;
  const dir = sortDir.value === "asc" ? 1 : -1;
  return [...props.items].sort((a, b) => {
    const av = cellValue(a, key);
    const bv = cellValue(b, key);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
  });
});

const resolveKey = (item: T, index: number) => {
  const key = asRecord(item)[props.itemKey];
  return key !== undefined && key !== null ? String(key) : index;
};
</script>

<style scoped>
.table-skeleton {
  display: grid;
  gap: 4px;
  padding-top: 4px;
}

.table-scroll {
  overflow-x: auto;
}

.global-table {
  background: transparent;
}

.global-table :deep(th) {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9aa4b2;
}

.global-table :deep(th.num),
.global-table :deep(td.num) {
  text-align: right;
}

.global-table :deep(th.sortable) {
  cursor: pointer;
  user-select: none;
}

.sort-icon {
  margin-left: 2px;
  opacity: 0.6;
  vertical-align: middle;
}

.global-table-row--clickable {
  cursor: pointer;
}

.global-table-row--clickable:hover {
  background: #f7f8fa;
}
</style>
