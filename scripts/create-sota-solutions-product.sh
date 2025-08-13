#!/bin/bash

# Создание продукта "SotA Solutions" с расширенными полями
# Этот скрипт демонстрирует создание полноценного цифрового продукта

# Base URL для API
BASE_URL="http://localhost:8888"  # Замените на ваш URL

# Учетные данные для аутентификации
USERNAME="info@ava.capetown"
PASSWORD="1234567"

# Файл для логов
LOG_FILE="./create_sota_solutions_output.log"

# Очистка лога
> "${LOG_FILE}"

echo "Создание продукта 'SotA Solutions' через API..." | tee -a "${LOG_FILE}"

# --- Шаг 1: Аутентификация --- #
echo "Попытка входа в систему..." | tee -a "${LOG_FILE}"

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/.netlify/functions/auth-login" \
     -H "Content-Type: application/json" \
     -d "{\"email\": \"${USERNAME}\", \"password\": \"${PASSWORD}\"}")

# Извлечение статус-кода и тела ответа
LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | tail -n1)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

echo "Статус входа: ${LOGIN_STATUS}" | tee -a "${LOG_FILE}"

if [ "$LOGIN_STATUS" -ne 200 ]; then
  echo "Ошибка входа. Завершение." | tee -a "${LOG_FILE}"
  echo "Ответ: ${LOGIN_BODY}" | tee -a "${LOG_FILE}"
  exit 1
fi

# Извлечение токена доступа
TEMP_FILE="temp_login_response.json"
echo "${LOGIN_BODY}" > "${TEMP_FILE}"
ACCESS_TOKEN=$(powershell.exe -Command "(Get-Content -Raw '${TEMP_FILE}' | ConvertFrom-Json).accessToken")
rm "${TEMP_FILE}"

# Очистка возможных символов возврата каретки
ACCESS_TOKEN=$(echo "${ACCESS_TOKEN}" | tr -d '\r')

if [ -z "${ACCESS_TOKEN}" ]; then
    echo "Не удалось извлечь токен доступа:" | tee -a "${LOG_FILE}"
    echo "${LOGIN_BODY}" | tee -a "${LOG_FILE}"
    exit 1
fi

echo "Успешный вход. Токен получен." | tee -a "${LOG_FILE}"
echo "------------------------------------" | tee -a "${LOG_FILE}"

# --- Шаг 2: Получение ownerAilockId пользователя --- #
echo "Получение информации о пользователе и его Ailock ID..." | tee -a "${LOG_FILE}"

USER_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/.netlify/functions/user-profile" \
     -H "Authorization: Bearer ${ACCESS_TOKEN}")

USER_STATUS=$(echo "$USER_RESPONSE" | tail -n1)
USER_BODY=$(echo "$USER_RESPONSE" | sed '$d')

echo "Статус получения пользователя: ${USER_STATUS}" | tee -a "${LOG_FILE}"

if [ "$USER_STATUS" -ne 200 ]; then
  echo "Ошибка получения данных пользователя. Используем тестовый Ailock ID." | tee -a "${LOG_FILE}"
  OWNER_AILOCK_ID="550e8400-e29b-41d4-a716-446655440000"
else
  # Извлечение Ailock ID из ответа
  TEMP_FILE="temp_user_response.json"
  echo "${USER_BODY}" > "${TEMP_FILE}"
  OWNER_AILOCK_ID=$(powershell.exe -Command "(Get-Content -Raw '${TEMP_FILE}' | ConvertFrom-Json).ailock.id")
  rm "${TEMP_FILE}"
  
  # Очистка возможных символов возврата каретки
  OWNER_AILOCK_ID=$(echo "${OWNER_AILOCK_ID}" | tr -d '\r')
fi

if [ -z "${OWNER_AILOCK_ID}" ]; then
    echo "Не удалось получить Ailock ID. Используем тестовый ID." | tee -a "${LOG_FILE}"
    OWNER_AILOCK_ID="550e8400-e29b-41d4-a716-446655440000"
fi

echo "Owner Ailock ID: ${OWNER_AILOCK_ID}" | tee -a "${LOG_FILE}"
echo "------------------------------------" | tee -a "${LOG_FILE}"

# --- Шаг 3: Создание продукта SotA Solutions --- #
echo "Создание продукта 'SotA Solutions'..." | tee -a "${LOG_FILE}"

# Генерация тестового хеша контента (SHA-256)
CONTENT_HASH=$(echo "sota-solutions-content-$(date +%s)" | sha256sum | cut -d' ' -f1)

# Создание расширенного JSON payload для продукта
PRODUCT_PAYLOAD=$(cat <<EOF
{
  "ownerAilockId": "${OWNER_AILOCK_ID}",
  "title": "SotA Solutions",
  "description": "Предлагаем для вашей проблемы подбор оптимального решения, основанного на наилучших известных подходах и практиках",
  "shortDescription": "Подбор оптимальных решений на основе лучших практик",
  "price": 99.00,
  "currency": "USD",
  "status": "published",
  "category": "solutions",
  "tags": ["solutions", "best-practices", "optimization", "consulting"],
  "licenseType": "single_use",
  "licenseTerms": "Однократное использование решения для одного проекта. Передача третьим лицам запрещена.",
  "previewContent": "Демонстрационный контент: анализ проблемы -> подбор решений -> рекомендации по внедрению",
  "version": "1.0.0",
  "contentType": "application/json",
  "size": 2048576,
  "contentHash": "${CONTENT_HASH}",
  "requirements": {
    "minExperience": "intermediate",
    "timeToImplement": "1-2 weeks",
    "supportedPlatforms": ["web", "mobile", "desktop"]
  },
  "seoTitle": "SotA Solutions - Оптимальные решения для вашего бизнеса",
  "seoDescription": "Получите подборку лучших решений для вашей задачи, основанных на проверенных практиках и современных подходах",
  "seoKeywords": ["решения", "практики", "оптимизация", "консалтинг", "sota"],
  "featured": true,
  "policy": {
    "allowDownload": true,
    "maxDownloads": 5,
    "expiresAt": "2025-12-31T23:59:59Z"
  },
  "changelog": [
    {
      "version": "1.0.0",
      "date": "2025-01-13",
      "changes": ["Первый релиз продукта", "Базовая функциональность подбора решений"]
    }
  ]
}
EOF
)

# Очистка возможных символов возврата каретки
CLEAN_PRODUCT_PAYLOAD=$(echo "${PRODUCT_PAYLOAD}" | tr -d '\r')

PRODUCT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/.netlify/functions/products-create" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ${ACCESS_TOKEN}" \
     -d "${CLEAN_PRODUCT_PAYLOAD}")

# Извлечение статус-кода и тела ответа
PRODUCT_STATUS=$(echo "$PRODUCT_RESPONSE" | tail -n1)
PRODUCT_BODY=$(echo "$PRODUCT_RESPONSE" | sed '$d')

echo "Статус создания продукта: ${PRODUCT_STATUS}" | tee -a "${LOG_FILE}"
echo "Ответ создания продукта:" | tee -a "${LOG_FILE}"
echo "${PRODUCT_BODY}" | tee -a "${LOG_FILE}"

if [ "$PRODUCT_STATUS" -ne 201 ] && [ "$PRODUCT_STATUS" -ne 200 ]; then
  echo "Ошибка создания продукта. Статус: $PRODUCT_STATUS" | tee -a "${LOG_FILE}"
  exit 1
fi

# Извлечение Product ID
TEMP_FILE="temp_product_response.json"
echo "${PRODUCT_BODY}" > "${TEMP_FILE}"
PRODUCT_ID=$(powershell.exe -Command "(Get-Content -Raw '${TEMP_FILE}' | ConvertFrom-Json).productId")
rm "${TEMP_FILE}"

# Очистка возможных символов возврата каретки
PRODUCT_ID=$(echo "${PRODUCT_ID}" | tr -d '\r')

if [ -z "${PRODUCT_ID}" ]; then
    echo "Не удалось извлечь Product ID из ответа:" | tee -a "${LOG_FILE}"
    echo "${PRODUCT_BODY}" | tee -a "${LOG_FILE}"
    exit 1
fi

echo "Новый Product ID: ${PRODUCT_ID}" | tee -a "${LOG_FILE}"
echo "------------------------------------" | tee -a "${LOG_FILE}"

# --- Шаг 4: Создание скидки для продукта (опционально) --- #
echo "Создание промо-скидки для продукта..." | tee -a "${LOG_FILE}"

DISCOUNT_PAYLOAD=$(cat <<EOF
{
  "productId": "${PRODUCT_ID}",
  "name": "Скидка раннего доступа",
  "description": "20% скидка для первых покупателей",
  "discountType": "percentage",
  "value": 20.00,
  "code": "EARLY20",
  "maxUses": 50,
  "startsAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "expiresAt": "2025-02-28T23:59:59Z"
}
EOF
)

CLEAN_DISCOUNT_PAYLOAD=$(echo "${DISCOUNT_PAYLOAD}" | tr -d '\r')

# Примечание: этот эндпоинт нужно будет создать в API
echo "Скидка будет создана через отдельный API эндпоинт (требует реализации)" | tee -a "${LOG_FILE}"

echo "------------------------------------" | tee -a "${LOG_FILE}"
echo "Продукт 'SotA Solutions' успешно создан!" | tee -a "${LOG_FILE}"
echo "Product ID: ${PRODUCT_ID}" | tee -a "${LOG_FILE}"
echo "Цена: \$99.00 USD" | tee -a "${LOG_FILE}"
echo "Статус: Опубликован" | tee -a "${LOG_FILE}"

exit 0
