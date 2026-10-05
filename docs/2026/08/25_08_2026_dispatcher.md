Опис

Стављамо фокус на диспечера - пошто рола курира с еобрађује на мобилној

Курирски новчаник и зарада — спремно за интеграцију
Четири endpoint-а, сви на `api.kurir.ordera`, сви тестирани end-to-end.

1. Зарада по достави + груписање по дану
```
GET /api/couriers/{courierId}/earnings
Authorization: Bearer <token>
```

Одговор:
```json {
"success": true,
"total": 175.95,
"daily": [ {"date": "2026-08-19", "amount": 36.02, "deliveries": 7}, {"date": "2026-08-18", "amount": 29.92, "deliveries": 6}
],
"data": [ {"order_id": 3796, "wage": 12, "collected_from_customer": 67.40, "date": "2026-08-18 17:31:50"}
]
}
```

- `total` — укупна зарада (сав приказани период)
- `daily` — груписано по дану, најновије прво — за "Недавни дани" листу
- `data` — појединачне ставке по достави — за drill-down кад корисник отвори један дан
- `wage` — колика је курирова зарада за ту доставу
- `collected_from_customer` — колико је курир наплатио од купца готовином за ту доставу (`null` ако је плаћено картицом — курир тада ништа не наплаћује)

2. Тренутно стање новчаника — "ко коме шта дугује"
```
GET /api/couriers/{courierId}/wallet-balance
Authorization: Bearer <token>
```

Одговор:
```json {
"success": true,
"cash_owed_to_company": 45.60,
"wage_owed_to_courier": 175.95
}
```

- `cash_owed_to_company` — колико готовине курир тренутно држи (наплатио од купаца преко поузећа, још није предао фирми)
- `wage_owed_to_courier` — колико зараде фирма дугује куриру (обрачунато, још није исплаћено)

Важна напомена: ово су чисто информативни бројеви. Тренутно нема аутоматске исплате — ни готовинског предавања, ни исплате зараде на рачун. Курир и диспечер само виде тренутно стање. Аутоматизација (периодична исплата, лимит на количину готовине) долази у следећој фази.

3. Пријава предаје готовине (курир)
```
POST /api/cash-handovers/report
Authorization: Bearer <token>
Body: {"reported_amount": 50}
```

Одговор:
```json {
"success": true,
"handover": {
"id": 1,
"courier_id": 30189,
"delivery_company_id": 24,
"reported_amount": "50.00",
"status": "pending",
"reported_at": "2026-08-20T04:37:12.000000Z"
}
}
```

4. Историја предаја готовине
```
GET /api/couriers/{courierId}/cash-handovers
Authorization: Bearer <token>
```

Одговор:
```json {
"success": true,
"data": [ {
"id": 1,
"reported_amount": "50.00",
"confirmed_amount": "50.00",
"status": "confirmed",
"note": null,
"reported_at": "2026-08-20T04:37:12.000000Z",
"confirmed_at": "2026-08-20T04:51:22.000000Z"
}
]
}
```

`status` могуће вриједности:
- `pending` — курир пријавио, чека потврду диспечера
- `confirmed` — потврђено, укњижено у главну књигу
- `disputed` — резервисано за будућност (спорна предаја)

5. Диспечер: листа курира фирме са балансима
```
GET /api/dispatcher/delivery-companies/{companyId}/couriers-balance
Authorization: Bearer <token dispečera>
```

Одговор:
```json {
"success": true,
"data": [ {"courier_id": 30189, "cash_owed_to_company": 25, "wage_owed_to_courier": 60}, {"courier_id": 30190, "cash_owed_to_company": 0, "wage_owed_to_courier": 15}
]
}
```

Приказује оба стања за сваког курира фирме одjедном — "ко коме шта дугује" на нивоу цијеле фирме.

6. Диспечер: листа захтјева за предају који чекају потврду
```
GET /api/dispatcher/delivery-companies/{companyId}/cash-handovers/pending
Authorization: Bearer <token dispečera>
```

Одговор:
```json {
"success": true,
"data": [ {
"id": 1,
"courier_id": 30189,
"reported_amount": "50.00",
"reported_at": "2026-08-20T04:37:12.000000Z"
}
]
}
```

"Кога треба да потврдим данас" преглед — сортирано по времену пријаве, најстарије прво. Диспечер потврђује преко endpoint-а из тачке 3 (`/dispatcher/cash-handovers/{id}/confirm`, већ имплементирано и тестирано раније).

Шта долази у следећој фази
- Периодична исплата зараде куриру (аутоматска или ручна евиденција исплате)
- Лимит на количину готовине коју курир смије да држи (блокада нових поузећа наруџби)
- Бонуси и ручне корекције зараде