# QuizMaster

QuizMaster is a static quiz practice app built with plain HTML, CSS, and JavaScript. It supports preset quizzes, custom JSON upload, timed practice, exam mode, bookmarks, progress resume, answer explanations, quick translation, and local attempt history.

## Run Locally

Because preset quizzes are loaded with `fetch`, serve the folder over HTTP instead of opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Quiz JSON Format

Each quiz file is a non-empty array of question objects:

```json
[
  {
    "id": 1,
    "question": "Which data structure uses LIFO order?",
    "options": ["Queue", "Stack", "Heap", "Graph"],
    "answer": 1,
    "explanation": "A stack removes the most recently added item first.",
    "category": "Data Structures"
  }
]
```

Required fields:

- `question`: non-empty string.
- `options`: array with at least 2 string or number options.
- `answer`: either a zero-based option index, a numeric string index, or exact option text.

Optional fields:

- `id`: stable identifier for the question.
- `explanation`: shown after answering or in review.
- `category`: shown as a question tag.

## Validate Quiz Files

Run this before committing or deploying new quiz data:

```bash
node scripts/validate-quiz-json.js
```

The script checks every `.json` file in `data/` and `quiz/`.

## Quick Translation

The quiz screen includes a dictionary and quick translation panel for unfamiliar words in questions or answers.

1. Select a word in the current question or answer, or type it into the lookup box.
2. Click `Tra từ` to see English definitions, phonetics, and examples from the free Dictionary API.
3. Select a phrase and click `Dịch sang tiếng Việt` for translation.
4. If no text is selected for translation, the app translates the current question.

The default endpoint is LibreTranslate:

```text
https://libretranslate.com/translate
```

LibreTranslate's hosted service can require an API key. You can paste a free or self-hosted LibreTranslate endpoint into the app, then add an API key only if that endpoint requires one. The endpoint and key are stored only in the current browser's `localStorage`.

When no LibreTranslate API key is saved, the app falls back to MyMemory's free `en|vi` endpoint for short English words or phrases. This is useful for quick vocabulary checks, but technical terms may still need human judgment.

## Project Layout

- `index.html`: application screens and static markup.
- `css/variables.css`: theme tokens.
- `css/style.css`: app layout and component styling.
- `js/quiz.js`: quiz state, normalization, timer, scoring, serialization.
- `js/storage.js`: localStorage persistence for theme, history, translation settings, custom quizzes, active quiz state.
- `js/ui.js`: UI rendering, events, upload, preset loading, charts.
- `data/`: small samples and JSON template.
- `quiz/`: larger chapter-based quiz sets.
- `scripts/`: maintenance checks.

## Notes

Uploaded quizzes and attempt history are stored in the browser's `localStorage`; they are local to the current browser/profile and can be cleared by browser settings. User-provided quiz text is rendered as text, not HTML, so custom JSON cannot inject markup into the page.
