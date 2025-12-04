# Деплой на Ubuntu 24 (78.153.136.193)

## 1. Подготовка сервера

```bash
# Подключиться к серверу
ssh root@78.153.136.193

# Обновить систему
apt update && apt upgrade -y

# Установить Docker
apt install -y docker.io docker-compose

# Запустить Docker
systemctl start docker
systemctl enable docker

# Проверить установку
docker --version
docker-compose --version
```

## 2. Загрузка проекта на сервер

### Вариант A: Через SCP (с локальной машины)
```bash
# На локальной машине
cd /Users/klimentiy/Desktop
scp -r backend root@78.153.136.193:/opt/mia-backend
```

### Вариант B: Через Git (если есть репозиторий)
```bash
# На сервере
cd /opt
git clone <your-repo-url> mia-backend
cd mia-backend
```

## 3. Настройка переменных окружения

```bash
# На сервере
cd /opt/mia-backend

# Создать .env файл
cat > .env << 'EOF'
YANDEX_FOLDER_ID=your_folder_id_here
YANDEX_API_KEY=your_api_key_here
NODE_ENV=production
PORT=3000
EOF
```

## 4. Запуск через Docker Compose

```bash
# Собрать и запустить
docker-compose up -d --build

# Проверить логи
docker-compose logs -f

# Проверить статус
docker-compose ps

# Проверить health
curl http://localhost:3000/health
```

## 5. Настройка Nginx (опционально, для HTTPS)

```bash
# Установить Nginx
apt install -y nginx certbot python3-certbot-nginx

# Создать конфиг
cat > /etc/nginx/sites-available/mia-backend << 'EOF'
server {
    listen 80;
    server_name 78.153.136.193;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Активировать конфиг
ln -s /etc/nginx/sites-available/mia-backend /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 6. Firewall

```bash
# Открыть порты
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable
```

## 7. Управление сервисом

```bash
# Остановить
docker-compose down

# Перезапустить
docker-compose restart

# Обновить после изменений
docker-compose up -d --build

# Посмотреть логи
docker-compose logs -f mia-backend

# Очистить старые образы
docker system prune -a
```

## 8. Проверка работы

```bash
# Health check
curl http://78.153.136.193/health

# Тестовый запрос
curl -X POST http://78.153.136.193/api/schedule-notifications \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "timezone": "Europe/Moscow",
    "now": '$(date +%s000)',
    "habits": [{
      "id": "1",
      "name": "Вода",
      "emoji": "💧",
      "reminderTime": "09:00",
      "frequency": "once",
      "requiredSlots": ["anytime"],
      "completedSlotsToday": [],
      "streak": 5,
      "completionRate": 0.8,
      "consecutiveMisses": 0,
      "lastCompleted": null
    }]
  }'
```

## Endpoints

- `GET /health` - проверка статуса сервера
- `POST /api/schedule-notifications` - планирование уведомлений

## Мониторинг

```bash
# Автозапуск при перезагрузке сервера (уже настроено через restart: unless-stopped)

# Посмотреть использование ресурсов
docker stats

# Посмотреть логи за последние 100 строк
docker-compose logs --tail=100 mia-backend
```
