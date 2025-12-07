// Behavioral Analysis Engine - Layer 2
// Анализирует поведение и предсказывает намерения

class BehavioralAnalysisEngine {
  /**
   * Анализ паттернов выполнения
   */
  analyzeCompletionPattern(habit, completions = [], snoozeEvents = []) {
    const trend = this.calculateTrend(completions);
    const momentum = this.calculateMomentum(completions);
    
    return {
      // Тренд
      trend, // "improving" | "stable" | "declining"
      
      // Momentum (импульс)
      momentum, // "strong" | "moderate" | "weak" | "negative"
      
      // Риски
      risks: {
        streakAtRisk: this.isStreakAtRisk(habit, completions),
        motivationDeclining: this.isMotivationDeclining(completions, snoozeEvents),
        habitForming: this.isHabitForming(habit, completions) // первые 21-66 дней
      },
      
      // Возможности
      opportunities: {
        canBreakRecord: this.canBreakRecord(habit, completions),
        canReachMilestone: this.canReachMilestone(habit, completions),
        optimalTimeWindow: this.findOptimalTimeWindow(completions)
      }
    };
  }

  /**
   * Предсказание вероятности выполнения
   */
  predictCompletionProbability(habit, context, completions = [], snoozeEvents = []) {
    let probability = 0.5; // базовая вероятность
    
    const streak = this.calculateStreak(completions);
    const completionRate = this.calculateCompletionRate(completions, habit.createdAt);
    const consecutiveMisses = this.calculateConsecutiveMisses(completions);
    const lastSnoozeReason = snoozeEvents.length > 0 ? snoozeEvents[snoozeEvents.length - 1].reason : null;
    
    // Факторы, увеличивающие вероятность
    const bestTime = this.findBestCompletionTime(completions);
    if (bestTime !== null && context.temporal.hour === bestTime) {
      probability += 0.2;
    }
    
    if (streak > 7) {
      probability += 0.15; // инерция streak
    }
    
    if (context.temporal.isWeekend) {
      // Проверяем weekend completion rate
      const weekendRate = this.calculateWeekendCompletionRate(completions);
      if (weekendRate > 0.8) {
        probability += 0.1;
      }
    }
    
    if (completionRate > 0.8) {
      probability += 0.1; // высокая consistency
    }
    
    // Факторы, уменьшающие вероятность
    if (consecutiveMisses > 2) {
      probability -= 0.3;
    } else if (consecutiveMisses > 0) {
      probability -= 0.15;
    }
    
    const worstTime = this.findWorstCompletionTime(completions);
    if (worstTime !== null && context.temporal.hour === worstTime) {
      probability -= 0.2;
    }
    
    if (lastSnoozeReason === 'tired' && context.temporal.timeOfDay === 'evening') {
      probability -= 0.15;
    }
    
    if (lastSnoozeReason === 'notHome' && context.temporal.timeOfDay === 'morning') {
      probability -= 0.1;
    }
    
    // Эмоциональное состояние
    if (context.user?.emotionalProfile?.currentState === 'struggling') {
      probability -= 0.2;
    } else if (context.user?.emotionalProfile?.currentState === 'motivated') {
      probability += 0.15;
    }
    
    return Math.max(0, Math.min(1, probability));
  }

  /**
   * Определение оптимальной стратегии на основе вероятности
   */
  determineOptimalStrategy(habit, context, probability) {
    if (probability > 0.7) {
      return 'gentle_reminder'; // просто напомнить
    } else if (probability > 0.4) {
      return 'motivation_boost'; // нужна мотивация
    } else if (probability > 0.2) {
      return 'challenge'; // нужен вызов
    } else {
      return 'empathy_support'; // нужна поддержка
    }
  }

  // MARK: - Helper Methods

  calculateTrend(completions) {
    if (!completions || completions.length < 14) return 'stable';
    
    // Сравниваем последние 7 дней с предыдущими 7 днями
    const now = new Date();
    const last7Days = [];
    const previous7Days = [];
    
    for (let i = 0; i < 7; i++) {
      const date1 = new Date(now);
      date1.setDate(date1.getDate() - i);
      date1.setHours(0, 0, 0, 0);
      last7Days.push(date1.getTime());
      
      const date2 = new Date(now);
      date2.setDate(date2.getDate() - (i + 7));
      date2.setHours(0, 0, 0, 0);
      previous7Days.push(date2.getTime());
    }
    
    const last7Completions = completions.filter(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      return last7Days.includes(date.getTime());
    }).length;
    
    const previous7Completions = completions.filter(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      return previous7Days.includes(date.getTime());
    }).length;
    
    if (last7Completions > previous7Completions * 1.2) return 'improving';
    if (last7Completions < previous7Completions * 0.8) return 'declining';
    return 'stable';
  }

  calculateMomentum(completions) {
    if (!completions || completions.length < 3) return 'weak';
    
    // Проверяем последние 3 дня
    const now = new Date();
    const last3Days = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      last3Days.push(date.getTime());
    }
    
    const completionsLast3Days = completions.filter(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      return last3Days.includes(date.getTime());
    }).length;
    
    if (completionsLast3Days === 3) return 'strong';
    if (completionsLast3Days === 2) return 'moderate';
    if (completionsLast3Days === 1) return 'weak';
    return 'negative';
  }

  isStreakAtRisk(habit, completions) {
    const streak = this.calculateStreak(completions);
    if (streak === 0) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    const hasCompletionToday = completions.some(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === todayTime;
    });
    
    return streak > 5 && !hasCompletionToday;
  }

  isMotivationDeclining(completions, snoozeEvents) {
    if (!completions || completions.length === 0) return true;
    
    // Если много snooze и мало completions в последние дни
    const now = new Date();
    const last3Days = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      last3Days.push(date.getTime());
    }
    
    const recentCompletions = completions.filter(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      return last3Days.includes(date.getTime());
    }).length;
    
    const recentSnoozes = snoozeEvents.filter(e => {
      const date = new Date(e.timestamp);
      date.setHours(0, 0, 0, 0);
      return last3Days.includes(date.getTime());
    }).length;
    
    return recentSnoozes > recentCompletions;
  }

  isHabitForming(habit, completions) {
    const daysSinceCreation = Math.floor((Date.now() - new Date(habit.createdAt).getTime()) / (24 * 60 * 60 * 1000));
    return daysSinceCreation < 66; // первые 66 дней
  }

  canBreakRecord(habit, completions) {
    const streak = this.calculateStreak(completions);
    if (streak === 0) return false;
    
    // Находим максимальный streak в истории
    const maxStreak = this.findMaxStreak(completions);
    return streak === maxStreak - 1; // на 1 день меньше рекорда
  }

  canReachMilestone(habit, completions) {
    const streak = this.calculateStreak(completions);
    const milestones = [7, 14, 30, 100];
    const nextMilestone = milestones.find(m => m > streak);
    return nextMilestone && (nextMilestone - streak) <= 1; // завтра достигнет milestone
  }

  findOptimalTimeWindow(completions) {
    if (!completions || completions.length === 0) return null;
    
    const bestTime = this.findBestCompletionTime(completions);
    if (bestTime === null) return null;
    
    // Оптимальное окно: за 15-30 минут до лучшего времени
    return {
      start: bestTime - 0.5, // 30 минут до
      end: bestTime + 0.5 // 30 минут после
    };
  }

  calculateStreak(completions) {
    if (!completions || completions.length === 0) return 0;
    
    const sorted = [...completions].sort((a, b) => b.timestamp - a.timestamp);
    const days = new Set();
    sorted.forEach(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      days.add(date.getTime());
    });
    
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
    
    const now = Date.now();
    const daysSinceCreation = Math.max(1, Math.floor((now - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000)));
    
    const completionDays = new Set();
    completions.forEach(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      completionDays.add(date.getTime());
    });
    
    return completionDays.size / daysSinceCreation;
  }

  calculateConsecutiveMisses(completions) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let misses = 0;
    let currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() - 1);
    
    while (misses < 10) { // проверяем максимум 10 дней назад
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const hasCompletion = completions.some(c => {
        const timestamp = new Date(c.timestamp).getTime();
        return timestamp >= dayStart.getTime() && timestamp < dayEnd.getTime();
      });
      
      if (hasCompletion) {
        break;
      } else {
        misses++;
        currentDate.setDate(currentDate.getDate() - 1);
      }
    }
    
    return misses;
  }

  findBestCompletionTime(completions) {
    if (!completions || completions.length === 0) return null;
    
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
    const bestTime = this.findBestCompletionTime(completions);
    return bestTime ? (bestTime + 12) % 24 : null;
  }

  calculateWeekendCompletionRate(completions) {
    if (!completions || completions.length === 0) return 0;
    
    const weekendCompletions = completions.filter(c => {
      const day = new Date(c.timestamp).getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    });
    
    // Предполагаем, что проверяем последние N недель
    return weekendCompletions.length / Math.max(1, completions.length);
  }

  findMaxStreak(completions) {
    if (!completions || completions.length === 0) return 0;
    
    const sorted = [...completions].sort((a, b) => a.timestamp - b.timestamp);
    const days = new Set();
    sorted.forEach(c => {
      const date = new Date(c.timestamp);
      date.setHours(0, 0, 0, 0);
      days.add(date.getTime());
    });
    
    const dayArray = Array.from(days).sort((a, b) => a - b);
    let maxStreak = 1;
    let currentStreak = 1;
    
    for (let i = 1; i < dayArray.length; i++) {
      const diff = (dayArray[i] - dayArray[i - 1]) / (24 * 60 * 60 * 1000);
      if (diff === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    
    return maxStreak;
  }
}

module.exports = BehavioralAnalysisEngine;

