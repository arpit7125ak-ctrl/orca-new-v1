// tests/contract/envelope.test.js
// The error-category -> HTTP status mapping from Section 40. These are the
// distinctions the Frontend branches on, so a regression here changes client
// behaviour silently.

const { HTTP, statusForCategory, statusForAnalysisState } = require('../../src/errors/httpStatus');
const { ERROR_CATEGORIES, ALL_ERROR_CATEGORIES, AppError } = require('../../src/errors/errorCategories');

describe('Section 9 error_category enum', () => {
  test('contains exactly the ten documented categories', () => {
    expect(ALL_ERROR_CATEGORIES).toHaveLength(10);
    expect(ALL_ERROR_CATEGORIES).toEqual(expect.arrayContaining([
      'invalid_location', 'unsupported_region', 'unresolvable_place', 'unsupported_time',
      'planner_failure', 'risk_failure', 'validation_failure', 'upstream_unavailable',
      'timeout', 'internal_error',
    ]));
  });
});

describe('Section 40 - 400 vs 422', () => {
  test('MALFORMED input maps to 400', () => {
    expect(statusForCategory(ERROR_CATEGORIES.VALIDATION_FAILURE)).toBe(HTTP.BAD_REQUEST);
    // A latitude of 200 is nonsense, not "valid but unsupported".
    expect(statusForCategory(ERROR_CATEGORIES.INVALID_LOCATION)).toBe(HTTP.BAD_REQUEST);
  });

  test('the three semantic cases Section 40 names map to 422', () => {
    expect(statusForCategory(ERROR_CATEGORIES.UNSUPPORTED_REGION)).toBe(HTTP.UNPROCESSABLE_ENTITY);
    expect(statusForCategory(ERROR_CATEGORIES.UNRESOLVABLE_PLACE)).toBe(HTTP.UNPROCESSABLE_ENTITY);
    expect(statusForCategory(ERROR_CATEGORIES.UNSUPPORTED_TIME)).toBe(HTTP.UNPROCESSABLE_ENTITY);
  });
});

describe('Section 40 - upstream failures', () => {
  test('upstream_unavailable maps to 502', () => {
    expect(statusForCategory(ERROR_CATEGORIES.UPSTREAM_UNAVAILABLE)).toBe(HTTP.BAD_GATEWAY);
  });

  test('timeout maps to 504', () => {
    expect(statusForCategory(ERROR_CATEGORIES.TIMEOUT)).toBe(HTTP.GATEWAY_TIMEOUT);
  });

  test('our own pipeline failures map to 500', () => {
    expect(statusForCategory(ERROR_CATEGORIES.PLANNER_FAILURE)).toBe(HTTP.INTERNAL_SERVER_ERROR);
    expect(statusForCategory(ERROR_CATEGORIES.RISK_FAILURE)).toBe(HTTP.INTERNAL_SERVER_ERROR);
  });

  test('an unknown category falls back to 500 rather than guessing', () => {
    expect(statusForCategory('nonsense_category')).toBe(HTTP.INTERNAL_SERVER_ERROR);
  });
});

describe('statusForAnalysisState', () => {
  test('completed is 200', () => {
    expect(statusForAnalysisState('completed')).toBe(HTTP.OK);
  });

  test('partial is 206 - this is what tells the client data is incomplete', () => {
    expect(statusForAnalysisState('partial')).toBe(HTTP.PARTIAL_CONTENT);
  });

  test('queued and running are 200 - the POLL succeeded', () => {
    expect(statusForAnalysisState('queued')).toBe(HTTP.OK);
    expect(statusForAnalysisState('running')).toBe(HTTP.OK);
  });

  test('failed resolves from the stored error_category', () => {
    expect(statusForAnalysisState('failed', ERROR_CATEGORIES.UNSUPPORTED_REGION))
      .toBe(HTTP.UNPROCESSABLE_ENTITY);
  });
});

describe('AppError', () => {
  test('carries its category', () => {
    expect(new AppError('x', ERROR_CATEGORIES.TIMEOUT).errorCategory).toBe('timeout');
  });

  test('an unknown category is coerced to internal_error rather than leaking', () => {
    expect(new AppError('x', 'made_up').errorCategory).toBe('internal_error');
  });
});
