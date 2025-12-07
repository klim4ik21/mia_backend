# Mia Notification Backend

Yandex Cloud Function для генерации AI-уведомлений через YandexGPT.

## 🧠 Система движков (Engines)

Проект использует многоуровневую систему движков для умных уведомлений:

- **UserContextEngine** - сбор и структурирование контекста о пользователе
- **BehavioralAnalysisEngine** - анализ поведения и предсказание намерений
- **IntentPredictionEngine** - предсказание намерений пользователя
- **BaseReminderEngine** - гарантированные базовые напоминания
- **NotificationOrchestrator** - главный оркестратор, координирующий все движки

Движки интегрированы в основной сервер через `NotificationOrchestrator`, который заменяет старый `AIPlanner` и обеспечивает более умное и стабильное планирование уведомлений.

## 🚀 Локальный запуск для тестирования

### 1. Установка зависимостей
```bash
cd backend
npm install
```

### 2. Запуск локального сервера
```bash
npm start
# или
node server.js
```

Сервер запустится на `http://localhost:3000`

### 3. Тестирование

#### С помощью curl:
```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d @test-request.json
```

#### Или вручную:
```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{
    "habit": {
      "name": "Пить воду",
      "emoji": "💧",
      "averageCompletionHour": 10,
      "snoozeCount": 3,
      "topSnoozeReason": "не дома",
      "currentStreak": 5,
      "completionPattern": "morning",
      "needsMotivation": false
    },
    "currentTime": "10:00",
    "dayOfWeek": "Wednesday",
    "notificationType": "reminder"
  }'
```

### 4. Обновление URL в iOS приложении

В `NotificationService.swift` измени URL на локальный:
```swift
private let apiURL = "http://localhost:3000"  // Для симулятора
// или
private let apiURL = "http://192.168.1.X:3000"  // Для реального устройства (замени на IP твоего Mac)
```

**Важно:** 
- Для симулятора используй `localhost:3000`
- Для реального устройства нужен IP адрес твоего Mac в локальной сети

## 📦 Деплой в Yandex Cloud Functions

1. Установи [Yandex Cloud CLI](https://cloud.yandex.ru/docs/cli/quickstart)
2. Создай функцию:
```bash
yc serverless function create --name mia-notification-generator
```
3. Загрузи код:
```bash
yc serverless function version create \
  --function-name mia-notification-generator \
  --runtime nodejs18 \
  --entrypoint index.handler \
  --memory 128m \
  --execution-timeout 30s \
  --source-path .
```
4. Получи URL функции и обнови в `NotificationService.swift`

## 🔑 API ключи

⚠️ **ВНИМАНИЕ:** API ключ захардкожен в `index.js` для тестирования. 

Для продакшена:
1. Используй переменные окружения Yandex Cloud Functions
2. Или создай `.env` файл (не коммить в git!)

## 📝 Формат запроса

```json
{
  "habit": {
    "name": "string",
    "emoji": "string",
    "averageCompletionHour": number | null,
    "snoozeCount": number,
    "topSnoozeReason": "string" | null,
    "currentStreak": number,
    "completionPattern": "string" | null,
    "lastCompletionDate": "string" | null,
    "needsMotivation": boolean
  },
  "currentTime": "HH:mm",
  "dayOfWeek": "string",
  "notificationType": "reminder" | "motivation" | "celebration" | "personalized"
}
```

## 📤 Формат ответа

```json
{
  "message": "🐱 Мяу! Время для 💧 Пить воду!",
  "type": "reminder",
  "context": "Напоминание в обычное время"
}
```

