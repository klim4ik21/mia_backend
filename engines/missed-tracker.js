// Missed Tracker Service
// Автоматически проверяет и трекает пропущенные дни для привычек

class MissedTracker {
  /**
   * Проверяет и создает missed events для пропущенных дней
   * @param {Object} habit - объект привычки
   * @param {Array} completions - массив выполнений
   * @param {Array} snoozeEvents - массив snooze событий
   * @param {Array} existingMissedEvents - существующие missed events
   * @param {Number} now - текущее время (timestamp)
   * @returns {Array} - массив новых missed events
   */
  checkAndTrackMissedDays(habit, completions = [], snoozeEvents = [], existingMissedEvents = [], now = Date.now()) {
    const newMissedEvents = [];
    const nowDate = new Date(now);
    const habitCreatedAt = new Date(habit.createdAt);
    
    // Начинаем проверку с вчерашнего дня (не проверяем сегодня, так как день еще не закончился)
    const yesterday = new Date(nowDate);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    // Проверяем максимум 30 дней назад или с момента создания привычки
    const startDate = new Date(Math.max(
      yesterday.getTime(),
      habitCreatedAt.getTime()
    ));
    startDate.setHours(0, 0, 0, 0);
    
    // Создаем Set существующих missed events для быстрой проверки
    const existingMissedDays = new Set();
    existingMissedEvents.forEach(event => {
      const date = new Date(event.date);
      date.setHours(0, 0, 0, 0);
      existingMissedDays.add(date.getTime());
    });
    
    // Создаем Set дней с completions
    const completionDays = new Set();
    completions.forEach(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      completionDays.add(date.getTime());
    });
    
    // Создаем Set дней с snooze (snooze не считается пропуском)
    const snoozeDays = new Set();
    snoozeEvents.forEach(s => {
      const date = new Date(s.timestamp);
      date.setHours(0, 0, 0, 0);
      snoozeDays.add(date.getTime());
    });
    
    // Проверяем каждый день от вчера до начала
    let currentDate = new Date(yesterday);
    const endDate = new Date(startDate);
    
    while (currentDate.getTime() >= endDate.getTime()) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayTimestamp = dayStart.getTime();
      
      // Пропускаем если:
      // 1. Уже есть completion в этот день
      // 2. Уже есть snooze в этот день (snooze не считается пропуском)
      // 3. Уже есть missed event для этого дня
      const hasCompletion = completionDays.has(dayTimestamp);
      const hasSnooze = snoozeDays.has(dayTimestamp);
      const alreadyTracked = existingMissedDays.has(dayTimestamp);
      
      if (!hasCompletion && !hasSnooze && !alreadyTracked) {
        // Создаем новый missed event
        newMissedEvents.push({
          id: this.generateMissedEventId(habit.id, dayTimestamp),
          habitId: habit.id,
          date: dayTimestamp,
          createdAt: now
        });
      }
      
      // Переходим к предыдущему дню
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return newMissedEvents;
  }

  /**
   * Получает количество пропущенных дней за период
   * @param {Array} missedEvents - массив missed events
   * @param {Number} days - количество дней для проверки (по умолчанию все время)
   * @param {Number} now - текущее время
   * @returns {Number} - количество пропущенных дней
   */
  getMissedCount(missedEvents = [], days = null, now = Date.now()) {
    if (!missedEvents || missedEvents.length === 0) return 0;
    
    if (days === null) {
      // Возвращаем общее количество
      return missedEvents.length;
    }
    
    // Фильтруем по периоду
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);
    
    return missedEvents.filter(event => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() >= cutoffDate.getTime();
    }).length;
  }

  /**
   * Получает количество подряд пропущенных дней
   * @param {Array} missedEvents - массив missed events
   * @param {Number} now - текущее время
   * @returns {Number} - количество подряд пропущенных дней
   */
  getConsecutiveMissedDays(missedEvents = [], now = Date.now()) {
    if (!missedEvents || missedEvents.length === 0) return 0;
    
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    // Сортируем missed events по дате (новые первыми)
    const sorted = [...missedEvents].sort((a, b) => b.date - a.date);
    
    // Проверяем последовательность дней от вчера
    let consecutive = 0;
    let expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - 1); // Начинаем с вчера
    
    for (const event of sorted) {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      
      const expectedTimestamp = expectedDate.getTime();
      
      if (eventDate.getTime() === expectedTimestamp) {
        consecutive++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else if (eventDate.getTime() < expectedTimestamp) {
        // Пропуск в последовательности - останавливаемся
        break;
      }
      // Если eventDate > expectedTimestamp, пропускаем этот event (он в будущем или сегодня)
    }
    
    return consecutive;
  }

  /**
   * Получает пропуски за последние 7 дней
   * @param {Array} missedEvents - массив missed events
   * @param {Number} now - текущее время
   * @returns {Number} - количество пропусков за последние 7 дней
   */
  getMissedCountLast7Days(missedEvents = [], now = Date.now()) {
    return this.getMissedCount(missedEvents, 7, now);
  }

  /**
   * Получает пропуски за последние 30 дней
   * @param {Array} missedEvents - массив missed events
   * @param {Number} now - текущее время
   * @returns {Number} - количество пропусков за последние 30 дней
   */
  getMissedCountLast30Days(missedEvents = [], now = Date.now()) {
    return this.getMissedCount(missedEvents, 30, now);
  }

  /**
   * Генерирует уникальный ID для missed event
   */
  generateMissedEventId(habitId, dateTimestamp) {
    return `missed-${habitId}-${dateTimestamp}`;
  }

  /**
   * Проверяет, был ли пропуск в конкретный день
   * @param {Array} missedEvents - массив missed events
   * @param {Number} dateTimestamp - timestamp дня для проверки
   * @returns {Boolean} - true если был пропуск
   */
  wasMissedOnDate(missedEvents = [], dateTimestamp) {
    const targetDate = new Date(dateTimestamp);
    targetDate.setHours(0, 0, 0, 0);
    const targetTimestamp = targetDate.getTime();
    
    return missedEvents.some(event => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() === targetTimestamp;
    });
  }
}

module.exports = MissedTracker;

