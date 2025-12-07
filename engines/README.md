# Notification Engines

Многоуровневая система engines для умных уведомлений.

## Структура

### Layer 1: User Context Engine
Собирает и структурирует весь контекст о пользователе:
- Временной контекст (время дня, день недели)
- Контекст привычки (streak, паттерны, прогресс)
- Контекст пользователя (профиль активности, эмоциональный профиль)
- Внешний контекст (погода, сезон)
- **Статистика пропусков** (missedCount, missedCountLast7Days, consecutiveMisses)

### Layer 2: Behavioral Analysis Engine
Анализирует поведение и предсказывает намерения:
- Анализ паттернов выполнения
- Расчет momentum (импульса)
- Выявление рисков и возможностей
- Предсказание вероятности выполнения
- **Анализ пропусков** через MissedTracker

### Missed Tracker Service
Автоматически проверяет и трекает пропущенные дни:
- `checkAndTrackMissedDays()` - проверка и создание missed events
- `getMissedCount()` - общее количество пропусков
- `getMissedCountLast7Days()` - пропуски за последние 7 дней
- `getConsecutiveMissedDays()` - подряд пропущенных дней

## Использование

```javascript
const { UserContextEngine, BehavioralAnalysisEngine } = require('./engines');

const contextEngine = new UserContextEngine();
const behaviorEngine = new BehavioralAnalysisEngine();

// Сбор контекста
const temporalContext = contextEngine.getTemporalContext();
const habitContext = contextEngine.getHabitContext(habit, completions, snoozeEvents);
const userContext = contextEngine.getUserContext(userId, userProfile);
const externalContext = contextEngine.getExternalContext();

// Анализ поведения
const behavior = behaviorEngine.analyzeCompletionPattern(habit, completions, snoozeEvents);
const probability = behaviorEngine.predictCompletionProbability(habit, context, completions, snoozeEvents);
```

## Следующие шаги

- Layer 3: Intent Prediction Engine
- Layer 4: Notification Strategy Engine
- Layer 5: Content Generation Engine
- Layer 6: Timing Optimization Engine
- Layer 7: Feedback Learning Engine

