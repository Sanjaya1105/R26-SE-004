const test = require('node:test');
const assert = require('node:assert/strict');

const { generateMcqs, validateQuiz } = require('../src/services/ollamaMcq');

function validPayload() {
  return {
    questions: Array.from({ length: 10 }, (_, index) => ({
      question: `Question ${index + 1}?`,
      options: [`Option ${index + 1}A`, `Option ${index + 1}B`, `Option ${index + 1}C`, `Option ${index + 1}D`],
      correctAnswer: ['A', 'B', 'C', 'D'][index % 4],
      explanation: `Explanation ${index + 1}`,
    })),
  };
}

test('validateQuiz accepts exactly ten valid MCQs', () => {
  const questions = validateQuiz(validPayload());
  assert.equal(questions.length, 10);
  assert.deepEqual(questions[0].options, ['Option 1A', 'Option 1B', 'Option 1C', 'Option 1D']);
});

test('validateQuiz rejects an invalid question count and duplicate options', () => {
  assert.throws(() => validateQuiz({ questions: validPayload().questions.slice(0, 9) }), /exactly 10/);
  const payload = validPayload();
  payload.questions[0].options[3] = payload.questions[0].options[0];
  assert.throws(() => validateQuiz(payload), /duplicate options/);
});

test('generateMcqs requests structured non-streaming output from gemma3:12b', async (context) => {
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      message: { content: JSON.stringify(validPayload()) },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const result = await generateMcqs({
    lessonName: 'Algorithms',
    unitNo: '1',
    cognitiveLoad: 'High',
    context: '[Page 1]\nA sorting algorithm arranges values.',
  });

  assert.equal(result.model, 'gemma3:12b');
  assert.equal(result.questions.length, 10);
  assert.equal(requestBody.stream, false);
  assert.equal(requestBody.format.properties.questions.minItems, 10);
  assert.match(requestBody.messages[1].content, /sorting algorithm/);
  assert.match(requestBody.messages[1].content, /dominant cognitive-load level.*"High"/);
});
