const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateBoxPlotStats,
  createCounts,
  dominantLoad,
  normalizeLoadLabel,
  recommendationFor,
} = require('./server');

test('calculates box-plot values in min, q1, median, q3, max order', () => {
  assert.deepEqual(calculateBoxPlotStats([5, 1, 4, 2, 3]), [1, 2, 3, 4, 5]);
  assert.equal(calculateBoxPlotStats([]), null);
});

test('normalizes cognitive-load labels', () => {
  assert.equal(normalizeLoadLabel(' VERY_HIGH '), 'Very High');
  assert.equal(normalizeLoadLabel('law'), 'Low');
  assert.equal(normalizeLoadLabel('moderate'), 'Medium');
  assert.equal(normalizeLoadLabel('unexpected'), 'Unknown');
});

test('creates all category counts and selects the maximum', () => {
  const counts = createCounts([
    { load_level: 'High', load_count: 7 },
    { load_level: 'very high', load_count: 3 },
    { load_level: 'Low', load_count: 2 },
  ]);

  assert.deepEqual(counts, {
    'Very Low': 0,
    Low: 2,
    Medium: 0,
    High: 7,
    'Very High': 3,
    Unknown: 0,
  });
  assert.equal(dominantLoad(counts), 'High');
});

test('uses the safer higher level when maximum counts are tied', () => {
  const counts = createCounts([
    { load_level: 'Low', load_count: 4 },
    { load_level: 'High', load_count: 4 },
  ]);
  assert.equal(dominantLoad(counts), 'High');
  assert.match(recommendationFor('High', 'Algorithms'), /Algorithms/);
});

test('does not invent a dominant level when every label is unknown', () => {
  const counts = createCounts([{ load_level: 'unexpected', load_count: 5 }]);
  assert.equal(dominantLoad(counts), 'Unknown');
});
