// Intent Prediction Engine - Layer 3
// Предсказывает намерения пользователя и определяет эмоциональное состояние

class IntentPredictionEngine {
  /**
   * Определение намерения пользователя
   */
  predictUserIntent(habit, context, behavior, completions = [], snoozeEvents = []) {
    const intents = [];
    
    // Намерение: выполнить привычку
    if (this.wantsToComplete(habit, context, behavior, completions)) {
      intents.push({
        type: 'wants_to_complete',
        confidence: this.calculateConfidence('wants_to_complete', habit, context, behavior, completions),
        needs: 'timing_reminder', // нужно просто напомнить о времени
        priority: 'high'
      });
    }
    
    // Намерение: отложить
    if (this.wantsToPostpone(habit, context, behavior, snoozeEvents)) {
      intents.push({
        type: 'wants_to_postpone',
        confidence: this.calculateConfidence('wants_to_postpone', habit, context, behavior, completions),
        needs: 'gentle_push', // нужно мягко подтолкнуть
        priority: 'medium'
      });
    }
    
    // Намерение: сдаться
    if (this.wantsToGiveUp(habit, context, behavior, completions, snoozeEvents)) {
      intents.push({
        type: 'wants_to_give_up',
        confidence: this.calculateConfidence('wants_to_give_up', habit, context, behavior, completions),
        needs: 'empathy_and_support', // нужна поддержка
        priority: 'critical'
      });
    }
    
    // Намерение: продолжить streak
    if (this.wantsToContinueStreak(habit, context, behavior, completions)) {
      intents.push({
        type: 'wants_to_continue_streak',
        confidence: this.calculateConfidence('wants_to_continue_streak', habit, context, behavior, completions),
        needs: 'streak_protection', // защита streak
        priority: 'critical'
      });
    }
    
    // Намерение: достичь milestone
    if (this.wantsToReachMilestone(habit, context, behavior, completions)) {
      intents.push({
        type: 'wants_to_reach_milestone',
        confidence: this.calculateConfidence('wants_to_reach_milestone', habit, context, behavior, completions),
        needs: 'milestone_support', // поддержка для milestone
        priority: 'high'
      });
    }
    
    // Сортируем по приоритету и confidence
    intents.sort((a, b) => {
      const priorityOrder = { 'critical': 3, 'high': 2, 'medium': 1, 'low': 0 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
    
    return intents.length > 0 ? intents[0] : this.getDefaultIntent();
  }

  /**
   * Определение эмоционального состояния
   */
  detectEmotionalState(habit, context, behavior, completions = [], snoozeEvents = []) {
    const streak = this.calculateStreak(completions);
    const completionRate = this.calculateCompletionRate(completions, habit.createdAt);
    const consecutiveMisses = this.calculateConsecutiveMisses(completions);
    const snoozeFrequency = this.calculateSnoozeFrequency(snoozeEvents, completions);
    
    // Состояние: уверенный (confident)
    if (streak > 14 && completionRate > 0.9 && snoozeFrequency < 0.2) {
      return {
        state: 'confident',
        energy: 'high',
        needs: 'celebration_and_recognition',
        motivation: 'strong',
        riskLevel: 'low'
      };
    }
    
    // Состояние: борется (struggling)
    if (consecutiveMisses > 3 || (completionRate < 0.4 && snoozeFrequency > 0.5)) {
      return {
        state: 'struggling',
        energy: 'low',
        needs: 'empathy_and_gentle_encouragement',
        motivation: 'weak',
        riskLevel: 'high'
      };
    }
    
    // Состояние: строит (building)
    if (streak > 0 && streak < 7 && completionRate > 0.5) {
      return {
        state: 'building',
        energy: 'moderate',
        needs: 'support_and_consistency_reminder',
        motivation: 'moderate',
        riskLevel: 'medium'
      };
    }
    
    // Состояние: восстанавливается (recovering)
    if (consecutiveMisses > 0 && consecutiveMisses <= 2 && streak === 0) {
      const lastCompletion = completions.length > 0 ? completions[completions.length - 1] : null;
      if (lastCompletion) {
        const daysSinceLastCompletion = Math.floor(
          (Date.now() - lastCompletion.timestamp) / (24 * 60 * 60 * 1000)
        );
        if (daysSinceLastCompletion <= 3) {
          return {
            state: 'recovering',
            energy: 'moderate',
            needs: 'recovery_support',
            motivation: 'moderate',
            riskLevel: 'medium'
          };
        }
      }
    }
    
    // Состояние: стабильный (stable)
    if (streak > 7 && streak <= 14 && completionRate > 0.7) {
      return {
        state: 'stable',
        energy: 'moderate',
        needs: 'standard_reminder',
        motivation: 'moderate',
        riskLevel: 'low'
      };
    }
    
    // Состояние: нейтральный (neutral) - по умолчанию
    return {
      state: 'neutral',
      energy: 'moderate',
      needs: 'standard_reminder',
      motivation: 'moderate',
      riskLevel: 'medium'
    };
  }

  /**
   * Определение потребностей пользователя
   */
  determineUserNeeds(habit, context, behavior, intent, emotionalState) {
    const needs = [];
    
    // Критические потребности
    if (intent.type === 'wants_to_continue_streak' && behavior.risks.streakAtRisk) {
      needs.push({
        type: 'streak_protection',
        urgency: 'critical',
        description: 'Защита streak от прерывания'
      });
    }
    
    if (intent.type === 'wants_to_give_up') {
      needs.push({
        type: 'empathy_and_support',
        urgency: 'critical',
        description: 'Эмоциональная поддержка и понимание'
      });
    }
    
    // Высокоприоритетные потребности
    if (emotionalState.state === 'struggling') {
      needs.push({
        type: 'gentle_encouragement',
        urgency: 'high',
        description: 'Мягкое поощрение без давления'
      });
    }
    
    if (behavior.probability < 0.4) {
      needs.push({
        type: 'motivation_boost',
        urgency: 'high',
        description: 'Повышение мотивации'
      });
    }
    
    // Среднеприоритетные потребности
    if (intent.type === 'wants_to_reach_milestone') {
      needs.push({
        type: 'milestone_support',
        urgency: 'medium',
        description: 'Поддержка в достижении milestone'
      });
    }
    
    if (behavior.opportunities.canBreakRecord) {
      needs.push({
        type: 'challenge',
        urgency: 'medium',
        description: 'Вызов для мотивации'
      });
    }
    
    // Низкоприоритетные потребности
    if (behavior.probability > 0.7) {
      needs.push({
        type: 'timing_reminder',
        urgency: 'low',
        description: 'Простое напоминание о времени'
      });
    }
    
    return needs;
  }

  // MARK: - Intent Detection Methods

  wantsToComplete(habit, context, behavior, completions) {
    // Высокая вероятность выполнения
    if (behavior.probability > 0.6) return true;
    
    // В оптимальное время
    const bestTime = this.findBestCompletionTime(completions);
    if (bestTime !== null && Math.abs(context.temporal.hour - bestTime) <= 1) {
      return true;
    }
    
    // Сильный momentum
    if (behavior.momentum === 'strong') return true;
    
    // Стабильный паттерн
    if (behavior.trend === 'improving' || behavior.trend === 'stable') {
      return true;
    }
    
    return false;
  }

  wantsToPostpone(habit, context, behavior, snoozeEvents) {
    // Низкая вероятность выполнения
    if (behavior.probability < 0.5) return true;
    
    // Частые snooze в последнее время
    if (snoozeEvents.length > 0) {
      const recentSnoozes = snoozeEvents.filter(e => {
        const daysAgo = (Date.now() - e.timestamp) / (24 * 60 * 60 * 1000);
        return daysAgo <= 3;
      });
      if (recentSnoozes.length >= 2) return true;
    }
    
    // Не в оптимальное время
    const worstTime = this.findWorstCompletionTime(habit, context, habit.completions || []);
    if (worstTime !== null && context.temporal && context.temporal.hour === worstTime) {
      return true;
    }
    
    return false;
  }

  wantsToGiveUp(habit, context, behavior, completions, snoozeEvents) {
    // Много пропусков подряд
    const consecutiveMisses = this.calculateConsecutiveMisses(completions);
    if (consecutiveMisses > 5) return true;
    
    // Низкий completion rate и много snooze
    const completionRate = this.calculateCompletionRate(completions, habit.createdAt);
    const snoozeFrequency = this.calculateSnoozeFrequency(snoozeEvents, completions);
    if (completionRate < 0.3 && snoozeFrequency > 0.6) return true;
    
    // Снижающийся тренд
    if (behavior.trend === 'declining' && behavior.momentum === 'negative') {
      return true;
    }
    
    // Эмоциональное состояние
    if (context.user?.emotionalProfile?.currentState === 'struggling') {
      return true;
    }
    
    return false;
  }

  wantsToContinueStreak(habit, context, behavior, completions) {
    const streak = this.calculateStreak(completions);
    
    // Streak в риске
    if (behavior.risks.streakAtRisk && streak > 5) return true;
    
    // Длинный streak
    if (streak > 7) return true;
    
    // Близко к milestone
    const milestones = [7, 14, 30, 100];
    const nextMilestone = milestones.find(m => m > streak);
    if (nextMilestone && (nextMilestone - streak) <= 2) {
      return true;
    }
    
    return false;
  }

  wantsToReachMilestone(habit, context, behavior, completions) {
    const streak = this.calculateStreak(completions);
    const milestones = [7, 14, 30, 100];
    const nextMilestone = milestones.find(m => m > streak);
    
    // Завтра или сегодня достигнет milestone
    if (nextMilestone && (nextMilestone - streak) <= 1) {
      return true;
    }
    
    return false;
  }

  getDefaultIntent() {
    return {
      type: 'neutral',
      confidence: 0.5,
      needs: 'standard_reminder',
      priority: 'low'
    };
  }

  // MARK: - Helper Methods

  calculateConfidence(intentType, habit, context, behavior, completions = []) {
    let confidence = 0.5; // базовая уверенность
    
    switch (intentType) {
      case 'wants_to_complete':
        confidence = behavior.probability || 0.5;
        if (behavior.momentum === 'strong') confidence += 0.2;
        break;
        
      case 'wants_to_postpone':
        confidence = 1 - (behavior.probability || 0.5);
        if (behavior.momentum === 'negative') confidence += 0.2;
        break;
        
      case 'wants_to_give_up':
        const consecutiveMisses = this.calculateConsecutiveMisses(completions);
        confidence = Math.min(0.9, consecutiveMisses / 10);
        break;
        
      case 'wants_to_continue_streak':
        if (behavior.risks && behavior.risks.streakAtRisk) confidence = 0.9;
        else confidence = 0.7;
        break;
        
      case 'wants_to_reach_milestone':
        confidence = 0.8;
        break;
    }
    
    return Math.max(0, Math.min(1, confidence));
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
    
    while (misses < 10) {
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

  calculateSnoozeFrequency(snoozeEvents, completions) {
    if (!snoozeEvents || snoozeEvents.length === 0) return 0;
    if (!completions || completions.length === 0) return 1;
    
    return snoozeEvents.length / (snoozeEvents.length + completions.length);
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

  findWorstCompletionTime(habit, context, completions = []) {
    // Противоположность лучшему времени или неудобное время
    const bestTime = this.findBestCompletionTime(completions);
    if (bestTime !== null) {
      return (bestTime + 12) % 24;
    }
    
    // Если нет данных, используем типичные неудобные часы
    if (context.temporal && context.temporal.timeOfDay === 'night') return context.temporal.hour;
    if (context.temporal && context.temporal.timeOfDay === 'morning' && context.temporal.hour < 7) return context.temporal.hour;
    
    return null;
  }
}

module.exports = IntentPredictionEngine;

