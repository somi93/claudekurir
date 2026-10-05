// Od 01.09 (odgovor 2.4) 409 sa /orders/{id}/accept nosi `order_status` -
// trenutno stanje narudžbe. Mapiramo poznata stanja u čitljivu poruku;
// nepoznato → null pa pozivalac pada na serversku/generičku poruku. Ključ se
// normalizuje (mala slova, bez razmaka/crtica/donjih crta) da pokrije
// varijante zapisa.
//
// Puna lista (odgovor backend 15.09, §III "order_status u 409" - 26 stanja +
// UNDEFINED fallback). Legacy (0-10), aktivna iz glavnog backenda (11-17,
// kurirska app ih ne upisuje ali mora znati) i terminalna (20-26) - front ne
// razlikuje grupe, samo mapira na poruku dispečeru zašto ponuda nije moguća.
//
// Deljeno između useCandidateCouriers.ts (ručno "Pošalji ponudu" po jednom
// kandidatu) i useDispatchBoard.ts (direktAssign - prisustvo `order_status`
// u 409 tijelu je i signal da je greška vezana za NARUDŽBU, ne za kandidata,
// pa se dalji pokušaji sa sledećim kandidatom obustavljaju).
export const ORDER_STATUS_MESSAGES: Record<string, string> = {
  // Legacy (0-10)
  deleted: "Narudžba je obrisana.",
  onhold: 'Narudžba još čeka potvrdu restorana ("Čeka restoran") — ponuda kuriru nije moguća dok restoran ne prihvati.',
  cekarestoran: 'Narudžba još čeka potvrdu restorana ("Čeka restoran") — ponuda kuriru nije moguća dok restoran ne prihvati.',
  accepted: "Restoran je potvrdio narudžbu, hrana se sprema — kurir je već može prihvatiti.",
  bookeddelivery: "Narudžba već ima kurira koji ju je rezervisao.",
  booked: "Narudžba već ima dodijeljenog kurira.",
  ready: "Hrana je gotova i čeka kurira.",
  chargeddelivery: "Kurir je već preuzeo hranu i vozi ka kupcu.",
  pickedup: "Kurir je već preuzeo ovu narudžbu.",
  indelivery: "Narudžba je već u dostavi.",
  delivered: "Narudžba je već isporučena.",
  completed: "Narudžba je već završena.",
  rejected: "Restoran je odbio narudžbu.",
  deliverycanceled: "Kurir je odustao od rezervacije — narudžba se vratila restoranu.",
  clientrefused: "Kupac je odbio narudžbu na vratima.",
  payed: "Narudžba je plaćena.",
  // Aktivna, iz glavnog backenda (11-17)
  courieratrestaurant: "Kurir je stigao u restoran, još nije preuzeo narudžbu.",
  courierarrived: "Kurir je stigao na adresu isporuke, još nije predao narudžbu.",
  scheduled: "Narudžba je zakazana za kasnije — restoran je još ne vidi.",
  pendingpayment: "Narudžba čeka autorizaciju plaćanja karticom.",
  preparing: "Kuhinja sprema narudžbu.",
  readyforpickup: "Gost je pozvan da lično preuzme narudžbu — bez kurira.",
  pickedbycustomer: "Gost je lično preuzeo narudžbu.",
  // Terminalna (20-26)
  expired: "Restoran nije odgovorio na vrijeme — narudžba je automatski otkazana.",
  customercanceled: "Kupac je otkazao narudžbu prije dostave.",
  nocourier: "Hrana je bila spremna, ali nijedan kurir je nije preuzeo.",
  deliveryfailed: "Kurir je bio na adresi, ali kupac se nije javio ili je adresa pogrešna.",
  returned: "Hrana je vraćena u restoran nakon neuspjele dostave.",
  paymentfailed: "Autorizacija plaćanja karticom nije uspjela.",
  supportcanceled: "Podrška je ručno otkazala narudžbu.",
  // Legacy alias-i (varijante zapisa viđene u praksi)
  pending: "Narudžba još nije spremna za dodjelu kurira.",
  assigned: "Narudžba već ima dodijeljenog kurira.",
  cancelled: "Narudžba je otkazana.",
  canceled: "Narudžba je otkazana.",
  refused: "Kupac je odbio ovu narudžbu — dodjela kurira nije moguća.",
  // Fallback
  undefined: "Narudžba je u stanju koje front ne prepoznaje.",
};

export const orderStatusMessage = (status: string | null): string | null => {
  if (!status) return null;
  const key = status.toLowerCase().replace(/[\s_-]/g, "");
  return ORDER_STATUS_MESSAGES[key] ?? null;
};
