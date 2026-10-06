<template>
  <component
    :is="tag"
    class="pr"
    :class="{ 'pr--live': Boolean(to) || interactive }"
    v-bind="tagAttrs"
  >
    <span class="pr-ic" :class="tone ? `is-${tone}` : ''" :style="iconStyle">
      <v-icon :icon="icon" size="20" />
    </span>
    <span class="pr-t">
      <small>{{ label }}</small>
      <b :class="{ empty, wrap }">{{ value }}</b>
      <em v-if="hint">{{ hint }}</em>
    </span>
    <span class="pr-end">
      <slot name="end">
        <span v-if="endText" class="pr-add">{{ endText }}</span>
        <v-icon v-else-if="to || interactive" icon="mdi-chevron-right" size="20" />
      </slot>
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed, resolveComponent } from "vue";

// Red na ekranu Profil: ikona od 40 px, oznaka, vrijednost (bez dodira se čita) i desna strana
// (strelica, "Dodaj", čip ili prekidač). Minimalna visina 64 px, cijeli red je meta. Prazna
// vrijednost je sivi tekst + plavo "Dodaj", stanje nije samo u boji.
// Red je dugme (`interactive`), veza (`to`) ili običan blok.
const props = withDefaults(
  defineProps<{
    icon: string;
    label: string;
    value: string;
    empty?: boolean;
    // Vrijednost se prelama u više redova (npr. hitni kontakt) umjesto da se skrati.
    wrap?: boolean;
    // Dodatni red pod vrijednošću (objašnjenje).
    hint?: string;
    tone?: "ok" | "warn" | "bad" | "blue" | null;
    // Boje ikone kad ih određuje sadržaj (vozilo).
    iconInk?: string;
    iconTint?: string;
    to?: string;
    interactive?: boolean;
    ariaLabel?: string;
    endText?: string;
  }>(),
  {
    empty: false,
    wrap: false,
    hint: undefined,
    tone: null,
    iconInk: undefined,
    iconTint: undefined,
    to: undefined,
    interactive: false,
    ariaLabel: undefined,
    endText: undefined,
  }
);

const NuxtLink = resolveComponent("NuxtLink");

const tag = computed(() => (props.to ? NuxtLink : props.interactive ? "button" : "div"));

const tagAttrs = computed(() => {
  const attrs: Record<string, unknown> = {};
  if (props.to) attrs.to = props.to;
  else if (props.interactive) attrs.type = "button";
  if ((props.to || props.interactive) && props.ariaLabel) attrs["aria-label"] = props.ariaLabel;
  return attrs;
});

const iconStyle = computed(() =>
  props.iconInk || props.iconTint ? { background: props.iconTint, color: props.iconInk } : undefined
);
</script>

<style scoped>
.pr {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: center;
  width: 100%;
  min-height: 64px;
  padding: 12px 14px;
  border: 0;
  background: #fff;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: none;
  transition: background 0.12s;
}

/* Crta između redova (i iza tonirane poruke u listi), uvučena do teksta. */
.pr:not(:first-child)::before {
  content: "";
  position: absolute;
  top: 0;
  left: 66px;
  right: 0;
  height: 1px;
  background: #eceef2;
}

.pr--live {
  cursor: pointer;
}

.pr--live:active {
  background: #f1f4f9;
}

/* Okvir fokusa unutra: lista ima overflow:hidden pa bi vanjski bio odsječen. */
.pr--live:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.pr-ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
}

.pr-ic.is-ok {
  background: #e3f8ef;
  color: #00734f;
}

.pr-ic.is-warn {
  background: #fff2df;
  color: #9a4a07;
}

.pr-ic.is-bad {
  background: #fde8e6;
  color: #b42318;
}

.pr-ic.is-blue {
  background: #eef4ff;
  color: #2459c7;
}

.pr-t {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.pr-t small {
  font-size: 0.76rem;
  font-weight: 700;
  color: #5b6676;
}

.pr-t b {
  overflow: hidden;
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-t b.empty {
  font-weight: 600;
  color: #657083;
}

.pr-t b.wrap {
  white-space: normal;
}

.pr-t em {
  font-size: 0.8rem;
  font-style: normal;
  line-height: 1.3;
  color: #5b6676;
}

.pr-end {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #657083;
}

.pr-add {
  font-size: 0.84rem;
  font-weight: 800;
  color: #2459c7;
}

@media (prefers-reduced-motion: reduce) {
  .pr {
    transition: none;
  }
}
</style>
