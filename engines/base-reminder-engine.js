// Base Reminder Engine
// Гарантирует стабильные базовые напоминания в адекватное время
// Это критически важно - пользователь должен получать напоминания регулярно

class BaseReminderEngine {
  /**
   * Создает базовые напоминания для привычки
   * Гарантирует, что пользователь всегда получит напоминание в правильное время
   */
  createBaseReminders(habit, now, timezone, completions = []) {
    const reminders = [];
    const nowDate = new Date(now);
    const frequency = habit.frequency || 'once';
    const requiredSlots = habit.requiredSlots || ['anytime'];
    const completedSlots = habit.completedSlotsToday || [];
    
    // Определяем оптимальное время для напоминания
    const optimalTime = this.calculateOptimalReminderTime(habit, completions, nowDate);
    
    // Для каждого required slot создаем напоминания на 2 дня вперед
    for (const slot of requiredSlots) {
      const reminderHour = this.getSlotHour(slot, habit, optimalTime);
      
      // День 1 - только если слот еще не выполнен сегодня
      if (!completedSlots.includes(slot)) {
        const day1 = this.createReminderTime(nowDate, reminderHour);
        
        if (day1.getTime() > nowDate.getTime()) {
          reminders.push({
            id: this.generateId(),
            habitId: habit.id,
            title: `${habit.emoji} ${habit.name}`,
            body: this.generateBaseReminderText(habit, slot, 'today'),
            timestamp: day1.getTime(),
            type: 'base_reminder',
            slot: slot,
            priority: 'high', // Базовые напоминания всегда высокий приоритет
            isBaseReminder: true // Флаг, что это базовое напоминание
          });
        }
      }
      
      // День 2 - всегда создаем
      const day2 = new Date(nowDate);
      day2.setDate(day2.getDate() + 1);
      day2.setHours(reminderHour, 0, 0, 0);
      
      reminders.push({
        id: this.generateId(),
        habitId: habit.id,
        title: `${habit.emoji} ${habit.name}`,
        body: this.generateBaseReminderText(habit, slot, 'tomorrow'),
        timestamp: day2.getTime(),
        type: 'base_reminder',
        slot: slot,
        priority: 'high',
        isBaseReminder: true
      });
    }
    
    return reminders;
  }

  /**
   * Вычисляет оптимальное время для напоминания
   * Учитывает:
   * - Среднее время выполнения (если есть история)
   * - Предпочтительный time slot
   * - Reminder time из настроек привычки
   */
  calculateOptimalReminderTime(habit, completions, nowDate) {
    // Если есть история выполнения, используем среднее время
    if (completions && completions.length > 0) {
      const hours = completions.map(c => new Date(c.timestamp).getHours());
      const avgHour = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
      
      // Напоминаем за 15-30 минут до среднего времени выполнения
      return avgHour;
    }
    
    // Если есть reminderTime в настройках, используем его
    if (habit.reminderTime) {
      const [hour, minute] = habit.reminderTime.split(':').map(Number);
      return hour;
    }
    
    // Используем дефолтное время для time slot
    if (habit.preferredTimeSlot) {
      const slotHours = {
        'morning': 8,
        'afternoon': 14,
        'evening': 19,
        'anytime': 10
      };
      return slotHours[habit.preferredTimeSlot] || 10;
    }
    
    // Дефолт: 9:00
    return 9;
  }

  /**
   * Получает час для конкретного slot
   */
  getSlotHour(slot, habit, optimalTime) {
    const slotHours = {
      'morning': 8,
      'afternoon': 14,
      'evening': 19,
      'anytime': optimalTime || 10
    };
    
    return slotHours[slot] || optimalTime || 10;
  }

  /**
   * Создает время для напоминания
   * Учитывает, что время должно быть в будущем
   */
  createReminderTime(baseDate, hour) {
    const reminderTime = new Date(baseDate);
    reminderTime.setHours(hour, 0, 0, 0);
    
    // Если время уже прошло сегодня, переносим на завтра
    if (reminderTime.getTime() <= baseDate.getTime()) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }
    
    return reminderTime;
  }

  /**
   * Генерирует базовый текст напоминания
   * Это fallback текст, который будет использован если AI не сработает
   * Но в идеале должен быть заменен на AI-генерированный текст
   */
  generateBaseReminderText(habit, slot, dayType) {
    const slotEmojis = {
      'morning': '🌅',
      'afternoon': '☀️',
      'evening': '🌙',
      'anytime': '⭐'
    };
    
    const emoji = slotEmojis[slot] || '';
    const streak = habit.streak || 0;
    
    // Простые, но мотивирующие тексты
    if (streak > 7) {
      return `${emoji} ${streak} дней подряд! Продолжай 💪`;
    } else if (streak > 0) {
      return `${emoji} День ${streak}! Не останавливайся`;
    } else {
      return `${emoji} Время для ${habit.name}!`;
    }
  }

  /**
   * Проверяет, нужно ли создать базовое напоминание
   * Базовые напоминания создаются ВСЕГДА, независимо от других факторов
   */
  shouldCreateBaseReminder(habit, now, completions = []) {
    // Базовые напоминания создаются всегда
    // Это гарантия стабильности системы
    return true;
  }

  /**
   * Обогащает базовое напоминание AI-текстом
   * Базовое напоминание остается, но текст улучшается через AI
   * КРИТИЧЕСКИ ВАЖНО: всегда возвращает валидный текст (fallback на базовый)
   */
  async enrichWithAIText(baseReminder, habit, context, yandexGPT) {
    // Если AI недоступен, возвращаем базовый текст
    if (!yandexGPT) {
      console.log('⚠️ [BaseReminder] YandexGPT not available, using base text');
      return baseReminder;
    }
    
    try {
      // Строим расширенный контекст для AI
      const timeOfDay = context.temporal?.timeOfDay || 'anytime';
      const dayOfWeek = context.temporal?.dayOfWeek || '';
      const streak = habit.streak || 0;
      const slot = baseReminder.slot || 'anytime';
      
      // Генерируем улучшенный текст через AI с полным контекстом
      const aiText = await yandexGPT.generateText(habit, 'reminder', {
        context: `base reminder for ${slot} slot`,
        tone: 'friendly',
        habitContext: {
          streak: streak,
          name: habit.name,
          emoji: habit.emoji,
          slot: slot,
          timeOfDay: timeOfDay
        },
        temporalContext: {
          timeOfDay: timeOfDay,
          dayOfWeek: dayOfWeek,
          hour: context.temporal?.hour,
          isWeekend: context.temporal?.isWeekend
        }
      });
      
      // Проверяем, что AI вернул валидный текст
      if (aiText && aiText.trim().length > 0) {
        console.log(`✅ [BaseReminder] AI text generated: "${aiText.substring(0, 50)}..."`);
        return {
          ...baseReminder,
          body: aiText.trim(),
          enrichedWithAI: true
        };
      } else {
        console.log('⚠️ [BaseReminder] AI returned empty text, using base text');
        return baseReminder;
      }
    } catch (error) {
      console.error('❌ [BaseReminder] Failed to enrich with AI:', error.message);
      // ВСЕГДА возвращаем валидное напоминание, даже если AI не сработал
      return baseReminder;
    }
  }

  generateId() {
    return `base-reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = BaseReminderEngine;

