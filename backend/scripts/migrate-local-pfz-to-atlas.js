// scripts/migrate-local-pfz-to-atlas.js
const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  console.log('1. Connecting to local MongoDB...');
  const localConn = await mongoose.createConnection('mongodb://localhost:27017/orca').asPromise();
  const localDocs = await localConn.collection('pfz_advisories').find({}).toArray();
  console.log(`2. Found ${localDocs.length} PFZ documents in local MongoDB.`);

  console.log('3. Connecting to MongoDB Atlas...');
  const atlasConn = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  const atlasCol = atlasConn.collection('pfz_advisories');

  console.log('4. Copying all documents to Atlas...');
  let migrated = 0;
  for (const doc of localDocs) {
    const { _id, ...cleanDoc } = doc;
    await atlasCol.updateOne(
      { advisory_id: doc.advisory_id },
      { $set: cleanDoc },
      { upsert: true }
    );
    migrated++;
  }

  const finalCount = await atlasCol.countDocuments();
  console.log(`5. SUCCESS! Total pfz_advisories in MongoDB Atlas: ${finalCount}`);

  await localConn.close();
  await atlasConn.close();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
