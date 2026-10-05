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

// Promjena dostavne firme u ladici dok stranica ima neosnimljen unos: ladica pita stranicu prije
// nego što izbor stupi na snagu. Stranica se prijavi dok je otvorena i vrati true ako je promjenu
// zaustavila (sama pita "Imaš nesačuvane izmjene" i firmu promijeni tek poslije "Odbaci izmjene").
type CompanyGuard = (next: number) => boolean;

let companyGuard: CompanyGuard | null = null;

export const registerCompanyChangeGuard = (guard: CompanyGuard): (() => void) => {
  companyGuard = guard;
  return () => {
    if (companyGuard === guard) companyGuard = null;
  };
};

// Vraća true ako je promjena zaustavljena.
export const interceptCompanyChange = (next: number): boolean => companyGuard?.(next) ?? false;
