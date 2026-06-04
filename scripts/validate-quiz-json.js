#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const roots = ['data', 'quiz'];
const files = roots.flatMap(root => {
  const absoluteRoot = path.join(process.cwd(), root);
  if (!fs.existsSync(absoluteRoot)) return [];
  return fs.readdirSync(absoluteRoot)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(root, file));
});

function validateQuizData(data, filePath) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`${filePath}: root must be a non-empty array.`);
  }

  data.forEach((item, index) => {
    const questionNo = index + 1;
    const label = `${filePath} question ${questionNo}`;

    if (!item || typeof item !== 'object') {
      throw new Error(`${label}: must be an object.`);
    }
    if (typeof item.question !== 'string' || item.question.trim() === '') {
      throw new Error(`${label}: missing non-empty string field "question".`);
    }
    if (!Array.isArray(item.options) || item.options.length < 2) {
      throw new Error(`${label}: "options" must contain at least 2 values.`);
    }
    if (!item.options.every(option => typeof option === 'string' || typeof option === 'number')) {
      throw new Error(`${label}: every option must be a string or number.`);
    }
    if (item.answer === undefined || item.answer === null) {
      throw new Error(`${label}: missing field "answer".`);
    }

    const answer = item.answer;
    let answerIsValid = false;
    if (typeof answer === 'number') {
      answerIsValid = Number.isInteger(answer) && answer >= 0 && answer < item.options.length;
    } else if (typeof answer === 'string') {
      const trimmedAnswer = answer.trim();
      if (/^\d+$/.test(trimmedAnswer)) {
        const numericAnswer = Number(trimmedAnswer);
        answerIsValid = numericAnswer >= 0 && numericAnswer < item.options.length;
      } else {
        answerIsValid = item.options.some(option => option.toString().trim().toLowerCase() === trimmedAnswer.toLowerCase());
      }
    }

    if (!answerIsValid) {
      throw new Error(`${label}: "answer" must match an option index or option text.`);
    }
  });
}

let hasError = false;

files.forEach(filePath => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), filePath), 'utf8'));
    validateQuizData(data, filePath);
    console.log(`OK ${filePath}`);
  } catch (err) {
    hasError = true;
    console.error(`FAIL ${err.message}`);
  }
});

if (hasError) {
  process.exit(1);
}

console.log(`Validated ${files.length} quiz JSON files.`);
