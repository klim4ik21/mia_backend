// AI Planning Service - умная логика планирования уведомлений

const crypto = require('crypto');

class AIPlanner {
    constructor(yandexGPTService) {
        this.yandexGPT = yandexGPTService;
        this.MIN_HOURS_BETWEEN_NOTIFICATIONS = 3;
        this.BASE_MAX_NOTIFICATIONS = 4; // Базовый лимит за 2 дня
        this.EXTENDED_MAX_NOTIFICATIONS = 15; // Расширенный лимит для сложных случаев
        this.QUIET_HOURS_START = 22;
        this.QUIET_HOURS_END = 7;
    }

    /**
     * Планирование уведомлений для одной привычки на 2 дня
     */
    async planForHabit(habit, now, timezone) {
        const notifications = [];
        const nowDate = new Date(now);

        console.log(`\n🤖 [AI Planner] Planning for: ${habit.emoji} ${habit.name}`);

        // 1. БАЗОВЫЕ НАПОМИНАНИЯ (каждый день в указанное время)
        const baseReminders = this.createBaseReminders(habit, nowDate);
        notifications.push(...baseReminders);
        console.log(`   📝 Base reminders: ${baseReminders.length}`);

        // 2. УМНЫЕ ДОПОЛНИТЕЛЬНЫЕ УВЕДОМЛЕНИЯ
        const smartNotifications = await this.createSmartNotifications(habit, nowDate);
        notifications.push(...smartNotifications);
        console.log(`   🧠 Smart notifications: ${smartNotifications.length}`);

        // 3. Применяем лимиты и фильтры
        const filtered = this.applyLimits(notifications, habit);
        console.log(`   ✓ Final count: ${filtered.length}`);

        return filtered;
    }

    /**
     * Создание базовых напоминаний (день 1 и день 2 в reminderTime)
     * Учитывает multi-frequency (twice, thrice)
     */
    createBaseReminders(habit, nowDate) {
        const notifications = [];
        const frequency = habit.frequency || 'once';
        const requiredSlots = habit.requiredSlots || ['anytime'];
        const completedSlots = habit.completedSlotsToday || [];

        console.log(`   📋 [AI Planner] Frequency: ${frequency}, Required: ${requiredSlots.join(',')}, Completed: ${completedSlots.join(',')}`);

        // Временные слоты и их часы
        const slotHours = {
            'morning': 8,
            'afternoon': 14,
            'evening': 19,
            'anytime': parseInt(habit.reminderTime.split(':')[0]) || 9
        };

        // Для каждого required slot создаем напоминания на 2 дня
        for (const slot of requiredSlots) {
            const hour = slotHours[slot] || 9;

            // День 1 - только если слот еще не выполнен сегодня
            if (!completedSlots.includes(slot)) {
                const day1 = new Date(nowDate);
                day1.setHours(hour, 0, 0, 0);

                if (day1.getTime() > nowDate.getTime()) {
                    notifications.push({
                        id: this.generateId(),
                        habitId: habit.id,
                        title: `${habit.emoji} ${habit.name}`,
                        body: this.getBaseReminderText(habit, slot),
                        timestamp: day1.getTime(),
                        type: 'reminder',
                        slot: slot
                    });
                    console.log(`   ✓ Added reminder for ${slot} today at ${hour}:00`);
                }
            } else {
                console.log(`   ⏭️ Skipped ${slot} today (already completed)`);
            }

            // День 2 - всегда создаем
            const day2 = new Date(nowDate);
            day2.setDate(day2.getDate() + 1);
            day2.setHours(hour, 0, 0, 0);

            notifications.push({
                id: this.generateId(),
                habitId: habit.id,
                title: `${habit.emoji} ${habit.name}`,
                body: this.getBaseReminderText(habit, slot),
                timestamp: day2.getTime(),
                type: 'reminder',
                slot: slot
            });
            console.log(`   ✓ Added reminder for ${slot} tomorrow at ${hour}:00`);
        }

        return notifications;
    }

    /**
     * Создание умных уведомлений на основе аналитики
     */
    async createSmartNotifications(habit, nowDate) {
        const notifications = [];

        // a) Streak-based notifications
        if (habit.streak > 10) {
            // Празднование длинного streak
            const celebration = await this.createStreakCelebration(habit, nowDate);
            if (celebration) notifications.push(celebration);
        } else if (habit.streak === 0 && habit.consecutiveMisses > 0) {
            // Мотивация после пропусков
            const motivation = await this.createMotivationAfterMiss(habit, nowDate);
            if (motivation) notifications.push(motivation);
        } else if (habit.streak > 0 && habit.streak < 3) {
            // Поддержка нового streak
            const support = await this.createNewStreakSupport(habit, nowDate);
            if (support) notifications.push(support);
        }

        // b) Completion rate based
        if (habit.completionRate > 0.8) {
            // Позитивное подкрепление
            const positive = await this.createPositiveReinforcement(habit, nowDate);
            if (positive) notifications.push(positive);
        } else if (habit.completionRate < 0.5) {
            // Мягкая мотивация
            const gentle = await this.createGentleMotivation(habit, nowDate);
            if (gentle) notifications.push(gentle);
        }

        // c) Risk of breaking streak
        if (habit.streak > 5 && !this.wasCompletedToday(habit, nowDate)) {
            // Вечернее напоминание о streak
            const warning = this.createStreakWarning(habit, nowDate);
            if (warning) notifications.push(warning);
        }

        // d) Timing adjustments
        if (habit.avgCompletionDelay && habit.avgCompletionDelay > 60) {
            // Напоминание раньше обычного
            const early = await this.createEarlyReminder(habit, nowDate);
            if (early) notifications.push(early);
        }

        return notifications;
    }

    /**
     * Проверка, выполнена ли привычка сегодня
     */
    wasCompletedToday(habit, nowDate) {
        if (!habit.lastCompleted) return false;

        const lastCompleted = new Date(habit.lastCompleted);
        const today = new Date(nowDate);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return lastCompleted >= today && lastCompleted < tomorrow;
    }

    /**
     * Празднование streak > 10
     */
    async createStreakCelebration(habit, nowDate) {
        // Один раз в 2 дня, вечером
        const scheduledTime = this.getEveningTime(nowDate);
        if (!scheduledTime) return null;

        const text = await this.yandexGPT.generateText(habit, 'celebration', {
            context: `streak ${habit.streak} days`,
            tone: 'celebratory'
        });

        return {
            id: this.generateId(),
            habitId: habit.id,
            title: `🎉 ${habit.name}`,
            body: text,
            timestamp: scheduledTime.getTime(),
            type: 'celebration'
        };
    }

    /**
     * Мотивация после пропусков
     */
    async createMotivationAfterMiss(habit, nowDate) {
        // Через 2 часа после обычного времени
        const [hour, minute] = habit.reminderTime.split(':').map(Number);
        const scheduledTime = new Date(nowDate);
        scheduledTime.setHours(hour + 2, minute, 0, 0);

        if (scheduledTime <= nowDate || this.isQuietHours(scheduledTime)) {
            return null;
        }

        const text = await this.yandexGPT.generateText(habit, 'motivation', {
            context: `${habit.consecutiveMisses} consecutive misses`,
            tone: 'gentle push'
        });

        return {
            id: this.generateId(),
            habitId: habit.id,
            title: `${habit.emoji} ${habit.name}`,
            body: text,
            timestamp: scheduledTime.getTime(),
            type: 'motivation'
        };
    }

    /**
     * Поддержка нового streak
     */
    async createNewStreakSupport(habit, nowDate) {
        const evening = this.getEveningTime(nowDate);
        if (!evening) return null;

        const text = await this.yandexGPT.generateText(habit, 'support', {
            context: `new streak ${habit.streak} days`,
            tone: 'encouraging'
        });

        return {
            id: this.generateId(),
            habitId: habit.id,
            title: `💪 ${habit.name}`,
            body: text,
            timestamp: evening.getTime(),
            type: 'motivation'
        };
    }

    /**
     * Позитивное подкрепление
     */
    async createPositiveReinforcement(habit, nowDate) {
        const evening = this.getEveningTime(nowDate);
        if (!evening) return null;

        const text = await this.yandexGPT.generateText(habit, 'praise', {
            context: `high completion rate ${(habit.completionRate * 100).toFixed(0)}%`,
            tone: 'proud'
        });

        return {
            id: this.generateId(),
            habitId: habit.id,
            title: `⭐ ${habit.name}`,
            body: text,
            timestamp: evening.getTime(),
            type: 'personalized'
        };
    }

    /**
     * Мягкая мотивация
     */
    async createGentleMotivation(habit, nowDate) {
        const afternoon = this.getAfternoonTime(nowDate);
        if (!afternoon) return null;

        const text = await this.yandexGPT.generateText(habit, 'push', {
            context: `low completion rate ${(habit.completionRate * 100).toFixed(0)}%`,
            tone: 'supportive without pressure'
        });

        return {
            id: this.generateId(),
            habitId: habit.id,
            title: `${habit.emoji} ${habit.name}`,
            body: text,
            timestamp: afternoon.getTime(),
            type: 'motivation'
        };
    }

    /**
     * Предупреждение о риске потери streak
     */
    createStreakWarning(habit, nowDate) {
        const evening = this.getEveningTime(nowDate, 20); // 20:00
        if (!evening || evening <= nowDate) return null;

        return {
            id: this.generateId(),
            habitId: habit.id,
            title: `🔥 ${habit.name}`,
            body: `Не потеряй streak! Уже ${habit.streak} ${this.getDaysWord(habit.streak)}. Осталось время!`,
            timestamp: evening.getTime(),
            type: 'streak_warning'
        };
    }

    /**
     * Раннее напоминание
     */
    async createEarlyReminder(habit, nowDate) {
        const [hour, minute] = habit.reminderTime.split(':').map(Number);
        const earlyTime = new Date(nowDate);
        earlyTime.setHours(hour - 1, minute, 0, 0);

        if (earlyTime <= nowDate || this.isQuietHours(earlyTime)) {
            return null;
        }

        const text = await this.yandexGPT.generateText(habit, 'reminder', {
            context: 'early reminder',
            tone: 'gentle'
        });

        return {
            id: this.generateId(),
            habitId: habit.id,
            title: `⏰ ${habit.name}`,
            body: text,
            timestamp: earlyTime.getTime(),
            type: 'reminder'
        };
    }

    /**
     * Применение лимитов и фильтров
     */
    applyLimits(notifications, habit) {
        // Определяем нужен ли расширенный лимит
        const needsExtendedSupport = this.needsExtendedSupport(habit);
        const maxNotifications = needsExtendedSupport
            ? this.EXTENDED_MAX_NOTIFICATIONS
            : this.BASE_MAX_NOTIFICATIONS;

        console.log(`   🎯 [AI Planner] Max notifications: ${maxNotifications}${needsExtendedSupport ? ' (EXTENDED)' : ''}`);

        // 1. Удалить уведомления в quiet hours
        let filtered = notifications.filter(n => !this.isQuietHours(new Date(n.timestamp)));

        // 2. Удалить уведомления в прошлом
        const now = Date.now();
        filtered = filtered.filter(n => n.timestamp > now);

        // 3. Лимит на количество
        if (filtered.length > maxNotifications) {
            // Приоритизация: reminder и streak_warning важнее
            filtered.sort((a, b) => {
                const priorityA = this.getNotificationPriority(a.type);
                const priorityB = this.getNotificationPriority(b.type);
                if (priorityA !== priorityB) return priorityB - priorityA;
                return a.timestamp - b.timestamp;
            });
            filtered = filtered.slice(0, maxNotifications);
        }

        // 4. Минимум 3 часа между уведомлениями
        filtered.sort((a, b) => a.timestamp - b.timestamp);
        const result = [];
        let lastTimestamp = 0;

        for (const notification of filtered) {
            const hoursDiff = (notification.timestamp - lastTimestamp) / (1000 * 60 * 60);
            if (hoursDiff >= this.MIN_HOURS_BETWEEN_NOTIFICATIONS || result.length === 0) {
                result.push(notification);
                lastTimestamp = notification.timestamp;
            }
        }

        return result;
    }

    /**
     * Определяет нужна ли расширенная поддержка
     */
    needsExtendedSupport(habit) {
        // Multi-frequency привычки
        const isMultiFrequency = habit.frequency && ['twice', 'thrice'].includes(habit.frequency);

        // Низкий completion rate (< 50%)
        const hasLowCompletionRate = habit.completionRate < 0.5;

        // Много пропусков подряд (≥ 3)
        const hasManyMisses = habit.consecutiveMisses >= 3;

        // Высокий streak в риске (> 7 дней и еще не выполнено сегодня)
        const hasStreakAtRisk = habit.streak > 7 && habit.completedSlotsToday?.length === 0;

        const needsSupport = isMultiFrequency || hasLowCompletionRate || hasManyMisses || hasStreakAtRisk;

        if (needsSupport) {
            console.log(`   ⚠️ [AI Planner] Extended support needed:`);
            if (isMultiFrequency) console.log(`      - Multi-frequency: ${habit.frequency}`);
            if (hasLowCompletionRate) console.log(`      - Low completion rate: ${(habit.completionRate * 100).toFixed(0)}%`);
            if (hasManyMisses) console.log(`      - Consecutive misses: ${habit.consecutiveMisses}`);
            if (hasStreakAtRisk) console.log(`      - Streak at risk: ${habit.streak} days`);
        }

        return needsSupport;
    }

    /**
     * Приоритет типов уведомлений
     */
    getNotificationPriority(type) {
        const priorities = {
            'reminder': 10,
            'streak_warning': 9,
            'motivation': 5,
            'celebration': 3,
            'personalized': 4
        };
        return priorities[type] || 1;
    }

    // MARK: - Helper Methods

    getEveningTime(nowDate, targetHour = 19) {
        const time = new Date(nowDate);
        time.setHours(targetHour, 0, 0, 0);
        if (time <= nowDate) {
            time.setDate(time.getDate() + 1);
        }
        return this.isQuietHours(time) ? null : time;
    }

    getAfternoonTime(nowDate) {
        const time = new Date(nowDate);
        time.setHours(14, 0, 0, 0);
        if (time <= nowDate) {
            time.setDate(time.getDate() + 1);
        }
        return this.isQuietHours(time) ? null : time;
    }

    isQuietHours(date) {
        const hour = date.getHours();
        return hour >= this.QUIET_HOURS_START || hour < this.QUIET_HOURS_END;
    }

    getBaseReminderText(habit, slot) {
        const slotEmoji = {
            'morning': '🌅',
            'afternoon': '☀️',
            'evening': '🌙',
            'anytime': '⭐'
        };

        const emoji = slotEmoji[slot] || '';

        if (habit.streak > 7) {
            return `${emoji} ${habit.streak} ${this.getDaysWord(habit.streak)} подряд! Продолжай 💪`;
        } else if (habit.streak > 0) {
            return `${emoji} День ${habit.streak}! Не останавливайся`;
        } else {
            return `${emoji} Время начать!`;
        }
    }

    getDaysWord(days) {
        if (days % 10 === 1 && days % 100 !== 11) return "день";
        if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) return "дня";
        return "дней";
    }

    generateId() {
        return `notif-${crypto.randomBytes(8).toString('hex')}`;
    }
}

module.exports = AIPlanner;
