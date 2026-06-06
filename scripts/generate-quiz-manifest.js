#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildQuizCatalog } = require('./quiz-catalog');

const projectRoot = process.cwd();
const outputPath = path.join(projectRoot, 'data', 'quiz-manifest.json');
const scriptOutputPath = path.join(projectRoot, 'js', 'quiz-manifest.js');
const catalog = buildQuizCatalog(projectRoot);

fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(scriptOutputPath, `window.QUIZ_MANIFEST = ${JSON.stringify(catalog, null, 2)};\n`);
console.log(`Generated quiz manifests with ${catalog.length} quizzes.`);
