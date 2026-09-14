// tests/unit/trace.test.js
// Section 100 execution trace. The key invariant: an unfinished stage must be
// VISIBLY unfinished (null duration), never tidied up with a fake zero.

const trace = require('../../src/observability/trace');

describe('startEntry', () => {
  test('an in-flight stage has null completed_at and null duration', () => {
    const entry = trace.startEntry({ stage: 'weather_agent' });
    expect(entry.status).toBe('running');
    expect(entry.completed_at).toBeNull();
    expect(entry.duration_ms).toBeNull();   // null, NOT 0
    expect(entry.duration_ms).not.toBe(0);
  });
});

describe('skippedEntry', () => {
  test('Section 107: a skipped stage always carries a reason', () => {
    const entry = trace.skippedEntry({ stage: 'pfz_agent', selectionReason: 'intent is safety only' });
    expect(entry.status).toBe('skipped');
    expect(entry.selected).toBe(false);
    expect(entry.selection_reason).toBe('intent is safety only');
  });

  test('falls back to a default reason rather than leaving it null', () => {
    expect(trace.skippedEntry({ stage: 'x' }).selection_reason).toBeTruthy();
  });
});

describe('completeEntry / failEntry', () => {
  test('completing a stage sets a real duration', () => {
    const entry = trace.completeEntry(trace.startEntry({ stage: 'ocean_agent' }), { statusCode: 200 });
    expect(entry.status).toBe('completed');
    expect(entry.completed_at).not.toBeNull();
    expect(typeof entry.duration_ms).toBe('number');
  });

  test('failing a stage records the error_category', () => {
    const entry = trace.failEntry(trace.startEntry({ stage: 'tide_agent' }), {
      error: 'upstream refused',
      errorCategory: 'upstream_unavailable',
    });
    expect(entry.status).toBe('failed');
    expect(entry.error_category).toBe('upstream_unavailable');
  });

  test('a timeout is recorded with error_category timeout', () => {
    const entry = trace.timeoutEntry(trace.startEntry({ stage: 'gis_agent' }));
    expect(entry.status).toBe('timeout');
    expect(entry.error_category).toBe('timeout');
  });
});

describe('summarise', () => {
  test('excludes skipped stages from the progress denominator', () => {
    // A skipped stage was never going to run; counting it would deflate progress.
    const summary = trace.summarise([
      { stage: 'a', status: 'completed' },
      { stage: 'b', status: 'completed' },
      { stage: 'c', status: 'skipped', selection_reason: 'not needed' },
    ]);
    expect(summary.progress_percent).toBe(100); // 2 of 2 runnable, not 2 of 3
  });

  test('returns null progress (not 0) when there is nothing measurable', () => {
    expect(trace.summarise([]).progress_percent).toBeNull();
  });

  test('surfaces failed stages with their categories', () => {
    const summary = trace.summarise([
      { stage: 'tide', status: 'failed', error_category: 'timeout', error: 'slow' },
    ]);
    expect(summary.failed_stages[0]).toMatchObject({ stage: 'tide', error_category: 'timeout' });
  });
});
