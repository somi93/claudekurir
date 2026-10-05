import { computed, ref, watch, type Ref } from "vue";
import type { Surcharge } from "~/types/pricing";
import { SIM_DEFAULT, SIM_STEP, activeWithOverrides, clampDist } from "~/utils/pricing";

// Ulaz za "Primjer narudžbe": udaljenost (0,5 do 15 km, korak 0,5), zona i doplate "šta ako".
// "Šta ako" (over) mijenja samo primjer, nikad cjenovnik: ono što dispečer prebaci prepisuje stvarno
// stanje doplata (active) samo u obračunu primjera. Izlaz (cijena, vozilo) računa radni prostor.
export const usePricingSimulator = (surcharges: Ref<Surcharge[]>) => {
  const dist = ref(SIM_DEFAULT);
  // null je "Svejedno": zona se ne uzima u obzir.
  const zoneId = ref<number | null>(null);
  // Prepisana stanja doplata, po id-u; samo ona koja se razlikuju od stvarnog.
  const over = ref<Record<number, boolean>>({});

  const active = computed(() => activeWithOverrides(surcharges.value, over.value));
  const hasOver = computed(() => Object.keys(over.value).length > 0);

  // Udaljenost uvijek u granicama i na korak od 0,5 km (klizač, ± dugmad i upisan broj).
  const setDist = (n: number) => {
    dist.value = clampDist(n);
  };

  const step = (dir: 1 | -1) => setDist(dist.value + dir * SIM_STEP);

  // Dodir na doplatu u primjeru: prebaci u suprotno od stvarnog, a drugi dodir vraća na stvarno.
  const toggleOver = (id: number) => {
    const s = surcharges.value.find((x) => x.id === id);
    if (!s) return;
    if (id in over.value) {
      const next = { ...over.value };
      delete next[id];
      over.value = next;
    } else {
      over.value = { ...over.value, [id]: !s.active };
    }
  };

  const resetOver = () => {
    over.value = {};
  };

  // Sve na početno (druga firma): udaljenost, zona i "šta ako".
  const reset = () => {
    dist.value = SIM_DEFAULT;
    zoneId.value = null;
    over.value = {};
  };

  // Doplata koje više nema (obrisana, druga firma) ili čije se stvarno stanje poklopilo sa prepisanim ne
  // smije ostati u "šta ako": inače bi dugme "Vrati na stvarno" stajalo bez ikakve razlike.
  watch(
    () => surcharges.value.map((s) => `${s.id}:${s.active ? 1 : 0}`).join(","),
    () => {
      const keys = Object.keys(over.value);
      if (keys.length === 0) return;
      const next: Record<number, boolean> = {};
      let changed = false;
      for (const key of keys) {
        const id = Number(key);
        const s = surcharges.value.find((x) => x.id === id);
        const wanted = over.value[id];
        if (s && wanted !== undefined && wanted !== s.active) next[id] = wanted;
        else changed = true;
      }
      if (changed) over.value = next;
    }
  );

  return { dist, zoneId, over, active, hasOver, setDist, step, toggleOver, resetOver, reset };
};

export type PricingSimulatorApi = ReturnType<typeof usePricingSimulator>;
