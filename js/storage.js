/**
 * Storage Module - Handles all LocalStorage read/write operations for QuizMaster.
 */
class QuizStorage {
  static HISTORY_KEY = 'quizmaster_history';
  static THEME_KEY = 'quizmaster_theme';

  /**
   * Fetch all historical quiz results.
   * @returns {Array} Array of history objects
   */
  static getHistory() {
    try {
      const historyJson = localStorage.getItem(this.HISTORY_KEY);
      return historyJson ? JSON.parse(historyJson) : [];
    } catch (e) {
      console.error("Error reading history from localStorage:", e);
      return [];
    }
  }

  /**
   * Save a new quiz run result to history.
   * @param {Object} result - The quiz completion result details
   */
  static saveResult(result) {
    try {
      const history = this.getHistory();
      const newResult = {
        id: 'result_' + Date.now(),
        date: new Date().toISOString(),
        quizName: result.quizName || 'Bộ đề tùy chỉnh',
        score: result.score,
        totalQuestions: result.totalQuestions,
        timeSpent: result.timeSpent, // in seconds
        accuracy: Math.round((result.score / result.totalQuestions) * 100),
        mode: result.mode // 'practice' or 'exam'
      };
      
      history.push(newResult);
      // Keep only the last 50 entries to avoid filling storage
      if (history.length > 50) {
        history.shift();
      }
      
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
      return newResult;
    } catch (e) {
      console.error("Error saving result to localStorage:", e);
    }
  }

  /**
   * Clear all history records.
   */
  static clearHistory() {
    try {
      localStorage.removeItem(this.HISTORY_KEY);
    } catch (e) {
      console.error("Error clearing history:", e);
    }
  }

  /**
   * Get the saved theme setting.
   * @returns {string} 'light' or 'dark' (default 'dark' for premium aesthetics)
   */
  static getTheme() {
    return localStorage.getItem(this.THEME_KEY) || 'dark';
  }

  /**
   * Save the theme setting.
   * @param {string} theme - 'light' or 'dark'
   */
  static setTheme(theme) {
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch (e) {
      console.error("Error setting theme in localStorage:", e);
    }
  }

  static ACTIVE_QUIZ_KEY = 'quizmaster_active_quiz';

  /**
   * Save the active quiz progress state.
   */
  static saveActiveQuizState(state) {
    try {
      localStorage.setItem(this.ACTIVE_QUIZ_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Error saving active quiz state:", e);
    }
  }

  /**
   * Fetch the saved active quiz progress state.
   */
  static getActiveQuizState() {
    try {
      const stateJson = localStorage.getItem(this.ACTIVE_QUIZ_KEY);
      return stateJson ? JSON.parse(stateJson) : null;
    } catch (e) {
      console.error("Error getting active quiz state:", e);
      return null;
    }
  }

  /**
   * Clear active quiz progress state.
   */
  static clearActiveQuizState() {
    try {
      localStorage.removeItem(this.ACTIVE_QUIZ_KEY);
    } catch (e) {
      console.error("Error clearing active quiz state:", e);
    }
  }
}

// Export class globally or for ES modules
window.QuizStorage = QuizStorage;
