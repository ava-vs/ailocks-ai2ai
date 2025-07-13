# План реализации TD-009: Приватность сообщений в карточке интента (Версия 2.0)

> **Задача:** TD-009 | **Сообщения между Айлоками** — только автор и адресат сообщения должны видеть сообщения в карточке интента.
> **Приоритет:** High
> **Оценка:** 1 день

## 1. Обзор

Цель этой задачи — реализовать **новую** функциональность для безопасной загрузки и отображения сообщений (`ailock_interactions`), связанных с конкретным интентом, в компоненте `IntentDetailModal.tsx`. На текущий момент такой функциональности не существует.

**Критерии приемки:**
- При открытии модального окна интента загружаются все связанные с ним сообщения.
- Сообщения видны **только** авторизованным пользователям:
    - Для личных сообщений: отправителю и получателю.
    - Для групповых интентов: всем участникам связанной группы.
- Решение должно быть производительным и выполнять фильтрацию на уровне базы данных, а не в коде приложения.

## 2. План реализации

План разделен на два этапа: Backend (создание безопасного API) и Frontend (интеграция API в UI).

### Этап 1: Backend — Создание нового действия в `ailock-batch.ts`

Вместо создания отдельной функции, мы добавим новую операцию `get_intent_interactions` в существующую пакетную функцию `netlify/functions/ailock-batch.ts`. Это соответствует архитектуре проекта и позволяет в будущем комбинировать запросы.

**Файл для модификации:** `netlify/functions/ailock-batch.ts`

**Шаги:**

1.  **Добавить обработку нового действия `get_intent_interactions`:**
    Внутри функции `handler` добавить `case` для новой операции. Она будет принимать `intentId` в качестве параметра.

2.  **Получить ID текущего пользователя и его Айлока:**
    Из контекста Netlify-функции извлечь `userId` и, сделав запрос к БД, найти соответствующий `ailockId`.

3.  **Создать производительный SQL-запрос (SotA-подход):**
    Ключевое отличие этого плана — реализация всей логики авторизации в одном SQL-запросе с использованием `UNION` и `JOIN`. Это намного эффективнее, чем извлекать все данные и фильтровать их в коде.

    Нам нужно будет построить комплексный запрос, который выберет сообщения, удовлетворяющие одному из следующих условий:
    -   Сообщение является прямым (имеет `to_ailock_id`), и `currentUserAilockId` является либо отправителем, либо получателем.
    -   Интент является групповым, и `userId` текущего пользователя состоит в этой группе.

    **Примерная структура SQL-запроса (используя Drizzle ORM):**
    ```typescript
    // Внутри case 'get_intent_interactions':
    const { intentId } = request.body;
    const { user } = context.clientContext;
    const userId = user.sub;

    const userAilock = await db.query.ailocks.findFirst({ where: eq(schema.ailocks.userId, userId) });
    const currentUserAilockId = userAilock?.id;

    if (!currentUserAilockId) {
        return { statusCode: 403, body: JSON.stringify({ message: 'Ailock not found for user' })};
    }

    // Находим, связан ли интент с группой
    const groupIntent = await db.query.groupIntents.findFirst({
        where: eq(schema.groupIntents.intentId, intentId),
        with: { group: { with: { members: true } } }
    });
    
    const isGroupIntent = !!groupIntent;
    const isMemberOfGroup = isGroupIntent 
        ? groupIntent.group.members.some(m => m.userId === userId) 
        : false;

    // Собираем условия для запроса
    const conditions = [];

    // Условие 1: Пользователь - отправитель или получатель прямого сообщения
    conditions.push(
        and(
            eq(schema.ailockInteractions.intentId, intentId),
            isNotNull(schema.ailockInteractions.toAilockId), // Это прямое сообщение
            or(
                eq(schema.ailockInteractions.fromAilockId, currentUserAilockId),
                eq(schema.ailockInteractions.toAilockId, currentUserAilockId)
            )
        )
    );

    // Условие 2: Интент групповой, и пользователь - участник группы
    if (isGroupIntent && isMemberOfGroup) {
        conditions.push(
             and(
                eq(schema.ailockInteractions.intentId, intentId),
                isNull(schema.ailockInteractions.toAilockId) // Это групповое сообщение
             )
        );
    }
    
    // Если нет условий, которые может удовлетворить пользователь - вернуть пустой массив
    if (conditions.length === 0) {
        return { statusCode: 200, body: JSON.stringify([]) };
    }

    const interactions = await db.query.ailockInteractions.findMany({
        where: or(...conditions),
        orderBy: [asc(schema.ailockInteractions.createdAt)],
        // ...добавляем JOIN'ы для получения имен и уровней отправителей
    });
    
    // Возвращаем результат
    return { statusCode: 200, body: JSON.stringify(interactions) };
    ```

### Этап 2: Frontend — Интеграция в `IntentDetailModal.tsx`

**Файл для модификации:** `src/components/Chat/IntentDetailModal.tsx`

**Шаги:**

1.  **Создать новую функцию в `src/lib/api.ts`:**
    Добавить функцию `getIntentInteractions(intentId: string)`, которая будет вызывать пакетный эндпоинт `ailock-batch` с новой операцией.

    ```typescript
    // в src/lib/api.ts
    export const getIntentInteractions = async (intentId: string) => {
      const response = await fetch('/.netlify/functions/ailock-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{ type: 'get_intent_interactions', intentId }]
        })
      });
      // ... обработка ответа
    };
    ```

2.  **Вызывать новую функцию в `IntentDetailModal.tsx`:**
    Использовать `useEffect` для вызова `getIntentInteractions` при открытии модального окна.

    ```typescript
    // в src/components/Chat/IntentDetailModal.tsx
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      if (isOpen && intent) {
        setIsLoading(true);
        api.getIntentInteractions(intent.id)
          .then(data => {
            // Преобразовать данные в формат, который нужен для отображения
            setMessages(data.batch_results[0].body); 
          })
          .catch(console.error)
          .finally(() => setIsLoading(false));
      }
    }, [isOpen, intent]);
    ```

3.  **Отобразить сообщения:**
    Обновить JSX для рендеринга загруженных сообщений, а также добавить состояние загрузки (`isLoading`) и обработку ошибок.


Этот обновленный план точно отражает текущее состояние проекта, устраняет предположения и предлагает более производительное и безопасное решение. 

## 3. Test-критерии

1. **Unit-тесты Backend (Jest + Drizzle mock):**
   - `handleGetIntentInteractions` возвращает 403, если пользователь не является участником диалога.
   - Запрос с валидным `intentId` и авторизованным пользователем возвращает массив `AilockInteraction` длиной > 0.
   - В случае группового интента сообщение доступно всем членам группы, остальным — 403.
2. **Integration Frontend (Vitest + React Testing Library):**
   - `IntentDetailModal` делает один запрос и рендерит полученные сообщения.
   - Клик по пузырю устанавливает `replyTo` и подсвечивает сообщение.
   - Отправка ответа добавляет новый объект в UI без повторного запроса.
3. **E2E (Playwright):**
   - Пользователь A и B могут взаимно видеть свои сообщения; пользователь C получает ошибку.

## 4. Ограничения

- **Секьюрити:** фильтрация доступа производится строго на уровне SQL; в код не передаются лишние поля.
- **Производительность:** лимит сообщений 200; для больших историй реализовать пагинацию (out of scope).
- **Совместимость:** API схема (`results[].{type, success, data|error}`) должна сохранять обратную совместимость для существующих запросов.
- **Миграции:** настоящая версия не изменяет схему БД; при будущих изменениях таблицы `ailock_interactions` необходимо обновить сервис-слой. 