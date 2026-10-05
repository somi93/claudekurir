<template>
  <div />
</template>

<script setup lang="ts">
// Zarada je spojena u Novčanik (tab "Zarada") - stara ruta samo preusmjerava da
// stari linkovi i oznake i dalje rade.
definePageMeta({ redirect: "/courier/wallet?tab=zarada" });
</script>
