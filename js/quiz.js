/**
 * QuizEngine - Core logic for managing quiz state, tracking time, bookmarks, and user answers.
 */
class QuizEngine {
  constructor(questions, quizName, timeLimitMinutes, mode) {
    this.quizName = quizName || 'Bài trắc nghiệm';
    this.timeLimit = timeLimitMinutes; // 0 means unlimited
    this.mode = mode || 'practice'; // 'practice' or 'exam'
    
    // Process and normalize questions
    this.questions = this.normalizeQuestions(questions);
    
    this.currentQuestionIndex = 0;
    this.userAnswers = {}; // Map of questionIndex -> selectedOptionIndex (number)
    this.bookmarkedQuestions = new Set(); // Set of questionIndex
    
    this.timeRemaining = this.timeLimit * 60; // in seconds
    this.timeSpent = 0;
    this.quizStarted = false;
    this.quizSubmitted = false;
    
    this.timerInterval = null;
    
    // Callback events
    this.onTick = null; // function(timeRemaining, timeSpent)
    this.onTimeUp = null; // function()
  }

  /**
   * Helper to parse and standardize the answer fields from JSON.
   */
  normalizeQuestions(questions) {
    return questions.map((q, idx) => {
      // Ensure we have standard keys
      const question = {
        id: q.id || idx + 1,
        question: q.question || '',
        options: Array.isArray(q.options) ? q.options : [],
        explanation: q.explanation || 'Không có giải thích cho câu hỏi này.',
        category: q.category || 'Chung',
        originalAnswer: q.answer
      };

      // Determine correct answer index
      let correctIndex = -1;
      if (typeof q.answer === 'number') {
        if (q.answer >= 0 && q.answer < question.options.length) {
          correctIndex = q.answer;
        }
      } else if (typeof q.answer === 'string') {
        // Find option index that matches string exactly or trim/case-insensitively
        const cleanAnswer = q.answer.trim().toLowerCase();
        correctIndex = question.options.findIndex(opt => opt.toString().trim().toLowerCase() === cleanAnswer);
      }

      question.correctIndex = correctIndex;
      return question;
    });
  }

  start() {
    this.quizStarted = true;
    this.timeSpent = 0;
    
    if (this.timeLimit > 0) {
      this.timeRemaining = this.timeLimit * 60;
      this.startTimer();
    }
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    const startTime = Date.now();
    const initialTimeRemaining = this.timeRemaining;
    
    this.timerInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      
      this.timeSpent = elapsedSeconds;
      
      if (this.timeLimit > 0) {
        this.timeRemaining = initialTimeRemaining - elapsedSeconds;
        if (this.timeRemaining <= 0) {
          this.timeRemaining = 0;
          this.stopTimer();
          if (this.onTimeUp) this.onTimeUp();
          return;
        }
      }
      
      if (this.onTick) {
        this.onTick(this.timeRemaining, this.timeSpent);
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Save user's selection for the current question
   */
  selectOption(optionIndex) {
    if (this.quizSubmitted) return;
    this.userAnswers[this.currentQuestionIndex] = optionIndex;
  }

  getCurrentAnswer() {
    return this.userAnswers[this.currentQuestionIndex];
  }

  toggleBookmark() {
    if (this.bookmarkedQuestions.has(this.currentQuestionIndex)) {
      this.bookmarkedQuestions.delete(this.currentQuestionIndex);
      return false;
    } else {
      this.bookmarkedQuestions.add(this.currentQuestionIndex);
      return true;
    }
  }

  isBookmarked(index = this.currentQuestionIndex) {
    return this.bookmarkedQuestions.has(index);
  }

  isAnswered(index = this.currentQuestionIndex) {
    return this.userAnswers[index] !== undefined;
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      return true;
    }
    return false;
  }

  prevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      return true;
    }
    return false;
  }

  goToQuestion(index) {
    if (index >= 0 && index < this.questions.length) {
      this.currentQuestionIndex = index;
      return true;
    }
    return false;
  }

  submit() {
    this.stopTimer();
    this.quizSubmitted = true;
    
    // Calculate final results
    let score = 0;
    const details = this.questions.map((q, idx) => {
      const userSel = this.userAnswers[idx];
      const isCorrect = userSel !== undefined && userSel === q.correctIndex;
      const isSkipped = userSel === undefined;
      
      if (isCorrect) score++;
      
      return {
        questionId: q.id,
        questionText: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        userSelectedIndex: userSel,
        isCorrect: isCorrect,
        isSkipped: isSkipped,
        explanation: q.explanation,
        category: q.category
      };
    });

    return {
      quizName: this.quizName,
      score: score,
      totalQuestions: this.questions.length,
      timeSpent: this.timeSpent,
      mode: this.mode,
      details: details
    };
  }
}

// Export class globally or for ES modules
window.QuizEngine = QuizEngine;
