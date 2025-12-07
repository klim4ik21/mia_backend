// Notification Orchestrator
// Главный оркестратор, который гарантирует стабильные напоминания + умные уведомления

const UserContextEngine = require('./user-context-engine');
const BehavioralAnalysisEngine = require('./behavioral-analysis-engine');
const IntentPredictionEngine = require('./intent-prediction-engine');
const BaseReminderEngine = require('./base-reminder-engine');

class NotificationOrchestrator {
  constructor(yandexGPT) {
    this.contextEngine = new UserContextEngine();
    this.behaviorEngine = new BehavioralAnalysisEngine();
    this.intentEngine = new IntentPredictionEngine();
    this.baseReminderEngine = new BaseReminderEngine();
    this.yandexGPT = yandexGPT;
  }

  /**
   * Главный метод: создание уведомлений для привычки
   * ГАРАНТИРУЕТ:
   * 1. Базовые напоминания всегда создаются (стабильность)
   * 2. Умные уведомления добавляются на основе контекста
   * 3. Все тексты обогащаются через AI
   */
  async createNotifications(habit, userId, userProfile = {}, now, timezone) {
    const allNotifications = [];
    
    // Подготавливаем данные
    const completions = habit.completions || [];
    const snoozeEvents = habit.snoozeEvents || [];
    const missedEvents = habit.missedEvents || [];
    
    // ШАГ 1: Сбор контекста (включая автоматический трекинг пропусков)
    const context = {
      temporal: this.contextEngine.getTemporalContext(now, timezone),
      habit: this.contextEngine.getHabitContext(habit, completions, snoozeEvents, missedEvents, now),
      user: this.contextEngine.getUserContext(userId, userProfile),
      external: this.contextEngine.getExternalContext(now)
    };
    
    // Если были созданы новые missed events, логируем их
    if (context.habit.newMissedEvents && context.habit.newMissedEvents.length > 0) {
      console.log(`📊 [Orchestrator] Detected ${context.habit.newMissedEvents.length} new missed days for ${habit.name}`);
    }
    
    // ШАГ 2: КРИТИЧЕСКИ ВАЖНО - создаем базовые напоминания
    // Это гарантирует стабильность системы
    const baseReminders = this.baseReminderEngine.createBaseReminders(
      habit,
      now,
      timezone,
      habit.completions || []
    );
    
    console.log(`📌 [Orchestrator] Created ${baseReminders.length} base reminders for ${habit.name}`);
    
    // ШАГ 3: Обогащаем базовые напоминания AI-текстом
    const enrichedBaseReminders = await Promise.all(
      baseReminders.map(reminder => 
        this.baseReminderEngine.enrichWithAIText(reminder, habit, context, this.yandexGPT)
      )
    );
    
    allNotifications.push(...enrichedBaseReminders);
    
    // ШАГ 4: Анализ поведения (с использованием missedEvents)
    const allMissedEvents = [...missedEvents, ...(context.habit.newMissedEvents || [])];
    const behavior = this.behaviorEngine.analyzeCompletionPattern(
      habit,
      completions,
      snoozeEvents,
      allMissedEvents,
      now
    );
    behavior.probability = this.behaviorEngine.predictCompletionProbability(
      habit,
      context,
      completions,
      snoozeEvents,
      allMissedEvents,
      now
    );
    
    // ШАГ 5: Предсказание намерений
    const intent = this.intentEngine.predictUserIntent(
      habit,
      context,
      behavior,
      completions,
      snoozeEvents
    );
    const emotionalState = this.intentEngine.detectEmotionalState(
      habit,
      context,
      behavior,
      completions,
      snoozeEvents
    );
    
    // Логируем статистику пропусков для аналитики
    if (allMissedEvents.length > 0) {
      console.log(`📊 [Orchestrator] Missed stats for ${habit.name}:`);
      console.log(`   - Total missed: ${context.habit.missedCount}`);
      console.log(`   - Last 7 days: ${context.habit.missedCountLast7Days}`);
      console.log(`   - Consecutive: ${context.habit.consecutiveMisses}`);
    }
    
    // ШАГ 6: Создаем умные дополнительные уведомления
    // (это будет в следующем этапе - Strategy Engine)
    // Пока что базовые напоминания - это главное
    
    // ШАГ 7: Фильтрация и оптимизация
    const optimized = this.optimizeNotifications(allNotifications, habit);
    
    console.log(`✅ [Orchestrator] Final notifications for ${habit.name}: ${optimized.length}`);
    console.log(`   - Base reminders: ${enrichedBaseReminders.length}`);
    
    // Возвращаем уведомления и новые missed events для сохранения на клиенте
    return {
      notifications: optimized,
      newMissedEvents: context.habit.newMissedEvents || []
    };
  }

  /**
   * Оптимизация уведомлений
   * Убирает дубликаты, проверяет временные ограничения
   */
  optimizeNotifications(notifications, habit) {
    // Сортируем по времени
    const sorted = notifications.sort((a, b) => a.timestamp - b.timestamp);
    
    // Убираем дубликаты (если несколько напоминаний в одно время)
    const unique = [];
    const seen = new Set();
    
    for (const notif of sorted) {
      const key = `${notif.habitId}-${notif.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(notif);
      }
    }
    
    // Проверяем quiet hours (22:00 - 07:00)
    const filtered = unique.filter(notif => {
      const date = new Date(notif.timestamp);
      const hour = date.getHours();
      return hour >= 7 && hour < 22;
    });
    
    return filtered;
  }
}

module.exports = NotificationOrchestrator;

