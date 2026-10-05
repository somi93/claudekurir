// Zaštita unosa u donjem listu: dok list ima neosnimljen unos, zatvaranje (X, pozadina, Esc)
// i odlazak sa stranice (dugme Nazad na telefonu) ne gube ga bez pitanja. List se prijavi ovdje
// dok je otvoren; ruta ga pita prije nego što odluči.
//
// Jedan list je otvoren u jednom trenutku, pa je dovoljan jedan zapis na nivou modula (piše se
// samo u pregledaču, kad se list otvori - nikad tokom SSR-a).
type Guard = { dirty: () => boolean; ask: () => void };

let active: Guard | null = null;

export const registerSheetGuard = (guard: Guard): (() => void) => {
  active = guard;
  return () => {
    if (active === guard) active = null;
  };
};

// Vraća true ako je odlazak zaustavljen: list sa unosom pokazuje "Imaš nesačuvane izmjene".
export const interceptLeaving = (): boolean => {
  if (active?.dirty()) {
    active.ask();
    return true;
  }
  return false;
};
