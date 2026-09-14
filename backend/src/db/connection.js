// src/db/connection.js
// Connects to MongoDB when the app starts. Nothing else in the app should
// call mongoose.connect() directly — this is the one place it happens.

const mongoose = require('mongoose');
const env = require('../config/env');

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    return mongoose.connection;
  }

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(env.MONGO_URI, {
      // Mongoose 8 no longer needs useNewUrlParser / useUnifiedTopology,
      // they're the default behavior now — keeping this options object
      // here anyway as the place to add things like maxPoolSize later.
    });

    isConnected = true;

    console.log(
      `[db] Connected to MongoDB at ${maskCredentials(env.MONGO_URI)} ` +
      `(db: ${mongoose.connection.name})`
    );

    mongoose.connection.on('error', (err) => {
      console.error('[db] MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('[db] MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (err) {
    console.error('[db] Failed to connect to MongoDB:', err.message);
    // Fail loudly at startup rather than limping along with no database.
    process.exit(1);
  }
}

async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('[db] MongoDB connection closed');
}

// Never log a full connection string if it contains credentials
// (mongodb://user:pass@host/db) — mask everything between // and @.
function maskCredentials(uri) {
  return uri.replace(/\/\/([^@]+)@/, '//***:***@');
}

// Close the connection cleanly on shutdown signals so local dev (and any
// process manager) doesn't leave a dangling connection behind.
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});

// Exported under BOTH naming styles deliberately.
// The original files in this repo were written against connectDB/disconnectDB;
// the entry points (server.js, internal-server.js, worker.js) and scripts use
// the shorter connect/disconnect. Exporting both aliases means neither style
// breaks, and there is still exactly ONE implementation behind them.
module.exports = {
  connectDB,
  disconnectDB,
  connect: connectDB,
  disconnect: disconnectDB,
};
