/**
 * ============================================================================
 * ORCA Dual-Gateway Process Supervisor (src/start-both.js)
 * ============================================================================
 * Production process supervisor spawning and managing both backend gateways:
 * - Public Gateway (Port 4000 via server.js)
 * - Internal Callback Gateway (Port 4100 via internal-server.js)
 * 
 * Process Management Architecture:
 * - Uses Node.js child_process.fork() with inherited stdio for unified log aggregation.
 * - Centralized signal handling forwards SIGTERM / SIGINT down to child workers.
 * - Fail-fast monitoring: If either gateway crashes unexpectedly, supervisor exits
 *   with that status code so container orchestrators (Docker, Kubernetes) can restart the pod.
 */

const { fork } = require('child_process');
const path = require('path');

const publicServerPath = path.join(__dirname, 'server.js');
const internalServerPath = path.join(__dirname, 'internal-server.js');

console.log('[ORCA-Supervisor] Starting ORCA Public Gateway and Internal Gateway...');

let publicProcess = fork(publicServerPath, [], { stdio: 'inherit' });
let internalProcess = fork(internalServerPath, [], { stdio: 'inherit' });

function shutdown(signal) {
  console.log(`[ORCA-Supervisor] Received ${signal}. Gracefully terminating child processes...`);
  if (publicProcess) publicProcess.kill(signal);
  if (internalProcess) internalProcess.kill(signal);
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

publicProcess.on('exit', (code) => {
  console.error(`[ORCA-Supervisor] Public Gateway exited with code ${code}`);
  if (code !== 0) process.exit(code || 1);
});

internalProcess.on('exit', (code) => {
  console.error(`[ORCA-Supervisor] Internal Gateway exited with code ${code}`);
  if (code !== 0) process.exit(code || 1);
});
