<template>
  <v-card class="enforcement-card" flat>
    <p class="enforcement-title">Provjera dostupnosti pri dodjeli narudžbi</p>
    <p class="enforcement-copy">
      Kad je uključeno, sistem dodjeljuje narudžbe samo kuririma koji su trenutno
      <strong>potvrđeni</strong> po ovom rasporedu. Dok je isključeno, dodjela radi kao i do sada.
    </p>

    <PageAlert type="warning" class="mb-4">
      Ne uključuj ovo dok kuriri ove firme ne počnu aktivno da prijavljuju dostupnost - u
      suprotnom niko neće biti "potvrđen" i firma prestaje da prima narudžbe.
    </PageAlert>

    <div class="enforcement-row">
      <div>
        <p class="switch-label">Provjera dostupnosti</p>
        <p class="switch-hint">
          {{ loading ? "Učitavam trenutno stanje..." : "Stanje je učitano sa servera za izabranu firmu." }}
        </p>
      </div>
      <v-switch
        :model-value="enabled"
        color="warning"
        hide-details
        :disabled="saving || loading"
        @update:model-value="emit('toggle', Boolean($event))"
      />
    </div>
  </v-card>
</template>

<script setup lang="ts">
import PageAlert from "~/components/common/PageAlert.vue";

defineProps<{
  enabled: boolean;
  loading: boolean;
  saving: boolean;
}>();

const emit = defineEmits<{
  toggle: [value: boolean];
}>();
</script>

<style scoped>
.enforcement-card {
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  padding: 20px;
}

.enforcement-title {
  margin: 0 0 8px;
  font-weight: 800;
  font-size: 1.05rem;
}

.enforcement-copy {
  margin: 0 0 16px;
  color: #6b7685;
}

.enforcement-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: #f5f6f8;
  border-radius: 16px;
}

.switch-label {
  margin: 0;
  font-weight: 700;
}

.switch-hint {
  margin: 2px 0 0;
  font-size: 0.78rem;
  color: #9aa4b2;
  max-width: 360px;
}
</style>
