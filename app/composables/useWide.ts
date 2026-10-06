import { onBeforeUnmount, onMounted, ref } from "vue";

// Računar (mreža, dvije kolone) ili telefon (jedna kolona), po širini prozora. Na serveru i do prvog
// mjerenja je "računar" (isto kao ekran Poruke), pa se raspored ne mijenja pri hidrataciji računara.
export const useWide = (query = "(min-width: 960px)") => {
  const wide = ref(true);
  let mq: MediaQueryList | null = null;
  const sync = () => {
    wide.value = mq?.matches ?? true;
  };
  onMounted(() => {
    mq = window.matchMedia(query);
    sync();
    mq.addEventListener("change", sync);
  });
  onBeforeUnmount(() => mq?.removeEventListener("change", sync));
  return wide;
};
