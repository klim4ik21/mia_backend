// Локальный сервер для тестирования умных уведомлений
require('dotenv').config();
const http = require('http');
const https = require('https');
const YandexGPTService = require('./yandex-gpt-service');
const AIPlanner = require('./ai-planner');
const SchedulingService = require('./scheduling-service');
const { NotificationOrchestrator } = require('./engines');
const YooKassaService = require('./yookassa-service');

const PORT = process.env.PORT || 3000;

// Инициализация сервисов
const YANDEX_GPT_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_GPT_FOLDER_ID = process.env.YANDEX_FOLDER_ID;

const yandexGPT = new YandexGPTService(YANDEX_GPT_API_KEY, YANDEX_GPT_FOLDER_ID);

// Используем новый NotificationOrchestrator с движками
const notificationOrchestrator = new NotificationOrchestrator(yandexGPT);
const schedulingService = new SchedulingService(notificationOrchestrator);

// Сохраняем aiPlanner для обратной совместимости (если нужен)
const aiPlanner = new AIPlanner(yandexGPT);

// Инициализация YooKassa
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;
const yooKassa = YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY 
    ? new YooKassaService(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY)
    : null;

// In-memory хранилище для платежей и подписок (в продакшене использовать БД)
const paymentsStore = new Map(); // paymentId -> { paymentId, plan, userId, status, createdAt }
const subscriptionsStore = new Map(); // userId -> { userId, plan, expiresAt, paymentId, createdAt }

const server = http.createServer(async (req, res) => {
    console.log(`\n📨 [Server] ${req.method} ${req.url}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Роутинг
    // Парсим URL для правильной обработки query параметров
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (pathname === '/api/schedule-notifications' && req.method === 'POST') {
        await handleScheduleNotifications(req, res);
    } else if (pathname === '/api/tg/send' && req.method === 'POST') {
        await handleTelegramFeedback(req, res);
    } else if (pathname === '/api/analytics/event' && req.method === 'POST') {
        await handleAnalyticsEvent(req, res);
    } else if (pathname === '/api/payments/create' && req.method === 'POST') {
        await handleCreatePayment(req, res);
    } else if (pathname.startsWith('/api/payments/') && pathname.endsWith('/status') && req.method === 'GET') {
        await handlePaymentStatus(req, res);
    } else if (pathname === '/api/subscription/activate' && req.method === 'POST') {
        await handleActivateSubscription(req, res);
    } else if (pathname === '/api/subscription/status' && req.method === 'GET') {
        await handleSubscriptionStatus(req, res);
    } else if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    } else {
        console.log(`⚠️ [Server] 404: ${req.method} ${req.url}`);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found', path: pathname }));
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

// ==================== Payment Handlers ====================

async function handleCreatePayment(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const request = JSON.parse(body);
            const { amount, currency, description, plan, returnUrl, userId } = request;

            // Валидация
            if (!amount || !description || !plan || !returnUrl) {
                throw new Error('Invalid request: amount, description, plan, and returnUrl are required');
            }

            if (!yooKassa) {
                throw new Error('YooKassa service not configured. Set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY');
            }

            console.log(`💳 [Payment] Creating payment: ${plan} - ${amount} ${currency || 'RUB'}`);

            // Генерируем ключ идемпотентности
            const idempotenceKey = yooKassa.generateIdempotenceKey();

            // Создаем платеж через ЮKassa
            const payment = await yooKassa.createPayment({
                amount,
                currency: currency || 'RUB',
                description,
                returnUrl
            }, idempotenceKey);

            console.log(`✅ [Payment] Payment created: ${payment.id}, status: ${payment.status}`);

            // Сохраняем платеж в хранилище
            paymentsStore.set(payment.id, {
                paymentId: payment.id,
                plan: plan,
                userId: userId || 'anonymous',
                status: payment.status,
                createdAt: Date.now()
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: payment.id,
                status: payment.status,
                confirmationUrl: payment.confirmation?.confirmation_url
            }));

        } catch (error) {
            console.error('❌ [Payment] Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to create payment',
                details: error.message
            }));
        }
    });
}

async function handlePaymentStatus(req, res) {
    try {
        // Извлекаем paymentId из URL: /api/payments/:paymentId/status
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;
        const urlParts = pathname.split('/');
        const paymentId = urlParts[urlParts.length - 2]; // предпоследний элемент

        if (!paymentId) {
            throw new Error('Payment ID is required');
        }

        console.log(`💳 [Payment] Checking status for: ${paymentId}`);

        if (!yooKassa) {
            throw new Error('YooKassa service not configured');
        }

        // Проверяем статус через API ЮKassa
        const payment = await yooKassa.getPaymentStatus(paymentId);

        // Обновляем статус в хранилище
        const storedPayment = paymentsStore.get(paymentId);
        if (storedPayment) {
            storedPayment.status = payment.status;
            storedPayment.paid = payment.paid;
            paymentsStore.set(paymentId, storedPayment);
        }

        console.log(`✅ [Payment] Status: ${payment.status}, paid: ${payment.paid}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: payment.status,
            paid: payment.paid || false
        }));

    } catch (error) {
        console.error('❌ [Payment] Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Failed to check payment status',
            details: error.message
        }));
    }
}

async function handleActivateSubscription(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const request = JSON.parse(body);
            const { plan, paymentId, userId } = request;

            // Валидация
            if (!plan || !paymentId) {
                throw new Error('Invalid request: plan and paymentId are required');
            }

            console.log(`📱 [Subscription] Activating: ${plan} for payment ${paymentId}`);

            if (!yooKassa) {
                throw new Error('YooKassa service not configured');
            }

            // Проверяем статус платежа
            const payment = await yooKassa.getPaymentStatus(paymentId);

            if (payment.status !== 'succeeded' || !payment.paid) {
                console.log(`⚠️ [Subscription] Payment not succeeded: ${payment.status}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'Payment not succeeded',
                    paymentStatus: payment.status
                }));
                return;
            }

            // Вычисляем дату истечения подписки
            const expiresAt = calculateSubscriptionExpiry(plan);

            // Активируем подписку
            const user = userId || 'anonymous';
            subscriptionsStore.set(user, {
                userId: user,
                plan: plan,
                expiresAt: expiresAt,
                paymentId: paymentId,
                createdAt: Date.now()
            });

            console.log(`✅ [Subscription] Activated: ${plan} until ${new Date(expiresAt).toISOString()}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                plan: plan,
                expiresAt: new Date(expiresAt).toISOString()
            }));

        } catch (error) {
            console.error('❌ [Subscription] Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to activate subscription',
                details: error.message
            }));
        }
    });
}

async function handleSubscriptionStatus(req, res) {
    try {
        // Извлекаем userId из query параметров или headers
        const url = new URL(req.url, `http://${req.headers.host}`);
        const userId = url.searchParams.get('userId') || req.headers['x-user-id'] || 'anonymous';

        console.log(`📱 [Subscription] Checking status for user: ${userId}`);

        const subscription = subscriptionsStore.get(userId);

        if (!subscription) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                subscribed: false
            }));
            return;
        }

        // Проверяем, не истекла ли подписка
        const now = Date.now();
        const isExpired = subscription.expiresAt < now;
        const subscribed = !isExpired;

        if (isExpired) {
            console.log(`⚠️ [Subscription] Subscription expired for user: ${userId}`);
            subscriptionsStore.delete(userId);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            subscribed: subscribed,
            expiresAt: new Date(subscription.expiresAt).toISOString(),
            plan: subscription.plan
        }));

    } catch (error) {
        console.error('❌ [Subscription] Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Failed to check subscription status',
            details: error.message
        }));
    }
}

/**
 * Вычисляет дату истечения подписки на основе плана
 */
function calculateSubscriptionExpiry(plan) {
    const now = Date.now();
    const planDurations = {
        'premium_monthly': 30 * 24 * 60 * 60 * 1000, // 30 дней
        'premium_yearly': 365 * 24 * 60 * 60 * 1000, // 365 дней
        'premium_lifetime': Number.MAX_SAFE_INTEGER // никогда не истекает
    };

    const duration = planDurations[plan] || planDurations['premium_monthly'];
    return now + duration;
}

server.listen(PORT, () => {
    console.log(`\n🚀 Smart Notifications Server`);
    console.log(`📡 Running on http://localhost:${PORT}`);
    console.log(`\n📍 Endpoints:`);
    console.log(`   POST /api/schedule-notifications - Schedule smart notifications`);
    console.log(`   POST /api/tg/send - Send feedback to Telegram`);
    console.log(`   POST /api/analytics/event - Track analytics events`);
    console.log(`   POST /api/payments/create - Create payment via YooKassa`);
    console.log(`   GET  /api/payments/:paymentId/status - Check payment status`);
    console.log(`   POST /api/subscription/activate - Activate subscription`);
    console.log(`   GET  /api/subscription/status?userId=xxx - Check subscription status`);
    console.log(`   GET  /health - Health check`);
    console.log(`\n💳 Payment Service: ${yooKassa ? '✅ Configured' : '⚠️  Not configured (set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY)'}`);
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
