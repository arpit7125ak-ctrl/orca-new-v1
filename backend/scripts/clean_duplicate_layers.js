require('dotenv').config();
const { connect, disconnect } = require('../src/db/connection');
const GisLayer = require('../src/db/models/gisLayer.model');

async function run() {
  await connect();
  // Delete the old duplicate that had the suffixed name
  const resDel = await GisLayer.deleteMany({
    layer_name: 'India - Sri Lanka International Maritime Boundary & Sri Lankan Waters (approximate boundary, unverified)'
  });
  console.log('Deleted duplicate suffixed layer:', resDel.deletedCount);

  // Update the canonical layer to approximate
  const resUpd = await GisLayer.updateOne(
    { layer_name: 'India - Sri Lanka International Maritime Boundary & Sri Lankan Waters' },
    { $set: { verification: 'approximate', active: true } }
  );
  console.log('Updated canonical Sri Lanka layer to approximate:', resUpd.modifiedCount);

  // Check all layers matching Sri Lanka
  const docs = await GisLayer.find({ layer_name: /Sri Lanka/ }).lean();
  for (const d of docs) {
    console.log(`- Layer: "${d.layer_name}", Verification: "${d.verification}", Constraint: "${d.constraint_type}"`);
  }
  await disconnect();
}

run().catch(console.error);
