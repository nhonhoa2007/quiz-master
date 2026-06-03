/**
 * UI Controller - Manages DOM manipulation, page states, event handlers, animations, and chart rendering.
 */
class QuizUI {
  constructor() {
    this.currentQuizData = null;
    this.currentQuizName = 'Bộ đề trắc nghiệm';
    this.quizEngine = null;
    
    // Cache DOM Elements
    this.screens = {
      landing: document.getElementById('landing-screen'),
      setup: document.getElementById('setup-screen'),
      quiz: document.getElementById('quiz-screen'),
      results: document.getElementById('results-screen')
    };

    this.initEventListeners();
    this.renderHistory();
    this.renderPresetGrid();

    // Check for saved ongoing quiz progress
    setTimeout(() => this.checkForActiveQuiz(), 100);
  }

  /**
   * Screen navigation
   */
  showScreen(screenName) {
    Object.keys(this.screens).forEach(name => {
      if (name === screenName) {
        this.screens[name].classList.add('active');
        this.screens[name].dispatchEvent(new Event('screenactive'));
      } else {
        this.screens[name].classList.remove('active');
      }
    });
    // Scroll to top on screen change
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    toast.innerHTML = `
      ${icon}
      <span class="toast-message">${message}</span>
    `;
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
    
    overlay.innerHTML = `
      <div class="dialog-box">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="dialog-buttons">
          <button class="btn btn-secondary btn-sm" id="dlg-cancel">Hủy</button>
          <button class="btn btn-primary btn-sm" id="dlg-confirm">Xác nhận</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    overlay.querySelector('#dlg-cancel').addEventListener('click', () => {
      overlay.remove();
      if (onCancel) onCancel();
    });
    overlay.querySelector('#dlg-confirm').addEventListener('click', () => {
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
              this.currentQuizData = quiz.questions;
              this.currentQuizName = quiz.name;
              this.showToast(`Đã chọn bộ đề: ${quiz.name}`, "success");
              this.showScreen('setup');
              document.getElementById('setup-quiz-title').innerText = quiz.name;
              document.getElementById('setup-question-count').innerText = `${quiz.questions.length} câu hỏi`;
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
    const sidebar = document.getElementById('quiz-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    
    const closeSidebar = () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('open');
    };

    gridTrigger.addEventListener('click', () => {
      sidebar.classList.add('open');
      backdrop.classList.add('open');
    });

    backdrop.addEventListener('click', closeSidebar);
    
    // Close sidebar on grid button click for mobile
    document.getElementById('question-grid').addEventListener('click', (e) => {
      if (e.target.classList.contains('grid-btn')) {
        closeSidebar();
      }
    });

    // 7. Quiz controls
    document.getElementById('quiz-prev-btn').addEventListener('click', () => {
      if (this.quizEngine.prevQuestion()) {
        this.renderQuizQuestion();
      }
    });

    document.getElementById('quiz-next-btn').addEventListener('click', () => {
      if (this.quizEngine.nextQuestion()) {
        this.renderQuizQuestion();
      }
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

    // 11. Page reload auto-save handler
    window.addEventListener('beforeunload', () => {
      this.persistActiveQuiz();
    });

    // 12. History list retake click handler
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
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Dữ liệu JSON phải là một mảng chứa danh sách câu hỏi.");
        }
        
        // Basic schema validation
        const isValid = data.every(item => {
          return item.question && Array.isArray(item.options) && item.options.length >= 2 && item.answer !== undefined;
        });

        if (!isValid) {
          throw new Error("Một số câu hỏi bị thiếu trường 'question', 'options' (tối thiểu 2) hoặc 'answer'.");
        }

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
        if (idx === question.correctIndex) {
          feedbackClass = 'correct';
        } else if (isChecked && idx !== question.correctIndex) {
          feedbackClass = 'incorrect';
        }
      }
      
      if (feedbackClass) {
        optionItem.classList.add(feedbackClass);
      }

      optionItem.innerHTML = `
        <input type="radio" name="quiz-option" id="opt-${idx}" value="${idx}" 
          ${isChecked ? 'checked' : ''} 
          ${isAnsweredInPractice ? 'disabled' : ''}>
        <label class="option-label" for="opt-${idx}">
          <span class="option-prefix">${String.fromCharCode(65 + idx)}</span>
          <span class="option-text">${option}</span>
        </label>
      `;
      
      optionsContainer.appendChild(optionItem);

      // Event listener for selecting an option
      if (!isAnsweredInPractice) {
        optionItem.querySelector('input').addEventListener('change', () => {
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
      
      // Generate Options UI elements
      let optionsHTML = '';
      q.options.forEach((option, optIdx) => {
        let optItemClass = 'review-option-item';
        let iconHTML = '';
        
        // Highlight states
        if (optIdx === q.correctIndex) {
          optItemClass += ' correct-target';
          iconHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" class="review-option-icon"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`;
        } else if (optIdx === q.userSelectedIndex && optIdx !== q.correctIndex) {
          optItemClass += ' selected-wrong';
          iconHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" class="review-option-icon"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1.414-9.414a1 1 0 10-1.414-1.414L10 8.586 8.586 7.172a1 1 0 00-1.414 1.414L8.586 10l-1.414 1.414a1 1 0 101.414 1.414L10 11.414l1.414 1.414a1 1 0 001.414-1.414L11.414 10l1.414-1.414z" clip-rule="evenodd"/></svg>`;
        }
        
        optionsHTML += `
          <div class="${optItemClass}">
            ${iconHTML}
            <span class="review-option-text"><strong>${String.fromCharCode(65 + optIdx)}.</strong> ${option}</span>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="review-card-header">
          <div style="flex:1">
            <span class="quiz-tag" style="margin-bottom:0.5rem; display:inline-block">${q.category}</span>
            <h4 style="font-weight:700">Câu hỏi ${idx + 1}: ${q.questionText}</h4>
          </div>
          <span class="${badgeClass}">${badgeText}</span>
        </div>
        
        <div class="review-options">
          ${optionsHTML}
        </div>
        
        <div class="review-explanation-box">
          <div class="review-explanation-title">Giải thích đáp án</div>
          <p class="review-explanation-text">${q.explanation}</p>
        </div>
      `;
      
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
    const landingChartDiv = document.getElementById('landing-chart-container');
    
    if (history.length === 0) {
      list.innerHTML = `
        <div class="empty-history">
          Lịch sử trống. Hãy hoàn thành bài thi trắc nghiệm đầu tiên để lưu kết quả ôn tập!
        </div>
      `;
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

      div.innerHTML = `
        <div class="history-item-top">
          <span class="history-item-name" title="${item.quizName}">${item.quizName}</span>
          <span class="history-item-score">${item.score}/${item.totalQuestions} (${item.accuracy}%)</span>
        </div>
        <div class="history-item-details" style="align-items: center; justify-content: space-between; display: flex; width: 100%;">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
            <span>📅 ${formattedDate}</span>
            <span>⏱️ ${this.formatTime(item.timeSpent)}</span>
            <span class="preset-tag" style="padding:0.1rem 0.4rem; font-size:0.7rem">${modeLabel}</span>
          </div>
          <button class="retake-history-btn" data-name="${item.quizName}" title="Làm lại bộ đề này">
            🔄 Làm lại
          </button>
        </div>
      `;
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

    // 1. Default Presets
    const defaultPresets = [
      {
        file: 'data/sample-general.json',
        name: 'Kiến thức chung',
        displayName: 'Kiến Thức Tổng Hợp',
        category: 'Xã hội',
        description: '5 câu hỏi trắc nghiệm',
        isPreset: true
      },
      {
        file: 'data/sample-javascript.json',
        name: 'Lập trình JavaScript',
        displayName: 'Lập Trình JavaScript',
        category: 'IT / Code',
        description: '5 câu hỏi kỹ thuật ES6+',
        isPreset: true
      }
    ];

    // 2. Custom Quizzes from Storage
    const customQuizzes = QuizStorage.getCustomQuizzes();

    // Render default presets
    defaultPresets.forEach(preset => {
      const card = document.createElement('button');
      card.className = 'preset-card';
      card.dataset.file = preset.file;
      card.dataset.name = preset.name;
      card.innerHTML = `
        <span class="preset-tag">${preset.category}</span>
        <h4>${preset.displayName}</h4>
        <span>${preset.description}</span>
      `;
      presetGrid.appendChild(card);
    });

    // Render custom presets
    customQuizzes.forEach(quiz => {
      const card = document.createElement('div');
      card.className = 'preset-card custom-preset-card';
      card.dataset.id = quiz.id;
      
      card.innerHTML = `
        <div class="preset-card-content" style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem; cursor: pointer;">
          <span class="preset-tag" style="background-color: var(--info-light); color: var(--info-color);">${quiz.category}</span>
          <h4>${quiz.name}</h4>
          <span>${quiz.questions.length} câu hỏi trắc nghiệm</span>
        </div>
        <button class="delete-quiz-btn" data-id="${quiz.id}" title="Xóa bộ đề này">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      `;
      presetGrid.appendChild(card);
    });
  }

  /**
   * Helper to load a quiz by its name (checks default presets and custom stored quizzes).
   */
  loadQuizByName(quizName) {
    // 1. Check default presets
    if (quizName === 'Kiến thức chung' || quizName === 'Kiến Thức Tổng Hợp') {
      this.loadPresetQuiz('data/sample-general.json', 'Kiến thức chung');
      return;
    }
    if (quizName === 'Lập trình JavaScript' || quizName === 'Lập Trình JavaScript') {
      this.loadPresetQuiz('data/sample-javascript.json', 'Lập trình JavaScript');
      return;
    }

    // 2. Check custom quizzes
    const customQuizzes = QuizStorage.getCustomQuizzes();
    const customQuiz = customQuizzes.find(q => q.name.trim().toLowerCase() === quizName.trim().toLowerCase());
    if (customQuiz) {
      this.currentQuizData = customQuiz.questions;
      this.currentQuizName = customQuiz.name;
      this.showToast(`Đã nạp bộ đề: ${customQuiz.name}`, "success");
      this.showScreen('setup');
      document.getElementById('setup-quiz-title').innerText = customQuiz.name;
      document.getElementById('setup-question-count').innerText = `${customQuiz.questions.length} câu hỏi`;
    } else {
      this.showToast(`Không tìm thấy câu hỏi cho bộ đề "${quizName}". Tệp có thể đã bị xóa.`, "error");
    }
  }
}

// Export UI Controller globally
window.QuizUI = QuizUI;
