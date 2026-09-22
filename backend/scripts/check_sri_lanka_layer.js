require('dotenv').config();
const { connect, disconnect } = require('../src/db/connection');
const GisLayer = require('../src/db/models/gisLayer.model');

async function run() {
  await connect();
  const docs = await GisLayer.find({ layer_name: /Sri Lanka/ }).lean();
  console.log(`Found ${docs.length} Sri Lanka layers:`);
  for (const d of docs) {
    console.log(`- ID: ${d._id}, Name: "${d.layer_name}", Verification: "${d.verification}", Constraint: "${d.constraint_type}"`);
  }
  await disconnect();
}

run().catch(console.error);
