/**
 * scripts/verify_alerts_live.js
 *
 * Runs the alert scheduler pass in MongoDB, captures:
 * 1. Scheduler boot log line: "[scheduler] Starting alert scheduler"
 * 2. An active subscription evaluation that raises an AlertEvent
 * 3. The raw AlertEvent row in MongoDB
 * 4. Executes cleanup-test-data.js reporting regex patterns and deletion counts.
 */

const path = require('path');
const { connect, disconnect } = require('../backend/src/db/connection');
const AlertSubscription = require('../backend/src/db/models/alertSubscription.model');
const AlertEvent = require('../backend/src/db/models/alertEvent.model');
const Analysis = require('../backend/src/db/models/analysis.model');
const RiskResult = require('../backend/src/db/models/riskResult.model');
const Decision = require('../backend/src/db/models/decision.model');
const scheduler = require('../backend/src/modules/alerts/scheduler');

async function main() {
  await connect();
  console.log('--- 1. Starting Alert Scheduler ---');
  scheduler.start();

  try {
    const testSubId = 'sub_test_dang_001';
    const testAnalysisId = 'req_test_dang_001';

    // Clean any prior run for these test IDs
    await AlertSubscription.deleteMany({ subscription_id: testSubId });
    await AlertEvent.deleteMany({ subscription_id: testSubId });
    await Analysis.deleteMany({ analysis_id: testAnalysisId });
    await RiskResult.deleteMany({ analysis_id: testAnalysisId });
    await Decision.deleteMany({ analysis_id: testAnalysisId });

    console.log('\n--- 2. Creating Test Subscription & Completed Analysis ---');
    const sub = await AlertSubscription.create({
      subscription_id: testSubId,
      subscriber_id: 'sub_test_user_01',
      channel: 'web_push',
      push_subscription: { endpoint: 'https://test.push/endpoint', keys: { p256dh: 'test', auth: 'test' } },
      location: { place_name: 'Kasimedu', coordinate: { lat: 13.13, lon: 80.30 } },
      alert_types: ['high_wave', 'strong_wind', 'cyclone', 'other_hazard'],
      minimum_level: 'CAUTION',
      active: true,
      language_override: 'en',
    });

    const analysis = await Analysis.create({
      analysis_id: testAnalysisId,
      request: { place_name: 'Kasimedu', coordinate: { lat: 13.13, lon: 80.30 } },
      status: 'completed',
      alert_subscription_id: testSubId,
      place_name: 'Kasimedu',
      coordinate: { lat: 13.13, lon: 80.30 },
      response_language: 'en',
      completed_at: new Date(),
    });

    await RiskResult.create({
      analysis_id: testAnalysisId,
      results: [
        {
          point_id: 'P1',
          lat: 13.13,
          lon: 80.30,
          risk_level: 'DANGEROUS',
          final_score: 88,
          baseline_score: 88,
          confidence: 0.9,
          risk_factors: ['wave_height_m', 'wind_speed_ms'],
          hard_rules_applied: [
            {
              rule_id: 'high_wave_rough_sea',
              description: 'Wave height exceeds small-craft limit',
              floor_score: 85,
            },
          ],
        },
      ],
      evaluated_at: new Date(),
    });

    await Decision.create({
      analysis_id: testAnalysisId,
      overall_risk_level: 'DANGEROUS',
      confidence: 0.9,
      recommendation_type: 'strongly_discouraged',
      one_line_recommendation: 'Severe high waves observed offshore. Do not venture out.',
      safety_rules_applied: [{ rule_id: 'high_wave_rough_sea', level: 'DANGEROUS' }],
    });

    console.log('\n--- 3. Evaluating Completed Analyses ---');
    const evalResult = await scheduler.evaluateCompletedAnalyses();
    console.log('Evaluation pass outcome:', evalResult);

    console.log('\n--- 4. Captured AlertEvent Row in MongoDB ---');
    const alertEvent = await AlertEvent.findOne({ subscription_id: testSubId }).lean();
    console.log(JSON.stringify(alertEvent, null, 2));

    console.log('\n--- 5. Stopping Alert Scheduler ---');
    scheduler.stop();

    console.log('\n--- 6. Running Test Data Cleanup ---');
    const subPattern = /^(sub_dang_|sub_test_dang|sub_test_dangerous_|sub_test_)/;
    const reqPattern = /^(req_dang_|req_test_dang|req_test_dangerous_|test_)/;

    console.log('Cleanup Regex Patterns:');
    console.log('  Subscription ID Pattern:', subPattern.toString());
    console.log('  Request/Analysis ID Pattern:', reqPattern.toString());
    console.log('  Subscriber ID Pattern: /^(device_|sub_test_)/');

    const rSub = await AlertSubscription.deleteMany({
      $or: [{ subscription_id: subPattern }, { subscriber_id: /^(device_|sub_test_)/ }],
    });
    const rEvt = await AlertEvent.deleteMany({
      $or: [{ subscription_id: subPattern }, { analysis_id: reqPattern }],
    });
    const rAna = await Analysis.deleteMany({
      $or: [{ analysis_id: reqPattern }, { alert_subscription_id: subPattern }],
    });
    const rRisk = await RiskResult.deleteMany({ analysis_id: reqPattern });
    const rDec = await Decision.deleteMany({ analysis_id: reqPattern });

    console.log('Deletion Counts:');
    console.log('  alert_subscriptions deleted:', rSub.deletedCount);
    console.log('  alert_events deleted:', rEvt.deletedCount);
    console.log('  analyses deleted:', rAna.deletedCount);
    console.log('  risk_results deleted:', rRisk.deletedCount);
    console.log('  decisions deleted:', rDec.deletedCount);

  } finally {
    await disconnect();
  }
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
