const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateBoxPlotStats,
  createCounts,
  createStyleCounts,
  dominantLoad,
  buildEvidenceSnapshot,
  buildRecommendationPrompt,
  normalizeLoadLabel,
  normalizeStyleLabel,
  recommendationFor,
  summarizeTopSignals,
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

test('normalizes cognitive styles and counts only the latest profile per student', () => {
  assert.equal(normalizeStyleLabel('Moderate/Intermediatory'), 'Intermediate');
  assert.equal(normalizeStyleLabel('visual'), 'Visual');
  assert.deepEqual(createStyleCounts([
    { student_id: '1', lesson_id: 'a', cognitive_style: 'Visual' },
    { student_id: '1', lesson_id: 'b', cognitive_style: 'Verbal' },
    { student_id: '2', lesson_id: 'a', cognitive_style: 'Moderate/Intermediatory' },
  ]), { Visual: 1, Verbal: 0, Intermediate: 1, Unknown: 0 });
});

test('ranks recurring LIME and SHAP signals for class evidence', () => {
  const signals = summarizeTopSignals([
    { top_1_signal: 'pause_frequency', top_1_normalized_value: 0.8, top_2_signal: 'rewatch_segments', top_2_normalized_value: 0.4 },
    { top_1_signal: 'pause_frequency', top_1_normalized_value: 0.6, top_2_signal: 'time_on_content', top_2_normalized_value: 0.5 },
  ]);
  assert.equal(signals[0].signal, 'pause_frequency');
  assert.equal(signals[0].occurrences, 2);
  assert.equal(signals[0].averageImportance, 0.7);
});

test('builds a grounded recommendation prompt while retaining baseline support', () => {
  const counts = { 'Very Low': 0, Low: 1, Medium: 2, High: 5, 'Very High': 2, Unknown: 0 };
  const evidence = buildEvidenceSnapshot({
    course: { courseName: 'Algorithms', sections: [] },
    lessonIds: ['course-1'],
    counts,
    boxPlotData: [{ x: 'High', y: [1, 2, 3, 4, 5], observations: 5 }],
    commonSignals: [{ signal: 'pause_frequency', occurrences: 4, averageImportance: 0.6 }],
    styleCounts: { Visual: 3, Verbal: 2, Intermediate: 1, Unknown: 0 },
  });
  const prompt = buildRecommendationPrompt(evidence);
  assert.equal(evidence.cognitiveLoad.highOrVeryHighPercentage, 70);
  assert.equal(evidence.cognitiveLoad.aggregationUnit, 'one final result per student per lesson');
  assert.match(prompt, /exactly three numbered actions/);
  assert.match(prompt, /pause_frequency/);
  assert.match(recommendationFor('High', 'Algorithms'), /Algorithms/);
});
