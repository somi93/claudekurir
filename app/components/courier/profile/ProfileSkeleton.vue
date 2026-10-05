<template>
  <div class="pk" role="status" aria-busy="true" aria-label="Učitavam profil">
    <div class="pk-card pk-id">
      <div class="pk-top">
        <span class="sk pk-av" />
        <div class="pk-lines">
          <span class="sk" style="height: 22px; width: 62%" />
          <span class="sk" style="height: 32px; width: 46%; border-radius: 999px" />
        </div>
      </div>
      <div class="pk-chips">
        <span class="sk" style="height: 44px; width: 28%; border-radius: 999px" />
        <span class="sk" style="height: 44px; width: 38%; border-radius: 999px" />
      </div>
    </div>

    <div v-for="(group, index) in GROUPS" :key="index" class="pk-sec">
      <span class="sk pk-eyebrow" />
      <div class="pk-list">
        <div v-for="(height, row) in group.rows" :key="row" class="pk-row" :style="{ minHeight: `${height}px` }">
          <span class="sk" style="width: 40px; height: 40px; border-radius: 12px" />
          <div class="pk-lines">
            <span class="sk" style="height: 11px; width: 30%" />
            <span class="sk" style="height: 15px; width: 58%" />
          </div>
        </div>
      </div>
      <div v-if="group.foot" class="pk-text" :style="{ '--lines': group.foot }">
        <span v-for="line in group.foot" :key="line" class="sk" :style="{ width: line === group.foot ? '62%' : '92%' }" />
      </div>
      <template v-if="group.logout">
        <span class="sk" style="height: 52px; border-radius: 14px" />
        <div class="pk-text" style="--lines: 1">
          <span class="sk" style="width: 40%; margin: 0 auto" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton istog oblika kao ekran (zaglavlje identiteta i šest grupa redova), pa se pri učitavanju
// ništa ne pomjera kad stignu podaci. Visine su izmjerene na pravom ekranu (390 px širine): red
// 64 px, red sa napomenom 81.3 px, red sa prekidačem 68 px, napomena ispod grupe 1 ili 2 reda.
// Prikazuje se samo dok nema profila; osvježavanje ga nikad ne vraća.
const GROUPS: Array<{ rows: number[]; foot?: number; logout?: boolean }> = [
  { rows: [64, 64] },
  { rows: [64, 64, 64] },
  { rows: [81.3] },
  { rows: [64], foot: 1 },
  { rows: [64, 64, 68], foot: 2 },
  { rows: [64, 81.3, 64], logout: true },
];
</script>

<style scoped>
.pk {
  display: grid;
  gap: 14px;
  align-content: start;
}

.pk-card,
.pk-list {
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.pk-id {
  display: grid;
  gap: 14px;
  padding: 18px 16px 16px;
}

.pk-top {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}

.pk-av {
  width: 64px;
  height: 64px;
  border-radius: 50%;
}

.pk-lines {
  display: grid;
  gap: 8px;
}

.pk-chips {
  display: flex;
  gap: 8px;
}

.pk-sec {
  display: grid;
  gap: 8px;
}

/* Naslov grupe: visina jednog reda sitnog teksta (17.3 px). */
.pk-eyebrow {
  height: 12px;
  width: 90px;
  margin: 2.65px 0 2.65px 4px;
}

.pk-list {
  overflow: hidden;
}

.pk-row {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-height: 64px;
  padding: 12px 14px;
}

.pk-row + .pk-row::before {
  content: "";
  position: absolute;
  top: 0;
  left: 66px;
  right: 0;
  height: 1px;
  background: #eceef2;
}

/* Napomena ispod grupe: svaki red teksta je 18.1 px visok (0.78rem, line-height 1.45). */
.pk-text {
  display: grid;
  align-content: start;
  gap: 6.1px;
  box-sizing: border-box;
  height: calc(var(--lines) * 18.1px);
  padding: 3px 4px 0;
}

.pk-text .sk {
  height: 12px;
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eceff3 0%, #f6f7f9 50%, #eceff3 100%);
  background-size: 200% 100%;
  animation: pk-shimmer 1.3s linear infinite;
}

@keyframes pk-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}
</style>
