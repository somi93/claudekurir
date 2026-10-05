# Proces: od narudžbe kupca do dostave (kroz sva 3 projekta)

Tri aplikacije, tri uloge:

| Projekat | Ko ga koristi | Uloga |
|---|---|---|
| `restorani-ordera-app` | kupac | naručuje, prati status (guest web app "Ordera") |
| `restorani-front` | restoran (KDS/back-office) | prima, prihvata, priprema narudžbu |
| `dostavljaci-front` | dispečer + kurir | dodjeljuje kurira, isporučuje |

Kanonični status narudžbe je numerički enum iz kurirskog backenda
(`restorani-ordera-app/utils/orderStatus.js`) — sve tri app-e ga na kraju
prate, iako `restorani-front` interno koristi pojednostavljen naziv.

## Tok korak po korak

1. **Kupac naruči** — `restorani-ordera-app`, `POST /orders/guest-orders`
   (ili `guest-orders-with-id`). Status → `on_hold (1)`.
2. **Narudžba stiže restoranu** — `restorani-front` KDS je vidi kao `pending`
   (kolona "Nove narudžbe"). Trenutno bez websocketa — KDS poluje na 10s
   (`kitchen-display.vue:281`).
3. **Restoran prihvata + zadaje vrijeme pripreme** → `accepted (2)`, pa
   `preparing/in-progress (15)` dok kuva.
4. **Restoran označi spremno** → `ready (4)` (ili `ready_for_pickup (16)` ako
   kupac sam preuzima, bez kurira).
5. **Narudžba postaje vidljiva dispečeru** — `dostavljaci-front`,
   `GET /dispatcher/orders/waiting?delivery_company_id=X` → status na
   backendu odgovara "čeka kurira" (`booked_delivery (3)`).
6. **Dispečer dodjeljuje kurira** — vidi rangiranu listu
   (`GET .../candidate-couriers`) i ili odmah dodijeli (`POST /orders/{id}/accept`)
   ili otvori **rundu ponude** (novo, ugovor 2.3/2.4 od 10.09) — kurir(i) dobijaju
   push, prihvataju/odbijaju, backend sam ide na sljedećeg dok neko ne prihvati.
7. **Kurir stiže u restoran / preuzima** → `courier_at_restaurant (11)`, pa
   `charged_delivery (5)` kad se naplati dostava.
8. **Kurir stiže kod kupca** → `courier_arrived (12)` → **isporučeno**
   → `delivered (6)`.
9. **Terminalna/greška stanja** (bilo gdje u toku): `rejected (7)`,
   `no_courier (22)`, `delivery_failed (23)`, `customer_canceled (21)`.

## Praćenje uživo (kupac) — trenutno stanje

- Za **restoransku dostavu** (`delivery_type 0`, najčešći slučaj): mapa/kurir na
  ekranu kupca je **mock/simulacija** (`orderTrackingSimulator.js`,
  `OrderTrackingMap.vue`) — nema pravog GPS-a. Dokumentovano kao privremeno u
  `25_08_2026_ORDER_TRACKING_API_REQUIREMENTS.md`.
- Za **poštansku dostavu** (`delivery_type 3`): postoji pravi Pusher/Echo kanal
  `dispatch.tracking` / event `.gps.updated`.
- Planiran (nepotvrđeno da li je live) per-narudžba kanal
  `delivery.tracking.{id}` preko `GET /api/orders/{orderId}/tracking`
  (`27_08_2026_guest-tracking-frontend.textile`) — trebalo bi da zamijeni i
  mock i dijeljeni kanal.

## Napomene / razdvojenost sistema

- `restorani-front` osim KDS-a vodi i firmenu/ugovornu ishranu (kantina) —
  to su odvojene tabele (`orders`/`order_foods`) od gost-narudžbi
  (`orders_guest`/`orders_more_restaurants`) koje koristi `restorani-ordera-app`.
  Ne miješati statuse jednog sistema sa drugim.
- Dodjela kurira je danas **ručna** (dispečer klikće) — automatska
  push-dodjela je taj isti model ponude iz koraka 6, u fazi
  live-provjere (vidi `10_09_2026_test-plan-ponuda-socket.md`).
