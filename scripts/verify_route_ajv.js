const path = require('path');
const Ajv = require(path.resolve(__dirname, '../backend/node_modules/ajv'));
const addFormats = require(path.resolve(__dirname, '../backend/node_modules/ajv-formats'));
const fs = require('fs');

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const contractsDir = path.resolve(__dirname, '../contracts');
const scriptsDir = path.resolve(__dirname, '../scripts');

const errorInfo = JSON.parse(fs.readFileSync(path.join(contractsDir, 'shared/ErrorInfo.json'), 'utf8'));
const location = JSON.parse(fs.readFileSync(path.join(contractsDir, 'shared/Location.json'), 'utf8'));
const routeResultSchema = JSON.parse(fs.readFileSync(path.join(contractsDir, 'RouteResult.json'), 'utf8'));

ajv.addSchema(errorInfo, 'https://orca.sih26176/schemas/shared/ErrorInfo.json');
ajv.addSchema(location, 'https://orca.sih26176/schemas/shared/Location.json');

const validate = ajv.compile(routeResultSchema);
const data = JSON.parse(fs.readFileSync(path.join(scriptsDir, 'route_kochi_mangalore_output.json'), 'utf8'));

const valid = validate(data);
if (valid) {
  console.log('AJV VALIDATION SUCCESS: route_kochi_mangalore_output.json is VALID against contracts/RouteResult.json');
  console.log('Summary of validated route result:');
  console.log('  Route ID:', data.route_id);
  console.log('  Status:', data.status);
  console.log('  Vessel Type:', data.vessel_type);
  console.log('  Total Distance (km):', data.total_distance_km);
  console.log('  Estimated Duration (hours):', data.estimated_duration_hours);
  console.log('  Max Risk Score:', data.max_risk_score);
  console.log('  Max Risk Level:', data.max_risk_level);
  console.log('  Waypoints count:', data.waypoints.length);
  console.log('  Time of passage risk count:', data.time_of_passage_risk.length);
} else {
  console.error('AJV VALIDATION FAILED:', validate.errors);
  process.exit(1);
}
