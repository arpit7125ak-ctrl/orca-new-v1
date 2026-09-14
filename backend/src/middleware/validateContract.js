// src/middleware/validateContract.js
// ---------------------------------------------------------------------------
// THE contract gate. The 44-file `contracts/` set is the locked single source
// of truth for this project - architecture doc and code conform to the
// contracts, never the reverse. This middleware is what actually enforces
// that at runtime.
//
// HOW IT WORKS:
//   1. At startup, every contracts/**/*.json is loaded into one Ajv instance.
//   2. Because they are all in ONE instance, cross-file $refs resolve
//      naturally (e.g. a response schema referencing shared/Measurement.json).
//   3. Routes call validateContract('api/AnalysisRequest.json') as middleware.
//
// GRACEFUL DEGRADATION - IMPORTANT FOR YOUR SETUP:
// The contracts/ directory may not be present in every checkout yet. If it is
// missing, we log a loud warning and let requests through rather than
// hard-crashing the server, because module-level validators (analysis.validator
// .js etc.) already cover the Section 7 structural rules independently. When
// contracts ARE present, they take precedence and this becomes the strict gate.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const { AppError, ERROR_CATEGORIES } = require('../errors/errorCategories');
const { logger } = require('../observability/logger');

// contracts/ sits at the repo root, alongside backend/ and ai-service/.
const CONTRACTS_DIR = path.resolve(__dirname, '../../../contracts');

const ajv = new Ajv({
  allErrors: true,       // report every problem, not just the first
  strict: false,         // JSON Schema drafts vary; do not fight the contracts
  removeAdditional: false, // NEVER silently drop fields - see note below
  useDefaults: false,    // NEVER inject defaults - see never-fabricate note
  coerceTypes: false,    // "5" must not silently become 5; a string lat is a bug
});

// NEVER-FABRICATE NOTE on the three `false` settings above:
//   useDefaults:true would have Ajv INVENT values for absent fields. That is
//   textbook fabrication - a missing wave height would silently become a
//   default number and flow into a safety score.
//   coerceTypes:true would mask adapter bugs by quietly converting types.
//   removeAdditional:true would hide contract drift instead of surfacing it.

addFormats(ajv); // date-time, email, uri, etc.

let contractsLoaded = false;
let loadedCount = 0;

/** Recursively collect every .json file under a directory. */
function collectJsonFiles(dir, collected = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsonFiles(fullPath, collected);
    else if (entry.name.endsWith('.json')) collected.push(fullPath);
  }
  return collected;
}

/**
 * Load every contract into the shared Ajv instance.
 * Each schema is keyed by its path relative to contracts/ (e.g.
 * "api/AnalysisRequest.json") so routes reference them the same way a human
 * would name the file.
 */
function loadContracts() {
  if (!fs.existsSync(CONTRACTS_DIR)) {
    logger.warn(
      { contractsDir: CONTRACTS_DIR },
      '[contracts] contracts/ directory not found. Contract validation is DISABLED. ' +
      'Module-level validators still apply. Copy your 44-file contracts/ set to the repo root to enable.'
    );
    return;
  }

  const files = collectJsonFiles(CONTRACTS_DIR);

  for (const filePath of files) {
    // LEADING SLASH IS REQUIRED. Ajv's URI resolver normalises a relative
    // $ref against a base id that has no leading slash by treating the base
    // as already rooted - so "../shared/ErrorInfo.json" resolved against
    // "api/InternalResultPayload.json" comes out as "/shared/ErrorInfo.json"
    // (WITH a leading slash), which then fails to match a registered key of
    // "shared/ErrorInfo.json" (WITHOUT one). Registering every schema under
    // a key that itself starts with "/" makes the two consistent. Found by
    // live testing: the fix in the previous commit (overriding $id to the
    // bare relative path) resolved the ProgressMessage.json -> ErrorInfo.json
    // case, because that $ref has no "../" and happened to resolve without
    // hitting the leading-slash mismatch - but it did NOT fix the identical
    // problem one directory level deeper, in InternalResultPayload.json.
    const relativeKey = '/' + path.relative(CONTRACTS_DIR, filePath).split(path.sep).join('/');
    try {
      const schema = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      schema.$id = relativeKey;
      ajv.addSchema(schema, relativeKey);
      loadedCount += 1;
    } catch (err) {
      // A malformed contract is a build error, not a runtime surprise.
      logger.error({ file: relativeKey, err: err.message }, '[contracts] Failed to load contract');
    }
  }

  contractsLoaded = loadedCount > 0;
  logger.info({ count: loadedCount, dir: CONTRACTS_DIR }, '[contracts] Contracts loaded');
}

loadContracts(); // run once at require-time

/**
 * Format Ajv errors into something a developer can act on in Postman.
 * Ajv's raw output is accurate but nearly unreadable.
 */
function formatErrors(errors = []) {
  return errors.map((e) => ({
    field: e.instancePath || '(root)',
    rule: e.keyword,
    message: e.message,
    ...(e.params && Object.keys(e.params).length ? { details: e.params } : {}),
  }));
}

/**
 * Validate a plain object against a named contract.
 * Returns { valid, errors } instead of throwing, so non-HTTP callers (the
 * worker, internal handlers) can use it too.
 */
function validateAgainst(contractKey, data) {
  if (!contractsLoaded) return { valid: true, errors: [], skipped: true };

  // Callers pass clean keys ("AnalysisRequest.json", "api/RouteRequest.json")
  // - the leading slash is an internal registration detail (see loadContracts
  // for why it is required), so it is added here rather than pushed onto
  // every call site.
  const lookupKey = contractKey.startsWith('/') ? contractKey : `/${contractKey}`;
  const validator = ajv.getSchema(lookupKey);
  if (!validator) {
    logger.warn({ contractKey }, '[contracts] Unknown contract key - validation skipped');
    return { valid: true, errors: [], skipped: true };
  }

  const valid = validator(data);
  return { valid, errors: valid ? [] : formatErrors(validator.errors), skipped: false };
}

/**
 * Express middleware factory.
 *
 * @param {string} contractKey e.g. "api/AnalysisRequest.json"
 * @param {'body'|'query'|'params'} source
 */
function validateContract(contractKey, source = 'body') {
  return function contractValidator(req, res, next) {
    const { valid, errors, skipped } = validateAgainst(contractKey, req[source]);

    if (skipped) return next();

    if (!valid) {
      // Section 40: malformed input => 400, via validation_failure.
      return next(
        new AppError(
          `Request does not conform to contract ${contractKey}`,
          ERROR_CATEGORIES.VALIDATION_FAILURE,
          { contract: contractKey, violations: errors }
        )
      );
    }

    return next();
  };
}

/**
 * Validate an OUTGOING response in non-production.
 *
 * Catches contract drift during development - the backend promising a shape it
 * does not actually produce. Never blocks a response in production: shipping
 * the user a real answer beats enforcing our own schema on the way out.
 */
function assertResponseContract(contractKey, data) {
  const { valid, errors } = validateAgainst(contractKey, data);
  if (!valid) {
    logger.error(
      { contractKey, violations: errors },
      '[contracts] OUTGOING RESPONSE violates its contract - fix before demo'
    );
  }
  return valid;
}

module.exports = validateContract;
module.exports.validateAgainst = validateAgainst;
module.exports.assertResponseContract = assertResponseContract;
module.exports.isLoaded = () => contractsLoaded;
module.exports.loadedCount = () => loadedCount;
module.exports.CONTRACTS_DIR = CONTRACTS_DIR;
