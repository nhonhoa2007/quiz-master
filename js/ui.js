/**
 * UI Controller - Manages DOM manipulation, page states, event handlers, animations, and chart rendering.
 */
class QuizUI {
  static DEFAULT_PRESETS = [
    {
      file: 'data/sample-general.json',
      name: 'Kiến thức chung',
      displayName: 'Kiến Thức Tổng Hợp',
      category: 'Xã hội',
      description: '5 câu hỏi trắc nghiệm'
    },
    {
      file: 'data/sample-javascript.json',
      name: 'Lập trình JavaScript',
      displayName: 'Lập Trình JavaScript',
      category: 'IT / Code',
      description: '5 câu hỏi kỹ thuật ES6+'
    }
  ];

  constructor() {
    this.currentQuizData = null;
    this.currentQuizName = 'Bộ đề trắc nghiệm';
    this.quizEngine = null;
    this.availablePresets = this.mergePresets(QuizUI.DEFAULT_PRESETS, window.QUIZ_MANIFEST || []);
    this.catalogSignature = JSON.stringify(this.availablePresets);
    
    // Cache DOM Elements
    this.screens = {
      landing: document.getElementById('landing-screen'),
      setup: document.getElementById('setup-screen'),
      quiz: document.getElementById('quiz-screen'),
      results: document.getElementById('results-screen')
    };

    this.initEventListeners();
    this.syncNavigationState('landing');
    this.renderHistory();
    this.renderPresetGrid();
    this.initQuizCatalog();

    // Check for saved ongoing quiz progress
    setTimeout(() => this.checkForActiveQuiz(), 100);
  }

  createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text ?? '';
    return element;
  }

  mergePresets(...groups) {
    const presetsByFile = new Map();
    groups.flat().forEach(preset => presetsByFile.set(preset.file, preset));
    return Array.from(presetsByFile.values());
  }

  initQuizCatalog() {
    const refreshButton = document.getElementById('refresh-quizzes-btn');
    refreshButton?.addEventListener('click', () => this.refreshQuizCatalog(true));

    if (window.location.protocol === 'file:') {
      this.updateCatalogStatus('Danh mục đóng gói. Chạy server local để tự động nhận đề mới.');
      return;
    }

    this.updateCatalogStatus('Tự động kiểm tra đề mới mỗi 3 giây.');
    this.refreshQuizCatalog(false);
    this.catalogPoller = window.setInterval(() => this.refreshQuizCatalog(false), 3000);
  }

  async refreshQuizCatalog(showFeedback = false) {
    try {
      const response = await fetch(`data/quiz-manifest.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Không đọc được danh mục bộ đề.');

      const manifest = await response.json();
      const nextPresets = this.mergePresets(QuizUI.DEFAULT_PRESETS, manifest);
      const nextSignature = JSON.stringify(nextPresets);
      const changed = nextSignature !== this.catalogSignature;

      if (changed) {
        this.availablePresets = nextPresets;
        this.catalogSignature = nextSignature;
        this.renderPresetGrid();
      }

      this.updateCatalogStatus(`${this.availablePresets.length} bộ đề có sẵn · tự động cập nhật mỗi 3 giây.`);
      if (showFeedback) {
        this.showToast(changed ? 'Đã cập nhật danh sách bộ đề.' : 'Danh sách bộ đề đã là mới nhất.', 'success');
      }
    } catch (error) {
      this.updateCatalogStatus('Không thể tự cập nhật. Hãy chạy node scripts/dev-server.js.');
      if (showFeedback) this.showToast(error.message, 'error');
    }
  }

  updateCatalogStatus(message) {
    const status = document.getElementById('catalog-status');
    if (status) status.textContent = message;
  }

  validateQuizData(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Dữ liệu JSON phải là một mảng chứa danh sách câu hỏi.");
    }

    data.forEach((item, index) => {
      const questionNo = index + 1;
      if (!item || typeof item !== 'object') {
        throw new Error(`Câu ${questionNo} phải là một object.`);
      }
      if (typeof item.question !== 'string' || item.question.trim() === '') {
        throw new Error(`Câu ${questionNo} thiếu trường 'question' dạng chuỗi.`);
      }
      if (!Array.isArray(item.options) || item.options.length < 2) {
        throw new Error(`Câu ${questionNo} cần trường 'options' có tối thiểu 2 lựa chọn.`);
      }
      if (!item.options.every(option => typeof option === 'string' || typeof option === 'number')) {
        throw new Error(`Câu ${questionNo} chỉ hỗ trợ option dạng chuỗi hoặc số.`);
      }
      if (item.answer === undefined || item.answer === null) {
        throw new Error(`Câu ${questionNo} thiếu trường 'answer'.`);
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
        } else if (/^[a-dA-D]$/.test(trimmedAnswer)) {
          const letterIndex = trimmedAnswer.toLowerCase().charCodeAt(0) - 97;
          answerIsValid = letterIndex >= 0 && letterIndex < item.options.length;
        } else {
          answerIsValid = item.options.some(option => option.toString().trim().toLowerCase() === trimmedAnswer.toLowerCase());
        }
      }

      if (!answerIsValid) {
        throw new Error(`Câu ${questionNo} có 'answer' không khớp index hoặc nội dung lựa chọn.`);
      }
    });

    return data;
  }

  /**
   * Screen navigation
   */
  showScreen(screenName) {
    this.closeQuestionNavigator();

    Object.keys(this.screens).forEach(name => {
      if (name === screenName) {
        this.screens[name].classList.add('active');
        this.screens[name].dispatchEvent(new Event('screenactive'));
      } else {
        this.screens[name].classList.remove('active');
      }
    });

    document.body.dataset.screen = screenName;
    if (screenName === 'landing') {
      this.syncNavigationState('landing');
    }

    // Scroll to top on screen change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  syncNavigationState(target) {
    document.querySelectorAll('.app-nav-item').forEach(item => {
      const isActive = item.dataset.target === target;
      item.classList.toggle('active', isActive);
      if (isActive) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });
  }

  navigateToLandingSection(target) {
    this.showScreen('landing');
    this.syncNavigationState(target);

    const targetElement = target === 'exams'
      ? document.querySelector('.preset-quizzes')
      : target === 'history'
        ? document.querySelector('.history-panel')
        : document.getElementById('landing-screen');

    window.requestAnimationFrame(() => {
      targetElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  openQuestionNavigator() {
    if (!window.matchMedia('(max-width: 899px)').matches) return;

    const sidebar = document.getElementById('quiz-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const trigger = document.getElementById('mobile-grid-trigger');
    this.questionNavigatorReturnFocus = document.activeElement;

    sidebar.classList.add('open');
    backdrop.classList.add('open');
    sidebar.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('navigator-open');
    document.getElementById('sidebar-close-btn')?.focus();
  }

  closeQuestionNavigator({ restoreFocus = false } = {}) {
    const sidebar = document.getElementById('quiz-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const trigger = document.getElementById('mobile-grid-trigger');
    if (!sidebar || !backdrop || !trigger) return;

    const wasOpen = sidebar.classList.contains('open');
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('navigator-open');

    if (window.matchMedia('(max-width: 899px)').matches) {
      sidebar.setAttribute('aria-hidden', 'true');
    } else {
      sidebar.setAttribute('aria-hidden', 'false');
    }

    if (restoreFocus && wasOpen) {
      this.questionNavigatorReturnFocus?.focus();
    }
  }

  updateQuestionNavigatorMode() {
    const sidebar = document.getElementById('quiz-sidebar');
    if (!sidebar) return;

    if (window.matchMedia('(min-width: 900px)').matches) {
      this.closeQuestionNavigator();
      sidebar.setAttribute('aria-modal', 'false');
      sidebar.setAttribute('aria-hidden', 'false');
    } else {
      sidebar.setAttribute('aria-modal', 'true');
      if (!sidebar.classList.contains('open')) {
        sidebar.setAttribute('aria-hidden', 'true');
      }
    }
  }

  /**
   * Toast notification system
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'success') {
      icon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="color:var(--success-color)"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`;
    } else if (type === 'error') {
      icon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="color:var(--danger-color)"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;
    } else {
      icon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="color:var(--info-color)"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 00-1-1v-4a1 1 0 102 0v4a1 1 0 00-1 1z" clip-rule="evenodd"/></svg>`;
    }

    toast.innerHTML = icon;
    toast.appendChild(this.createTextElement('span', 'toast-message', message));
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeIn var(--transition-fast) reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Confirmation Dialog Modal
   */
  showConfirmDialog(title, message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialogBox = document.createElement('div');
    dialogBox.className = 'dialog-box';
    dialogBox.appendChild(this.createTextElement('h3', '', title));
    dialogBox.appendChild(this.createTextElement('p', '', message));

    const buttons = document.createElement('div');
    buttons.className = 'dialog-buttons';

    const cancelBtn = this.createTextElement('button', 'btn btn-secondary btn-sm', 'Hủy');
    cancelBtn.type = 'button';
    cancelBtn.id = 'dlg-cancel';

    const confirmBtn = this.createTextElement('button', 'btn btn-primary btn-sm', 'Xác nhận');
    confirmBtn.type = 'button';
    confirmBtn.id = 'dlg-confirm';

    buttons.append(cancelBtn, confirmBtn);
    dialogBox.appendChild(buttons);
    overlay.appendChild(dialogBox);
    
    document.body.appendChild(overlay);
    
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      if (onCancel) onCancel();
    });
    confirmBtn.addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });
  }

  /**
   * Initialize Global Event Listeners
   */
  initEventListeners() {
    // 1. Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    const savedTheme = QuizStorage.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    themeBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      QuizStorage.setTheme(newTheme);
      this.showToast(`Đã chuyển sang giao diện ${newTheme === 'dark' ? 'Tối' : 'Sáng'}.`, 'info');
    });

    document.querySelectorAll('.app-nav-item').forEach(link => {
      link.addEventListener('click', () => {
        this.navigateToLandingSection(link.dataset.target);
      });
    });

    document.getElementById('logo-home')?.addEventListener('click', () => {
      this.navigateToLandingSection('landing');
    });

    // 2. Drag & Drop File Upload
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    ['dragleave', 'dragend'].forEach(evt => {
      dropzone.addEventListener(evt, () => dropzone.classList.remove('dragover'));
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        this.handleFileUpload(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileUpload(e.target.files[0]);
      }
    });

    // 3. Preset Quizzes click handlers (using event delegation)
    const presetGrid = document.getElementById('preset-grid');
    if (presetGrid) {
      presetGrid.addEventListener('click', (e) => {
        // Find if they clicked a delete button
        const deleteBtn = e.target.closest('.delete-quiz-btn');
        if (deleteBtn) {
          e.stopPropagation();
          const quizId = deleteBtn.dataset.id;
          const customQuizzes = QuizStorage.getCustomQuizzes();
          const quiz = customQuizzes.find(q => q.id === quizId);
          const quizName = quiz ? quiz.name : 'bộ đề';
          
          this.showConfirmDialog(
            "Xóa bộ đề",
            `Bạn có chắc chắn muốn xóa bộ đề '${quizName}' không?`,
            () => {
              QuizStorage.deleteCustomQuiz(quizId);
              this.renderPresetGrid();
              this.showToast(`Đã xóa bộ đề '${quizName}'.`, "success");
            }
          );
          return;
        }

        // Find if they clicked a preset card
        const card = e.target.closest('.preset-card');
        if (card) {
          if (card.classList.contains('custom-preset-card')) {
            // It's a custom quiz!
            const quizId = card.dataset.id;
            const customQuizzes = QuizStorage.getCustomQuizzes();
            const quiz = customQuizzes.find(q => q.id === quizId);
            if (quiz) {
              try {
                this.validateQuizData(quiz.questions);
                this.currentQuizData = quiz.questions;
                this.currentQuizName = quiz.name;
                this.showToast(`Đã chọn bộ đề: ${quiz.name}`, "success");
                this.showScreen('setup');
                document.getElementById('setup-quiz-title').innerText = quiz.name;
                document.getElementById('setup-question-count').innerText = `${quiz.questions.length} câu hỏi`;
              } catch (err) {
                this.showToast(`Bộ đề đã lưu không hợp lệ: ${err.message}`, "error");
              }
            } else {
              this.showToast("Không tìm thấy dữ liệu bộ đề.", "error");
            }
          } else {
            // It's a default preset quiz
            const file = card.dataset.file;
            const name = card.dataset.name;
            this.loadPresetQuiz(file, name);
          }
        }
      });
    }

    // 4. Setup Screen navigation back
    document.getElementById('setup-back-btn').addEventListener('click', () => {
      this.showScreen('landing');
    });

    // 5. Setup Form Submit (Start Quiz)
    document.getElementById('setup-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.startQuiz();
    });

    // 6. Sidebar Mobile toggle
    const gridTrigger = document.getElementById('mobile-grid-trigger');
    const backdrop = document.getElementById('sidebar-backdrop');
    const closeButton = document.getElementById('sidebar-close-btn');

    gridTrigger.addEventListener('click', () => {
      this.openQuestionNavigator();
    });

    backdrop.addEventListener('click', () => this.closeQuestionNavigator({ restoreFocus: true }));
    closeButton.addEventListener('click', () => this.closeQuestionNavigator({ restoreFocus: true }));
    
    // Close sidebar on grid button click for mobile
    document.getElementById('question-grid').addEventListener('click', (e) => {
      if (e.target.classList.contains('grid-btn')) {
        this.closeQuestionNavigator({ restoreFocus: true });
      }
    });

    this.updateQuestionNavigatorMode();
    window.addEventListener('resize', () => this.updateQuestionNavigatorMode());

    // 7. Quiz controls
    document.getElementById('quiz-prev-btn').addEventListener('click', () => {
      this.goToPreviousQuestion();
    });

    document.getElementById('quiz-next-btn').addEventListener('click', () => {
      this.goToNextQuestion();
    });

    document.getElementById('quiz-bookmark-btn').addEventListener('click', () => {
      const bookmarked = this.quizEngine.toggleBookmark();
      this.showToast(bookmarked ? "Đã đánh dấu câu hỏi này!" : "Đã bỏ đánh dấu câu hỏi.", 'info');
      this.renderQuestionGrid();
      this.updateBookmarkButtonUI();
      this.persistActiveQuiz();
    });

    document.getElementById('quiz-submit-btn').addEventListener('click', () => {
      this.confirmSubmitQuiz();
    });

    // 8. Results Screen controls
    document.getElementById('res-home-btn').addEventListener('click', () => {
      this.showScreen('landing');
      this.renderHistory();
    });

    document.getElementById('res-retry-btn').addEventListener('click', () => {
      this.showScreen('setup');
    });

    // 9. Clear History Handler
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        this.showConfirmDialog(
          "Xóa lịch sử",
          "Bạn có chắc muốn xóa sạch toàn bộ lịch sử ôn tập trắc nghiệm không? Hành động này không thể hoàn tác.",
          () => {
            QuizStorage.clearHistory();
            this.renderHistory();
            this.showToast("Đã xóa toàn bộ lịch sử.", "success");
          }
        );
      });
    }

    // 10. Review Filters click handlers
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.filterReviewResults(e.target.dataset.filter);
      });
    });

    // 11. Translation helper
    this.initTranslationControls();

    // 12. Page reload auto-save handler
    window.addEventListener('beforeunload', () => {
      this.persistActiveQuiz();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('quiz-sidebar')?.classList.contains('open')) {
        e.preventDefault();
        this.closeQuestionNavigator({ restoreFocus: true });
        return;
      }
      this.handleKeyboardNavigation(e);
    });

    // 13. History list retake click handler
    const historyList = document.getElementById('history-list');
    if (historyList) {
      historyList.addEventListener('click', (e) => {
        const retakeBtn = e.target.closest('.retake-history-btn');
        if (retakeBtn) {
          e.stopPropagation();
          const quizName = retakeBtn.dataset.name;
          this.loadQuizByName(quizName);
        }
      });
    }
  }

  initTranslationControls() {
    const translateBtn = document.getElementById('translate-selected-btn');
    const lookupBtn = document.getElementById('lookup-word-btn');
    const saveBtn = document.getElementById('save-translation-settings-btn');
    const endpointInput = document.getElementById('translation-endpoint-input');
    const apiKeyInput = document.getElementById('translation-api-key-input');
    const dictionaryInput = document.getElementById('dictionary-word-input');

    if (!translateBtn || !lookupBtn || !saveBtn || !endpointInput || !apiKeyInput || !dictionaryInput) return;

    const settings = QuizStorage.getTranslationSettings();
    endpointInput.value = settings.endpoint;
    apiKeyInput.value = settings.apiKey;

    saveBtn.addEventListener('click', () => {
      QuizStorage.setTranslationSettings({
        endpoint: endpointInput.value.trim(),
        apiKey: apiKeyInput.value.trim()
      });
      this.showToast("Đã lưu cấu hình dịch.", "success");
    });

    translateBtn.addEventListener('click', () => this.translateSelectedText());
    lookupBtn.addEventListener('click', () => this.lookupSelectedWord());

    document.addEventListener('selectionchange', () => {
      const selectedText = window.getSelection().toString().trim();
      if (selectedText && selectedText.length <= 80) {
        dictionaryInput.value = this.normalizeDictionaryLookupText(selectedText);
      }
    });
  }

  getSelectedQuizText() {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) return selectedText;
    if (this.quizEngine) {
      return this.quizEngine.questions[this.quizEngine.currentQuestionIndex].question;
    }
    return '';
  }

  setTranslationResult(message, state = 'idle') {
    const result = document.getElementById('translation-result');
    if (!result) return;
    result.classList.remove('loading', 'error', 'success');
    if (state) result.classList.add(state);
    result.textContent = message;
  }

  normalizeDictionaryLookupText(text) {
    return text
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(' ');
  }

  getDictionaryLookupText() {
    const input = document.getElementById('dictionary-word-input');
    const typedText = input ? input.value.trim() : '';
    if (typedText) return this.normalizeDictionaryLookupText(typedText);

    const selectedText = window.getSelection().toString().trim();
    if (selectedText) return this.normalizeDictionaryLookupText(selectedText);

    return '';
  }

  async lookupSelectedWord() {
    const term = this.getDictionaryLookupText();
    if (!term) {
      this.setTranslationResult("Hãy bôi đen hoặc nhập một từ tiếng Anh cần tra.", "error");
      return;
    }
    if (term.split(/\s+/).length > 3) {
      this.setTranslationResult("Tra từ chỉ phù hợp với 1-3 từ. Với câu dài, hãy dùng nút dịch.", "error");
      return;
    }

    this.setTranslationResult(`Đang tra "${term}"...`, "loading");

    try {
      const entries = await this.lookupDictionaryEntry(term);
      this.renderDictionaryResult(term, entries);
    } catch (err) {
      this.setTranslationResult(`Không tìm thấy nghĩa từ điển cho "${term}". ${err.message} Với cụm thuật ngữ, hãy thử nút dịch.`, "error");
    }
  }

  async lookupDictionaryEntry(term) {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !Array.isArray(data) || data.length === 0) {
      throw new Error(data.message || `Dictionary API trả về lỗi HTTP ${response.status}.`);
    }

    return data;
  }

  renderDictionaryResult(term, entries) {
    const result = document.getElementById('translation-result');
    if (!result) return;

    result.classList.remove('loading', 'error', 'success');
    result.classList.add('success');
    result.textContent = '';

    const entry = entries[0];
    const title = this.createTextElement('div', 'dictionary-title', entry.word || term);
    const phonetic = entry.phonetic || (entry.phonetics || []).find(item => item.text)?.text || '';
    if (phonetic) {
      title.appendChild(this.createTextElement('span', 'dictionary-phonetic', ` ${phonetic}`));
    }

    const definitions = document.createElement('div');
    definitions.className = 'dictionary-definitions';

    (entry.meanings || []).slice(0, 3).forEach(meaning => {
      const block = document.createElement('div');
      block.className = 'dictionary-meaning';

      if (meaning.partOfSpeech) {
        block.appendChild(this.createTextElement('span', 'dictionary-part', meaning.partOfSpeech));
      }

      const firstDefinition = (meaning.definitions || [])[0];
      if (firstDefinition && firstDefinition.definition) {
        block.appendChild(this.createTextElement('span', '', firstDefinition.definition));
      }

      if (firstDefinition && firstDefinition.example) {
        block.appendChild(this.createTextElement('em', 'dictionary-example', `Example: ${firstDefinition.example}`));
      }

      definitions.appendChild(block);
    });

    result.append(title, definitions);
  }

  async translateSelectedText() {
    const text = this.getSelectedQuizText();
    if (!text) {
      this.setTranslationResult("Hãy bôi đen một vài từ trong đề hoặc đáp án trước.", "error");
      return;
    }
    if (text.length > 500) {
      this.setTranslationResult("Đoạn chọn hơi dài. Hãy chọn vài từ hoặc một câu ngắn để dịch nhanh hơn.", "error");
      return;
    }

    const endpointInput = document.getElementById('translation-endpoint-input');
    const apiKeyInput = document.getElementById('translation-api-key-input');
    const settings = {
      endpoint: endpointInput.value.trim() || 'https://libretranslate.com/translate',
      apiKey: apiKeyInput.value.trim()
    };

    QuizStorage.setTranslationSettings(settings);
    this.setTranslationResult("Đang dịch...", "loading");

    const isCustomEndpoint = settings.endpoint && settings.endpoint !== 'https://libretranslate.com/translate';
    const hasApiKey = !!settings.apiKey;

    // 1. Nếu có tùy chỉnh endpoint hoặc API key LibreTranslate, thử dùng trước
    if (isCustomEndpoint || hasApiKey) {
      try {
        const translatedText = await this.translateWithLibreTranslate(text, settings);
        this.setTranslationResult(`${text} → ${translatedText} (LibreTranslate)`, "success");
        return;
      } catch (err) {
        console.warn("LibreTranslate failed, trying hybrid translation...", err);
      }
    }

    // 2. Thử dịch bằng Lingva Translate (Google) làm mặc định miễn phí chất lượng cao
    try {
      const translatedText = await this.translateWithLingva(text);
      this.setTranslationResult(`${text} → ${translatedText} (Google Translate)`, "success");
    } catch (err) {
      console.warn("Lingva Translate failed, falling back to MyMemory...", err);
      
      // 3. Fallback dự phòng cuối cùng bằng MyMemory với hạn mức 10.000 từ/ngày
      try {
        const translatedText = await this.translateWithMyMemory(text);
        this.setTranslationResult(`${text} → ${translatedText} (MyMemory dự phòng)`, "success");
      } catch (fallbackErr) {
        this.setTranslationResult(`Không dịch được. (Lingva: ${err.message}, MyMemory: ${fallbackErr.message})`, "error");
      }
    }
  }

  async translateWithLibreTranslate(text, settings) {
    const payload = {
      q: text,
      source: 'auto',
      target: 'vi',
      format: 'text'
    };
    if (settings.apiKey) payload.api_key = settings.apiKey;

    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Dịch vụ trả về lỗi HTTP ${response.status}.`);
    }

    const translatedText = Array.isArray(data.translatedText) ? data.translatedText.join(' ') : data.translatedText;
    if (!translatedText) {
      throw new Error("Không nhận được kết quả dịch.");
    }

    return translatedText;
  }

  async translateWithLingva(text) {
    const response = await fetch(`https://lingva.ml/api/v1/en/vi/${encodeURIComponent(text)}`);
    if (!response.ok) {
      throw new Error(`Lingva API trả về lỗi HTTP ${response.status}.`);
    }

    const data = await response.json().catch(() => ({}));
    if (!data || !data.translation) {
      throw new Error("Không nhận được kết quả dịch từ Lingva.");
    }

    return data.translation;
  }

  async translateWithMyMemory(text) {
    const params = new URLSearchParams({
      q: text,
      langpair: 'en|vi',
      de: 'nhonhoa2007@gmail.com' // Tăng giới hạn lên 10,000 từ/ngày cho người dùng
    });
    const response = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.responseStatus >= 400) {
      throw new Error(data.responseDetails || `MyMemory trả về lỗi HTTP ${response.status}.`);
    }

    const translatedText = data.responseData && data.responseData.translatedText;
    if (!translatedText) {
      throw new Error("MyMemory không trả về kết quả dịch.");
    }

    return translatedText;
  }

  /**
   * Handles JSON file uploads and validations
   */
  handleFileUpload(file) {
    if (!file.name.endsWith('.json')) {
      this.showToast("Vui lòng tải lên tệp có định dạng .json!", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.validateQuizData(data);

        this.currentQuizData = data;
        this.currentQuizName = file.name.replace('.json', '');
        
        // Save to localStorage as custom quiz so it persists!
        const savedQuiz = QuizStorage.saveCustomQuiz(this.currentQuizName, this.currentQuizData);
        if (savedQuiz) {
          this.renderPresetGrid();
          this.showToast(`Nạp bộ đề '${this.currentQuizName}' thành công (${data.length} câu) và đã lưu vào máy!`, "success");
        } else {
          this.showToast(`Nạp bộ đề thành công (${data.length} câu), nhưng không thể lưu vào bộ nhớ trình duyệt (LocalStorage đầy).`, "warning");
        }
        
        // Auto navigate to setup screen
        this.showScreen('setup');
        document.getElementById('setup-quiz-title').innerText = this.currentQuizName;
        document.getElementById('setup-question-count').innerText = `${data.length} câu hỏi`;
      } catch (err) {
        this.showToast(`Lỗi định dạng tệp: ${err.message}`, "error");
        console.error(err);
      }
    };
    reader.readAsText(file);
  }

  /**
   * Loads default preset JSON quizzes from server/local folder
   */
  async loadPresetQuiz(filePath, quizName) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) throw new Error("Không thể kết nối tới tệp mẫu.");
      const data = await response.json();
      this.validateQuizData(data);
      
      this.currentQuizData = data;
      this.currentQuizName = quizName;
      
      this.showToast(`Đã chọn bộ đề: ${quizName}`, "success");
      this.showScreen('setup');
      document.getElementById('setup-quiz-title').innerText = quizName;
      document.getElementById('setup-question-count').innerText = `${data.length} câu hỏi`;
    } catch (err) {
      this.showToast(`Không thể nạp đề mẫu: ${err.message}`, "error");
      console.error(err);
    }
  }

  /**
   * Initializes and starts a new Quiz run
   */
  startQuiz() {
    if (!this.currentQuizData) {
      this.showToast("Vui lòng chọn hoặc tải lên một bộ đề trước khi bắt đầu.", "error");
      this.showScreen('landing');
      return;
    }

    try {
      this.validateQuizData(this.currentQuizData);
    } catch (err) {
      this.showToast(`Bộ đề không hợp lệ: ${err.message}`, "error");
      this.showScreen('landing');
      return;
    }

    QuizStorage.clearActiveQuizState();
    const timeLimitVal = parseInt(document.querySelector('input[name="quiz-time"]:checked').value);
    const modeVal = document.querySelector('input[name="quiz-mode"]:checked').value;
    
    // Create new Quiz Engine instance
    this.quizEngine = new QuizEngine(this.currentQuizData, this.currentQuizName, timeLimitVal, modeVal);
    
    // Setup Engine events
    this.quizEngine.onTick = (remaining, spent) => {
      this.updateTimerUI(remaining, spent);
    };

    this.quizEngine.onTimeUp = () => {
      this.showToast("Hết giờ làm bài! Ứng dụng tự động nộp bài.", "error");
      this.submitQuiz();
    };

    // Transition to quiz view
    this.showScreen('quiz');
    document.getElementById('quiz-title').innerText = this.currentQuizName;
    
    // Start Quiz
    this.quizEngine.start();
    
    // Setup first question
    this.renderQuizQuestion();
    this.renderQuestionGrid();
    this.updateTimerUI(this.quizEngine.timeRemaining, 0);
  }

  /**
   * Renders the current question and option details
   */
  renderQuizQuestion() {
    const engine = this.quizEngine;
    const qIndex = engine.currentQuestionIndex;
    const question = engine.questions[qIndex];
    
    // Update labels
    document.getElementById('current-question-num').innerText = qIndex + 1;
    document.getElementById('total-questions-num').innerText = engine.questions.length;
    document.getElementById('question-category-tag').innerText = question.category;
    
    // Progress Bar
    const progressPercent = ((qIndex + 1) / engine.questions.length) * 100;
    document.getElementById('quiz-progress-bar').style.width = `${progressPercent}%`;
    
    // Question Text
    document.getElementById('question-text').innerText = question.question;
    
    // Options
    const optionsContainer = document.getElementById('options-list');
    optionsContainer.innerHTML = '';
    
    const userSelected = engine.getCurrentAnswer();
    
    // Disable inputs in practice mode if question was already answered to show feedback
    const isAnsweredInPractice = engine.mode === 'practice' && userSelected !== undefined;

    question.options.forEach((option, idx) => {
      const optionItem = document.createElement('div');
      optionItem.className = 'option-item';
      
      const isChecked = userSelected === idx;
      
      // Determine CSS classes for practice mode feedback
      let feedbackClass = '';
      if (isAnsweredInPractice) {
        if (idx === Number(question.correctIndex)) {
          feedbackClass = 'correct';
        } else if (isChecked && idx !== Number(question.correctIndex)) {
          feedbackClass = 'incorrect';
        }
      }
      
      if (feedbackClass) {
        optionItem.classList.add(feedbackClass);
      }

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'quiz-option';
      input.id = `opt-${idx}`;
      input.value = String(idx);
      input.checked = isChecked;
      input.disabled = isAnsweredInPractice;

      const label = document.createElement('label');
      label.className = 'option-label';
      label.htmlFor = input.id;
      label.appendChild(this.createTextElement('span', 'option-prefix', String.fromCharCode(65 + idx)));
      label.appendChild(this.createTextElement('span', 'option-text', option));

      optionItem.append(input, label);
      
      optionsContainer.appendChild(optionItem);

      // Event listener for selecting an option
      if (!isAnsweredInPractice) {
        input.addEventListener('change', () => {
          this.handleOptionSelection(idx);
        });
      }
    });

    // Practice explanation section
    const explanationContainer = document.getElementById('practice-explanation');
    if (isAnsweredInPractice) {
      explanationContainer.style.display = 'block';
      document.getElementById('practice-explanation-text').innerText = question.explanation;
    } else {
      explanationContainer.style.display = 'none';
    }

    // Update Bookmark Button state
    this.updateBookmarkButtonUI();
    
    // Enable/disable previous/next buttons
    document.getElementById('quiz-prev-btn').disabled = qIndex === 0;
    
    // Show Submit instead of Next on last question
    const nextBtn = document.getElementById('quiz-next-btn');
    if (qIndex === engine.questions.length - 1) {
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = 'inline-flex';
    }

    // Persist ongoing state
    this.persistActiveQuiz();
  }

  /**
   * Handlers for option selection
   */
  handleOptionSelection(optionIndex) {
    this.quizEngine.selectOption(optionIndex);
    this.renderQuestionGrid();
    
    if (this.quizEngine.mode === 'practice') {
      // Re-render immediately to show correct/incorrect explanations
      this.renderQuizQuestion();
    } else {
      this.persistActiveQuiz();
    }
  }

  goToPreviousQuestion() {
    if (this.quizEngine && this.quizEngine.prevQuestion()) {
      this.renderQuizQuestion();
    }
  }

  goToNextQuestion() {
    if (this.quizEngine && this.quizEngine.nextQuestion()) {
      this.renderQuizQuestion();
    }
  }

  handleKeyboardNavigation(e) {
    if (!this.shouldHandleQuestionShortcut(e)) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.goToPreviousQuestion();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.goToNextQuestion();
    }
  }

  shouldHandleQuestionShortcut(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return false;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
    if (!this.quizEngine || this.quizEngine.quizSubmitted) return false;
    if (!this.screens.quiz.classList.contains('active')) return false;
    if (document.querySelector('.dialog-overlay')) return false;

    const activeElement = document.activeElement;
    if (!activeElement) return true;
    if (activeElement.isContentEditable) return false;

    const tagName = activeElement.tagName;
    if (tagName === 'TEXTAREA' || tagName === 'SELECT') return false;

    if (tagName === 'INPUT') {
      const inputType = (activeElement.type || '').toLowerCase();
      return inputType === 'radio' || inputType === 'checkbox' || inputType === 'button';
    }

    return true;
  }

  /**
   * Bookmark button appearance
   */
  updateBookmarkButtonUI() {
    const isBookmarked = this.quizEngine.isBookmarked();
    const btn = document.getElementById('quiz-bookmark-btn');
    const icon = btn.querySelector('svg');
    
    if (isBookmarked) {
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
      btn.style.backgroundColor = 'var(--warning-color)';
      btn.style.borderColor = 'var(--warning-color)';
      btn.style.color = 'white';
      icon.setAttribute('fill', 'currentColor');
    } else {
      btn.classList.add('btn-secondary');
      btn.classList.remove('btn-primary');
      btn.style.backgroundColor = '';
      btn.style.borderColor = '';
      btn.style.color = '';
      icon.setAttribute('fill', 'none');
    }
  }

  /**
   * Question Navigator Grid
   */
  renderQuestionGrid() {
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';
    
    const engine = this.quizEngine;
    
    engine.questions.forEach((_, idx) => {
      const btn = document.createElement('button');
      btn.className = 'grid-btn';
      btn.innerText = idx + 1;
      
      const isActive = idx === engine.currentQuestionIndex;
      const isAnswered = engine.isAnswered(idx);
      const isBookmarked = engine.isBookmarked(idx);
      
      if (isActive) btn.classList.add('active');
      else if (isAnswered) btn.classList.add('answered');
      
      if (isBookmarked) btn.classList.add('bookmarked');
      
      btn.addEventListener('click', () => {
        engine.goToQuestion(idx);
        this.renderQuizQuestion();
      });
      
      grid.appendChild(btn);
    });
  }

  /**
   * Updates Timer circular path and text clock
   */
  updateTimerUI(remaining, spent) {
    const timerText = document.getElementById('quiz-timer-text');
    const progressCircle = document.getElementById('timer-progress-circle');
    
    if (this.quizEngine.timeLimit === 0) {
      // Unlimited mode: Show time spent
      const m = String(Math.floor(spent / 60)).padStart(2, '0');
      const s = String(spent % 60).padStart(2, '0');
      timerText.innerText = `${m}:${s}`;
      
      // Save state every 10 seconds of time spent
      if (spent > 0 && spent % 10 === 0) {
        this.persistActiveQuiz();
      }
      
      // Keep stroke full green
      progressCircle.style.strokeDashoffset = '0';
      progressCircle.className.baseVal = 'timer-circle-progress';
      return;
    }

    // Countdown Mode
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    timerText.innerText = `${m}:${s}`;

    // Save state every 10 seconds of countdown remaining
    if (remaining > 0 && remaining % 10 === 0) {
      this.persistActiveQuiz();
    }
    
    // Circle stroke calculations
    const totalDuration = this.quizEngine.timeLimit * 60;
    const ratio = remaining / totalDuration;
    const strokeDashOffset = 126 * (1 - ratio);
    
    progressCircle.style.strokeDashoffset = strokeDashOffset;
    
    // Dynamic warning styling colors
    if (remaining < 30) {
      progressCircle.className.baseVal = 'timer-circle-progress danger';
      timerText.style.color = 'var(--danger-color)';
    } else if (remaining < 120) {
      progressCircle.className.baseVal = 'timer-circle-progress warning';
      timerText.style.color = 'var(--warning-color)';
    } else {
      progressCircle.className.baseVal = 'timer-circle-progress';
      timerText.style.color = '';
    }
  }

  /**
   * Prompts user before submitting
   */
  confirmSubmitQuiz() {
    const total = this.quizEngine.questions.length;
    const answeredCount = Object.keys(this.quizEngine.userAnswers).length;
    const unanswered = total - answeredCount;
    
    let warningMsg = "Bạn muốn nộp bài làm trắc nghiệm ngay bây giờ chứ?";
    if (unanswered > 0) {
      warningMsg = `Bạn còn ${unanswered} câu chưa trả lời. Bạn chắc chắn vẫn muốn nộp bài thi?`;
    }
    
    this.showConfirmDialog("Nộp bài thi", warningMsg, () => {
      this.submitQuiz();
    });
  }

  /**
   * Final Submission & saves history result
   */
  submitQuiz() {
    const results = this.quizEngine.submit();
    
    // Save to LocalStorage
    const savedResult = QuizStorage.saveResult(results);

    // Clear active state since quiz is submitted
    QuizStorage.clearActiveQuizState();
    
    // Open results screen
    this.showScreen('results');
    
    // Draw elements
    this.renderResultsScreen(results, savedResult);
  }

  /**
   * Draws stats cards, circles, SVG charts, and answers review
   */
  renderResultsScreen(results, savedResult) {
    // 1. Title / Title text
    document.getElementById('res-quiz-title').innerText = results.quizName;
    
    // 2. Score Percentage Progress
    const accuracy = results.totalQuestions > 0 ? Math.round((results.score / results.totalQuestions) * 100) : 0;
    const circle = document.getElementById('res-progress-circle');
    
    // Radial SVG has radius of 70, circumference is 440
    const offset = 440 * (1 - accuracy / 100);
    circle.style.strokeDashoffset = offset;
    
    document.getElementById('res-percent').innerText = `${accuracy}%`;
    document.getElementById('res-score-fraction').innerText = `${results.score}/${results.totalQuestions} Câu đúng`;
    
    // Performance assessment message
    let feedbackText = "Cố gắng lên nhé!";
    let feedbackColor = "var(--danger-color)";
    if (accuracy >= 90) {
      feedbackText = "Xuất sắc! Quá đẳng cấp!";
      feedbackColor = "var(--success-color)";
    } else if (accuracy >= 70) {
      feedbackText = "Làm tốt lắm! Hãy tiếp tục phát huy!";
      feedbackColor = "var(--info-color)";
    } else if (accuracy >= 50) {
      feedbackText = "Khá tốt! Bạn có thể cải thiện thêm.";
      feedbackColor = "var(--warning-color)";
    }
    
    const feedbackTag = document.getElementById('res-feedback-text');
    feedbackTag.innerText = feedbackText;
    feedbackTag.style.color = feedbackColor;

    // Set stroke color based on accuracy
    circle.style.stroke = feedbackColor;

    // 3. Mini Stat Cards
    document.getElementById('stat-time-val').innerText = this.formatTime(results.timeSpent);
    
    const avgTimeSecs = results.totalQuestions > 0 ? Math.round(results.timeSpent / results.totalQuestions) : 0;
    document.getElementById('stat-avg-val').innerText = `${avgTimeSecs}s / Câu`;
    
    const incorrectCount = results.totalQuestions - results.score - this.getSkippedCount(results.details);
    document.getElementById('stat-correct-val').innerText = results.score;
    document.getElementById('stat-incorrect-val').innerText = incorrectCount;

    // 4. Comparison performance charts (Progress tracking)
    this.renderComparisonChart(results.quizName);

    // 5. Build Review list elements
    this.reviewData = results.details; // Save globally to filter
    this.filterReviewResults('all');
  }

  getSkippedCount(details) {
    return details.filter(d => d.isSkipped).length;
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}ph ${s}s` : `${s}s`;
  }

  /**
   * Dynamic filtration of the finished question review list
   */
  filterReviewResults(filterType) {
    const list = document.getElementById('review-list');
    list.innerHTML = '';
    
    const engine = this.quizEngine;

    this.reviewData.forEach((q, idx) => {
      // Determine filters
      const isCorrect = q.isCorrect;
      const isIncorrect = !q.isCorrect && !q.isSkipped;
      const isSkipped = q.isSkipped;
      const isBookmarked = engine.isBookmarked(idx);

      if (filterType === 'correct' && !isCorrect) return;
      if (filterType === 'incorrect' && !isIncorrect) return;
      if (filterType === 'skipped' && !isSkipped) return;
      if (filterType === 'bookmarked' && !isBookmarked) return;

      const card = document.createElement('div');
      
      let cardClass = 'review-card card ';
      let badgeClass = 'review-status-badge ';
      let badgeText = '';
      
      if (isCorrect) {
        cardClass += 'correct';
        badgeClass += 'correct';
        badgeText = 'Đúng';
      } else if (isSkipped) {
        cardClass += 'skipped';
        badgeClass += 'skipped';
        badgeText = 'Bỏ qua';
      } else {
        cardClass += 'incorrect';
        badgeClass += 'incorrect';
        badgeText = 'Sai';
      }

      card.className = cardClass;

      const header = document.createElement('div');
      header.className = 'review-card-header';

      const headerText = document.createElement('div');
      headerText.style.flex = '1';
      const category = this.createTextElement('span', 'quiz-tag', q.category);
      category.style.marginBottom = '0.5rem';
      category.style.display = 'inline-block';
      const title = this.createTextElement('h4', '', `Câu hỏi ${idx + 1}: ${q.questionText}`);
      title.style.fontWeight = '700';
      headerText.append(category, title);

      const badge = this.createTextElement('span', badgeClass, badgeText);
      header.append(headerText, badge);

      const options = document.createElement('div');
      options.className = 'review-options';

      q.options.forEach((option, optIdx) => {
        let optItemClass = 'review-option-item';
        let iconHTML = '';
        
        // Highlight states
        if (optIdx === Number(q.correctIndex)) {
          optItemClass += ' correct-target';
          iconHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" class="review-option-icon"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`;
        } else if (optIdx === Number(q.userSelectedIndex) && optIdx !== Number(q.correctIndex)) {
          optItemClass += ' selected-wrong';
          iconHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" class="review-option-icon"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1.414-9.414a1 1 0 10-1.414-1.414L10 8.586 8.586 7.172a1 1 0 00-1.414 1.414L8.586 10l-1.414 1.414a1 1 0 101.414 1.414L10 11.414l1.414 1.414a1 1 0 001.414-1.414L11.414 10l1.414-1.414z" clip-rule="evenodd"/></svg>`;
        }

        const optionItem = document.createElement('div');
        optionItem.className = optItemClass;
        if (iconHTML) {
          optionItem.insertAdjacentHTML('beforeend', iconHTML);
        }
        const optionText = this.createTextElement('span', 'review-option-text', `${String.fromCharCode(65 + optIdx)}. ${option}`);
        optionItem.appendChild(optionText);
        options.appendChild(optionItem);
      });

      const explanationBox = document.createElement('div');
      explanationBox.className = 'review-explanation-box';
      explanationBox.appendChild(this.createTextElement('div', 'review-explanation-title', 'Giải thích đáp án'));
      explanationBox.appendChild(this.createTextElement('p', 'review-explanation-text', q.explanation));

      card.append(header, options, explanationBox);
      
      list.appendChild(card);
    });

    if (list.children.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-history';
      emptyMsg.innerText = "Không tìm thấy câu hỏi nào tương ứng với bộ lọc này.";
      list.appendChild(emptyMsg);
    }
  }

  /**
   * Draws a historical progress chart comparing results on the landing page
   */
  renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    
    const history = QuizStorage.getHistory();
    this.updateDashboardStats(history);
    const landingChartDiv = document.getElementById('landing-chart-container');
    
    if (history.length === 0) {
      list.appendChild(this.createTextElement('div', 'empty-history', 'Lịch sử trống. Hãy hoàn thành bài thi trắc nghiệm đầu tiên để lưu kết quả ôn tập!'));
      landingChartDiv.style.display = 'none';
      return;
    }

    // Show landing side statistics chart
    landingChartDiv.style.display = 'block';
    this.renderGeneralHistoryChart(history);

    // List out historical attempts (newest first)
    const reversedHistory = [...history].reverse();
    reversedHistory.forEach(item => {
      const div = document.createElement('div');
      
      const isPass = item.accuracy >= 70;
      div.className = `history-item ${isPass ? 'pass' : 'fail'}`;
      
      const formattedDate = new Date(item.date).toLocaleDateString('vi-VN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const modeLabel = item.mode === 'practice' ? 'Luyện tập' : 'Thi';

      const itemTop = document.createElement('div');
      itemTop.className = 'history-item-top';
      const itemName = this.createTextElement('span', 'history-item-name', item.quizName);
      itemName.title = item.quizName;
      itemTop.append(
        itemName,
        this.createTextElement('span', 'history-item-score', `${item.score}/${item.totalQuestions} (${item.accuracy}%)`)
      );

      const itemDetails = document.createElement('div');
      itemDetails.className = 'history-item-details';

      const meta = document.createElement('div');
      meta.className = 'history-item-meta';
      meta.append(
        this.createTextElement('span', '', `📅 ${formattedDate}`),
        this.createTextElement('span', '', `⏱️ ${this.formatTime(item.timeSpent)}`)
      );
      const mode = this.createTextElement('span', 'preset-tag', modeLabel);
      mode.style.padding = '0.1rem 0.4rem';
      mode.style.fontSize = '0.7rem';
      meta.appendChild(mode);

      const retake = this.createTextElement('button', 'retake-history-btn', '🔄 Làm lại');
      retake.type = 'button';
      retake.dataset.name = item.quizName;
      retake.title = 'Làm lại bộ đề này';

      itemDetails.append(meta, retake);
      div.append(itemTop, itemDetails);
      list.appendChild(div);
    });
  }

  /**
   * Check if there's any active quiz progress in localStorage.
   */
  checkForActiveQuiz() {
    const savedState = QuizStorage.getActiveQuizState();
    if (savedState) {
      this.showConfirmDialog(
        "Khôi phục bài làm",
        `Bạn có bài trắc nghiệm '${savedState.quizName}' đang làm dở. Bạn có muốn tiếp tục làm tiếp không?`,
        () => {
          this.resumeQuiz(savedState);
        },
        () => {
          QuizStorage.clearActiveQuizState();
        }
      );
    }
  }

  /**
   * Restores the quiz from saved state.
   */
  resumeQuiz(savedState) {
    this.quizEngine = QuizEngine.restore(savedState);
    this.currentQuizData = savedState.questions;
    this.currentQuizName = savedState.quizName;

    // Setup Engine events
    this.quizEngine.onTick = (remaining, spent) => {
      this.updateTimerUI(remaining, spent);
    };

    this.quizEngine.onTimeUp = () => {
      this.showToast("Hết giờ làm bài! Ứng dụng tự động nộp bài.", "error");
      this.submitQuiz();
    };

    // Transition to quiz view
    this.showScreen('quiz');
    document.getElementById('quiz-title').innerText = this.currentQuizName;
    
    // Resume timer
    this.quizEngine.startTimer();
    
    // Render restored question, grid and timer
    this.renderQuizQuestion();
    this.renderQuestionGrid();
    this.updateTimerUI(this.quizEngine.timeRemaining, this.quizEngine.timeSpent);

    this.showToast("Đã khôi phục tiến độ làm bài thành công!", "success");
  }

  /**
   * Save the current quiz engine state to localStorage.
   */
  persistActiveQuiz() {
    if (this.quizEngine && this.quizEngine.quizStarted && !this.quizEngine.quizSubmitted) {
      QuizStorage.saveActiveQuizState(this.quizEngine.serialize());
    }
  }

  /**
   * Draw Line chart for Landing screen using SVG (General historical results)
   */
  renderGeneralHistoryChart(history) {
    const svg = document.getElementById('history-line-chart');
    svg.innerHTML = '';

    // Take last 8 results to fit display nicely
    const data = history.slice(-8);
    if (data.length < 2) {
      // Draw placeholder or simple bar
      svg.innerHTML = `<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" class="comparison-text">Làm thêm đề trắc nghiệm để vẽ biểu đồ.</text>`;
      return;
    }

    const width = 300;
    const height = 120;
    const padding = 15;
    
    // Draw guidelines
    svg.innerHTML += `
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" class="comparison-grid-line" />
      <line x1="${padding}" y1="${height / 2}" x2="${width - padding}" y2="${height / 2}" class="comparison-grid-line" />
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="comparison-grid-line" />
    `;

    // Coordinates calculations
    const points = data.map((item, idx) => {
      const x = padding + (idx * (width - 2 * padding)) / (data.length - 1);
      // Accuracy maps: 100% is y = padding, 0% is y = height - padding
      const y = height - padding - (item.accuracy / 100) * (height - 2 * padding);
      return { x, y, val: item.accuracy };
    });

    // Build SVG Path string
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    // Area path under line
    let areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    // Render area path with gradient styling
    svg.innerHTML += `
      <path d="${areaD}" fill="url(#grad-landing)" opacity="0.3" />
      <path d="${pathD}" class="comparison-line" style="stroke-width:2.5" />
    `;

    // Add points markers
    points.forEach(pt => {
      svg.innerHTML += `
        <circle cx="${pt.x}" cy="${pt.y}" r="4" class="comparison-point" />
      `;
    });
  }

  /**
   * Draws a Comparison Progress line chart on the results page
   * Comparing attempts on the SAME quiz
   */
  renderComparisonChart(quizName) {
    const svg = document.getElementById('comparison-chart');
    svg.innerHTML = '';
    
    // Filter history of this exact quiz
    const history = QuizStorage.getHistory().filter(item => item.quizName === quizName);
    
    if (history.length < 2) {
      // Not enough data to compare
      svg.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" class="comparison-text" style="font-size:12px; fill:var(--text-muted)">Đây là lần làm bộ đề này đầu tiên của bạn. Tiếp tục luyện tập để xem biểu đồ so sánh!</text>`;
      return;
    }

    // Get exact viewport dimensions from wrapper
    const width = svg.clientWidth || 550;
    const height = 180;
    const paddingX = 35;
    const paddingY = 25;

    // Draw horizontal grid lines for 0%, 25%, 50%, 75%, 100%
    const gridYValues = [0, 25, 50, 75, 100];
    gridYValues.forEach(val => {
      const y = height - paddingY - (val / 100) * (height - 2 * paddingY);
      svg.innerHTML += `
        <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" class="comparison-grid-line" />
        <text x="${paddingX - 10}" y="${y + 3}" text-anchor="end" class="comparison-text">${val}%</text>
      `;
    });

    const data = history.slice(-10); // Display maximum last 10 attempts
    
    // Coordinates calculations
    const points = data.map((item, idx) => {
      const x = paddingX + (idx * (width - 2 * paddingX)) / (data.length - 1);
      const y = height - paddingY - (item.accuracy / 100) * (height - 2 * paddingY);
      return { x, y, accuracy: item.accuracy, date: new Date(item.date) };
    });

    // Build line path
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    // Build area gradient path
    let areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

    // Output elements
    svg.innerHTML += `
      <path d="${areaD}" fill="url(#grad-results)" opacity="0.25" />
      <path d="${pathD}" class="comparison-line" />
    `;

    // Draw markers, text labels, and hover nodes
    points.forEach((pt, idx) => {
      const isLatest = idx === points.length - 1;
      
      svg.innerHTML += `
        <circle cx="${pt.x}" cy="${pt.y}" r="${isLatest ? 6 : 4.5}" class="comparison-point" 
          style="${isLatest ? 'fill: var(--accent-color); stroke: white;' : ''}" />
        <text x="${pt.x}" y="${pt.y - 10}" text-anchor="middle" class="comparison-text" 
          style="font-weight: 700; fill: ${isLatest ? 'var(--accent-color)' : 'var(--text-primary)'}">${pt.accuracy}%</text>
        <text x="${pt.x}" y="${height - 8}" text-anchor="middle" class="comparison-text" style="font-size:9px">Lần ${idx + 1}</text>
      `;
    });
  }

  /**
   * Renders preset quizzes including default ones and custom saved quizzes from localStorage.
   */
  renderPresetGrid() {
    const presetGrid = document.getElementById('preset-grid');
    if (!presetGrid) return;
    presetGrid.innerHTML = '';

    // 1. Custom Quizzes from Storage
    const customQuizzes = QuizStorage.getCustomQuizzes();

    // Render default presets
    this.availablePresets.forEach(preset => {
      const card = document.createElement('button');
      card.className = 'preset-card';
      card.type = 'button';
      card.dataset.file = preset.file;
      card.dataset.name = preset.name;
      card.append(
        this.createTextElement('span', 'preset-tag', preset.category),
        this.createTextElement('h4', '', preset.displayName),
        this.createTextElement('span', '', preset.description)
      );
      presetGrid.appendChild(card);
    });

    // Render custom presets
    customQuizzes.forEach(quiz => {
      const card = document.createElement('div');
      card.className = 'preset-card custom-preset-card';
      card.dataset.id = quiz.id;

      const content = document.createElement('div');
      content.className = 'preset-card-content';
      content.style.flex = '1';
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.gap = '0.5rem';
      content.style.cursor = 'pointer';

      const category = this.createTextElement('span', 'preset-tag', quiz.category || 'Tự chọn');
      category.style.backgroundColor = 'var(--info-light)';
      category.style.color = 'var(--info-color)';
      content.append(
        category,
        this.createTextElement('h4', '', quiz.name),
        this.createTextElement('span', '', `${Array.isArray(quiz.questions) ? quiz.questions.length : 0} câu hỏi trắc nghiệm`)
      );

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-quiz-btn';
      deleteBtn.type = 'button';
      deleteBtn.dataset.id = quiz.id;
      deleteBtn.title = 'Xóa bộ đề này';
      deleteBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
      `;
      card.append(content, deleteBtn);
      presetGrid.appendChild(card);
    });

    this.updateDashboardStats();
  }

  updateDashboardStats(history = QuizStorage.getHistory()) {
    const customQuizzes = QuizStorage.getCustomQuizzes();
    const quizCount = this.availablePresets.length + customQuizzes.length;
    const averageAccuracy = history.length
      ? Math.round(history.reduce((sum, item) => sum + Number(item.accuracy || 0), 0) / history.length)
      : 0;

    const quizCountElement = document.getElementById('dashboard-quiz-count');
    const accuracyElement = document.getElementById('dashboard-accuracy');
    const attemptCountElement = document.getElementById('dashboard-attempt-count');

    if (quizCountElement) quizCountElement.textContent = quizCount;
    if (accuracyElement) accuracyElement.textContent = `${averageAccuracy}%`;
    if (attemptCountElement) attemptCountElement.textContent = history.length;
  }

  /**
   * Helper to load a quiz by its name (checks default presets and custom stored quizzes).
   */
  loadQuizByName(quizName) {
    // 1. Check default presets
    const preset = this.availablePresets.find(item => {
      const names = [item.name, item.displayName].map(name => name.trim().toLowerCase());
      return names.includes(quizName.trim().toLowerCase());
    });
    if (preset) {
      this.loadPresetQuiz(preset.file, preset.name);
      return;
    }

    // 2. Check custom quizzes
    const customQuizzes = QuizStorage.getCustomQuizzes();
    const customQuiz = customQuizzes.find(q => q.name.trim().toLowerCase() === quizName.trim().toLowerCase());
    if (customQuiz) {
      try {
        this.validateQuizData(customQuiz.questions);
        this.currentQuizData = customQuiz.questions;
        this.currentQuizName = customQuiz.name;
        this.showToast(`Đã nạp bộ đề: ${customQuiz.name}`, "success");
        this.showScreen('setup');
        document.getElementById('setup-quiz-title').innerText = customQuiz.name;
        document.getElementById('setup-question-count').innerText = `${customQuiz.questions.length} câu hỏi`;
      } catch (err) {
        this.showToast(`Bộ đề đã lưu không hợp lệ: ${err.message}`, "error");
      }
    } else {
      this.showToast(`Không tìm thấy câu hỏi cho bộ đề "${quizName}". Tệp có thể đã bị xóa.`, "error");
    }
  }
}

// Export UI Controller globally
window.QuizUI = QuizUI;
