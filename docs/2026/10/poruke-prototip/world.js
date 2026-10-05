/* Probni podaci (izmišljeni, ali dosljedni): isti kurir ima isto stanje na svakom mjestu na tabli. Oblik poruka je onaj iz
   types/inbox.ts; ponude (category "offer") nastaju nepročitane i gomilaju se (dokument 03.10). */
(function (g) {
  'use strict';
  const NOW = new Date(2026, 9, 5, 14, 32, 0); // ponedjeljak, 5. oktobar 2026.
  const NOW_MS = NOW.getTime();
  const COMPANY = { id: 24, name: 'Ordera Dostava Banja Luka', currency: 'KM', cashLimit: 150 };
  const H = 3600_000, D = 24 * H;

  const mulberry = (a) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // [id, ime, prezime, telefon, vozilo, uživo, prije (s), gotovina, suspendovan]
  const ROWS = [
    [30189, 'Amir', 'Hodžić', '062/519-315', 'motorbike', 'delivering', 20, 180.7, false],
    [30192, 'Kenan', 'Mujić', '+387 63 658 711', 'scooter', 'online', 45, 38.2, false],
    [30195, 'Aleksandar-Nemanja', 'Petrović-Njegoš Jovanović Mrkonjić', '065431483', 'motorbike', 'offline', 12 * 60, 0, false],
    [30198, 'Nemanja', 'Bajić', '064 901 963', 'scooter', 'offline', 3 * 3600, 112, true],
    [30201, 'Lazar', 'Zec', null, 'motorbike', 'none', 0, 0, false],
    [30204, 'Жељко', 'Марковић', '+387 66 777 888', 'car', 'online', 2 * 60, 0, false],
    [30207, 'Boris', 'Lukić', '066761691', null, 'online', 60, 0, false],
    [30210, 'Jasmin', 'Simić', '066 983 154', 'motorbike', 'delivering', 55, 62.5, false],
    [30213, 'Željko', 'Đurić', '065/123-456', 'bicycle', 'online', 30, 0, false],
    [30216, 'Nikola', 'Stanić', '061/424-528', 'scooter', 'offline', 25 * 60, 0, false],
    [30219, 'Milan', 'Hadžić', '+387 64 758 967', 'car', 'online', 4 * 60, 0, false],
    [30222, 'Boris', 'Salihović', '061847533', 'bicycle', 'offline', 5 * 3600, 0, false],
    [30225, 'Milan', 'Ilić', '063 916 350', 'motorbike', 'online', 3 * 60, 0, false],
    [30228, 'Tarik', 'Radić', '060/501-980', null, 'none', 0, 0, false],
    [30231, 'Nemanja', 'Mrkonjić', '+387 60 195 988', 'bicycle', 'offline', 2 * 86400, 0, false],
    [30234, 'Marko', 'Marković', '066127130', 'scooter', 'delivering', 12, 20, false],
    [30237, 'Milan', 'Đurić', '066 795 736', 'motorbike', 'offline', 40 * 60, 0, false],
    [30240, 'Luka', 'Lukić', '060/476-949', 'scooter', 'offline', 6 * 3600, 145.5, true],
    [30243, 'Ćamil', 'Mujić', '+387 64 380 581', 'motorbike', 'online', 6 * 60, 0, false],
    [30246, 'Nikola', 'Radić', '064663235', 'bicycle', 'offline', 86400, 0, false],
    [30249, 'Emir', 'Radić', '060 379 943', 'motorbike', 'none', 0, 0, false],
    [30252, 'Amir', 'Džaferović', '062/694-787', 'car', 'online', 50, 0, false],
    [30255, 'Čedomir', 'Vuković', '+387 63 432 108', 'motorbike', 'offline', 8 * 3600, 0, false],
    [30258, 'Alen', 'Pejić', '062785155', null, 'offline', 3 * 86400, 0, false],
    [30261, 'Damir', 'Softić', '066 930 404', 'bicycle', 'online', 60, 0, false],
    [30264, 'Selma', 'Begić', '065 220 117', 'scooter', 'online', 2 * 60, 0, false],
    [30267, 'Haris', 'Kurtović', '061 303 909', 'car', 'delivering', 33, 0, false],
    [30270, 'Edin', 'Čengić', '063 555 010', 'motorbike', 'offline', 2 * 86400, 0, true],
  ];
  const FIRST = ['Amir', 'Emir', 'Haris', 'Adnan', 'Mirza', 'Kenan', 'Tarik', 'Damir', 'Nermin', 'Dino', 'Jasmin', 'Senad', 'Edin', 'Alen', 'Sead', 'Armin', 'Ismar', 'Elvir', 'Samir', 'Vedran', 'Marko', 'Nikola', 'Milan', 'Dejan', 'Goran', 'Zoran', 'Bojan', 'Nemanja', 'Stefan', 'Luka'];
  const LAST = ['Hodžić', 'Kovačević', 'Marković', 'Delić', 'Mujić', 'Babić', 'Jovanović', 'Petrović', 'Salihović', 'Begić', 'Ćosić', 'Đurić', 'Nikolić', 'Simić', 'Tomić', 'Lukić', 'Zec', 'Vuković', 'Kurtović', 'Hadžić'];
  const ascii = (s) => String(s).toLowerCase().replace(/đ/g, 'dj').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

  const extra = (k) => {
    const out = [];
    for (let i = 0; i < k; i++) {
      const first = FIRST[i % FIRST.length], last = LAST[(i * 7) % LAST.length];
      const st = ['online', 'offline', 'offline', 'delivering', 'none'][i % 5];
      out.push([31000 + i, first, last, `06${i % 7} ${100 + (i * 13) % 800} ${100 + (i * 29) % 800}`, [null, 'motorbike', 'car', 'bicycle', 'scooter'][i % 5] || 'motorbike', st, 30 + (i * 97) % 40000, i % 9 === 0 ? 10 + (i % 150) : 0, i % 23 === 0]);
    }
    return out;
  };

  // Grupne poruke koje je dispečer slao (isti tekst ide svim primaocima). to: all | debt | some | few
  const BROADCASTS = [
    { key: 'M1', agoMs: 21 * D + 3 * H, category: 'announcement', title: 'Dobrodošli u Ordera Dostava', body: 'Dobrodošli u tim! Aplikaciju držite otvorenu dok radite. Pitanja: javite se dispečeru.', to: 'all' },
    { key: 'M2', agoMs: 12 * D + 5 * H, category: 'todo', title: 'Predaj gotovinu do petka', body: 'Ko ima više od 100 KM kod sebe neka preda gotovinu u poslovnici do petka u 16h.', to: 'debt' },
    { key: 'M3', agoMs: 9 * D + 2 * H, category: 'promotion', title: 'Vikend bonus +1.00 KM po dostavi', body: 'Ovog vikenda svaka dostava nosi 1.00 KM bonusa. Važi subota i nedjelja od 12 do 22h.', to: 'all' },
    { key: 'M4', agoMs: 6 * D + 7 * H, category: 'announcement', title: 'Nova zona Starčevica', body: 'Od ponedjeljka Starčevica je u našoj zoni. Mapa zona je u dispečerskom pregledu.', to: 'all' },
    { key: 'M5', agoMs: 2 * D + 4 * H, category: 'announcement', title: 'Pada kiša, pazite na put', body: 'Kiša cijeli dan. Vozite oprezno, nemojte žuriti zbog vremena dostave.', to: 'all' },
    { key: 'M6', agoMs: 26 * H, category: 'todo', title: 'Provjeri vozilo prije smjene', body: 'Prije smjene provjeri kočnice i svjetla. Ko ima kvar neka javi dispečeru prije prijave.', to: 'some' },
    { key: 'M7', agoMs: 3 * H + 10 * 60_000, category: 'todo', title: 'Javi se dispečeru', body: 'Molim te da se javiš na broj 051 123 456 čim završiš trenutnu dostavu.', to: 'few' },
  ];

  // Starije poruke jednog kurira (za listanje): da sanduče glavnog kurira ima više od jedne stranice po kategoriji.
  const OLD_TITLES = [
    ['announcement', 'Radno vrijeme za praznike', 'Za praznike radimo od 10 do 23h. Smjene ostaju kao i do sada.'],
    ['todo', 'Pošalji sliku vozačke dozvole', 'Treba nam čitka slika vozačke dozvole. Pošalji je dispečeru.'],
    ['promotion', 'Bonus za 30 dostava', 'Ko završi 30 dostava u sedmici dobija dodatnih 20 KM.'],
    ['announcement', 'Nova aplikacija za kurire', 'Instaliraj najnoviju verziju aplikacije prije sljedeće smjene.'],
    ['todo', 'Potvrdi smjenu za subotu', 'Potvrdi da radiš u subotu do 18h.'],
    ['announcement', 'Zatvoren most u centru', 'Most u centru je zatvoren do 20h. Koristite obilaznicu.'],
    ['promotion', 'Dvostruka zarada u petak', 'Petak od 18 do 22h dostave se plaćaju duplo.'],
    ['announcement', 'Podsjetnik: kaciga je obavezna', 'Kaciga je obavezna za sve vozače motora i skutera.'],
    ['todo', 'Javi broj računa za isplatu', 'Pošalji broj računa na koji želiš isplatu zarade.'],
    ['announcement', 'Promjena adrese poslovnice', 'Poslovnica se seli u novu ulicu od ponedjeljka.'],
    ['promotion', 'Bonus za nove kurire', 'Dovedi prijatelja i oboje dobijate bonus nakon 20 dostava.'],
    ['announcement', 'Održavanje sistema noćas', 'Aplikacija neće raditi noćas od 02 do 03h.'],
    ['todo', 'Obnovi osiguranje vozila', 'Osiguranje ti ističe. Pošalji novi polisu dispečeru.'],
    ['announcement', 'Nova pravila za čekanje', 'Čekanje u restoranu duže od 10 minuta prijavi dispečeru.'],
    ['promotion', 'Mjesečni bonus', 'Najbolji kurir mjeseca dobija 100 KM.'],
    ['announcement', 'Raspored za sljedeću sedmicu', 'Novi raspored smjena je objavljen u aplikaciji.'],
    ['todo', 'Predaj uniformu', 'Vrati uniformu u poslovnicu do petka.'],
    ['announcement', 'Zatvoren restoran Laguna', 'Restoran Laguna je zatvoren do daljnjeg.'],
    ['promotion', 'Vikend bonus', 'Subotom i nedjeljom dodatni bonus po dostavi.'],
    ['announcement', 'Uputstvo za gotovinu', 'Gotovinu predaj na kraju smjene, ne čuvaj je kod sebe.'],
  ];

  const build = (n) => {
    const rows = n && n > ROWS.length ? ROWS.concat(extra(n - ROWS.length)) : ROWS;
    const roster = rows.map(([id, first, last, phone, vehicle, st, agoSec, cash, suspended]) => ({
      id, first, last, phone, vehicle, live: st === 'none' ? null : { st, ago: agoSec }, cash, suspended: !!suspended,
      email: `${ascii(g.__M.toLatin(first)).slice(0, 14)}.${ascii(g.__M.toLatin(last)).slice(0, 14)}@ordera`,
    }));
    const inbox = new Map();
    const offers = new Map();
    let nextMsg = 700000;
    const rnd = mulberry(4242);
    roster.forEach((c, idx) => {
      const list = [];
      BROADCASTS.forEach((b) => {
        const to = b.to === 'all' ? true : b.to === 'debt' ? c.cash > 0 : b.to === 'some' ? idx % 2 === 0 : [0, 2, 4, 7, 9].includes(idx);
        if (!to) return;
        const age = b.agoMs;
        const chance = age > 5 * D ? 0.96 : age > 24 * H ? 0.8 : age > 6 * H ? 0.62 : 0.4;
        list.push({ id: nextMsg++, sender: 'dispatcher', category: b.category, title: b.title, body: b.body, sent_at: new Date(NOW_MS - age + idx * 1000).toISOString(), read: rnd() < chance, _batch: b.key });
      });
      if (c.id === 30189) {
        OLD_TITLES.forEach(([category, title, body], i) => {
          list.push({ id: nextMsg++, sender: 'dispatcher', category, title, body, sent_at: new Date(NOW_MS - (24 + i * 5) * D - i * H).toISOString(), read: true, _batch: `old${i}` });
        });
      }
      list.sort((a, b) => b.sent_at.localeCompare(a.sent_at));
      inbox.set(c.id, list);
      offers.set(c.id, c.id === 30189 ? 63 : 4 + Math.floor(rnd() * 36));
    });
    return { roster, inbox, offers, nextMsgId: () => nextMsg++ };
  };

  g.__MW = { NOW, NOW_MS, COMPANY, BROADCASTS, build, mulberry };
})(typeof window !== 'undefined' ? window : globalThis);
