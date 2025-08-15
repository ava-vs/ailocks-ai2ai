# API Digital Distribution Functions

Документация по Netlify Functions для системы цифровой дистрибуции AI2AI.

## Обзор

Система цифровой дистрибуции включает следующие эндпоинты:

1. **products-offer** - создание предложения продукта
2. **products-invoice** - создание счета и ссылки на оплату Stripe
3. **payments-stripe-webhook** - обработка webhook событий от Stripe
4. **products-grant** - выдача билета доставки (delivery ticket)
5. **products-claim** - получение деталей доступа к продукту
6. **products-ack** - подтверждение доставки с подписью
7. **products-revoke** - отзыв доступа к продукту
8. **products-dispute** - открытие спора

## Детальное описание функций

### 1. POST /.netlify/functions/products-offer

Создает предложение продукта для конкретного получателя.

**Аутентификация:** Bearer token (JWT)

**Тело запроса:**
```json
{
  "productId": "uuid",
  "toAilockId": "uuid", 
  "price": 99.99,
  "currency": "USD",
  "policy": {},
  "message": "Optional message"
}
```

**Ответ (201):**
```json
{
  "transferId": "uuid",
  "status": "offered",
  "productTitle": "Product Name",
  "price": 99.99,
  "currency": "USD",
  "message": "Product offer created successfully"
}
```

### 2. POST /.netlify/functions/products-invoice

Создает счет и возвращает ссылку на оплату Stripe.

**Аутентификация:** Bearer token (JWT)

**Тело запроса:**
```json
{
  "transferId": "uuid",
  // ИЛИ для создания трансфера на лету:
  "productId": "uuid",
  "toAilockId": "uuid",
  "price": 99.99,
  "currency": "USD"
}
```

**Ответ (200):**
```json
{
  "transferId": "uuid",
  "checkoutUrl": "https://checkout.stripe.com/pay/...",
  "amount": "99.99",
  "currency": "USD",
  "status": "invoiced",
  "message": "Invoice created successfully"
}
```

### 3. POST /.netlify/functions/payments-stripe-webhook

Обрабатывает webhook события от Stripe для подтверждения платежей.

**Аутентификация:** Stripe signature verification

**Тело запроса:** Stripe webhook payload

**События:**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

**Ответ (200):**
```json
{
  "received": true
}
```

### 4. POST /.netlify/functions/products-grant

Выдает билет доставки после подтвержденной оплаты.

**Аутентификация:** Bearer token (JWT)

**Тело запроса:**
```json
{
  "transferId": "uuid",
  "recipientPublicKey": "optional_x25519_key"
}
```

**Ответ (200):**
```json
{
  "transferId": "uuid",
  "productId": "uuid",
  "productTitle": "Product Name",
  "keyEnvelope": "base64_encoded_key",
  "claimToken": "jwt_token",
  "expiresAt": "2024-01-01T00:00:00Z",
  "status": "delivered",
  "message": "Delivery ticket issued successfully"
}
```

### 5. GET /.netlify/functions/products-claim

Возвращает детали доступа к продукту по claim token.

**Аутентификация:** Claim token (JWT) в заголовке `X-Claim-Token` или параметре `claim`

**Параметры запроса:**
- `claim` - claim token (альтернатива заголовку)

**Ответ (200):**
```json
{
  "transferId": "uuid",
  "productId": "uuid",
  "productTitle": "Product Name",
  "productSize": 1024000,
  "contentType": "application/zip",
  "keyEnvelope": "base64_encoded_key",
  "downloadToken": "jwt_token",
  "expiresAt": "2024-01-01T00:00:00Z",
  "manifest": {...},
  "downloadUrls": {
    "manifest": "/.netlify/functions/products-download-manifest?...",
    "chunk": "/.netlify/functions/products-download-chunk?..."
  },
  "status": "ready_for_download",
  "message": "Access details retrieved successfully"
}
```

### 6. POST /.netlify/functions/products-ack

Подтверждает доставку продукта с подписью Ed25519.

**Аутентификация:** Bearer token (JWT)

**Тело запроса:**
```json
{
  "transferId": "uuid",
  "clientHash": "sha256_hash_of_decrypted_content",
  "signature": "ed25519_signature",
  "meta": {
    "additional": "metadata"
  }
}
```

**Ответ (201):**
```json
{
  "receiptId": "uuid",
  "transferId": "uuid",
  "status": "acknowledged",
  "deliveredAt": "2024-01-01T00:00:00Z",
  "message": "Delivery receipt created successfully"
}
```

### 7. POST /.netlify/functions/products-revoke

Отзывает доступ к продукту на основе политик.

**Аутентификация:** Bearer token (JWT) - только владелец продукта

**Тело запроса:**
```json
{
  "transferId": "uuid",
  "reason": "Policy violation",
  "policy": {
    "additional": "revocation_rules"
  }
}
```

**Ответ (200):**
```json
{
  "transferId": "uuid",
  "productId": "uuid",
  "productTitle": "Product Name",
  "status": "revoked",
  "reason": "Policy violation",
  "revokedAt": "2024-01-01T00:00:00Z",
  "message": "Product access revoked successfully"
}
```

### 8. POST /.netlify/functions/products-dispute

Открывает спор по трансферу продукта.

**Аутентификация:** Bearer token (JWT) - владелец или получатель

**Тело запроса:**
```json
{
  "transferId": "uuid",
  "reason": "Product not as described",
  "description": "Detailed description of the issue",
  "evidence": {
    "screenshots": [],
    "logs": []
  },
  "requestedAction": "refund"
}
```

**Ответ (201):**
```json
{
  "transferId": "uuid",
  "productId": "uuid",
  "productTitle": "Product Name",
  "disputeId": "dispute_uuid_timestamp",
  "status": "disputed",
  "reason": "Product not as described",
  "requestedAction": "refund",
  "disputedAt": "2024-01-01T00:00:00Z",
  "disputedBy": "owner|recipient",
  "message": "Dispute opened successfully"
}
```

## Коды ошибок

### Общие ошибки
- **400** - Bad Request (неверные параметры)
- **401** - Unauthorized (неверная аутентификация)
- **403** - Forbidden (нет прав доступа)
- **404** - Not Found (ресурс не найден)
- **405** - Method Not Allowed
- **409** - Conflict (конфликт состояния)
- **500** - Internal Server Error

### Специфичные ошибки
- **503** - Service Unavailable (Stripe не настроен)

## Поток работы

1. **Offer** → **Invoice** → **Payment** → **Grant** → **Claim** → **Download** → **Ack**
2. Опционально: **Revoke** или **Dispute** на любом этапе после Payment

## Безопасность

- Все функции требуют аутентификации JWT токеном
- Claim tokens имеют короткий TTL (24 часа)
- Download tokens имеют еще более короткий TTL (1 час)
- Подписи Ed25519 для подтверждения доставки
- Политики доступа и отзыва на уровне трансферов

## Тестирование

Для тестирования без настроенного Stripe:
- Функции возвращают mock URLs
- Webhook принимает тестовые события без проверки подписи
- Все функции логируют действия в консоль

## Интеграции

- **База данных:** PostgreSQL через Drizzle ORM
- **Хранилище:** Netlify Blobs для чанков продуктов
- **Платежи:** Stripe Checkout + Webhooks
- **Сообщения:** AilockMessageService (TODO)
- **Криптография:** X25519 + AES-256-GCM + Ed25519
