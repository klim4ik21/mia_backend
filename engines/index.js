// Engines index - экспорт всех engines
const UserContextEngine = require('./user-context-engine');
const BehavioralAnalysisEngine = require('./behavioral-analysis-engine');
const IntentPredictionEngine = require('./intent-prediction-engine');
const BaseReminderEngine = require('./base-reminder-engine');
const NotificationOrchestrator = require('./notification-orchestrator');

module.exports = {
  UserContextEngine,
  BehavioralAnalysisEngine,
  IntentPredictionEngine,
  BaseReminderEngine,
  NotificationOrchestrator
};

