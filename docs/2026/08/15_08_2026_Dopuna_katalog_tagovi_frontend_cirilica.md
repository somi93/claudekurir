# Допуна — заједнички каталог услова (condition_tags)

Ово је **ново**, послије главног упутства о аутоматизацији вожила које си
већ добио. Не мења ништа од раније — само додаје.

---

## ⚠️ Пажња — два слична, различита поља

| Поље | Гдје живи | Шта повезује |
|---|---|---|
| **`condition_tag_id`** | `DeliverySurcharge` (Dodatni parametri) | Наканда → **глобални каталог** (Киша, Снијег...) |
| `surcharge_id` | `DeliveryVehicleRule` (Vozila i pravila) | Pravilo za vozilo → **конкретна наканда те фирме** |

`condition_tag_id` (ово упутство) везује накнаду за **стандардизован
назив/икону**. `surcharge_id` (из ранијег упутства) везује **правило за
возило** за конкретан ред накнаде. Не мешати — различита сврха,
различита табела на другом крају.

---

## 1. Нов endpoint — листа каталога

### `GET /api/condition-tags`


Не тражи `companyId` у путањи — **исти** каталог за све фирме.

**Одговор:**
```json
{
    "success": true,
    "data": [
        {
            "id": 3,
            "key": "traffic",
            "name": "Gužva",
            "icon": "ti-traffic-cone",
            "default_time_from": "15:00:00",
            "default_time_to": "17:00:00"
        },
        {
            "id": 1,
            "key": "rain",
            "name": "Kiša",
            "icon": "ti-cloud-rain",
            "default_time_from": null,
            "default_time_to": null
        }
    ]
}
```

Тренутно постоје **4** стандардна тага: `rain` (Kiša), `snow` (Snijeg),
`traffic` (Gužva), `night` (Noćna dostava).

**Шта прикажи:** ово су "Brzo dodavanje" chip-ovi на "Dodatni parametri"
екрану (тачно они које смо већ разрадили у mockup-u). `default_time_from`/
`default_time_to` су **предлог** за поља "Vreme od/do" — ако постоје
(Гужва, Ноћна dostava), укључи прекидач "Automatski po vremenu" и
предпопуни та поља; ако су `null` (Киша, Снијег), остави прекидач
искључен.

---

## 2. Ново поље при креирању/изменi наканде

### `POST`/`PUT .../surcharges`

Опционо поље **`condition_tag_id`**:
```json
{
    "name": "Kiša",
    "icon": "ti-cloud-rain",
    "condition_tag_id": 1,
    "type": "per_km",
    "value": 0.5
}
```

**Битно — front мора сам да копира `name`/`icon` из изабраног тага у
тело захтева.** Backend то не ради аутоматски (намерно, да не дуплира
логику "шта ако се tag промени касније"). Кад корисник кликне chip
"Кiša" из каталога — front узме `name`/`icon` из тог taga, попуни форму,
и **укључи** `condition_tag_id` у slanje.

Ако корисник бира "Prilagođeni parametar" (не из каталога) —
`condition_tag_id` се **не шаље** (или шаље `null`).

---

## 3. Ново поље у одговору наканде

`GET .../surcharges` сада враћа и:
```json
{
    "id": 7,
    "name": "Kiša",
    "condition_tag": {
        "id": 1,
        "key": "rain",
        "name": "Kiša",
        "icon": "ti-cloud-rain"
    },
    "...": "..."
}
```

`condition_tag` је **`null`** ако наканда није повезана са каталогом
(прилагођена). Ово је сигнал за бedž "iz kataloga" vs "prilagođeno" на
картици — тачно као у mockup-у.

---

## Подсетник — веза са "Vozila i pravila"

`DeliveryVehicleRule.surcharge_id` (из главног упутства) и даље показује
на **конкретан ред** у `delivery_surcharges` те фирме, не директно на
`condition_tags`. Каталог само стандардизује **назив/икону** приликом
креирања наканде — не мења како се пravila за возила повезују.
