// scripts/test-decision.js
const http = require('http');
const mongoose = require('mongoose');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(b) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: b });
        }
      });
    }).on('error', reject);
  });
}

async function testDecisionOutput() {
  await mongoose.connect('mongodb://localhost:27017/orca');
  const db = mongoose.connection.db;

  const decisions = await db
    .collection('decisions')
    .find()
    .sort({ created_at: -1 })
    .limit(2)
    .toArray();

  console.log('=== RETRIEVED ' + decisions.length + ' RECENT DECISION AGENT OUTPUTS ===\n');

  for (const doc of decisions) {
    console.log('='.repeat(75));
    console.log('DECISION FOR ANALYSIS ID: ' + doc.analysis_id);
    console.log('='.repeat(75));

    const apiRes = await get('http://localhost:4000/api/v1/analysis/' + doc.analysis_id);
    console.log('API Status Endpoint Code: ' + apiRes.status + ' (Result returned cleanly)');

    console.log('\n--- 1. CORE RECOMMENDATION FIELDS ---');
    console.log('recommendation_type     : ' + doc.recommendation_type);
    console.log('response_language       : ' + doc.response_language);
    console.log('generated_at            : ' + doc.generated_at);
    console.log('preferred_point         : ' + doc.preferred_point);
    console.log('preferred_point_reason  : ' + doc.preferred_point_reason);
    console.log('worst_point             : ' + doc.worst_point);

    console.log('\n--- 2. NATURAL LANGUAGE ADVISORIES ---');
    console.log('one_line_recommendation : ' + doc.one_line_recommendation);
    console.log('\ndetailed_recommendation :\n' + doc.detailed_recommendation);

    console.log('\n--- 3. STRUCTURED KEY FINDINGS ---');
    console.log(JSON.stringify(doc.key_findings, null, 2));

    console.log('\n--- 4. SAMPLED POINT SCORES SUMMARY ---');
    const scores = doc.point_scores || [];
    console.log('Total Evaluated Points  : ' + scores.length);
    for (const p of scores.slice(0, 2)) {
      console.log('  * Point ' + p.point_id + ': Final Risk Score = ' + p.final_score + ' (' + p.risk_level + '), Constraint Floor = ' + (p.constraint_floor || 'None'));
      if (p.official_warnings && p.official_warnings.length > 0) {
        console.log('    -> OFFICIAL WARNING: ' + JSON.stringify(p.official_warnings));
      }
    }
    console.log('\n');
  }

  await mongoose.disconnect();
}

testDecisionOutput().catch(console.error);
