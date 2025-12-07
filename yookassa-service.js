// YooKassa Payment Service
// Интеграция с API ЮKassa для обработки платежей

const https = require('https');
const crypto = require('crypto');

class YooKassaService {
    constructor(shopId, secretKey) {
        this.shopId = shopId;
        this.secretKey = secretKey;
        this.apiUrl = 'api.yookassa.ru';
    }

    /**
     * Создание платежа
     * @param {Object} paymentData - данные платежа
     * @param {String} paymentData.amount - сумма
     * @param {String} paymentData.currency - валюта (RUB)
     * @param {String} paymentData.description - описание
     * @param {String} paymentData.returnUrl - URL для возврата
     * @param {String} idempotenceKey - ключ идемпотентности
     * @returns {Promise<Object>} - данные платежа
     */
    async createPayment(paymentData, idempotenceKey) {
        const { amount, currency = 'RUB', description, returnUrl } = paymentData;

        const requestData = JSON.stringify({
            amount: {
                value: amount,
                currency: currency
            },
            capture: true,
            confirmation: {
                type: 'redirect',
                return_url: returnUrl
            },
            description: description
        });

        return this.makeRequest('POST', '/v3/payments', requestData, idempotenceKey);
    }

    /**
     * Проверка статуса платежа
     * @param {String} paymentId - ID платежа
     * @returns {Promise<Object>} - статус платежа
     */
    async getPaymentStatus(paymentId) {
        return this.makeRequest('GET', `/v3/payments/${paymentId}`);
    }

    /**
     * Выполнение HTTP запроса к API ЮKassa
     */
    makeRequest(method, path, data = null, idempotenceKey = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.apiUrl,
                path: path,
                method: method,
                auth: `${this.shopId}:${this.secretKey}`,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (idempotenceKey) {
                options.headers['Idempotence-Key'] = idempotenceKey;
            }

            if (data) {
                options.headers['Content-Length'] = Buffer.byteLength(data);
            }

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            const parsed = JSON.parse(responseData);
                            resolve(parsed);
                        } else {
                            console.error(`❌ [YooKassa] API Error: ${res.statusCode}`);
                            console.error(`   Response: ${responseData}`);
                            reject(new Error(`YooKassa API error: ${res.statusCode} - ${responseData}`));
                        }
                    } catch (error) {
                        console.error(`❌ [YooKassa] Parse error:`, error);
                        reject(new Error('Failed to parse YooKassa response'));
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`❌ [YooKassa] Request error:`, error);
                reject(error);
            });

            if (data) {
                req.write(data);
            }

            req.end();
        });
    }

    /**
     * Генерация ключа идемпотентности
     */
    generateIdempotenceKey() {
        return crypto.randomUUID();
    }
}

module.exports = YooKassaService;

