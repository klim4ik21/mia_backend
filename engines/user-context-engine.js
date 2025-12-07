// User Context Engine - Layer 1
// Собирает и структурирует весь контекст о пользователе

class UserContextEngine {
  /**
   * Временной контекст
   */
  getTemporalContext(now = new Date(), timezone = 'UTC') {
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const dayOfMonth = now.getDate();
    const month = now.getMonth();
    
    // Определение времени дня
    let timeOfDay;
    if (hour >= 5 && hour < 12) {
      timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = 'afternoon';
    } else if (hour >= 17 && hour < 22) {
      timeOfDay = 'evening';
    } else {
      timeOfDay = 'night';
    }
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return {
      timeOfDay,
      dayOfWeek: dayNames[dayOfWeek],
      dayOfMonth,
      month,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isHoliday: false, // TODO: добавить проверку праздников
      timezone,
      localTime: now,
      hour,
      minute: now.getMinutes()
    };
  }

  /**
   * Контекст привычки
   */
  getHabitContext(habit, completions = [], snoozeEvents = []) {
    // Расчет статистики
    const streak = this.calculateStreak(completions);
    const completionRate = this.calculateCompletionRate(completions, habit.createdAt);
    const averageCompletionTime = this.calculateAverageCompletionTime(completions);
    const bestCompletionTime = this.findBestCompletionTime(completions);
    const worstCompletionTime = this.findWorstCompletionTime(completions);
    
    // Анализ паттернов
    const completionPattern = this.analyzeCompletionPattern(completions);
    const weeklyPattern = this.calculateWeeklyPattern(completions);
    
    // Эмоциональная связь
    const lastSnoozeEvent = snoozeEvents.length > 0 ? snoozeEvents[snoozeEvents.length - 1] : null;
    const lastSnoozeReason = lastSnoozeEvent?.reason || null;
    const snoozeFrequency = this.calculateSnoozeFrequency(snoozeEvents, completions);
    const emotionalConnection = this.assessEmotionalConnection(streak, completionRate, snoozeFrequency);
    
    // Прогресс к milestone
    const milestones = [7, 14, 30, 100];
    const nextMilestone = milestones.find(m => m > streak) || null;
    const daysToMilestone = nextMilestone ? nextMilestone - streak : null;
    const isAtRisk = this.isStreakAtRisk(streak, completions);
    
    return {
      // Статистика
      streak,
      completionRate,
      averageCompletionTime,
      bestCompletionTime,
      worstCompletionTime,
      
      // Паттерны
      completionPattern, // "consistent" | "irregular" | "declining" | "improving"
      weeklyPattern,
      
      // Эмоциональная связь
      emotionalConnection, // "strong" | "moderate" | "weak"
      lastSnoozeReason,
      snoozeFrequency,
      
      // Прогресс
      milestoneProgress: {
        nextMilestone,
        daysToMilestone,
        isAtRisk
      }
    };
  }

  /**
   * Контекст пользователя (требует хранения профиля)
   */
  getUserContext(userId, userProfile = {}) {
    return {
      // Профиль активности
      activityProfile: {
        mostActiveHour: userProfile.mostActiveHour || 10,
        leastActiveHour: userProfile.leastActiveHour || 2,
        preferredNotificationTime: userProfile.preferredNotificationTime || null,
        responseTimeToNotifications: userProfile.responseTimeToNotifications || null // минуты
      },
      
      // Эмоциональный профиль
      emotionalProfile: {
        currentState: userProfile.currentState || 'stable', // "motivated" | "struggling" | "stable" | "declining"
        needsEncouragement: userProfile.needsEncouragement || false,
        respondsTo: {
          challenges: userProfile.respondsToChallenges !== false,
          support: userProfile.respondsToSupport !== false,
          facts: userProfile.respondsToFacts !== false,
          celebrations: userProfile.respondsToCelebrations !== false
        },
        preferredTone: userProfile.preferredTone || 'friendly' // "friendly" | "professional" | "casual" | "motivational"
      },
      
      // История взаимодействий
      interactionHistory: {
        lastNotificationReaction: userProfile.lastNotificationReaction || null, // "completed" | "snoozed" | "ignored"
        notificationEffectiveness: userProfile.notificationEffectiveness || {
          reminder: 0.5,
          motivation: 0.5,
          celebration: 0.5,
          challenge: 0.5
        },
        bestNotificationTimes: userProfile.bestNotificationTimes || [],
        worstNotificationTimes: userProfile.worstNotificationTimes || []
      },
      
      // Жизненный контекст
      lifeContext: {
        workSchedule: userProfile.workSchedule || 'unknown', // "9to5" | "flexible" | "night" | "unknown"
        typicalDayStructure: userProfile.typicalDayStructure || {
          wakeUp: 7,
          workStart: 9,
          lunch: 13,
          workEnd: 18,
          sleep: 23
        }
      }
    };
  }

  /**
   * Внешний контекст
   */
  getExternalContext(now = new Date()) {
    const month = now.getMonth();
    let season;
    if (month >= 2 && month <= 4) season = 'spring';
    else if (month >= 5 && month <= 7) season = 'summer';
    else if (month >= 8 && month <= 10) season = 'autumn';
    else season = 'winter';
    
    return {
      weather: {
        condition: null, // TODO: интеграция с weather API
        temperature: null
      },
      season
    };
  }

  // MARK: - Helper Methods

  calculateStreak(completions) {
    if (!completions || completions.length === 0) return 0;
    
    // Сортируем по дате (новые первыми)
    const sorted = [...completions].sort((a, b) => b.timestamp - a.timestamp);
    
    // Группируем по дням
    const days = new Set();
    sorted.forEach(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      days.add(date.getTime());
    });
    
    // Проверяем последовательность дней
    const dayArray = Array.from(days).sort((a, b) => b - a);
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    for (let i = 0; i < dayArray.length; i++) {
      const expectedDay = todayTime - (i * 24 * 60 * 60 * 1000);
      if (dayArray[i] === expectedDay) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  calculateCompletionRate(completions, createdAt) {
    if (!completions || completions.length === 0) return 0;
    
    const now = new Date();
    const daysSinceCreation = Math.max(1, Math.floor((now - new Date(createdAt)) / (24 * 60 * 60 * 1000)));
    
    // Уникальные дни с выполнением
    const completionDays = new Set();
    completions.forEach(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      completionDays.add(date.getTime());
    });
    
    return completionDays.size / daysSinceCreation;
  }

  calculateAverageCompletionTime(completions) {
    if (!completions || completions.length === 0) return null;
    
    const hours = completions.map(c => new Date(c.timestamp).getHours());
    const sum = hours.reduce((a, b) => a + b, 0);
    return Math.round(sum / hours.length);
  }

  findBestCompletionTime(completions) {
    if (!completions || completions.length === 0) return null;
    
    // Находим час, когда чаще всего выполняют
    const hourCounts = {};
    completions.forEach(c => {
      const hour = new Date(c.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    let maxCount = 0;
    let bestHour = null;
    for (const [hour, count] of Object.entries(hourCounts)) {
      if (count > maxCount) {
        maxCount = count;
        bestHour = parseInt(hour);
      }
    }
    
    return bestHour;
  }

  findWorstCompletionTime(completions) {
    // Противоположность лучшему времени (можно улучшить логику)
    const bestTime = this.findBestCompletionTime(completions);
    return bestTime ? (bestTime + 12) % 24 : null;
  }

  analyzeCompletionPattern(completions) {
    if (!completions || completions.length < 7) return 'irregular';
    
    // Анализируем последние 7 дней
    const now = new Date();
    const last7Days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      last7Days.push(date.getTime());
    }
    
    const completionDays = new Set();
    completions.forEach(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      if (last7Days.includes(date.getTime())) {
        completionDays.add(date.getTime());
      }
    });
    
    const completionRate = completionDays.size / 7;
    
    if (completionRate >= 0.8) return 'consistent';
    if (completionRate >= 0.5) return 'irregular';
    if (completionRate >= 0.3) return 'declining';
    return 'declining';
  }

  calculateWeeklyPattern(completions) {
    const pattern = {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0
    };
    
    if (!completions || completions.length === 0) return pattern;
    
    completions.forEach(c => {
      const date = new Date(c.timestamp);
      const day = date.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      pattern[dayNames[day]]++;
    });
    
    // Нормализуем (делаем проценты)
    const total = Object.values(pattern).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const key in pattern) {
        pattern[key] = pattern[key] / total;
      }
    }
    
    return pattern;
  }

  calculateSnoozeFrequency(snoozeEvents, completions) {
    if (!snoozeEvents || snoozeEvents.length === 0) return 0;
    if (!completions || completions.length === 0) return 1; // только snooze, нет выполнений
    
    return snoozeEvents.length / (snoozeEvents.length + completions.length);
  }

  assessEmotionalConnection(streak, completionRate, snoozeFrequency) {
    if (streak > 14 && completionRate > 0.8 && snoozeFrequency < 0.2) {
      return 'strong';
    }
    if (streak > 7 && completionRate > 0.6 && snoozeFrequency < 0.4) {
      return 'moderate';
    }
    return 'weak';
  }

  isStreakAtRisk(streak, completions) {
    if (streak === 0) return false;
    
    // Проверяем, был ли streak сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    const hasCompletionToday = completions.some(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === todayTime;
    });
    
    // Если streak > 5 и нет выполнения сегодня - риск
    return streak > 5 && !hasCompletionToday;
  }
}

module.exports = UserContextEngine;

