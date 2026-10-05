# Упутство за front — финансијске поставке и сарадња ресторан-фирма

Два нова, независна дела функционалности. Оба само за диспечерски панел.

---

## 1. Финансијске поставке фирме

### `GET /api/dispatcher/delivery-companies/{id}/finance-settings`

```json
{
    "success": true,
    "data": {
        "delivery_company_id": 24,
        "commission_percentage": 15.0,
        "commission_percentage_editable": false,
        "cash_limit_amount": 200.0,
        "payout_period_days": 7,
        "daily_handover_time": "22:00"
    }
}
```

### `PATCH /api/dispatcher/delivery-companies/{id}/finance-settings`

Прихвата **само** три поља (шаљеш само оно што мењаш):

```json
{
    "cash_limit_amount": 250.0,
    "payout_period_days": 15,
    "daily_handover_time": "21:30"
}
```

### ⚠️ Битно — `commission_percentage` је READ-ONLY за диспечера

**Не шаљи** ово поље у `PATCH` захтеву — тихо се игнорише (нема грешке, само нема ефекта). Прикажи га на екрану као **закључано** поље (нпр. засивљено, без могућности уноса) — бекенд одговор већ носи `commission_percentage_editable: false` да ти то олакша, не мораш сам да хардкодираш то правило на фронту.

**Зашто:** провизија утиче на то колико курир стварно зарађује — намерно резервисано само за Ordera admin (тренутно се поставља директно преко базе, док не добије посебан admin панел).

### UI предлог

- **Провизија (%)** — приказ, закључано поље
- **Лимит готовине (КМ)** — број, уносиво
- **Период исплате (дана)** — број, уносиво (1=дневно, 7=недељно, 15=свака 2 недеље, или било који договорен број)
- **Време дневне предаје** — time picker, уносиво, опционо (може остати празно)

---

## 2. Сарадња ресторан-фирма

### `GET /api/dispatcher/delivery-companies/{companyId}/restaurants`

```json
{
    "success": true,
    "data": [
        {
            "id": 12,
            "restaurant_id": 7,
            "restaurant_name": "Роштиљница Лагуна",
            "active_restoran": true,
            "active_company": true,
            "cooperation_active": true,
            "internal": false
        },
        {
            "id": 13,
            "restaurant_id": 9,
            "restaurant_name": "Sushi Bar",
            "active_restoran": true,
            "active_company": false,
            "cooperation_active": false,
            "internal": false
        }
    ]
}
```

### `PATCH /api/dispatcher/restaurant-delivery-company/{id}`

```json
{ "active_restoran": false }
```

### ⚠️ Битно — два различита прекидача, само један је твој

| Поље | Ко га мења | Приказ |
|---|---|---|
| `active_restoran` | **Диспечер** (преко овог PATCH-а) | Прекидач, уносиво |
| `active_company` | **Ресторан** (нема везе са овим API-јем) | **Само приказ**, закључано |

### UI предлог — зашто je `active_company` битно приказати, иако се не може мењати

Ако `active_restoran: true` а `active_company: false` — сарадња **не ради**, иако диспечер ништа није искључио. Без приказа другог прекидача, диспечер би помислио да је нешто покварено, или да треба да укључи нешто што је **већ** укључено на његовој страни.

**Предлог визуелног статуса:**
- Оба `true` → зелено, "Активна сарадња"
- `active_restoran: false` (диспечер искључио) → сиво, "Ти си искључио"
- `active_restoran: true`, `active_company: false` → жуто/наранџасто, "Ресторан је искључио сарадњу" (диспечер не може ништа да уради осим да контактира ресторан)

### `internal` поље

Означава да ли је ово **сопствена** достава ресторана (не спољна фирма) — вероватно није директно уносиво овде, само информативно (можда посебна иконица/ознака на листи).
