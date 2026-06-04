/**
 * Storage Module - Handles all LocalStorage read/write operations for QuizMaster.
 */
class QuizStorage {
  static HISTORY_KEY = 'quizmaster_history';
  static THEME_KEY = 'quizmaster_theme';
  static TRANSLATION_SETTINGS_KEY = 'quizmaster_translation_settings';

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

  static getTranslationSettings() {
    try {
      const settingsJson = localStorage.getItem(this.TRANSLATION_SETTINGS_KEY);
      return settingsJson ? JSON.parse(settingsJson) : {
        endpoint: 'https://libretranslate.com/translate',
        apiKey: ''
      };
    } catch (e) {
      console.error("Error reading translation settings from localStorage:", e);
      return {
        endpoint: 'https://libretranslate.com/translate',
        apiKey: ''
      };
    }
  }

  static setTranslationSettings(settings) {
    try {
      const normalizedSettings = {
        endpoint: settings.endpoint || 'https://libretranslate.com/translate',
        apiKey: settings.apiKey || ''
      };
      localStorage.setItem(this.TRANSLATION_SETTINGS_KEY, JSON.stringify(normalizedSettings));
    } catch (e) {
      console.error("Error setting translation settings in localStorage:", e);
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

  static CUSTOM_QUIZZES_KEY = 'quizmaster_custom_quizzes';

  /**
   * Fetch all custom quizzes from localStorage.
   * @returns {Array} Array of custom quiz objects
   */
  static getCustomQuizzes() {
    try {
      const customJson = localStorage.getItem(this.CUSTOM_QUIZZES_KEY);
      return customJson ? JSON.parse(customJson) : [];
    } catch (e) {
      console.error("Error reading custom quizzes from localStorage:", e);
      return [];
    }
  }

  /**
   * Save a custom quiz to localStorage (overwrites if the name already exists).
   * @param {string} name - Name of the quiz
   * @param {Array} questions - Questions list
   * @returns {Object} The saved custom quiz object
   */
  static saveCustomQuiz(name, questions) {
    try {
      const customQuizzes = this.getCustomQuizzes();
      // Check if one with same name already exists (case insensitive, trimmed)
      const existingIndex = customQuizzes.findIndex(q => q.name.trim().toLowerCase() === name.trim().toLowerCase());
      
      const quizObject = {
        id: existingIndex !== -1 ? customQuizzes[existingIndex].id : 'custom_' + Date.now(),
        name: name,
        questions: questions,
        category: 'Tự chọn',
        dateAdded: new Date().toISOString()
      };
      
      if (existingIndex !== -1) {
        // Overwrite
        customQuizzes[existingIndex] = quizObject;
      } else {
        // Append
        customQuizzes.push(quizObject);
      }
      
      localStorage.setItem(this.CUSTOM_QUIZZES_KEY, JSON.stringify(customQuizzes));
      return quizObject;
    } catch (e) {
      console.error("Error saving custom quiz to localStorage:", e);
      return null;
    }
  }

  /**
   * Delete a custom quiz by ID.
   * @param {string} id - The quiz ID
   */
  static deleteCustomQuiz(id) {
    try {
      let customQuizzes = this.getCustomQuizzes();
      customQuizzes = customQuizzes.filter(q => q.id !== id);
      localStorage.setItem(this.CUSTOM_QUIZZES_KEY, JSON.stringify(customQuizzes));
    } catch (e) {
      console.error("Error deleting custom quiz from localStorage:", e);
    }
  }
}

// Export class globally or for ES modules
window.QuizStorage = QuizStorage;
