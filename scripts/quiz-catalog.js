const fs = require('fs');
const path = require('path');

function listJsonFiles(rootPath) {
  if (!fs.existsSync(rootPath)) return [];

  return fs.readdirSync(rootPath, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(rootPath, entry.name);
    return entry.isDirectory()
      ? listJsonFiles(entryPath)
      : entry.name.endsWith('.json') ? [entryPath] : [];
  });
}

function titleCase(value) {
  return value.replace(/\b\p{L}/gu, letter => letter.toUpperCase());
}

function humanizeFileName(filePath) {
  const stem = path.basename(filePath, '.json');
  const specialNames = {
    'chapter1-dong-hoc-chat-diem': 'Chương 1: Động Học Chất Điểm',
    'chapter2-dong-luc-hoc-chat-diem': 'Chương 2: Động Lực Học Chất Điểm',
    'chapter3-dong-luc-hoc-vat-ran': 'Chương 3: Động Lực Học Vật Rắn'
  };
  if (specialNames[stem]) return specialNames[stem];

  const chapterMatch = stem.match(/^chapter(\d+)-(.+)$/i);
  if (chapterMatch) {
    const topic = chapterMatch[2].replaceAll('-', ' ').replaceAll('_', ' ');
    return `Chương ${chapterMatch[1]}: ${titleCase(topic)}`;
  }

  const setMatch = stem.match(/^dsa_quiz_set_(\d+)$/i);
  if (setMatch) return `Bộ DSA tổng hợp ${setMatch[1]}`;

  return titleCase(stem.replaceAll('-', ' ').replaceAll('_', ' '));
}

function categoryFromPath(relativePath, questionCount) {
  const parent = path.dirname(relativePath).split(path.sep).at(-1).trim();
  if (parent === 'lý thuyết') return 'Lý thuyết';
  if (parent === 'thực hành') return 'Thực hành';
  if (parent === 'vật lý đại cương' || parent === 'vat-ly-dai-cuong') return 'Vật Lý Đại Cương';
  if (parent.startsWith('dsa_quiz_')) return `DSA · ${questionCount} câu`;
  return titleCase(parent.replaceAll('-', ' ').replaceAll('_', ' '));
}

function buildQuizCatalog(projectRoot) {
  const quizRoot = path.join(projectRoot, 'quiz');

  return listJsonFiles(quizRoot).sort().map(absolutePath => {
    const relativePath = path.relative(projectRoot, absolutePath);
    const questions = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    const firstCategory = questions[0]?.category;
    const isDsaSet = /^Set \d+\s*-/i.test(firstCategory || '');
    const category = categoryFromPath(relativePath, questions.length);
    const baseDisplayName = isDsaSet
      ? firstCategory.replace(/^Set \d+\s*-\s*/i, '')
      : humanizeFileName(relativePath);
    const displayName = ['Lý thuyết', 'Thực hành'].includes(category) || category.startsWith('DSA ·')
      ? `${baseDisplayName} · ${category}`
      : baseDisplayName;

    return {
      file: relativePath.split(path.sep).join('/'),
      name: displayName,
      displayName,
      category,
      description: `${questions.length} câu hỏi`
    };
  });
}

module.exports = { buildQuizCatalog, listJsonFiles };
