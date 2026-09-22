import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node.js environment
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};

import { addEntry, list, remove, clear, lastId } from '../src/utils/history.js';

test('history manager - start empty', () => {
  clear();
  assert.deepEqual(list(), []);
  assert.equal(lastId(), null);
});

test('history manager - add single entry and retrieve lastId', () => {
  clear();
  const entry = addEntry({
    analysis_id: 'req_20260921_1200_000001',
    kind: 'point',
    title: 'Kochi Offshore Advisory',
    place: 'Kochi',
  });

  assert.equal(entry.analysis_id, 'req_20260921_1200_000001');
  assert.equal(lastId(), 'req_20260921_1200_000001');
  assert.equal(list().length, 1);
});

test('history manager - deduplicates existing entry and moves to front', () => {
  clear();
  addEntry({ analysis_id: 'id_1', title: 'First' });
  addEntry({ analysis_id: 'id_2', title: 'Second' });
  addEntry({ analysis_id: 'id_1', title: 'First Updated' });

  const current = list();
  assert.equal(current.length, 2);
  assert.equal(current[0].analysis_id, 'id_1');
  assert.equal(current[0].title, 'First Updated');
});

test('history manager - remove entry by id', () => {
  clear();
  addEntry({ analysis_id: 'id_1' });
  addEntry({ analysis_id: 'id_2' });
  remove('id_1');

  const current = list();
  assert.equal(current.length, 1);
  assert.equal(current[0].analysis_id, 'id_2');
});

test('history manager - caps entries at 50', () => {
  clear();
  for (let i = 0; i < 60; i++) {
    addEntry({ analysis_id: `id_${i}` });
  }

  const current = list();
  assert.equal(current.length, 50);
  assert.equal(current[0].analysis_id, 'id_59');
});
