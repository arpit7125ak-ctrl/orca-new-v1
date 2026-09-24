/**
 * @fileoverview Central Mongoose Models Registry & Aggregator
 * @module db/models/index
 * @description
 * Single point of registration and export for all 12 core Mongoose data models.
 *
 * Operational Mechanics:
 * - Startup Index Registration: Requiring every model here during server bootstrap
 *   guarantees that all Mongoose schemas, hooks, and 2dsphere indexes are properly
 *   registered with the active MongoDB driver connection before incoming HTTP traffic arrives.
 */


module.exports = {
  Analysis:          require('./analysis.model'),
  AgentResult:       require('./agentResult.model'),
  RiskResult:        require('./riskResult.model'),
  Decision:          require('./decision.model'),
  GisLayer:          require('./gisLayer.model'),
  AlertSubscription: require('./alertSubscription.model'),
  AlertEvent:        require('./alertEvent.model'),
  GeofenceEvent:     require('./geofenceEvent.model'),
  Conversation:      require('./conversation.model'),
  Route:             require('./route.model'),
  Report:            require('./report.model'),
  User:              require('./user.model'),
};
