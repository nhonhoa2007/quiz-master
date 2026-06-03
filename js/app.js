/**
 * App Module - Main entry point. Initializes the application once the DOM is fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the Quiz UI controller
  // This triggers loading history, setting up drag & drop listeners, and reading themes.
  window.quizApp = new QuizUI();
});
