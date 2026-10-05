<template>
  <div class="hk" aria-busy="true" role="status" aria-label="Učitavam istoriju">
    <div class="hs">
      <div class="hs-top">
        <span class="sk" style="height: 10px; width: 60px" />
        <span class="sk" style="height: 10px; width: 90px" />
      </div>
      <span class="sk" style="height: 34px; width: 170px" />
      <div class="hs-stats">
        <span v-for="n in 3" :key="n" class="sk" style="height: 54px; border-radius: 14px" />
      </div>
      <span class="sk" style="height: 92px; border-radius: 10px" />
    </div>

    <div v-for="rows in [3, 2]" :key="rows">
      <div class="hd-head">
        <span class="sk" style="height: 12px; width: 64px" />
        <span class="sk" style="height: 10px; width: 88px" />
      </div>
      <div class="sk-card">
        <div v-for="n in rows" :key="n" class="sk-row">
          <span class="sk" style="height: 14px; width: 36px" />
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
// Skeleton koji prati oblik stvarnog ekrana (sažetak + dva dana sa redovima), pa se
// pri učitavanju ništa ne pomjera.
</script>

<style scoped>
.hk {
  display: grid;
  gap: 12px;
}

.hs {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.hs-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.hs-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  grid-template-columns: 44px minmax(0, 1fr) 70px;
  gap: 12px;
  align-items: center;
  min-height: 68px;
  padding: 14px 16px;
}

.sk-row + .sk-row::before {
  content: "";
  position: absolute;
  top: 0;
  left: 72px;
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
  animation: hk-shimmer 1.3s linear infinite;
}

@keyframes hk-shimmer {
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
