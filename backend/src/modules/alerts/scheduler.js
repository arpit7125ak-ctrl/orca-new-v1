// src/modules/alerts/scheduler.js
// ---------------------------------------------------------------------------
// The proactive alerting loop. The problem statement requires "proactive alerts
// for adverse weather, high waves, lightning, cyclones, and other hazardous
// marine conditions" - proactive means ORCA checks WITHOUT being asked.
//
// HOW IT WORKS:
//   1. Every ALERT_SCHEDULER_CRON tick, load active subscriptions.
//   2. For each, create an analysis (alert_subscription_id links it back).
//   3. The AI Service runs it and calls back with a result.
//   4. evaluateCompletedAnalyses() then converts qualifying results into alerts.
//
// WHY TWO PHASES INSTEAD OF ONE:
// Analyses are asynchronous (Section 103: 202 Accepted). The scheduler cannot
// dispatch and immediately read a result. So one tick dispatches, and a later
// tick evaluates whatever has since completed. This is also why the process
// survives an AI Service outage - the dispatch simply fails and is retried on
// the next tick.
//
// RUNS IN src/worker.js ONLY - never inside the API server process. A cron
// firing inside a horizontally-scaled API tier would send duplicate alerts
// from every instance.
// ---------------------------------------------------------------------------

const cron = require('node-cron');

const AlertSubscription = require('../../db/models/alertSubscription.model');
const Analysis = require('../../db/models/analysis.model');
const RiskResult = require('../../db/models/riskResult.model');
const Decision = require('../../db/models/decision.model');

const analysisService = require('../analysis/analysis.service');
const dedup = require('./dedup');
const eventLogger = require('./eventLogger');
const webPush = require('./delivery/webPush');
const i18n = require('../../i18n');
const limits = require('../../config/limits');
const { logger } = require('../../observability/logger');

/**
 * PHASE 1 - dispatch an analysis for every active subscription.
 */
async function dispatchSubscriptionChecks() {
  const subscriptions = await AlertSubscription.find({ active: true })
    .sort({ last_checked_at: 1 }) // oldest-checked first, so none starves
    .limit(100)                   // bounded per tick to avoid flooding the AI Service
    .lean();

  logger.info({ count: subscriptions.length }, '[scheduler] Dispatching subscription checks');

  let dispatched = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await analysisService.createAnalysis(
        {
          // subscription.location IS ALREADY a place_or_coordinate object
          // (contracts/api/AlertSubscriptionRequest.json), so it maps directly
          // onto AnalysisRequest's own place_or_coordinate fields.
          query: 'Scheduled safety check for this location.',
          coordinate: subscription.location.coordinate || null,
          place_name: subscription.location.place_name || null,
          activity: subscription.activity,
          vessel_type: subscription.vessel_type,
          language_override: subscription.language_override,
        },
        // This linkage is what lets phase 2 find the result later (Section 8.1).
        { alert_subscription_id: subscription.subscription_id }
      );

      await AlertSubscription.updateOne(
        { subscription_id: subscription.subscription_id },
        { last_checked_at: new Date() }
      );

      dispatched += 1;
    } catch (err) {
      // One bad subscription must never stop the loop - the remaining
      // subscribers still need their checks.
      failed += 1;
      logger.error(
        { subscription_id: subscription.subscription_id, err: err.message },
        '[scheduler] Failed to dispatch check for subscription'
      );
    }
  }

  logger.info({ dispatched, failed }, '[scheduler] Dispatch pass complete');
  return { dispatched, failed };
}

/**
 * PHASE 2 - turn completed subscription-triggered analyses into alerts.
 */
async function evaluateCompletedAnalyses() {
  // Only analyses that (a) came from a subscription, (b) have finished, and
  // (c) are recent. The time bound stops us re-processing old history forever.
  const since = new Date(Date.now() - limits.ALERT_DEDUP_WINDOW_MS);

  const analyses = await Analysis.find({
    alert_subscription_id: { $ne: null },
    status: { $in: ['completed', 'partial'] },
    completed_at: { $gte: since },
    // Set once we have evaluated it, so each analysis is only alerted on once.
    alert_evaluated: { $ne: true },
  })
    .limit(100)
    .lean();

  logger.info({ count: analyses.length }, '[scheduler] Evaluating completed analyses for alerts');

  let raised = 0;
  let suppressed = 0;

  for (const analysis of analyses) {
    try {
      const outcome = await evaluateOne(analysis);
      if (outcome.raised) raised += 1;
      else suppressed += 1;

      // Mark as handled regardless of outcome, so it is not re-evaluated.
      await Analysis.updateOne(
        { analysis_id: analysis.analysis_id },
        { alert_evaluated: true }
      );
    } catch (err) {
      logger.error(
        { analysis_id: analysis.analysis_id, err: err.message },
        '[scheduler] Failed to evaluate analysis for alerting'
      );
    }
  }

  logger.info({ raised, suppressed }, '[scheduler] Evaluation pass complete');
  return { raised, suppressed };
}

/**
 * Decide whether one completed analysis warrants an alert, and deliver it.
 */
async function evaluateOne(analysis) {
  const subscription = await AlertSubscription.findOne({
    subscription_id: analysis.alert_subscription_id,
    active: true,
  }).lean();

  // The user unsubscribed between dispatch and completion.
  if (!subscription) return { raised: false, reason: 'subscription_inactive' };

  const [riskResult, decision] = await Promise.all([
    RiskResult.findOne({ analysis_id: analysis.analysis_id }).lean(),
    Decision.findOne({ analysis_id: analysis.analysis_id }).lean(),
  ]);

  // --- Determine the worst level across all points ----------------------
  // WORST, not average - consistent with the Section 48.4.1 conservative rule.
  // A subscriber must be warned about the most dangerous point in their area,
  // not a comfortable mean.
  let worstLevel = null;
  // contracts/db/RiskResultsDocument.json stores the array under `results`,
  // and each RiskAssessment names the level `risk_level` - UPPERCASE
  // (SAFE|CAUTION|UNSAFE|DANGEROUS).
  for (const point of riskResult?.results || []) {
    const level = point.risk_level;
    if (!level) continue;
    if (!worstLevel || (dedup.LEVEL_RANK[level] || 0) > (dedup.LEVEL_RANK[worstLevel] || 0)) {
      worstLevel = level;
    }
  }

  // No computable risk level means no honest alert can be made. We do NOT
  // invent a level, and we do NOT send a reassuring "all clear" that the data
  // does not support.
  if (!worstLevel) return { raised: false, reason: 'no_risk_level_computed' };

  // --- Threshold check (Section 99.6) -----------------------------------
  if (!dedup.meetsThreshold(worstLevel, subscription.minimum_level)) {
    await eventLogger.recordAlert({
      subscriptionId: subscription.subscription_id,
      analysisId: analysis.analysis_id,
      alertType: 'adverse_weather',
      level: worstLevel,
      messageText: null,
      language: subscription.language_override,
      dedupKey: dedup.buildAlertDedupKey({
        subscriptionId: subscription.subscription_id,
        alertType: 'adverse_weather',
        level: worstLevel,
      }),
      status: 'evaluated_no_send',  // below minimum_level threshold
    });
    return { raised: false, reason: 'below_threshold' };
  }

  // --- Pick the alert type ----------------------------------------------
  const alertType = inferAlertType(analysis, decision, riskResult);

  // Respect the subscriber's chosen alert types when they set any.
  if (subscription.alert_types?.length && !subscription.alert_types.includes(alertType)) {
    return { raised: false, reason: 'alert_type_not_subscribed' };
  }

  // --- Deduplication (Section 99.7) -------------------------------------
  const { duplicate, dedupKey } = await dedup.isDuplicate({
    subscriptionId: subscription.subscription_id,
    alertType,
    level: worstLevel,
  });

  if (duplicate) {
    await eventLogger.recordAlert({
      subscriptionId: subscription.subscription_id,
      analysisId: analysis.analysis_id,
      alertType,
      level: worstLevel,
      messageText: null,
      language: subscription.language_override,
      dedupKey,
      status: 'suppressed_duplicate',
    });
    return { raised: false, reason: 'duplicate' };
  }

  // --- Quiet hours (Section 99.6) ---------------------------------------
  // Severe alerts pierce quiet hours - see dedup.isWithinQuietHours.
  if (dedup.isWithinQuietHours(subscription.quiet_hours, worstLevel)) {
    await eventLogger.recordAlert({
      subscriptionId: subscription.subscription_id,
      analysisId: analysis.analysis_id,
      alertType,
      level: worstLevel,
      messageText: null,
      language: subscription.language_override,
      dedupKey,
      status: 'evaluated_no_send',  // within quiet hours
    });
    return { raised: false, reason: 'quiet_hours' };
  }

  // --- Build the message (pre-translated template, no LLM) --------------
  const language = subscription.language_override || 'en';
  // location is place_or_coordinate - prefer the name, fall back to
  // coordinates if that's all that was given.
  const coord = subscription.location.coordinate;
  const locationLabel =
    subscription.location.place_name ||
    (coord ? `${coord.lat.toFixed(2)}, ${coord.lon.toFixed(2)}` : 'the subscribed location');

  const { message, languageUsed } = i18n.alertMessage(alertType, language, {
    location: locationLabel,
    level: worstLevel,
    detail: decision?.one_line_recommendation || '',
  });

  // --- Record, then deliver ---------------------------------------------
  // Recorded BEFORE delivery so a crash mid-send still leaves a trace.
  const event = await eventLogger.recordAlert({
    subscriptionId: subscription.subscription_id,
    analysisId: analysis.analysis_id,
    alertType,
    level: worstLevel,
    messageText: message,
    language: languageUsed,
    channel: subscription.channel,
    dedupKey,
    status: 'evaluated_no_send',  // becomes 'sent' or 'failed' after delivery
  });

  const delivery = await webPush.send(subscription.push_subscription, {
    title: 'ORCA Marine Alert',
    body: message,
    data: { analysis_id: analysis.analysis_id, level: worstLevel, alert_type: alertType },
  });

  await eventLogger.markDelivered(event._id, {
    success: delivery.delivered,
    error: delivery.error || delivery.reason || null,
  });

  // A dead browser subscription is deactivated rather than retried forever.
  if (delivery.reason === 'subscription_expired') {
    await AlertSubscription.updateOne(
      { subscription_id: subscription.subscription_id },
      { active: false }
    );
    logger.info(
      { subscription_id: subscription.subscription_id },
      '[scheduler] Deactivated subscription with an expired push endpoint'
    );
  }

  if (delivery.delivered) {
    await AlertSubscription.updateOne(
      { subscription_id: subscription.subscription_id },
      { last_alert_at: new Date() }
    );
  }

  return { raised: true, delivered: delivery.delivered, level: worstLevel, alertType };
}

/**
 * Infer which alert type best describes this analysis using structured fields.
 * Inspects official_warnings, hard_rules_applied, and contributing risk factors.
 */
function inferAlertType(analysis, decision, riskResult) {
  // 1. Check structured official warnings
  for (const point of riskResult?.results || []) {
    for (const w of point.official_warnings || []) {
      const auth = (w.issuing_authority || '').toLowerCase();
      const bId = (w.bulletin_id || '').toLowerCase();
      if (bId.includes('cyclone') || auth.includes('cyclone') || w.warning_type === 'cyclone') {
        return 'cyclone';
      }
      return 'official_warning';
    }
  }

  // 2. Check structured hard rules applied
  for (const point of riskResult?.results || []) {
    for (const r of point.hard_rules_applied || []) {
      const rid = (r.rule_id || '').toLowerCase();
      if (rid.includes('cyclone')) return 'cyclone';
      if (rid.includes('wave') || rid.includes('swell')) return 'high_wave';
      if (rid.includes('lightning') || rid.includes('thunder')) return 'lightning';
      if (rid.includes('wind') || rid.includes('gale') || rid.includes('squall')) return 'strong_wind';
    }
  }

  // 3. Check structured primary risk factors
  for (const point of riskResult?.results || []) {
    const factors = point.risk_factors || [];
    if (factors.some((f) => f.includes('wave') || f.includes('swell'))) return 'high_wave';
    if (factors.some((f) => f.includes('wind') || f.includes('gust'))) return 'strong_wind';
    if (factors.some((f) => f.includes('cyclone'))) return 'cyclone';
  }

  // 4. Check structured decision properties
  if (decision?.safety_rules_applied?.some((r) => (r.rule_id || '').includes('cyclone'))) {
    return 'cyclone';
  }

  return 'other_hazard';
}

let dispatchTask = null;
let evaluateTask = null;

/** Start both cron loops. Called only by src/worker.js. */
function start() {
  logger.info(
    { cron: limits.ALERT_SCHEDULER_CRON },
    '[scheduler] Starting alert scheduler'
  );

  dispatchTask = cron.schedule(limits.ALERT_SCHEDULER_CRON, async () => {
    try {
      await dispatchSubscriptionChecks();
    } catch (err) {
      logger.error({ err: err.message }, '[scheduler] Dispatch pass threw');
    }
  });

  // Evaluation runs more often than dispatch, because results arrive
  // continuously after a dispatch wave rather than all at once.
  evaluateTask = cron.schedule('*/5 * * * *', async () => {
    try {
      await evaluateCompletedAnalyses();
    } catch (err) {
      logger.error({ err: err.message }, '[scheduler] Evaluation pass threw');
    }
  });
}

function stop() {
  if (dispatchTask) dispatchTask.stop();
  if (evaluateTask) evaluateTask.stop();
  logger.info('[scheduler] Alert scheduler stopped');
}

module.exports = {
  start,
  stop,
  dispatchSubscriptionChecks,
  evaluateCompletedAnalyses,
  evaluateOne,
  inferAlertType,
};
