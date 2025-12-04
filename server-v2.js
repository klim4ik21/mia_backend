// Локальный сервер для тестирования умных уведомлений
require('dotenv').config();
const http = require('http');
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

server.listen(PORT, () => {
    console.log(`\n🚀 Smart Notifications Server`);
    console.log(`📡 Running on http://localhost:${PORT}`);
    console.log(`\n📍 Endpoints:`);
    console.log(`   POST /api/schedule-notifications - Schedule smart notifications`);
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
