/**
 * @fileoverview Express Asynchronous Route Handler Wrapper
 * @module utils/asyncHandler
 * @description
 * High-order function that wraps asynchronous Express route handlers and middleware.
 * Ensures that unhandled Promise rejections are automatically forwarded to Express's
 * `next(err)` error-handling chain, preventing process hangs or orphaned HTTP sockets.
 */

/**
 * Wraps an async route handler or middleware.
 *
 * @param {Function} fn - An async Express route handler `(req, res, next) => Promise<any>`.
 * @returns {import('express').RequestHandler} Standard Express request handler.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
module.exports.asyncHandler = asyncHandler;
