// Scheduling Service - умное планирование уведомлений на 2 дня

const crypto = require('crypto');

class SchedulingService {
    constructor(aiPlanner) {
        this.aiPlanner = aiPlanner;
    }

    /**
     * Планирование уведомлений для всех привычек
     * @param {Object} request - запрос с данными о привычках
     * @returns {Object} - расписание уведомлений
     */
    async scheduleNotifications(request) {
        const { userId, habits, timezone, now } = request;

        console.log(`\n📅 [Scheduling] Starting for ${habits.length} habits`);
        console.log(`📅 [Scheduling] Timezone: ${timezone}`);
        console.log(`📅 [Scheduling] Current time: ${new Date(now)}`);

        const allNotifications = [];

        // Для каждой привычки генерируем уведомления
        for (const habit of habits) {
            console.log(`\n📊 [Scheduling] Processing: ${habit.emoji} ${habit.name}`);
            console.log(`   - Streak: ${habit.streak}`);
            console.log(`   - Completion rate: ${(habit.completionRate * 100).toFixed(0)}%`);
            console.log(`   - Consecutive misses: ${habit.consecutiveMisses}`);

            try {
                const notifications = await this.aiPlanner.planForHabit(habit, now, timezone);
                allNotifications.push(...notifications);

                console.log(`   ✓ Generated ${notifications.length} notifications`);
            } catch (error) {
                console.error(`   ✗ Failed to plan for habit: ${error.message}`);
                // Fallback на базовое уведомление
                allNotifications.push(this.createFallbackNotification(habit, now));
            }
        }

        // Оптимизация под лимит iOS (64 уведомления)
        const optimized = this.optimizeForIOSLimit(allNotifications, habits.length);

        // Сортировка по времени
        optimized.sort((a, b) => a.timestamp - b.timestamp);

        const validUntil = now + (48 * 60 * 60 * 1000); // 48 часов

        console.log(`\n✅ [Scheduling] Total notifications: ${optimized.length}`);
        console.log(`✅ [Scheduling] Valid until: ${new Date(validUntil)}`);

        return {
            notifications: optimized,
            validUntil: validUntil
        };
    }

    /**
     * Оптимизация под лимит iOS (64 уведомления)
     */
    optimizeForIOSLimit(notifications, habitsCount) {
        const MAX_NOTIFICATIONS = 60; // Оставляем буфер

        if (notifications.length <= MAX_NOTIFICATIONS) {
            return notifications;
        }

        console.log(`⚠️ [Scheduling] Optimizing: ${notifications.length} -> ${MAX_NOTIFICATIONS}`);

        // Приоритизация:
        // 1. Reminder - базовые напоминания (высокий приоритет)
        // 2. Streak warnings - риск потери streak (высокий приоритет)
        // 3. Motivation - мотивация (средний приоритет)
        // 4. Celebration - празднование (низкий приоритет)

        const priorityMap = {
            'reminder': 3,
            'streak_warning': 3,
            'motivation': 2,
            'celebration': 1,
            'personalized': 1
        };

        // Сортируем по приоритету и времени
        const sorted = notifications.sort((a, b) => {
            const priorityDiff = (priorityMap[b.type] || 0) - (priorityMap[a.type] || 0);
            if (priorityDiff !== 0) return priorityDiff;
            return a.timestamp - b.timestamp;
        });

        return sorted.slice(0, MAX_NOTIFICATIONS);
    }

    /**
     * Fallback уведомление если AI не сработал
     */
    createFallbackNotification(habit, now) {
        const [hour, minute] = habit.reminderTime.split(':').map(Number);
        const tomorrow = new Date(now);
        tomorrow.setHours(hour, minute, 0, 0);
        if (tomorrow.getTime() <= now) {
            tomorrow.setDate(tomorrow.getDate() + 1);
        }

        return {
            id: this.generateId(),
            habitId: habit.id,
            title: `${habit.emoji} ${habit.name}`,
            body: "Время для привычки!",
            timestamp: tomorrow.getTime(),
            type: 'reminder'
        };
    }

    generateId() {
        return `notif-${crypto.randomBytes(8).toString('hex')}`;
    }
}

module.exports = SchedulingService;
