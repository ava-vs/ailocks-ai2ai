# План развития проекта Ailocks: Ai2Ai Network до стадии MVP (Mobile & Deep Research)

## Описание целей

1. **Мобильная версия (Mobile-first UI)**
   - Обеспечить комфортную работу приложения на смартфонах (iOS/Android) с шириной экрана от 320 px.
   - Сохранить текущую архитектуру Astro (SSG + Islands) и Tailwind CSS, обеспечив адаптивность основных страниц и виджетов.

2. **Функция «Deep Research»**
   - Реализовать востребованный инструмент глубокого исследования, позволяющий пользователю задавать комплексные запросы и получать структурированное исследование с источниками, краткими выводами и ссылками.
   - Интегрировать результат в экосистему Ailock (начисление XP, использование навыка). 

## Общий план (4 недели)

| Неделя | Основные работы | Ключевые результаты |
|--------|-----------------|---------------------|
| **1** | • Аудит UI/UX и формирование дизайн-гайдов под mobile-first<br/>• Высокоуровневое проектирование «Deep Research» (скоуп, API, схема БД, UX-флоу)<br/>• Настройка CI для mobile snapshot-тестов | • Figma-макеты мобильных экранов (index, chat, профиль, my-Ailock)<br/>• Техническое ТЗ на «Deep Research»<br/>• Обновлённый CI pipeline (Playwright + Percy) |
| **2** | • Имплементация адаптивной верстки (Tailwind breakpoints `sm` `md`)<br/>• Создание Netlify Function `deep-research.ts` – orchestrator AI-pipeline (OpenAI 🔁 search API + vector DB)<br/>• Миграция БД: таблица `research_tasks` и `research_sources` | • Все ключевые страницы проходят Lighthouse Mobile ≥ 90<br/>• Endpoint `/deep-research` (POST) возвращает JSON результата<br/>• Unit-тесты функций (Vitest) покрытие ≥ 80 % |
| **3** | • Frontend компонент `DeepResearchPage.tsx` + виджет в Chat Interface<br/>• Интеграция начисления XP за успешный research (`ailock-gain-xp`)<br/>• Оптимизация кэширования на Edge (SSR fallback) | • Пользователь может запускать Deep Research из чата и просматривать прогресс<br/>• XP начисляется, отображается в AilockDashboard<br/>• End-to-end (Playwright) сценарии mobile/desktop |
| **4** | • Полировка UI, исправление багов, accessibility (WCAG AA)<br/>• Документация (/docs) + README обновления<br/>• Подготовка Demo + нетлифай deploy preview<br/>• Валидация требований MVP | • Публичная demo-ссылка (mobile-friendly)<br/>• Док-ция «Deep Research API» и «Mobile Guidelines»<br/>• Jira / GitHub Projects — все задачи статут ✅ |

## Детализация задач

### 1. Мобильная версия

- **Design:** адаптировать компоненты `Header`, `Sidebar`, `AilockWidget`, `ChatInterface` под narrow-viewport.
- **Tailwind:** добавить кастомные утилиты `@screen xs (360px)` при необходимости.
- **Navigation:** заменить hover-события на touch-friendly (например, раскрытие меню по tap).
- **Testing:** Playwright + Device Emulation (Pixel 5, iPhone SE).

### 2. Deep Research (Backend)

1. **Netlify Function `deep-research.ts`**  
   • Валидация входных параметров (`topic`, `depth`)  
   • Генерация промптов → OpenAI / Anthropic  
   • Итеративный сбор ссылок (SerpAPI / DuckDuckGo)  
   • Сохранение результатов в `research_tasks`, `research_sources`  
   • SSE-стриминг промежуточного статуса.
2. **БД schema (Drizzle)**  
   ```ts
   // ... existing code ...
   export const researchTasks = pgTable("research_tasks", { /* ... */ });
   export const researchSources = pgTable("research_sources", { /* ... */ });
   ```
3. **Unit Tests:** Vitest mocking OpenAI responses.

### 3. Deep Research (Frontend)

- **`DeepResearchPage.tsx`** – форма ввода запроса, индикатор прогресса, вывод карточек источников.
- **Chat Integration:** slash-команда `/research <query>` переносит пользователя на страницу с предзаполненным запросом.
- **UX:** возможность сохранять исследование в «Intents».

### 4. DevOps & QA

- **CI:** GitHub Actions – lint, test, build, Percy snapshots.
- **Edge Caching:** результаты research кэшируются на 24 ч для ускорения повторных запросов.
- **Monitoring:** Netlify Analytics + Sentry performance.

## KPI для стейкхолдеров

- 95 % критических страниц адаптированы под mobile.
- Deep Research время ответа ≤ 30 сек при depth = medium.
- Увеличение retention пользователей beta-группы на 20 %.
- Bug count (P0/P1) ≤ 5 к концу недельного релиз-кандидата.

## Зависимости и риски

| Риск | Вероятность | План смягчения |
|------|-------------|----------------|
| Ограничения API поисковых движков (rate limit) | Средняя | Кэширование + ротация ключей |
| Перегрузка мобильного UI из-за heavy-компонентов | Низкая | Code-splitting, lazy-load Islands |
| Время ответа AI-моделей > 30 с | Средняя | Параллельные вызовы + streaming UI |

