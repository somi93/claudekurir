<template>
  <div class="dl-stops" :class="{ 'dl-stops--compact': compact }">
    <div class="dl-stop">
      <div class="dl-stop-rail">
        <i class="dl-stop-dot" :class="pickupDone ? 'dl-stop-dot--done' : 'dl-stop-dot--p'" />
        <i class="dl-stop-line" />
      </div>
      <div class="dl-stop-txt">
        <span class="dl-stop-k">Preuzimanje</span>
        <strong>{{ restaurant.name }}</strong>
        <span v-if="restaurant.address" class="dl-stop-addr">{{ restaurant.address }}</span>
        <div v-if="$slots.restaurant" class="dl-stop-acts"><slot name="restaurant" /></div>
      </div>
    </div>
    <div class="dl-stop">
      <div class="dl-stop-rail">
        <i class="dl-stop-dot dl-stop-dot--d" />
      </div>
      <div class="dl-stop-txt">
        <span class="dl-stop-k">Dostava</span>
        <strong>{{ customer.title }}</strong>
        <span v-if="customer.sub" class="dl-stop-addr">{{ customer.sub }}</span>
        <div v-if="$slots.customer" class="dl-stop-acts"><slot name="customer" /></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Dvije stanice (restoran -> kupac) sa šinom i tačkama iste boje kao pinovi na mapi.
// `compact` = jedan red po stanici (ponuda), inače puni prikaz sa dugmadi (detalji).
withDefaults(
  defineProps<{
    restaurant: { name: string; address?: string | null };
    customer: { title: string; sub?: string | null };
    compact?: boolean;
    pickupDone?: boolean;
  }>(),
  { compact: false, pickupDone: false }
);
</script>
