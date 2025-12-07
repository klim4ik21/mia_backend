// Тестовый файл для проверки работы engines

const { UserContextEngine, BehavioralAnalysisEngine, IntentPredictionEngine } = require('./index');

// Тестовые данные
const mockHabit = {
  id: 'habit-1',
  name: 'Drink water',
  emoji: '💧',
  createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 дней назад
  reminderTime: '09:00'
};

// Создаем completions для последних 7 дней (включая сегодня)
const mockCompletions = [];
const now = Date.now();
for (let i = 0; i < 7; i++) {
  const date = new Date(now - i * 24 * 60 * 60 * 1000);
  date.setHours(9, 0, 0, 0);
  mockCompletions.push({
    timestamp: date.getTime()
  });
}

const mockSnoozeEvents = [];

const mockUserProfile = {
  mostActiveHour: 10,
  preferredTone: 'friendly',
  currentState: 'stable'
};

// Инициализация engines
const contextEngine = new UserContextEngine();
const behaviorEngine = new BehavioralAnalysisEngine();

console.log('\n🧪 Тестирование User Context Engine\n');

// 1. Временной контекст
const temporalContext = contextEngine.getTemporalContext();
console.log('📅 Временной контекст:');
console.log('  - Время дня:', temporalContext.timeOfDay);
console.log('  - День недели:', temporalContext.dayOfWeek);
console.log('  - Выходной:', temporalContext.isWeekend);
console.log('  - Час:', temporalContext.hour);

// 2. Контекст привычки
const habitContext = contextEngine.getHabitContext(mockHabit, mockCompletions, mockSnoozeEvents);
console.log('\n📊 Контекст привычки:');
console.log('  - Streak:', habitContext.streak, 'дней');
console.log('  - Completion rate:', (habitContext.completionRate * 100).toFixed(1) + '%');
console.log('  - Паттерн:', habitContext.completionPattern);
console.log('  - Эмоциональная связь:', habitContext.emotionalConnection);
console.log('  - Следующий milestone:', habitContext.milestoneProgress.nextMilestone);
console.log('  - Streak в риске:', habitContext.milestoneProgress.isAtRisk);

// 3. Контекст пользователя
const userContext = contextEngine.getUserContext('user-1', mockUserProfile);
console.log('\n👤 Контекст пользователя:');
console.log('  - Состояние:', userContext.emotionalProfile.currentState);
console.log('  - Предпочитаемый тон:', userContext.emotionalProfile.preferredTone);

// 4. Внешний контекст
const externalContext = contextEngine.getExternalContext();
console.log('\n🌍 Внешний контекст:');
console.log('  - Сезон:', externalContext.season);

console.log('\n🧪 Тестирование Behavioral Analysis Engine\n');

// 5. Анализ поведения
const behavior = behaviorEngine.analyzeCompletionPattern(mockHabit, mockCompletions, mockSnoozeEvents);
console.log('📈 Анализ поведения:');
console.log('  - Тренд:', behavior.trend);
console.log('  - Momentum:', behavior.momentum);
console.log('  - Streak в риске:', behavior.risks.streakAtRisk);
console.log('  - Мотивация снижается:', behavior.risks.motivationDeclining);
console.log('  - Может побить рекорд:', behavior.opportunities.canBreakRecord);
console.log('  - Может достичь milestone:', behavior.opportunities.canReachMilestone);

// 6. Предсказание вероятности
const context = {
  temporal: temporalContext,
  habit: habitContext,
  user: userContext,
  external: externalContext
};

const probability = behaviorEngine.predictCompletionProbability(
  mockHabit,
  context,
  mockCompletions,
  mockSnoozeEvents
);
console.log('\n🎯 Предсказание вероятности выполнения:');
console.log('  - Вероятность:', (probability * 100).toFixed(1) + '%');

// 7. Оптимальная стратегия
const strategy = behaviorEngine.determineOptimalStrategy(mockHabit, context, probability);
console.log('  - Рекомендуемая стратегия:', strategy);

console.log('\n🧪 Тестирование Intent Prediction Engine\n');

// 8. Intent Prediction Engine
const intentEngine = new IntentPredictionEngine();

// 9. Предсказание намерений
const intent = intentEngine.predictUserIntent(mockHabit, context, behavior, mockCompletions, mockSnoozeEvents);
console.log('🎯 Предсказание намерений:');
console.log('  - Тип намерения:', intent.type);
console.log('  - Уверенность:', (intent.confidence * 100).toFixed(1) + '%');
console.log('  - Потребности:', intent.needs);
console.log('  - Приоритет:', intent.priority);

// 10. Эмоциональное состояние
const emotionalState = intentEngine.detectEmotionalState(mockHabit, context, behavior, mockCompletions, mockSnoozeEvents);
console.log('\n💭 Эмоциональное состояние:');
console.log('  - Состояние:', emotionalState.state);
console.log('  - Энергия:', emotionalState.energy);
console.log('  - Потребности:', emotionalState.needs);
console.log('  - Мотивация:', emotionalState.motivation);
console.log('  - Уровень риска:', emotionalState.riskLevel);

// 11. Определение потребностей
const needs = intentEngine.determineUserNeeds(mockHabit, context, behavior, intent, emotionalState);
console.log('\n📋 Определенные потребности:');
needs.forEach((need, index) => {
  console.log(`  ${index + 1}. ${need.type} (${need.urgency}): ${need.description}`);
});

console.log('\n✅ Тестирование завершено!\n');

