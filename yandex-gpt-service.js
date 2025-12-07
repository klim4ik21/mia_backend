// YandexGPT Service с кешированием

const https = require('https');
const crypto = require('crypto');

class YandexGPTService {
    constructor(apiKey, folderId) {
        this.apiKey = apiKey;
        this.folderId = folderId;
        this.cache = new Map(); // Simple in-memory cache
        this.CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 дней

        // Fallback сообщения
        this.fallbackMessages = {
            'praise': [
                'Отличная работа! 💪',
                'Ты на верном пути!',
                'Красава! Продолжай в том же духе',
                'Так держать! 🔥'
            ],
            'push': [
                'Сегодня отличный день для старта!',
                'Маленький шаг лучше чем никакого!',
                'Начни прямо сейчас!',
                'Ты сможешь!'
            ],
            'support': [
                'Каждый день важен',
                'Продолжай! Получается',
                'Ты молодец, что стараешься',
                'Главное не сдаваться'
            ],
            'urgent': [
                'Не потеряй прогресс!',
                'Осталось немного!',
                'Сделай это сейчас!',
                'Последний рывок!'
            ],
            'celebration': [
                'Невероятно! 🎉',
                'Ты легенда!',
                'Какой streak! 🔥',
                'Так держать!'
            ],
            'motivation': [
                'Попробуй ещё раз',
                'Не сдавайся!',
                'У тебя получится',
                'Верю в тебя!'
            ],
            'reminder': [
                'Время для привычки!',
                'Не забудь!',
                'Пора начинать',
                'Давай!'
            ]
        };
    }

    /**
     * Генерация текста с кешированием
     */
    async generateText(habit, type, options = {}) {
        const cacheKey = this.getCacheKey(habit, type, options);

        console.log(`🔍 [YandexGPT] Request for ${habit.name} (${type})`);
        console.log(`   - Cache key: ${cacheKey}`);
        console.log(`   - Cache size: ${this.cache.size}`);

        // Проверка кеша
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log(`💾 [YandexGPT] ✓ Cache hit! Returning: "${cached}"`);
            return cached;
        }

        console.log(`🌐 [YandexGPT] Cache miss, calling API...`);
        console.log(`   - API Key: ${this.apiKey.substring(0, 10)}...`);
        console.log(`   - Folder ID: ${this.folderId}`);

        try {
            const text = await this.callYandexGPT(habit, type, options);
            console.log(`✅ [YandexGPT] Generated text: "${text}"`);
            this.saveToCache(cacheKey, text);
            console.log(`💾 [YandexGPT] Saved to cache (total: ${this.cache.size})`);
            return text;
        } catch (error) {
            console.error(`❌ [YandexGPT] API Error: ${error.message}`);
            console.error(`❌ [YandexGPT] Stack: ${error.stack}`);
            const fallback = this.getFallbackMessage(type);
            console.log(`🔄 [YandexGPT] Using fallback: "${fallback}"`);
            return fallback;
        }
    }

    /**
     * Вызов YandexGPT API
     */
    async callYandexGPT(habit, type, options) {
        const prompt = this.buildPrompt(habit, type, options);

        console.log(`📤 [YandexGPT] Request prompt:\n${prompt.substring(0, 200)}...`);

        const requestData = JSON.stringify({
            modelUri: `gpt://${this.folderId}/yandexgpt/latest`,
            completionOptions: {
                stream: false,
                temperature: 0.8,
                maxTokens: 100
            },
            messages: [
                {
                    role: 'system',
                    text: this.getSystemPrompt()
                },
                {
                    role: 'user',
                    text: prompt
                }
            ]
        });

        console.log(`📤 [YandexGPT] Making HTTPS request to Yandex API...`);

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'llm.api.cloud.yandex.net',
                path: '/foundationModels/v1/completion',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Api-Key ${this.apiKey}`,
                    'x-folder-id': this.folderId
                },
                timeout: 10000
            };

            const req = https.request(options, (res) => {
                console.log(`📥 [YandexGPT] Response status: ${res.statusCode}`);
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    console.log(`📥 [YandexGPT] Response body: ${data.substring(0, 300)}...`);
                    try {
                        const response = JSON.parse(data);
                        const text = response.result?.alternatives?.[0]?.message?.text || '';
                        if (text) {
                            console.log(`✅ [YandexGPT] Extracted text: "${text}"`);
                            resolve(text.trim());
                        } else {
                            console.error(`❌ [YandexGPT] No text in response structure`);
                            console.error(`   Response: ${JSON.stringify(response)}`);
                            reject(new Error('Empty response from GPT'));
                        }
                    } catch (e) {
                        console.error(`❌ [YandexGPT] Parse error: ${e.message}`);
                        console.error(`   Raw data: ${data}`);
                        reject(new Error('Failed to parse GPT response'));
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`❌ [YandexGPT] Request error: ${error.message}`);
                reject(error);
            });

            req.on('timeout', () => {
                console.error(`⏱️ [YandexGPT] Request timeout after 10s`);
                req.destroy();
                reject(new Error('Request timeout'));
            });

            console.log(`📤 [YandexGPT] Sending request...`);
            req.write(requestData);
            req.end();
        });
    }

    /**
     * Построение промпта
     */
    buildPrompt(habit, type, options) {
        const context = options.context || '';
        const tone = options.tone || 'friendly';
        const habitContext = options.habitContext || {};
        const temporalContext = options.temporalContext || {};

        // Базовая информация о привычке
        let basePrompt = `Сгенерируй КОРОТКОЕ уведомление (максимум 10-12 слов) для привычки:

Привычка: ${habit.emoji} ${habit.name}
Streak: ${habit.streak || 0} ${this.getDaysWord(habit.streak || 0)}`;
        
        if (habit.completionRate !== undefined && habit.completionRate !== null) {
            basePrompt += `\nCompletion rate: ${(habit.completionRate * 100).toFixed(0)}%`;
        }
        if (habit.consecutiveMisses !== undefined && habit.consecutiveMisses !== null && habit.consecutiveMisses > 0) {
            basePrompt += `\nConsecutive misses: ${habit.consecutiveMisses}`;
        }

        // Добавляем контекст времени, если есть
        if (temporalContext.timeOfDay) {
            basePrompt += `\nВремя дня: ${this.translateTimeOfDay(temporalContext.timeOfDay)}`;
        }
        if (temporalContext.dayOfWeek) {
            basePrompt += `\nДень недели: ${temporalContext.dayOfWeek}`;
        }

        // Добавляем контекст привычки из движков
        if (habitContext.slot) {
            basePrompt += `\nВременной слот: ${this.translateSlot(habitContext.slot)}`;
        }
        if (habitContext.streak && habitContext.streak > 0) {
            const milestone = this.getNextMilestone(habitContext.streak);
            if (milestone) {
                basePrompt += `\nДо milestone (${milestone} дней): ${milestone - habitContext.streak} дней`;
            }
        }

        // Общий контекст
        if (context) {
            basePrompt += `\nДополнительный контекст: ${context}`;
        }

        // Инструкции по типу уведомления
        switch (type) {
            case 'praise':
                basePrompt += '\n\nЗадача: Напиши хвалебное сообщение. Подчеркни достижение, но без пафоса.';
                break;
            case 'push':
                basePrompt += '\n\nЗадача: Напиши мотивирующее сообщение. Мягкий push без вины и давления.';
                break;
            case 'support':
                basePrompt += '\n\nЗадача: Напиши поддерживающее сообщение. Фокус на малых шагах и прогрессе.';
                break;
            case 'urgent':
                basePrompt += '\n\nЗадача: Напиши срочное напоминание. Срочность, но без паники и агрессии.';
                break;
            case 'celebration':
                basePrompt += '\n\nЗадача: Напиши праздничное сообщение. Радость и гордость, но естественно.';
                break;
            case 'motivation':
                basePrompt += '\n\nЗадача: Напиши мотивирующее сообщение. Вера в успех, но реалистично.';
                break;
            case 'reminder':
                basePrompt += '\n\nЗадача: Напиши простое напоминание. Прямо и по делу, без лишнего.';
                break;
            default:
                basePrompt += '\n\nЗадача: Напиши простое напоминание.';
        }

        // Финальные инструкции
        basePrompt += `\n\nТребования:
- Тон: ${tone}
- Используй эмодзи ${habit.emoji} (1-2 раза, не перебор)
- Будь краток: максимум 10-12 слов
- Естественный язык, как в мессенджере
- Без "Мяу", "Привет" - сразу к сути
- Без восклицательных знаков подряд (максимум 1)
- Без повторов и воды`;

        return basePrompt;
    }

    /**
     * Вспомогательные методы для промпта
     */
    getDaysWord(days) {
        if (days % 10 === 1 && days % 100 !== 11) return "день";
        if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) return "дня";
        return "дней";
    }

    translateTimeOfDay(timeOfDay) {
        const translations = {
            'morning': 'утро',
            'afternoon': 'день',
            'evening': 'вечер',
            'night': 'ночь'
        };
        return translations[timeOfDay] || timeOfDay;
    }

    translateSlot(slot) {
        const translations = {
            'morning': 'утро',
            'afternoon': 'день',
            'evening': 'вечер',
            'anytime': 'любое время'
        };
        return translations[slot] || slot;
    }

    getNextMilestone(currentStreak) {
        const milestones = [7, 14, 30, 50, 100];
        return milestones.find(m => m > currentStreak) || null;
    }

    /**
     * Системный промпт
     */
    getSystemPrompt() {
        return `Ты — ассистент Mia, который помогает пользователям формировать привычки через умные уведомления.

ТВОЯ РОЛЬ:
Генерировать короткие, естественные уведомления для мобильного приложения, которые мотивируют и напоминают о привычках.

СТИЛЬ ОБЩЕНИЯ:
- ОЧЕНЬ коротко: максимум 5-7 слов
- Прямо и по делу, без воды
- Как друг пишет в мессенджере - естественно и просто
- Используй эмодзи умеренно (1-2 эмодзи, не перебор)
- Без "Мяу", "Привет", "Доброе утро" - сразу к сути
- Без множественных восклицательных знаков (максимум 1)
- Без повторов и общих фраз

ПРИНЦИПЫ:
1. Персонализация: учитывай streak, completion rate, контекст
2. Мотивация без давления: поддерживай, но не дави
3. Естественность: говори как человек, не как бот
4. Краткость: каждое слово на счету
5. Релевантность: текст должен соответствовать типу уведомления

ПРИМЕРЫ ХОРОШИХ УВЕДОМЛЕНИЙ:
- "2 дня подряд 💧 красава"
- "что по водичке?"
- "Не потеряй streak! Уже 12 дней"
- "Маленький шаг тоже шаг"
- "Утро началось, время для привычки"
- "7 дней - это уже неделя! 🔥"
- "Сегодня пропустил? Завтра наверстаешь"

ПРИМЕРЫ ПЛОХИХ УВЕДОМЛЕНИЙ:
- "Мяу! Привет! Доброе утро! Не забудь про привычку!!!" (слишком много, пафос)
- "Это очень важно для твоего здоровья и благополучия" (слишком длинно, общие фразы)
- "💧💧💧💧💧💧💧" (перебор с эмодзи)
- "Уведомление: напоминание о привычке" (формально, как бот)

ВАЖНО:
- Отвечай ТОЛЬКО текстом уведомления
- Без JSON, без дополнительных пояснений
- Без кавычек вокруг текста
- Только чистый текст уведомления`;
    }

    // MARK: - Cache Management

    getCacheKey(habit, type, options) {
        const streakRange = this.getStreakRange(habit.streak);
        const rateRange = this.getRateRange(habit.completionRate);
        const data = `${habit.name}-${type}-${streakRange}-${rateRange}-${options.tone || ''}`;
        return crypto.createHash('md5').update(data).digest('hex');
    }

    getStreakRange(streak) {
        if (streak === 0) return '0';
        if (streak <= 3) return '1-3';
        if (streak <= 7) return '4-7';
        if (streak <= 14) return '8-14';
        return '15+';
    }

    getRateRange(rate) {
        if (rate < 0.3) return 'low';
        if (rate < 0.7) return 'medium';
        return 'high';
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL;
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }

        return cached.text;
    }

    saveToCache(key, text) {
        this.cache.set(key, {
            text,
            timestamp: Date.now()
        });
    }

    getFallbackMessage(type) {
        const messages = this.fallbackMessages[type] || this.fallbackMessages['reminder'];
        return messages[Math.floor(Math.random() * messages.length)];
    }
}

module.exports = YandexGPTService;
