<template>
  <div class="inbox-skeleton" aria-busy="true" aria-label="Učitavam poruke" role="status">
    <div class="sk-card">
      <div v-for="n in rows" :key="n" class="sk-row">
        <span class="sk sk-circle" />
        <span class="sk-lines">
          <span class="sk sk-eyebrow" />
          <span class="sk sk-title" />
          <span class="sk sk-text" />
        </span>
        <span class="sk sk-time" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Skeleton koji prati raspored stvarnog reda (krug + tri linije + vrijeme).
withDefaults(defineProps<{ rows?: number }>(), { rows: 4 });
</script>

<style scoped>
.sk-card {
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.sk-row {
  position: relative;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 34px;
  gap: 12px;
  align-items: start;
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
  animation: inbox-shimmer 1.3s linear infinite;
}

.sk-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.sk-eyebrow {
  height: 10px;
  width: 30%;
}

.sk-title {
  height: 14px;
  width: 70%;
}

.sk-text {
  height: 12px;
  width: 92%;
}

.sk-time {
  height: 10px;
  width: 30px;
}

@keyframes inbox-shimmer {
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
