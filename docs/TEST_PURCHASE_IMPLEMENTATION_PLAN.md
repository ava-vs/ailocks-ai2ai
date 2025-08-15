# TEST_PURCHASE_IMPLEMENTATION_PLAN: Инициация покупки продукта «SotA Solutions» (AI2AI Product Distribution)

## 1) Цель и охват
- Цель: описать и протестировать процесс ИНИЦИАЦИИ покупки (до этапа оплаты) продукта «SotA Solutions» в экосистеме AI2AI.
- Результат: получить checkout URL Stripe для оплаты и идентификатор `transferId` для отслеживания сделки.
- Охват теста: аутентификация покупателя → определение `toAilockId` → получение/передача `productId` → запрос инвойса (checkout URL). Оплата, grant/claim/ack — вне данного плана (покрывается в e2e).

## 2) Соответствие документации
- Соответствие AI2AI Network (см. `docs/AI2AI_Network_ru.md`):
  - Раздел 4.5 «Цифровая дистрибуция (AI2AI Product Distribution)»: описывает поток Offer → Invoice → Payment → Grant → Claim → Ack, политику `required_inputs` и гейтинг до выдачи. Данный план покрывает первую часть: Invoice (получение ссылки Stripe) для опубликованного продукта («SotA Solutions»), с учётом новых обязательных данных (если заданы).
  - Ключевые эндпоинты: `products-requirements`, `transfers-requirements-submit`, `attachments-upload-*`, `products-invoice`, `payments-stripe-webhook`, `products-grant`, `products-claim`, `products-download-manifest`, `products-download-chunk`, `products-ack`, `products-offer`.
- Соответствие Implementation Plan (см. `docs/IMPLEMENTATION_PLAN_Digital_Distribution.md`):
  - Раздел «API Endpoints»: подтверждает наличие `products-requirements`, `transfers-requirements-submit` и валидацию обязательных полей на `products-invoice` (HTTP 422 при отсутствии pre-payment данных).
  - Разделы «Payments (Stripe)» и «Flows»: подтверждают, что доступ к выдаче (grant/claim) следует после события оплаты (`payments-stripe-webhook`) и выполнения post-payment обязательных данных (если заданы).

Вывод: Инициация покупки (получение платежной ссылки) полностью согласуется с архитектурой и ограничениями MVP. Мы не затрагиваем загрузку/выдачу контента до подтверждённой оплаты по вебхуку Stripe.

## 3) Предпосылки и артефакты
- Опубликованный продукт «SotA Solutions» существует и имеет `productId` (можно создать через `scripts/create-sota-solutions-product.sh`).
- У покупателя есть аккаунт (email/password) и персональный Ailock (`toAilockId` извлекается через API).
- Работающее окружение Netlify Functions локально: `http://localhost:8888` (или соответствующий `BASE_URL`).
- Авторизация: `POST /.netlify/functions/auth-login` возвращает `token` (см. пример в `scripts/create-sota-solutions-product.sh`).

## 4) Сценарий инициирования покупки (Happy Path)
0. Проверка обязательных данных (при наличии):
   - `GET /.netlify/functions/products-requirements?productId=<id>`.
   - Если есть поля с `timing = pre_payment`, подготовить значения и (при необходимости) файлы через `attachments-upload-*`.
   - Отправить значения: `POST /.netlify/functions/transfers-requirements-submit` (если известен `transferId`) ИЛИ включить объект `requiredInputs` прямо в тело `products-invoice` (см. шаг 4). Допускается пропуск шага 0 с обработкой `422 missing_inputs` на шаге 4.
1. Аутентификация покупателя: `POST /.netlify/functions/auth-login` → `token`.
2. Получение `toAilockId`: `GET /.netlify/functions/get-ailock-id` с `Authorization: Bearer <token>`.
3. Определение `productId` продукта «SotA Solutions»:
   - Вариант A: передаётся параметром скрипту.
   - Вариант B: берётся из лога `scripts/create_sota_solutions_output.log` (последняя созданная запись `Product ID: ...`).
4. Запрос инвойса: `POST /.netlify/functions/products-invoice`.
   - Рекомендуемый payload: `{ "productId", "toAilockId", "currency?", "price?", "requiredInputs?": { ... } }`.
   - Если pre-payment поля уже собраны (шаг 0), включить их в `requiredInputs`; иначе при ответе `422 missing_inputs` — перейти к обработке ошибок (раздел 5) и повторить.
   - Ожидаемый ответ: `{ "transferId", "checkoutUrl" }` или аналог (`url`, `checkoutSessionUrl`).
5. Логирование результата: вывести `transferId` и `checkoutUrl` в консоль и лог-файл.

Примечание: Если эндпоинт требует `transferId`, а не `productId`/`toAilockId`, допускается fallback:
- Сначала попытаться создать оффер/трансфер продавцом (см. `products-offer` из документации). Для тестовой инициации в ряде реализаций `products-invoice` создаёт (или находит) трансфер автоматически.

## 5) Обработка ошибок и допущения
- Если `auth-login` возвращает ≠200 — завершаем сценарий (ошибка авторизации).
- Если `get-ailock-id` возвращает ≠200 — завершаем сценарий (ошибка профиля).
- Если `products-invoice` возвращает ≠200 — завершаем сценарий (ошибка инвойса), кроме случая `422`.
- Если `products-invoice` вернул `422` с отсутствующими полями:
  - Ожидаемый ответ (пример):
    ```json
    { "error": "missing_inputs", "missing_inputs": [
      { "name": "buyer_email", "type": "text", "timing": "pre_payment" },
      { "name": "company_doc", "type": "file", "timing": "pre_payment" }
    ], "transferId": "..." }
    ```
  - Действия:
    1) Получить требования: `GET products-requirements` (для валидации полного списка).
    2) Для `type = file` — выполнить `attachments-upload-*` и получить указатели.
    3) Отправить значения: `POST transfers-requirements-submit` с `transferId` (если не вернулся — создать через `products-offer`), затем повторить `products-invoice`.
- Если `products-invoice` не найден (404/Function not found), выполняется fallback на `create-checkout-session` с `{ "planId": productId, "email": email }`.
- **ВАЖНО**: При fallback на `create-checkout-session` не возвращается `transferId`, что делает невозможным выполнение Grant/Claim/Download/Ack операций. Скрипт логирует предупреждение и пропускает эти этапы.
- Если ни один из эндпоинтов не возвращает `checkoutUrl` — завершаем сценарий (критическая ошибка).
- Если `transferId` отсутствует после invoice — Grant/Claim/Download/Ack операции пропускаются с соответствующими предупреждениями.
- Если какие-то эндпоинты отсутствуют/не реализованы, выполняется «мягкий» пропуск с логированием и завершением сценария без ошибки (см. флаг `-SimulateAck`).

## 6) Нефункциональные требования (только для инициации)
- Идемпотентность клиента не требуется (создание инвойса может быть повторным — сервер должен вернуть тот же активный checkout при повторе).
- Логирование в файл: `scripts/initiate_purchase_output.log`.
- Конфигурируемость: параметры `BaseUrl`, `Email`, `Password`, `ProductId`, `Currency`, `Price`, `DryRun`.

## 7) Тестовый подход (скриптовый уровень)
- Unit-lite (без внешних зависимостей): режим `-DryRun` проверяет формирование payload'ов и валидацию параметров без сетевых вызовов.
- Smoke: запуск без `-DryRun` в локальном окружении с опубликованным продуктом — проверяем получение `checkoutUrl`.
- Валидация: проверка кодов ответов и обязательных полей (`token`, `ailockId`, `checkoutUrl`).

## 8) Артефакты реализации
- Скрипт: `scripts/initiate-sota-solutions-purchase.ps1` (Windows/PowerShell).
- Тестовый скрипт (dry-run): `scripts/test-initiate-sota-solutions-purchase.ps1`.
- Логи выполнения: `scripts/initiate_purchase_output.log`.

## 9) Ограничения и будущие шаги (вне данного плана)
- Оплата: совершается вручную пользователем по `checkoutUrl`; подтверждение происходит асинхронно через `payments-stripe-webhook` (см. документацию).
- После оплаты: последующие шаги (`products-grant`, `products-claim`, `products-ack`) покрываются отдельным e2e-планом.

## 10) Использование (как запускать)
- Dry-Run (валидация без HTTP вызовов):
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/initiate-sota-solutions-purchase.ps1 `
    -BaseUrl http://localhost:8888 `
    -Email <buyer-email> `
    -Password <buyer-password> `
    -ProductId <product-id> `
    -DryRun
  ```
- Реальный запуск (получение `checkoutUrl`):
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/initiate-sota-solutions-purchase.ps1 `
    -BaseUrl http://localhost:8888 `
    -Email <buyer-email> `
    -Password <buyer-password> `
    -ProductId <product-id>
  ```

## 11) Этапы после оплаты (assume paid)
- В рамках данного теста считаем оплату успешной (симулируем подтверждение webhook Stripe). Это позволяет перейти к Grant → Claim → Download → Ack.
- Если какие-то эндпоинты отсутствуют/не реализованы, выполняется «мягкий» пропуск с логированием и завершением сценария без ошибки (см. флаг `-SimulateAck`).

## 12) Grant (выдача доступа)
- Если продукт содержит `required_inputs` с `timing = post_payment_pre_grant`, сервер может вернуть `409/422` (например, `pending_inputs`) до выполнения этих пунктов. В этом случае:
  - Отправить недостающие значения `POST transfers-requirements-submit` (после оплаты, с `transferId`).
  - Повторить `products-grant` после успешной валидации входных данных.
- Эндпоинт: `POST /.netlify/functions/products-grant`
- Запрос (минимально): `{ "transferId", "productId", "toAilockId" }`
- Ответ (ожидаемо): `{ "deliveryTicket", "claimToken", "expiresAt" }`
- Цель: получить `claimToken` (или эквивалент), необходимый для `claim`/`download`.

## 13) Claim (получение деталей доступа)
- Эндпоинт: `GET /.netlify/functions/products-claim` (обычно с параметром `claim` или заголовком `X-Claim`)
- Запрос: токен из шага Grant. Также передаём `Authorization: Bearer <token>` при необходимости.
- Ответ: детали доступа и/или специальный «download token» с TTL.

## 14) Download & Verify
- Эндпоинты:
  - `GET /.netlify/functions/products-download-manifest` — получить манифест (кол-во чанков, размеры, хэши)
  - `GET /.netlify/functions/products-download-chunk?index=<n>` — скачать конкретный чанк
- Маркер доступа: используем токен из Claim (как query `claim=` и/или заголовок `X-Claim`).
- Проверки:
  - Скачать 1–2 первых чанка (ограничение через параметр `DownloadMaxChunks`).
  - Вычислить SHA-256 скачанных данных (для Ack) — при возможности.
  - Логи: путь сохранения файлов, размеры, рассчитанная контрольная сумма.

## 15) Ack (подтверждение доставки)
- Эндпоинт: `POST /.netlify/functions/products-ack`
- Запрос (минимально): `{ "transferId", "contentHash", "signature" }`
  - Полноценная схема предполагает Ed25519-подпись клиентского хэша. В тестовом режиме допускается `-SimulateAck`, отправляющий плейсхолдер.
- Ответ: статус `acknowledged` (или эквивалент).

## 16) Режимы запуска и флаги
- Новые флаги скрипта `scripts/initiate-sota-solutions-purchase.ps1`:
  - `-AssumePaid` — считать оплату успешной и продолжать (по умолчанию: true)
  - `-DoGrant` / `-DoClaim` / `-DoDownload` / `-DoAck` — включение этапов (по умолчанию: true для всех)
  - `-SimulateAck` — отправить плейсхолдер-подтверждение вместо Ed25519 (по умолчанию: true)
  - `-DownloadDir` — директория для сохранения чанков (по умолчанию: `scripts/downloads`)
  - `-DownloadMaxChunks` — ограничение числа скачиваемых чанков (по умолчанию: 2)
  - `-GatherRequiredInputs` — выполнять шаг 0 с опросом требований и отправкой pre-payment полей (по умолчанию: true)
  - `-RequiredInputsJson` — путь к JSON-файлу со значениями полей `required_inputs` (для text/url)
  - `-AttachmentsDir` — директория с файлами вложений; имена файлов сопоставляются по ключам полей
  - `-SkipPostPaymentInputs` — не выполнять post-payment гейтинг (по умолчанию: false)
- В Dry-Run режиме HTTP-запросы не выполняются, но все тела/URL логируются.

## 17) Тестовый подход (расширение)
- Dry-Run проверки:
  - Наличие «would GET products-requirements», «would POST transfers-requirements-submit (pre)», «would POST products-invoice», «would POST products-grant», «would GET products-claim», «would GET products-download-manifest/chunk», «would POST products-ack» в логах.
- Smoke (реальный запуск):
  - При наличии pre-payment полей: первая попытка `products-invoice` может вернуть `422 missing_inputs` → корректная отправка `transfers-requirements-submit` → успешный повторный invoice (есть `checkoutUrl`).
  - После оплаты и при наличии post-payment полей: попытка `products-grant` может вернуть `pending_inputs` → `transfers-requirements-submit` → успешный `products-grant` → `claim` → скачивание хотя бы одного чанка.
  - Логирование хэша и успешной отправки Ack (или симуляции).

