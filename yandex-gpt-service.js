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

        let basePrompt = `Сгенерируй КОРОТКОЕ уведомление (максимум 10 слов) для привычки:

Привычка: ${habit.emoji} ${habit.name}
Streak: ${habit.streak} дней
Completion rate: ${(habit.completionRate * 100).toFixed(0)}%
Consecutive misses: ${habit.consecutiveMisses}`;

        if (context) {
            basePrompt += `\nКонтекст: ${context}`;
        }

        switch (type) {
            case 'praise':
                basePrompt += '\n\nНапиши хвалебное сообщение. Подчеркни достижение.';
                break;
            case 'push':
                basePrompt += '\n\nНапиши мотивирующее сообщение. Мягкий push без вины.';
                break;
            case 'support':
                basePrompt += '\n\nНапиши поддерживающее сообщение. Фокус на малых шагах.';
                break;
            case 'urgent':
                basePrompt += '\n\nНапиши срочное напоминание. Срочность, но без паники.';
                break;
            case 'celebration':
                basePrompt += '\n\nНапиши праздничное сообщение. Радость и гордость.';
                break;
            case 'motivation':
                basePrompt += '\n\nНапиши мотивирующее сообщение. Вера в успех.';
                break;
            default:
                basePrompt += '\n\nНапиши простое напоминание.';
        }

        basePrompt += `\n\nТон: ${tone}. Используй эмодзи ${habit.emoji}. Будь краток и естественен.`;

        return basePrompt;
    }

    /**
     * Системный промпт
     */
    getSystemPrompt() {
        return `Ты — ассистент Mia, который помогает с привычками.

Стиль:
- ОЧЕНЬ коротко (максимум 10 слов)
- Прямо и по делу
- Как друг в чат
- Используй эмодзи умеренно
- Без "Мяу", "Привет" и прочего - сразу к сути

Примеры:
- "2 дня подряд 💧 красава"
- "что по водичке?"
- "Не потеряй streak! Уже 12 дней"
- "Маленький шаг тоже шаг"

Отвечай ТОЛЬКО текстом уведомления, без JSON и дополнительных пояснений.`;
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
