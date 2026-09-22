const { connect, disconnect } = require('../src/db/connection');
const AlertSubscription = require('../src/db/models/alertSubscription.model');
const AlertEvent = require('../src/db/models/alertEvent.model');
const Analysis = require('../src/db/models/analysis.model');
const RiskResult = require('../src/db/models/riskResult.model');
const Decision = require('../src/db/models/decision.model');

async function cleanup() {
  await connect();
  try {
    const subPattern = /^(sub_dang_|sub_test_dang|sub_test_dangerous_|sub_test_)/;
    const reqPattern = /^(req_dang_|req_test_dang|req_test_dangerous_|test_)/;

    const rSub = await AlertSubscription.deleteMany({
      $or: [{ subscription_id: subPattern }, { subscriber_id: /^(device_|sub_test_)/ }]
    });
    const rEvt = await AlertEvent.deleteMany({
      $or: [{ subscription_id: subPattern }, { analysis_id: reqPattern }]
    });
    const rAna = await Analysis.deleteMany({
      $or: [{ analysis_id: reqPattern }, { alert_subscription_id: subPattern }]
    });
    const rRisk = await RiskResult.deleteMany({ analysis_id: reqPattern });
    const rDec = await Decision.deleteMany({ analysis_id: reqPattern });

    console.log('CLEANUP RESULTS:');
    console.log('alert_subscriptions deleted:', rSub.deletedCount);
    console.log('alert_events deleted:', rEvt.deletedCount);
    console.log('analyses deleted:', rAna.deletedCount);
    console.log('risk_results deleted:', rRisk.deletedCount);
    console.log('decisions deleted:', rDec.deletedCount);
  } finally {
    await disconnect();
  }
}

cleanup().catch(console.error);
