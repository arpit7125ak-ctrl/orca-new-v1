// src/utils/asyncHandler.js
// ---------------------------------------------------------------------------
// Wraps an async Express handler so a rejected promise reaches the central
// errorHandler instead of becoming an unhandled rejection.
//
// WHY THIS IS NEEDED AT ALL:
// Express 4 does not understand async functions. If an `async` route handler
// throws, Express never sees it - the request just hangs until it times out,
// and the process logs an UnhandledPromiseRejection. Wrapping every handler
// converts that into a normal next(err) call.
//
// It lives in utils/ rather than inside a controller so that every module can
// import it without reaching into another module's controller file.
// ---------------------------------------------------------------------------

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
module.exports.asyncHandler = asyncHandler;
