// Локальный сервер для тестирования умных уведомлений
require('dotenv').config();
const http = require('http');
const https = require('https');
const YandexGPTService = require('./yandex-gpt-service');
const AIPlanner = require('./ai-planner');
const SchedulingService = require('./scheduling-service');

const PORT = process.env.PORT || 3000;

// Инициализация сервисов
const YANDEX_GPT_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_GPT_FOLDER_ID = process.env.YANDEX_FOLDER_ID;

const yandexGPT = new YandexGPTService(YANDEX_GPT_API_KEY, YANDEX_GPT_FOLDER_ID);
const aiPlanner = new AIPlanner(yandexGPT);
const schedulingService = new SchedulingService(aiPlanner);

const server = http.createServer(async (req, res) => {
    console.log(`\n📨 [Server] ${req.method} ${req.url}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Роутинг
    if (req.url === '/api/schedule-notifications' && req.method === 'POST') {
        await handleScheduleNotifications(req, res);
    } else if (req.url === '/api/tg/send' && req.method === 'POST') {
        await handleTelegramFeedback(req, res);
    } else if (req.url === '/api/analytics/event' && req.method === 'POST') {
        await handleAnalyticsEvent(req, res);
    } else if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

async function handleScheduleNotifications(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const request = JSON.parse(body);

            console.log(`📊 [Server] Request received:`);
            console.log(`   - User ID: ${request.userId}`);
            console.log(`   - Habits: ${request.habits?.length || 0}`);
            console.log(`   - Timezone: ${request.timezone}`);

            // Валидация
            if (!request.habits || !Array.isArray(request.habits)) {
                throw new Error('Invalid request: habits array required');
            }

            // Планирование уведомлений
            const response = await schedulingService.scheduleNotifications(request);

            console.log(`✅ [Server] Response: ${response.notifications.length} notifications`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));

        } catch (error) {
            console.error('❌ [Server] Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Internal server error',
                details: error.message
            }));
        }
    });
}

async function handleTelegramFeedback(req, res) {
    let body = '';
    const startTime = Date.now();

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const request = JSON.parse(body);

            console.log(`📬 [Telegram] Feedback received (${(body.length / 1024).toFixed(1)}KB)`);
            console.log(`📬 [Telegram] Type: ${request.type}, Has screenshot: ${!!request.screenshot}`);
            console.log(`📬 [Telegram] Message: "${request.message}"`);
            console.log(`📬 [Telegram] Username: "${request.username}"`);

            // Валидация
            if (!request.type || !request.message) {
                throw new Error('Invalid request: type and message required');
            }

            // Отправка в Telegram (не ждем завершения для быстрого ответа)
            sendToTelegram(request).catch(err => {
                console.error(`❌ [Telegram] Async send error:`, err);
            });

            // Быстро отвечаем клиенту
            const responseTime = Date.now() - startTime;
            console.log(`✅ [Telegram] Response sent in ${responseTime}ms`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));

        } catch (error) {
            console.error('❌ [Telegram] Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Internal server error',
                details: error.message
            }));
        }
    });
}

async function sendToTelegram(feedback) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        throw new Error('Telegram credentials not configured');
    }

    const typeEmoji = {
        'bug': '🐛',
        'idea': '💡',
        'feedback': '💬'
    };

    const emoji = typeEmoji[feedback.type] || '📝';

    let text = `${emoji} ${feedback.type.toUpperCase()}\n\n`;
    text += `${feedback.message}\n`;

    if (feedback.username) {
        text += `\n👤 User: ${feedback.username}`;
    }

    // Отправка текста
    console.log(`📤 [Telegram] Sending message...`);
    console.log(`📤 [Telegram] Text length: ${text.length} chars`);
    console.log(`📤 [Telegram] Text: "${text}"`);
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const textPayload = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text
    });

    await new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(textPayload)
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ [Telegram] Message sent`);
                    resolve();
                } else {
                    console.error(`❌ [Telegram] Message failed: ${res.statusCode} ${data}`);
                    reject(new Error(`Telegram API error: ${data}`));
                }
            });
        });

        req.on('error', (err) => {
            console.error(`❌ [Telegram] Request error:`, err);
            reject(err);
        });
        req.write(textPayload);
        req.end();
    });

    // Отправка скриншота если есть
    if (feedback.screenshot) {
        console.log(`📸 [Telegram] Sending screenshot (${(feedback.screenshot.length / 1024).toFixed(1)}KB)...`);
        await sendTelegramPhoto(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, feedback.screenshot);
    }
}

async function sendTelegramPhoto(botToken, chatId, base64Image) {
    const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;

    // Убираем data:image/png;base64, если есть
    const imageData = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(imageData, 'base64');

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36);

    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n`;
    body += `${chatId}\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="photo"; filename="screenshot.png"\r\n`;
    body += `Content-Type: image/png\r\n\r\n`;

    const bodyBuffer = Buffer.concat([
        Buffer.from(body, 'utf8'),
        buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
    ]);

    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': bodyBuffer.length
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ [Telegram] Screenshot sent`);
                    resolve();
                } else {
                    reject(new Error(`Telegram photo API error: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(bodyBuffer);
        req.end();
    });
}

async function handleAnalyticsEvent(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const event = JSON.parse(body);

            // Валидация
            if (!event.eventName) {
                throw new Error('Invalid request: eventName required');
            }

            // Логирование события
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                eventName: event.eventName,
                userId: event.userId || 'anonymous',
                screen: event.screen || 'unknown',
                properties: event.properties || {},
                deviceInfo: {
                    platform: event.platform || 'unknown',
                    appVersion: event.appVersion || 'unknown'
                }
            };

            console.log(`📊 [Analytics] ${logEntry.eventName} | User: ${logEntry.userId} | Screen: ${logEntry.screen}`);
            if (Object.keys(logEntry.properties).length > 0) {
                console.log(`📊 [Analytics] Properties:`, JSON.stringify(logEntry.properties));
            }

            // Отправляем в Telegram (асинхронно)
            sendAnalyticsToTelegram(logEntry).catch(err => {
                console.error(`❌ [Analytics] Telegram send error:`, err);
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));

        } catch (error) {
            console.error('❌ [Analytics] Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Internal server error',
                details: error.message
            }));
        }
    });
}

async function sendAnalyticsToTelegram(logEntry) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        return; // Тихо пропускаем если нет credentials
    }

    const eventEmoji = {
        'button_click': '🖱️',
        'screen_view': '📱',
        'habit_completed': '✅',
        'habit_created': '➕',
        'habit_deleted': '🗑️',
        'notification_scheduled': '🔔',
        'feedback_sent': '💬'
    };

    const emoji = eventEmoji[logEntry.eventName] || '📊';

    let text = `${emoji} ${logEntry.eventName}\n\n`;
    text += `👤 User: ${logEntry.userId}\n`;
    text += `📱 Screen: ${logEntry.screen}\n`;
    text += `⏰ Time: ${new Date(logEntry.timestamp).toLocaleString('ru-RU')}\n`;

    if (Object.keys(logEntry.properties).length > 0) {
        text += `\n📝 Properties:\n`;
        for (const [key, value] of Object.entries(logEntry.properties)) {
            text += `  • ${key}: ${value}\n`;
        }
    }

    text += `\n🔧 Platform: ${logEntry.deviceInfo.platform} | v${logEntry.deviceInfo.appVersion}`;

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text
    });

    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ [Analytics] Sent to Telegram`);
                    resolve();
                } else {
                    reject(new Error(`Telegram API error: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

server.listen(PORT, () => {
    console.log(`\n🚀 Smart Notifications Server`);
    console.log(`📡 Running on http://localhost:${PORT}`);
    console.log(`\n📍 Endpoints:`);
    console.log(`   POST /api/schedule-notifications - Schedule smart notifications`);
    console.log(`   POST /api/tg/send - Send feedback to Telegram`);
    console.log(`   POST /api/analytics/event - Track analytics events`);
    console.log(`   GET  /health - Health check`);
    console.log(`\n💡 Test with iOS app or curl`);
    console.log(`\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
