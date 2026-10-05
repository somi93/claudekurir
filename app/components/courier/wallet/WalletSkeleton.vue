<template>
  <div
    class="w-skel"
    role="status"
    aria-busy="true"
    :aria-label="rowsOnly ? 'Učitavam listu' : 'Učitavam novčanik'"
  >
    <template v-if="!rowsOnly">
      <div class="tiles">
        <span class="sk" style="height: 98px; border-radius: 20px" />
        <span class="sk" style="height: 98px; border-radius: 20px" />
      </div>
      <div class="sc">
        <span class="sk" style="height: 8px; border-radius: 999px" />
        <span class="sk" style="height: 12px; width: 60%" />
        <span class="sk" style="height: 52px; border-radius: 14px" />
      </div>
      <div class="pills">
        <span class="sk" style="height: 38px; width: 70px; border-radius: 999px" />
        <span class="sk" style="height: 38px; width: 84px; border-radius: 999px" />
        <span class="sk" style="height: 38px; width: 76px; border-radius: 999px" />
      </div>
      <div class="tiles">
        <span class="sk" style="height: 62px; border-radius: 14px" />
        <span class="sk" style="height: 62px; border-radius: 14px" />
      </div>
    </template>
    <div>
      <div class="hd-head">
        <span class="sk" style="height: 12px; width: 64px" />
        <span class="sk" style="height: 10px; width: 88px" />
      </div>
      <div class="sk-card">
        <div v-for="n in 3" :key="n" class="sk-row">
          <span class="sk" style="height: 40px; width: 40px; border-radius: 50%" />
          <span class="sk-lines">
            <span class="sk" style="height: 14px; width: 68%" />
            <span class="sk" style="height: 12px; width: 48%" />
          </span>
          <span class="sk" style="height: 14px; width: 60px; justify-self: end" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton u obliku stvarnog ekrana (pločice računa, panel, pilule, sažetak i tri reda), pa se pri
// prvom učitavanju ništa ne pomjera. Prikazuje se samo dok nema ni salda; osvježavanje ga nikad
// ne vraća. `rowsOnly`: samo dani sa redovima (lista čeka dostave, a ostatak ekrana je već tu).
withDefaults(defineProps<{ rowsOnly?: boolean }>(), { rowsOnly: false });
</script>

<style scoped>
.w-skel {
  display: grid;
  gap: 12px;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.sc {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.pills {
  display: flex;
  gap: 8px;
}

.hd-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 4px 8px;
}

.sk-card {
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.sk-row {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 70px;
  gap: 12px;
  align-items: center;
  min-height: 68px;
  padding: 14px 16px;
}

.sk-row + .sk-row::before {
  content: "";
  position: absolute;
  top: 0;
  left: 68px;
  right: 0;
  height: 1px;
  background: #eceef2;
}

.sk-lines {
  display: grid;
  gap: 8px;
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eceff3 0%, #f6f7f9 50%, #eceff3 100%);
  background-size: 200% 100%;
  animation: w-shimmer 1.3s linear infinite;
}

@keyframes w-shimmer {
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
