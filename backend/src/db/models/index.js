// src/db/models/index.js
// ---------------------------------------------------------------------------
// Single import point for every model.
//
// WHY THIS EXISTS: requiring a Mongoose model file is what REGISTERS it with
// Mongoose. If a model is only required lazily inside a rarely-hit route, its
// indexes are never built at startup. Importing everything here once, from
// server.js, guarantees all 12 collections and their indexes are registered
// before the first request arrives.
// ---------------------------------------------------------------------------

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
