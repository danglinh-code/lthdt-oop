// Hệ thống Ôn tập & Thi Trắc nghiệm Lập trình hướng đối tượng với C#
(function () {
  const DATA = window.OOP_DATA;
  const STORAGE_KEYS = {
    THEME: 'oop_theme_v1',
    PRAC_CONFIG: 'oop_practice_config_v1',
    CH_CONFIG: 'oop_chapter_config_v1',
    FULL_CONFIG: 'oop_full_config_v1',
    HISTORY_PRAC: 'oop_history_practice_v1',
    HISTORY_CH: 'oop_history_chapter_v1',
    HISTORY_FULL: 'oop_history_full_v1',
    WRONG_STATS: 'oop_wrong_stats_v1'
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderCodeBlock(code) {
    if (!code || !String(code).trim()) return '';
    return `<pre class="q-code-block"><code>${escapeHtml(code)}</code></pre>`;
  }

  // Default independent settings for Instant Practice Mode (Ôn tập hiện đáp án ngay)
  const defaultPracticeConfig = {
    source: 'all', // 'all' = Tất cả 284 câu, 'syllabus' = Bộ 124 câu Đề cương, 'practice' = Bộ 160 câu Luyện tập
    scope: '0', // '0' = Toàn bộ 8 chương (284 câu), '1'..'8' = Chương 1..8
    sectionId: 'all',
    qCountMode: 'all', // 'all', '10', '20', '30', '50', 'custom', 'negative', 'wrong'
    customQCount: 20,
    timerPreset: 'none', // 'none', '15', '30', '45', 'per_question', 'custom'
    customMin: 20,
    customSec: 0,
    secPerQ: 45,
    lockFirst: true,
    autoNext: false,
    shuffleQ: true,
    shuffleOpt: false
  };

  // Default independent settings for Function 1 (Chapter exam mode)
  const defaultChapterConfig = {
    source: 'all', // 'all' = Tất cả câu của chương, 'syllabus' = Bộ 124 Đề cương, 'practice' = Bộ 160 Luyện tập
    chapterId: 1,
    sectionId: 'all',
    qCountMode: 'all', // 'all', '10', '15', '20', 'custom', 'wrong'
    customQCount: 10,
    timerPreset: '15', // 'none', '10', '15', '20', '30', 'per_question', 'custom'
    customMin: 15,
    customSec: 0,
    secPerQ: 45,
    passScore: 5.0,
    rounding: '2', // '2', '1', '0.25'
    shuffleQ: true,
    shuffleOpt: false
  };

  // Default independent settings for Function 2 (Full exam mode)
  const defaultFullConfig = {
    qMode: '50', // '284', 'only_syllabus', 'only_practice', '40', '50', '60', '100', 'custom_total', 'matrix'
    customTotal: 50,
    distributionType: 'proportional', // 'proportional', 'equal', 'random'
    matrix: { 1: 8, 2: 12, 3: 4, 4: 5, 5: 8, 6: 5, 7: 4, 8: 4 }, // sums to 50 for 284 total
    timerPreset: '45', // '30', '45', '60', '90', 'none', 'per_question', 'custom'
    customMin: 45,
    customSec: 0,
    secPerQ: 45,
    passScore: 5.0,
    rounding: '2',
    shuffleQ: true,
    shuffleOpt: false,
    strictMode: false
  };

  const state = {
    currentView: 'home',
    pracConfig: loadJson(STORAGE_KEYS.PRAC_CONFIG, defaultPracticeConfig),
    chConfig: loadJson(STORAGE_KEYS.CH_CONFIG, defaultChapterConfig),
    fullConfig: loadJson(STORAGE_KEYS.FULL_CONFIG, defaultFullConfig),
    historyPractice: loadJson(STORAGE_KEYS.HISTORY_PRAC, []),
    historyChapter: loadJson(STORAGE_KEYS.HISTORY_CH, []),
    historyFull: loadJson(STORAGE_KEYS.HISTORY_FULL, []),
    wrongStats: loadJson(STORAGE_KEYS.WRONG_STATS, {}), // { [qId]: wrongCount }
    bankShowAnswers: false,
    bankRevealedIds: {},

    // Active Quiz Session
    quiz: null,
    autoNextTimeout: null,
    // Last Completed Quiz Result
    lastResult: null,
    resultFilter: 'all'
  };

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return JSON.parse(JSON.stringify(fallback));
      return Object.assign(JSON.parse(JSON.stringify(fallback)), JSON.parse(raw));
    } catch (e) {
      return JSON.parse(JSON.stringify(fallback));
    }
  }

  function saveJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  function formatScore10(rawScore, roundingMode) {
    const mode = String(roundingMode || '2');
    if (mode === '0.25') {
      const r = Math.round(rawScore * 4) / 4;
      return r.toFixed(2);
    }
    if (mode === '1') {
      return (Math.round(rawScore * 10) / 10).toFixed(1);
    }
    return (Math.round(rawScore * 100) / 100).toFixed(2);
  }

  function getNumericScore10(rawScore, roundingMode) {
    return parseFloat(formatScore10(rawScore, roundingMode));
  }

  function getAcademicRank(score10) {
    if (score10 >= 9.0) return { label: 'Xuất sắc', color: '#15803d' };
    if (score10 >= 8.0) return { label: 'Giỏi', color: '#1d4ed8' };
    if (score10 >= 7.0) return { label: 'Khá', color: '#0369a1' };
    if (score10 >= 5.0) return { label: 'Trung bình (Đạt)', color: '#b45309' };
    return { label: 'Yếu (Chưa đạt)', color: '#b91c1c' };
  }

  function formatTimeMMSS(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function getChapterById(chId) {
    return DATA.chapters.find(c => c.id === Number(chId));
  }

  function getQuestionsByChapter(chId, secId = 'all', source = 'all') {
    return DATA.questions.filter(q => {
      if (Number(chId) !== 0 && q.chapter !== Number(chId)) return false;
      if (secId && secId !== 'all' && q.sectionId !== secId) return false;
      if (source && source !== 'all' && q.source !== source) return false;
      return true;
    });
  }

  function getChapterStats(chId) {
    const attempts = state.historyChapter.filter(h => Number(h.chapterId) === Number(chId));
    if (!attempts.length) {
      return { count: 0, bestScore10: null, lastScore10: null };
    }
    const best = Math.max(...attempts.map(a => a.score10));
    const last = attempts[0].score10;
    return { count: attempts.length, bestScore10: best, lastScore10: last };
  }

  // ==================== NAVIGATION & THEME ====================
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEYS.THEME, next);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
  }

  function navigate(viewName) {
    if (state.quiz && !state.quiz.submitted && viewName !== 'quiz') {
      const ok = confirm('Bạn đang có bài làm / phiên ôn tập chưa kết thúc. Bạn có chắc muốn rời khỏi màn hình này?');
      if (!ok) return;
      stopQuizTimer();
      state.quiz = null;
    }

    state.currentView = viewName;
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${viewName}`);
    if (navBtn) navBtn.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'home') renderHome();
    if (viewName === 'practice-config') renderPracticeConfigView();
    if (viewName === 'chapter-config') renderChapterConfigView();
    if (viewName === 'full-config') renderFullConfigView();
    if (viewName === 'bank') renderBankView();
    if (viewName === 'history') renderHistoryView();
  }

  // ==================== 1. HOME VIEW ====================
  function renderHome() {
    const totalAttempts = state.historyChapter.length + state.historyFull.length + state.historyPractice.length;
    const bestFull = state.historyFull.length
      ? `${Math.max(...state.historyFull.map(x => x.score10)).toFixed(2)}/10`
      : 'Chưa thi';
    const completedChapters = DATA.chapters.filter(c => getChapterStats(c.id).count > 0).length;

    const statsEl = document.getElementById('home-quick-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-tile">
          <div class="stat-val">${DATA.questions.length}</div>
          <div class="stat-lbl">Câu OOP C# (124 Đề cương + 160 Luyện tập)</div>
        </div>
        <div class="stat-tile">
          <div class="stat-val">3 Chế độ</div>
          <div class="stat-lbl">Ôn tức thì • Chương • Toàn bộ</div>
        </div>
        <div class="stat-tile">
          <div class="stat-val">${completedChapters}/${DATA.chapters.length}</div>
          <div class="stat-lbl">Chương đã làm (${totalAttempts} lượt)</div>
        </div>
        <div class="stat-tile">
          <div class="stat-val">${bestFull}</div>
          <div class="stat-lbl">Điểm Thi Tổng hợp cao nhất</div>
        </div>
      `;
    }

    const gridEl = document.getElementById('home-chapters-grid');
    if (!gridEl) return;

    gridEl.innerHTML = DATA.chapters.map(ch => {
      const qList = getQuestionsByChapter(ch.id);
      const st = getChapterStats(ch.id);
      const scoreBadge = st.bestScore10 !== null
        ? `<span class="pill score-pill">★ Điểm KT: ${st.bestScore10.toFixed(2)}/10</span>`
        : `<span class="pill">Chưa kiểm tra</span>`;

      const sectionsHtml = ch.sections.map(sec => {
        const secCount = getQuestionsByChapter(ch.id, sec.id).length;
        return `<div>• ${sec.title} <strong>(${secCount} câu - PDF tr.${sec.pdfPage})</strong></div>`;
      }).join('');

      return `
        <div class="chapter-card">
          <div>
            <div class="chapter-card-top">
              <span class="ch-badge">${ch.code}</span>
              <div class="ch-meta-pills">
                <span class="pill"><strong>${qList.length}</strong> câu</span>
                <span class="pill">PDF tr.${ch.pdfStart}–${ch.pdfEnd}</span>
                ${scoreBadge}
              </div>
            </div>
            <h4>${ch.title}</h4>
            <p class="ch-desc">${ch.description}</p>
            <div class="ch-sections-list">
              ${sectionsHtml}
            </div>
          </div>
          <div class="chapter-card-actions">
            <button class="btn btn-success btn-sm" style="flex:1" onclick="app.quickStartPracticeChapter(${ch.id})">
              ⚡ Ôn hiện đáp án ngay
            </button>
            <button class="btn btn-primary btn-sm" style="flex:1" onclick="app.quickStartChapter(${ch.id})">
              📘 Kiểm tra ${ch.code}
            </button>
            <button class="btn btn-subtle btn-sm" onclick="app.openChapterInBank(${ch.id})">
              🔍 Tra cứu
            </button>
            <button class="btn btn-outline btn-sm" onclick="app.openPdfModal(${ch.pdfStart}, '${ch.code}: ${ch.shortTitle}')">
              📖 PDF
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function quickStartPracticeChapter(chId) {
    state.pracConfig.source = 'all';
    state.pracConfig.scope = String(chId);
    state.pracConfig.sectionId = 'all';
    state.pracConfig.qCountMode = 'all';
    saveJson(STORAGE_KEYS.PRAC_CONFIG, state.pracConfig);
    navigate('practice-config');
  }

  function quickStartSyllabusPractice() {
    state.pracConfig.source = 'syllabus';
    state.pracConfig.scope = '0';
    state.pracConfig.sectionId = 'all';
    state.pracConfig.qCountMode = 'all';
    saveJson(STORAGE_KEYS.PRAC_CONFIG, state.pracConfig);
    navigate('practice-config');
  }

  function quickStartChapter(chId) {
    state.chConfig.chapterId = Number(chId);
    state.chConfig.sectionId = 'all';
    saveJson(STORAGE_KEYS.CH_CONFIG, state.chConfig);
    navigate('chapter-config');
  }

  function openChapterInBank(chId) {
    navigate('bank');
    const sel = document.getElementById('bank-chapter-select');
    if (sel) {
      sel.value = String(chId);
      onBankChapterChange();
    }
  }

  // ==================== 1B. INSTANT PRACTICE CONFIG VIEW (ÔN TẬP HIỆN ĐÁP ÁN NGAY) ====================
  function setPracticeSource(src, skipUpdate) {
    state.pracConfig.source = src || 'all';
    const container = document.getElementById('prac-source-chips');
    if (container) {
      const sources = ['all', 'syllabus', 'practice'];
      container.querySelectorAll('.chip-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', sources[idx] === state.pracConfig.source);
      });
    }
    populatePracticeScopeDropdown();
    populatePracticeSectionsDropdown();
    if (!skipUpdate) updatePracticePreview();
  }

  function populatePracticeScopeDropdown() {
    const scopeSel = document.getElementById('prac-scope-select');
    if (!scopeSel) return;
    const src = state.pracConfig.source || 'all';
    const totalInSource = DATA.questions.filter(q => src === 'all' || q.source === src).length;
    let label = `🌐 Toàn bộ ${DATA.chapters.length} Chương (${totalInSource} câu)`;
    if (src === 'syllabus') label = `📘 Toàn bộ ${DATA.chapters.length} Chương (${totalInSource} câu Đề cương chuẩn)`;
    else if (src === 'practice') label = `💻 Toàn bộ ${DATA.chapters.length} Chương (${totalInSource} câu Luyện tập OOP C#)`;

    let html = `<option value="0">${label}</option>`;
    html += DATA.chapters.map(ch => {
      const count = getQuestionsByChapter(ch.id, 'all', src).length;
      return `<option value="${ch.id}">📘 ${ch.code}: ${ch.title} (${count} câu • PDF tr.${ch.pdfStart}–${ch.pdfEnd})</option>`;
    }).join('');
    scopeSel.innerHTML = html;
    scopeSel.value = String(state.pracConfig.scope ?? '0');
    if (scopeSel.selectedIndex === -1) scopeSel.value = '0';
  }

  function renderPracticeConfigView() {
    setPracticeSource(state.pracConfig.source || 'all', true);
    populatePracticeScopeDropdown();
    populatePracticeSectionsDropdown();

    document.getElementById('prac-custom-qcount').value = state.pracConfig.customQCount || 20;
    document.getElementById('prac-custom-min').value = state.pracConfig.customMin ?? 20;
    document.getElementById('prac-custom-sec').value = state.pracConfig.customSec ?? 0;
    document.getElementById('prac-sec-per-q').value = state.pracConfig.secPerQ || 45;
    document.getElementById('prac-lock-first').checked = state.pracConfig.lockFirst !== false;
    document.getElementById('prac-auto-next').checked = !!state.pracConfig.autoNext;
    document.getElementById('prac-shuffle-q').checked = !!state.pracConfig.shuffleQ;
    document.getElementById('prac-shuffle-opt').checked = !!state.pracConfig.shuffleOpt;

    setPracticeQCountMode(state.pracConfig.qCountMode || 'all', true);
    setPracticeTimerPreset(state.pracConfig.timerPreset || 'none', true);
    updatePracticePreview();
    renderPracticeScoresBoard();
  }

  function populatePracticeSectionsDropdown() {
    const scopeVal = document.getElementById('prac-scope-select').value;
    const secGroup = document.getElementById('prac-section-group');
    const secSelect = document.getElementById('prac-section-select');
    const hintEl = document.getElementById('prac-scope-hint');
    const src = state.pracConfig.source || 'all';

    if (scopeVal === '0') {
      secGroup.style.display = 'none';
      secSelect.innerHTML = `<option value="all">Tất cả các mục</option>`;
      if (hintEl) {
        const totalInSource = DATA.questions.filter(q => src === 'all' || q.source === src).length;
        const srcText = src === 'syllabus' ? '124 câu Đề cương chuẩn' : (src === 'practice' ? '160 câu Luyện tập OOP C#' : `${DATA.questions.length} câu hỏi đầy đủ`);
        hintEl.innerHTML = `📚 Phạm vi: <strong>Toàn bộ ${DATA.chapters.length} Chương (${totalInSource} câu • ${srcText})</strong> • Phù hợp để ôn tổng rà soát và xem giải thích ngay sau mỗi câu.`;
      }
      return;
    }

    secGroup.style.display = 'block';
    const chId = Number(scopeVal);
    const ch = getChapterById(chId);
    const totalChQ = getQuestionsByChapter(chId, 'all', src).length;

    let html = `<option value="all">Tất cả các mục trong ${ch.code} (${totalChQ} câu)</option>`;
    ch.sections.forEach(s => {
      const cnt = getQuestionsByChapter(chId, s.id, src).length;
      html += `<option value="${s.id}" ${cnt === 0 ? 'disabled' : ''}>${s.title} (${cnt} câu • PDF tr.${s.pdfPage})</option>`;
    });
    secSelect.innerHTML = html;

    if (state.pracConfig.sectionId && secSelect.querySelector(`option[value="${state.pracConfig.sectionId}"]`)) {
      secSelect.value = state.pracConfig.sectionId;
    } else {
      secSelect.value = 'all';
    }

    if (hintEl) {
      hintEl.innerHTML = `📖 Đề cương: <strong>${ch.bookPages}</strong> (PDF trang <strong>${ch.pdfStart} – ${ch.pdfEnd}</strong>) • ${ch.description}`;
    }
  }

  function onPracticeScopeChange() {
    state.pracConfig.scope = document.getElementById('prac-scope-select').value;
    state.pracConfig.sectionId = 'all';
    populatePracticeSectionsDropdown();
    updatePracticePreview();
  }

  function setPracticeQCountMode(mode, skipUpdate) {
    state.pracConfig.qCountMode = mode;
    const container = document.getElementById('prac-qcount-chips');
    if (container) {
      const modes = ['all', '10', '20', '30', '50', 'custom', 'negative', 'wrong'];
      container.querySelectorAll('.chip-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', modes[idx] === mode);
      });
    }
    const customWrap = document.getElementById('prac-custom-qcount-wrap');
    if (customWrap) {
      customWrap.style.display = mode === 'custom' ? 'block' : 'none';
    }
    if (!skipUpdate) updatePracticePreview();
  }

  function setPracticeTimerPreset(preset, skipUpdate) {
    state.pracConfig.timerPreset = preset;
    const container = document.getElementById('prac-timer-chips');
    if (container) {
      const presets = ['none', '15', '30', '45', 'per_question', 'custom'];
      container.querySelectorAll('.chip-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', presets[idx] === preset);
      });
    }
    document.getElementById('prac-timer-custom-wrap').style.display = preset === 'custom' ? 'grid' : 'none';
    document.getElementById('prac-timer-perq-wrap').style.display = preset === 'per_question' ? 'block' : 'none';
    if (!skipUpdate) updatePracticePreview();
  }

  function getSelectedPracticeQuestionPool() {
    const scopeVal = document.getElementById('prac-scope-select').value;
    const secId = scopeVal === '0' ? 'all' : document.getElementById('prac-section-select').value;
    const src = state.pracConfig.source || 'all';
    let pool = getQuestionsByChapter(Number(scopeVal), secId, src);
    const mode = state.pracConfig.qCountMode;

    if (mode === 'negative') {
      const negPool = pool.filter(q => q.isNegative);
      return { pool: negPool.length ? negPool : pool, count: negPool.length ? negPool.length : pool.length, note: negPool.length ? 'Chỉ lọc các câu hỏi phủ định (Chọn đáp án SAI)' : 'Không có câu phủ định, lấy toàn bộ câu' };
    }

    if (mode === 'wrong') {
      const wrongPool = pool.filter(q => (state.wrongStats[q.id] || 0) > 0);
      return { pool: wrongPool.length ? wrongPool : pool, count: wrongPool.length ? wrongPool.length : pool.length, note: wrongPool.length ? 'Chỉ lọc các câu bạn từng trả lời sai' : 'Chưa có câu làm sai trong phạm vi này, lấy toàn bộ câu' };
    }

    let desiredCount = pool.length;
    if (['10', '20', '30', '50'].includes(mode)) {
      desiredCount = Math.min(pool.length, Number(mode));
    } else if (mode === 'custom') {
      const val = Math.max(1, Number(document.getElementById('prac-custom-qcount').value) || 20);
      desiredCount = Math.min(pool.length, val);
    }
    return { pool, count: desiredCount, note: '' };
  }

  function computePracticeTimerSeconds(questionCount) {
    const preset = state.pracConfig.timerPreset;
    if (preset === 'none') return 0;
    if (['15', '30', '45'].includes(preset)) return Number(preset) * 60;
    if (preset === 'per_question') {
      const secPerQ = Math.max(5, Number(document.getElementById('prac-sec-per-q').value) || 45);
      return questionCount * secPerQ;
    }
    if (preset === 'custom') {
      const m = Math.max(0, Number(document.getElementById('prac-custom-min').value) || 0);
      const s = Math.max(0, Number(document.getElementById('prac-custom-sec').value) || 0);
      return Math.max(10, m * 60 + s);
    }
    return 0;
  }

  function updatePracticePreview() {
    state.pracConfig.scope = document.getElementById('prac-scope-select').value;
    state.pracConfig.sectionId = state.pracConfig.scope === '0' ? 'all' : document.getElementById('prac-section-select').value;
    state.pracConfig.customQCount = Math.max(1, Number(document.getElementById('prac-custom-qcount').value) || 20);
    state.pracConfig.customMin = Math.max(0, Number(document.getElementById('prac-custom-min').value) || 0);
    state.pracConfig.customSec = Math.max(0, Number(document.getElementById('prac-custom-sec').value) || 0);
    state.pracConfig.secPerQ = Math.max(5, Number(document.getElementById('prac-sec-per-q').value) || 45);
    state.pracConfig.lockFirst = document.getElementById('prac-lock-first').checked;
    state.pracConfig.autoNext = document.getElementById('prac-auto-next').checked;
    state.pracConfig.shuffleQ = document.getElementById('prac-shuffle-q').checked;
    state.pracConfig.shuffleOpt = document.getElementById('prac-shuffle-opt').checked;

    saveJson(STORAGE_KEYS.PRAC_CONFIG, state.pracConfig);

    const scopeVal = state.pracConfig.scope;
    const src = state.pracConfig.source || 'all';
    const srcSuffix = src === 'syllabus' ? ' (Bộ 124 câu Đề cương)' : (src === 'practice' ? ' (Bộ 160 câu Luyện tập)' : ` (Toàn bộ ${DATA.questions.length} câu)`);
    const scopeTitle = scopeVal === '0'
      ? `Toàn bộ ${DATA.chapters.length} Chương${srcSuffix}`
      : `${getChapterById(Number(scopeVal)).code}: ${getChapterById(Number(scopeVal)).shortTitle}${src !== 'all' ? srcSuffix : ''}`;

    const { count, pool, note } = getSelectedPracticeQuestionPool();
    const totalSec = computePracticeTimerSeconds(count);

    const summaryEl = document.getElementById('prac-config-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <h4>⚡ Ôn tập Phản hồi tức thì: ${scopeTitle}</h4>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">
          • Số câu ôn tập: <strong>${count} / ${pool.length} câu</strong> ${note ? `<span style="color:var(--success)">(${note})</span>` : ''}<br/>
          • Thời gian: <strong>${totalSec > 0 ? formatTimeMMSS(totalSec) : 'Không giới hạn (Thoải mái đọc kỹ giải thích)'}</strong><br/>
          • Cơ chế hiển thị: <strong>Chọn đáp án tới đâu → Báo Đúng/Sai, hiện Đáp án đúng &amp; Giải thích ngay tới đó</strong>
        </div>
        <div class="scale10-formula" style="color: var(--success);">
          ✓ Hỗ trợ nút "🔄 Chọn lại câu này" ngay tại câu hỏi &amp; Chấm điểm Thang 10 trực tiếp khi đang làm
        </div>
      `;
    }
  }

  function renderPracticeScoresBoard() {
    const el = document.getElementById('prac-scores-board');
    if (!el) return;

    if (!state.historyPractice.length) {
      el.innerHTML = `<p style="font-size:0.86rem; color:var(--text-muted); padding: 12px 0;">Chưa có phiên ôn tập hiện đáp án ngay nào được lưu. Nhấn nút bắt đầu bên trái để trải nghiệm!</p>`;
      return;
    }

    el.innerHTML = `
      <table class="breakdown-table">
        <thead>
          <tr>
            <th>Thời điểm</th>
            <th>Phạm vi ôn tập</th>
            <th>Số câu Đúng</th>
            <th>Điểm (Thang 10)</th>
          </tr>
        </thead>
        <tbody>
          ${state.historyPractice.slice(0, 8).map(item => `
            <tr>
              <td style="font-size:0.78rem;">${item.dateStr}</td>
              <td>${item.title}</td>
              <td>${item.correct}/${item.total}</td>
              <td><strong style="color:var(--success)">${item.score10Str} / 10</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function startPracticeQuiz() {
    updatePracticePreview();
    const scopeVal = state.pracConfig.scope;
    const { pool, count } = getSelectedPracticeQuestionPool();
    if (!pool.length) {
      alert('Không có câu hỏi nào trong phạm vi đã chọn!');
      return;
    }

    let selected = state.pracConfig.shuffleQ ? shuffleArray(pool) : pool.slice();
    selected = selected.slice(0, count);

    const scopeLabel = scopeVal === '0'
      ? `Toàn bộ ${DATA.chapters.length} Chương`
      : `${getChapterById(Number(scopeVal)).code}: ${getChapterById(Number(scopeVal)).shortTitle}`;

    const totalSec = computePracticeTimerSeconds(selected.length);
    launchQuizSession({
      mode: 'practice',
      title: `⚡ Ôn tập Hiện đáp án ngay: ${scopeLabel}`,
      subtitle: `Chế độ Ôn tập Phản hồi tức thì • ${selected.length} câu • Hiện đáp án & giải thích ngay khi chọn`,
      chapterId: Number(scopeVal),
      questions: selected,
      totalSeconds: totalSec,
      passScore: 5.0,
      rounding: '2',
      shuffleOpt: state.pracConfig.shuffleOpt,
      strictMode: false,
      instantFeedback: true,
      lockFirst: state.pracConfig.lockFirst,
      autoNext: state.pracConfig.autoNext
    });
  }

  // ==================== 2. CHAPTER CONFIG VIEW (CHỨC NĂNG 1) ====================
  function setChapterSource(src, skipUpdate) {
    state.chConfig.source = src || 'all';
    const container = document.getElementById('ch-source-chips');
    if (container) {
      const sources = ['all', 'syllabus', 'practice'];
      container.querySelectorAll('.chip-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', sources[idx] === state.chConfig.source);
      });
    }
    populateChapterDropdown();
    populateChapterSectionsDropdown();
    if (!skipUpdate) updateChapterPreview();
  }

  function populateChapterDropdown() {
    const chSelect = document.getElementById('ch-select');
    if (!chSelect) return;
    const src = state.chConfig.source || 'all';
    chSelect.innerHTML = DATA.chapters.map(ch => {
      const count = getQuestionsByChapter(ch.id, 'all', src).length;
      return `<option value="${ch.id}">${ch.code}: ${ch.title} (${count} câu • PDF tr.${ch.pdfStart}–${ch.pdfEnd})</option>`;
    }).join('');
    chSelect.value = String(state.chConfig.chapterId || 1);
    if (chSelect.selectedIndex === -1) chSelect.value = '1';
  }

  function renderChapterConfigView() {
    setChapterSource(state.chConfig.source || 'all', true);
    populateChapterDropdown();
    populateChapterSectionsDropdown();

    document.getElementById('ch-custom-qcount').value = state.chConfig.customQCount || 10;
    document.getElementById('ch-custom-min').value = state.chConfig.customMin ?? 15;
    document.getElementById('ch-custom-sec').value = state.chConfig.customSec ?? 0;
    document.getElementById('ch-sec-per-q').value = state.chConfig.secPerQ || 45;
    document.getElementById('ch-pass-score').value = state.chConfig.passScore ?? 5.0;
    document.getElementById('ch-rounding').value = String(state.chConfig.rounding || '2');
    document.getElementById('ch-shuffle-q').checked = !!state.chConfig.shuffleQ;
    document.getElementById('ch-shuffle-opt').checked = !!state.chConfig.shuffleOpt;

    setChapterQCountMode(state.chConfig.qCountMode || 'all', true);
    setChapterTimerPreset(state.chConfig.timerPreset || '15', true);
    updateChapterPreview();
    renderChapterScoresBoard();
  }

  function populateChapterSectionsDropdown() {
    const chId = Number(document.getElementById('ch-select').value);
    const ch = getChapterById(chId);
    const secSelect = document.getElementById('ch-section-select');
    const src = state.chConfig.source || 'all';
    const totalChQ = getQuestionsByChapter(chId, 'all', src).length;

    let html = `<option value="all">Tất cả các mục trong ${ch.code} (${totalChQ} câu)</option>`;
    ch.sections.forEach(s => {
      const cnt = getQuestionsByChapter(chId, s.id, src).length;
      html += `<option value="${s.id}" ${cnt === 0 ? 'disabled' : ''}>${s.title} (${cnt} câu • PDF tr.${s.pdfPage})</option>`;
    });
    secSelect.innerHTML = html;

    if (state.chConfig.sectionId && secSelect.querySelector(`option[value="${state.chConfig.sectionId}"]`)) {
      secSelect.value = state.chConfig.sectionId;
    } else {
      secSelect.value = 'all';
    }

    const hintEl = document.getElementById('ch-select-hint');
    if (hintEl) {
      hintEl.innerHTML = `📖 Nội dung Đề cương: <strong>${ch.bookPages}</strong> (Tệp PDF trang <strong>${ch.pdfStart} – ${ch.pdfEnd}</strong>) • ${ch.description}`;
    }
  }

  function onChapterSelectChange() {
    state.chConfig.chapterId = Number(document.getElementById('ch-select').value);
    state.chConfig.sectionId = 'all';
    populateChapterSectionsDropdown();
    updateChapterPreview();
  }

  function onChapterSectionChange() {
    state.chConfig.sectionId = document.getElementById('ch-section-select').value;
    updateChapterPreview();
  }

  function setChapterQCountMode(mode, skipUpdate) {
    state.chConfig.qCountMode = mode;
    const container = document.getElementById('ch-qcount-chips');
    if (container) {
      const modes = ['all', '10', '15', '20', 'custom', 'wrong'];
      container.querySelectorAll('.chip-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', modes[idx] === mode);
      });
    }
    const customWrap = document.getElementById('ch-custom-qcount-wrap');
    if (customWrap) {
      customWrap.style.display = mode === 'custom' ? 'block' : 'none';
    }
    if (!skipUpdate) updateChapterPreview();
  }

  function setChapterTimerPreset(preset, skipUpdate) {
    state.chConfig.timerPreset = preset;
    const container = document.getElementById('ch-timer-chips');
    if (container) {
      const presets = ['none', '10', '15', '20', '30', 'per_question', 'custom'];
      container.querySelectorAll('.chip-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', presets[idx] === preset);
      });
    }
    document.getElementById('ch-timer-custom-wrap').style.display = preset === 'custom' ? 'grid' : 'none';
    document.getElementById('ch-timer-perq-wrap').style.display = preset === 'per_question' ? 'block' : 'none';
    if (!skipUpdate) updateChapterPreview();
  }

  function getSelectedChapterQuestionPool() {
    const chId = Number(document.getElementById('ch-select').value);
    const secId = document.getElementById('ch-section-select').value;
    const src = state.chConfig.source || 'all';
    let pool = getQuestionsByChapter(chId, secId, src);
    const mode = state.chConfig.qCountMode;

    if (mode === 'wrong') {
      const wrongPool = pool.filter(q => (state.wrongStats[q.id] || 0) > 0);
      return { pool: wrongPool.length ? wrongPool : pool, count: wrongPool.length ? wrongPool.length : pool.length, fallbackUsed: wrongPool.length === 0 };
    }

    let desiredCount = pool.length;
    if (mode === '10' || mode === '15' || mode === '20') {
      desiredCount = Math.min(pool.length, Number(mode));
    } else if (mode === 'custom') {
      const val = Math.max(1, Number(document.getElementById('ch-custom-qcount').value) || 10);
      desiredCount = Math.min(pool.length, val);
    }
    return { pool, count: desiredCount, fallbackUsed: false };
  }

  function computeChapterTimerSeconds(questionCount) {
    const preset = state.chConfig.timerPreset;
    if (preset === 'none') return 0;
    if (['10', '15', '20', '30'].includes(preset)) return Number(preset) * 60;
    if (preset === 'per_question') {
      const secPerQ = Math.max(5, Number(document.getElementById('ch-sec-per-q').value) || 45);
      return questionCount * secPerQ;
    }
    if (preset === 'custom') {
      const m = Math.max(0, Number(document.getElementById('ch-custom-min').value) || 0);
      const s = Math.max(0, Number(document.getElementById('ch-custom-sec').value) || 0);
      return Math.max(10, m * 60 + s);
    }
    return 15 * 60;
  }

  function updateChapterPreview() {
    state.chConfig.chapterId = Number(document.getElementById('ch-select').value);
    state.chConfig.sectionId = document.getElementById('ch-section-select').value;
    state.chConfig.customQCount = Math.max(1, Number(document.getElementById('ch-custom-qcount').value) || 10);
    state.chConfig.customMin = Math.max(0, Number(document.getElementById('ch-custom-min').value) || 0);
    state.chConfig.customSec = Math.max(0, Number(document.getElementById('ch-custom-sec').value) || 0);
    state.chConfig.secPerQ = Math.max(5, Number(document.getElementById('ch-sec-per-q').value) || 45);
    state.chConfig.passScore = Math.min(10, Math.max(1, parseFloat(document.getElementById('ch-pass-score').value) || 5.0));
    state.chConfig.rounding = document.getElementById('ch-rounding').value;
    state.chConfig.shuffleQ = document.getElementById('ch-shuffle-q').checked;
    state.chConfig.shuffleOpt = document.getElementById('ch-shuffle-opt').checked;

    saveJson(STORAGE_KEYS.CH_CONFIG, state.chConfig);

    const ch = getChapterById(state.chConfig.chapterId);
    const { count, pool, fallbackUsed } = getSelectedChapterQuestionPool();
    const totalSec = computeChapterTimerSeconds(count);
    const pointPerQ = count > 0 ? (10 / count).toFixed(3) : 0;
    const src = state.chConfig.source || 'all';
    const srcSuffix = src === 'syllabus' ? ' [Chỉ câu Đề cương (Bộ 124)]' : (src === 'practice' ? ' [Chỉ câu Luyện tập (Bộ 160)]' : '');

    const summaryEl = document.getElementById('ch-config-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <h4>${ch.code}: ${ch.shortTitle}${srcSuffix}</h4>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">
          • Số câu trong bài: <strong>${count} / ${pool.length} câu</strong>
          ${fallbackUsed ? '<span style="color:var(--warning)">(Chưa có câu sai trong phạm vi này, lấy toàn bộ câu)</span>' : ''}<br/>
          • Thời gian làm bài: <strong>${totalSec > 0 ? formatTimeMMSS(totalSec) + ' (' + Math.round(totalSec / count) + ' giây/câu)' : 'Không giới hạn thời gian'}</strong><br/>
          • Ngưỡng điểm đạt riêng: <strong>≥ ${state.chConfig.passScore.toFixed(1)} / 10 điểm</strong> (Cần đúng ít nhất <strong>${Math.ceil((state.chConfig.passScore / 10) * count)}/${count}</strong> câu)<br/>
          • Chế độ hiển thị: <strong>Chấm điểm &amp; hiện đáp án, giải thích sau khi hoàn thành bài</strong>
        </div>
        <div class="scale10-formula">
          Điểm ${ch.code} (Thang 10) = (Số câu đúng / ${count}) × 10 &nbsp;[Mỗi câu đúng = ${pointPerQ} điểm]
        </div>
      `;
    }
  }

  function renderChapterScoresBoard() {
    const el = document.getElementById('ch-scores-board');
    if (!el) return;

    const rows = DATA.chapters.map(ch => {
      const st = getChapterStats(ch.id);
      const qCount = getQuestionsByChapter(ch.id).length;
      return `
        <tr>
          <td><strong>${ch.code}</strong>: ${ch.shortTitle} <span style="color:var(--text-muted); font-size:0.76rem;">(${qCount} câu)</span></td>
          <td>${st.count} lần</td>
          <td>${st.bestScore10 !== null ? `<strong style="color:var(--success)">${st.bestScore10.toFixed(2)} / 10</strong>` : '<span style="color:var(--text-muted)">—</span>'}</td>
          <td>${st.lastScore10 !== null ? `${st.lastScore10.toFixed(2)} / 10` : '<span style="color:var(--text-muted)">—</span>'}</td>
        </tr>
      `;
    }).join('');

    el.innerHTML = `
      <table class="breakdown-table">
        <thead>
          <tr>
            <th>Chương kiến thức</th>
            <th>Số lượt</th>
            <th>Điểm cao nhất</th>
            <th>Điểm gần nhất</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function openChapterPdfFromConfig() {
    const ch = getChapterById(state.chConfig.chapterId || 1);
    if (ch) openPdfModal(ch.pdfStart, `${ch.code}: ${ch.title}`);
  }

  function startChapterQuiz() {
    updateChapterPreview();
    const ch = getChapterById(state.chConfig.chapterId);
    const { pool, count } = getSelectedChapterQuestionPool();
    if (!pool.length) {
      alert('Không có câu hỏi nào trong mục đã chọn!');
      return;
    }

    let selected = state.chConfig.shuffleQ ? shuffleArray(pool) : pool.slice();
    selected = selected.slice(0, count);

    const totalSec = computeChapterTimerSeconds(selected.length);
    launchQuizSession({
      mode: 'chapter',
      title: `Kiểm tra ${ch.code}: ${ch.shortTitle}`,
      subtitle: `Chức năng 1 (Riêng từng chương) • ${selected.length} câu hỏi • Thang điểm 10`,
      chapterId: ch.id,
      questions: selected,
      totalSeconds: totalSec,
      passScore: state.chConfig.passScore,
      rounding: state.chConfig.rounding,
      shuffleOpt: state.chConfig.shuffleOpt,
      strictMode: false,
      instantFeedback: false
    });
  }

  // ==================== 3. FULL EXAM CONFIG VIEW (CHỨC NĂNG 2) ====================
  function renderFullConfigView() {
    document.getElementById('full-custom-total-input').value = state.fullConfig.customTotal || 50;
    document.getElementById('full-distribution-type').value = state.fullConfig.distributionType || 'proportional';
    document.getElementById('full-custom-min').value = state.fullConfig.customMin ?? 45;
    document.getElementById('full-custom-sec').value = state.fullConfig.customSec ?? 0;
    document.getElementById('full-sec-per-q').value = state.fullConfig.secPerQ || 45;
    document.getElementById('full-pass-score').value = state.fullConfig.passScore ?? 5.0;
    document.getElementById('full-rounding').value = String(state.fullConfig.rounding || '2');
    document.getElementById('full-shuffle-q').checked = !!state.fullConfig.shuffleQ;
    document.getElementById('full-shuffle-opt').checked = !!state.fullConfig.shuffleOpt;
    document.getElementById('full-strict-mode').checked = !!state.fullConfig.strictMode;

    renderFullMatrixInputs();
    setFullQMode(state.fullConfig.qMode || '50', true);
    setFullTimerPreset(state.fullConfig.timerPreset || '45', true);
    updateFullPreview();
    renderFullScoresBoard();
  }

  function renderFullMatrixInputs() {
    const container = document.getElementById('full-matrix-rows');
    if (!container) return;

    container.innerHTML = DATA.chapters.map(ch => {
      const maxQ = getQuestionsByChapter(ch.id).length;
      const curVal = state.fullConfig.matrix && state.fullConfig.matrix[ch.id] !== undefined
        ? state.fullConfig.matrix[ch.id]
        : Math.round((maxQ / DATA.questions.length) * 50);
      return `
        <div class="matrix-row">
          <div><strong>${ch.code}</strong>: ${ch.shortTitle}</div>
          <input type="number" id="matrix-ch-${ch.id}" min="0" max="${maxQ}" value="${curVal}" onchange="app.onMatrixInputChange(${ch.id}, ${maxQ})" />
          <span style="color:var(--text-muted); font-size:0.78rem;">/ ${maxQ} câu</span>
        </div>
      `;
    }).join('');
  }

  function onMatrixInputChange(chId, maxQ) {
    const el = document.getElementById(`matrix-ch-${chId}`);
    let val = Math.max(0, Math.min(maxQ, Number(el.value) || 0));
    el.value = val;
    state.fullConfig.matrix[chId] = val;
    updateFullPreview();
  }

  function resetFullMatrixToProportional() {
    const defaults = { 1: 8, 2: 12, 3: 4, 4: 5, 5: 8, 6: 5, 7: 4, 8: 4 };
    state.fullConfig.matrix = Object.assign({}, defaults);
    renderFullMatrixInputs();
    updateFullPreview();
  }

  function setFullQMode(mode, skipUpdate) {
    state.fullConfig.qMode = mode;
    const container = document.getElementById('full-qmode-chips');
    if (container) {
      const modes = ['284', 'only_syllabus', 'only_practice', '40', '50', '60', '100', 'custom_total', 'matrix'];
      container.querySelectorAll('.chip-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', modes[idx] === mode);
      });
    }
    document.getElementById('full-custom-total-wrap').style.display = mode === 'custom_total' ? 'block' : 'none';
    document.getElementById('full-matrix-wrap').style.display = mode === 'matrix' ? 'block' : 'none';
    if (!skipUpdate) updateFullPreview();
  }

  function setFullTimerPreset(preset, skipUpdate) {
    state.fullConfig.timerPreset = preset;
    const container = document.getElementById('full-timer-chips');
    if (container) {
      const presets = ['30', '45', '60', '90', 'none', 'per_question', 'custom'];
      container.querySelectorAll('.chip-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', presets[idx] === preset);
      });
    }
    document.getElementById('full-timer-custom-wrap').style.display = preset === 'custom' ? 'grid' : 'none';
    document.getElementById('full-timer-perq-wrap').style.display = preset === 'per_question' ? 'block' : 'none';
    if (!skipUpdate) updateFullPreview();
  }

  function computeFullChapterAllocation() {
    const mode = state.fullConfig.qMode;
    const maxPerCh = {};
    DATA.chapters.forEach(c => { maxPerCh[c.id] = getQuestionsByChapter(c.id).length; });
    const totalBank = DATA.questions.length; // 284

    if (mode === '284') {
      return { allocation: Object.assign({}, maxPerCh), total: totalBank, label: `Toàn bộ ${totalBank} câu hỏi OOP C#` };
    }

    if (mode === 'only_syllabus') {
      const allocSyl = {};
      let sumSyl = 0;
      DATA.chapters.forEach(c => {
        const cnt = getQuestionsByChapter(c.id, 'all', 'syllabus').length;
        allocSyl[c.id] = cnt;
        sumSyl += cnt;
      });
      return { allocation: allocSyl, total: sumSyl, label: `Trọn bộ ${sumSyl} câu Đề cương chuẩn` };
    }

    if (mode === 'only_practice') {
      const allocPrac = {};
      let sumPrac = 0;
      DATA.chapters.forEach(c => {
        const cnt = getQuestionsByChapter(c.id, 'all', 'practice').length;
        allocPrac[c.id] = cnt;
        sumPrac += cnt;
      });
      return { allocation: allocPrac, total: sumPrac, label: `Trọn bộ ${sumPrac} câu Luyện tập OOP C#` };
    }

    if (mode === 'matrix') {
      const alloc = {};
      let sum = 0;
      DATA.chapters.forEach(c => {
        const v = Math.max(0, Math.min(maxPerCh[c.id], Number(state.fullConfig.matrix[c.id]) || 0));
        alloc[c.id] = v;
        sum += v;
      });
      if (sum === 0) {
        alloc[1] = 5;
        sum = 5;
      }
      return { allocation: alloc, total: sum, label: 'Ma trận tùy chỉnh từng chương' };
    }

    let targetTotal = 50;
    if (['40', '50', '60', '100'].includes(mode)) {
      targetTotal = Number(mode);
    } else if (mode === 'custom_total') {
      targetTotal = Math.max(DATA.chapters.length, Math.min(totalBank, Number(document.getElementById('full-custom-total-input').value) || 50));
    }

    const distType = mode === 'custom_total' ? (document.getElementById('full-distribution-type').value || 'proportional') : 'proportional';
    const alloc = {};
    DATA.chapters.forEach(c => { alloc[c.id] = 0; });

    if (distType === 'equal') {
      let rem = targetTotal;
      while (rem > 0) {
        let progressed = false;
        for (const ch of DATA.chapters) {
          if (rem > 0 && alloc[ch.id] < maxPerCh[ch.id]) {
            alloc[ch.id]++;
            rem--;
            progressed = true;
          }
        }
        if (!progressed) break;
      }
      return { allocation: alloc, total: targetTotal, label: `Đề ${targetTotal} câu (Phân bổ đều)` };
    }

    let assigned = 0;
    const remainders = [];
    DATA.chapters.forEach(c => {
      const exact = (maxPerCh[c.id] / totalBank) * targetTotal;
      const fl = Math.min(maxPerCh[c.id], Math.floor(exact));
      alloc[c.id] = fl;
      assigned += fl;
      remainders.push({ id: c.id, rem: exact - fl });
    });
    remainders.sort((a, b) => b.rem - a.rem);
    let idx = 0;
    while (assigned < targetTotal && idx < 100) {
      const chId = remainders[idx % remainders.length].id;
      if (alloc[chId] < maxPerCh[chId]) {
        alloc[chId]++;
        assigned++;
      }
      idx++;
    }
    return { allocation: alloc, total: assigned, label: `Đề ${assigned} câu (Tỷ lệ chuẩn ${totalBank} câu)` };
  }

  function computeFullTimerSeconds(totalQuestions) {
    const preset = state.fullConfig.timerPreset;
    if (preset === 'none') return 0;
    if (['30', '45', '60', '90'].includes(preset)) return Number(preset) * 60;
    if (preset === 'per_question') {
      const spq = Math.max(5, Number(document.getElementById('full-sec-per-q').value) || 45);
      return totalQuestions * spq;
    }
    if (preset === 'custom') {
      const m = Math.max(0, Number(document.getElementById('full-custom-min').value) || 0);
      const s = Math.max(0, Number(document.getElementById('full-custom-sec').value) || 0);
      return Math.max(10, m * 60 + s);
    }
    return 45 * 60;
  }

  function updateFullPreview() {
    state.fullConfig.customTotal = Math.max(DATA.chapters.length, Math.min(DATA.questions.length, Number(document.getElementById('full-custom-total-input').value) || 50));
    state.fullConfig.distributionType = document.getElementById('full-distribution-type').value;
    state.fullConfig.customMin = Math.max(0, Number(document.getElementById('full-custom-min').value) || 0);
    state.fullConfig.customSec = Math.max(0, Number(document.getElementById('full-custom-sec').value) || 0);
    state.fullConfig.secPerQ = Math.max(5, Number(document.getElementById('full-sec-per-q').value) || 45);
    state.fullConfig.passScore = Math.min(10, Math.max(1, parseFloat(document.getElementById('full-pass-score').value) || 5.0));
    state.fullConfig.rounding = document.getElementById('full-rounding').value;
    state.fullConfig.shuffleQ = document.getElementById('full-shuffle-q').checked;
    state.fullConfig.shuffleOpt = document.getElementById('full-shuffle-opt').checked;
    state.fullConfig.strictMode = document.getElementById('full-strict-mode').checked;

    saveJson(STORAGE_KEYS.FULL_CONFIG, state.fullConfig);

    const { allocation, total, label } = computeFullChapterAllocation();
    const totalSec = computeFullTimerSeconds(total);
    const pointPerQ = total > 0 ? (10 / total).toFixed(3) : 0;

    const allocChips = DATA.chapters.map(c => {
      const n = allocation[c.id] || 0;
      return `<span class="pill" style="margin:2px;">${c.code}: <strong>${n}</strong> câu</span>`;
    }).join(' ');

    const summaryEl = document.getElementById('full-config-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <h4>Thi Tổng Hợp: ${label || (total + ' câu')}</h4>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">
          • Thời gian làm bài: <strong>${totalSec > 0 ? formatTimeMMSS(totalSec) + ' (' + Math.round(totalSec / total) + ' giây/câu)' : 'Không giới hạn thời gian'}</strong><br/>
          • Ngưỡng điểm đạt tổng hợp: <strong>≥ ${state.fullConfig.passScore.toFixed(1)} / 10 điểm</strong> (Cần đúng <strong>${Math.ceil((state.fullConfig.passScore / 10) * total)}/${total}</strong> câu)<br/>
          • Chế độ hiển thị: <strong>Chấm điểm &amp; hiện đáp án, giải thích sau khi hoàn thành bài</strong><br/>
          • Phân bổ câu hỏi theo 8 chương:
        </div>
        <div style="margin-bottom: 8px;">${allocChips}</div>
        <div class="scale10-formula">
          Điểm Tổng (Thang 10) = (Tổng số câu đúng / ${total}) × 10 &nbsp;[Mỗi câu đúng = ${pointPerQ} điểm]
        </div>
      `;
    }
  }

  function renderFullScoresBoard() {
    const el = document.getElementById('full-scores-board');
    if (!el) return;

    if (!state.historyFull.length) {
      el.innerHTML = `<p style="font-size:0.86rem; color:var(--text-muted); padding: 12px 0;">Bạn chưa có lượt thi tổng hợp nào. Hãy nhấn "Bắt đầu Thi Tổng Hợp" để kiểm tra toàn bộ kiến thức!</p>`;
      return;
    }

    const recent = state.historyFull.slice(0, 6);
    const best = Math.max(...state.historyFull.map(x => x.score10));
    const avg = state.historyFull.reduce((s, x) => s + x.score10, 0) / state.historyFull.length;

    el.innerHTML = `
      <div style="display:flex; gap:10px; margin-bottom:12px;">
        <div class="stat-tile" style="flex:1; padding:10px;">
          <div class="stat-val" style="font-size:1.25rem;">${best.toFixed(2)}/10</div>
          <div class="stat-lbl">Điểm cao nhất</div>
        </div>
        <div class="stat-tile" style="flex:1; padding:10px;">
          <div class="stat-val" style="font-size:1.25rem;">${avg.toFixed(2)}/10</div>
          <div class="stat-lbl">Điểm trung bình (${state.historyFull.length} đề)</div>
        </div>
      </div>
      <table class="breakdown-table">
        <thead>
          <tr>
            <th>Thời điểm</th>
            <th>Quy mô đề</th>
            <th>Số câu đúng</th>
            <th>Điểm (Thang 10)</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map(item => `
            <tr>
              <td style="font-size:0.78rem;">${item.dateStr}</td>
              <td>${item.total} câu</td>
              <td>${item.correct}/${item.total}</td>
              <td><strong style="color:${item.passed ? 'var(--success)' : 'var(--danger)'}">${item.score10.toFixed(2)} / 10</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function startFullQuiz() {
    updateFullPreview();
    const { allocation, total, label } = computeFullChapterAllocation();
    const mode = state.fullConfig.qMode;
    const srcFilter = mode === 'only_syllabus' ? 'syllabus' : (mode === 'only_practice' ? 'practice' : 'all');
    let selectedQuestions = [];

    if (state.fullConfig.qMode === 'custom_total' && state.fullConfig.distributionType === 'random') {
      selectedQuestions = shuffleArray(DATA.questions).slice(0, total);
    } else {
      DATA.chapters.forEach(ch => {
        const takeCount = allocation[ch.id] || 0;
        if (takeCount > 0) {
          const chPool = shuffleArray(getQuestionsByChapter(ch.id, 'all', srcFilter));
          selectedQuestions = selectedQuestions.concat(chPool.slice(0, takeCount));
        }
      });
    }

    if (state.fullConfig.shuffleQ) {
      selectedQuestions = shuffleArray(selectedQuestions);
    } else {
      selectedQuestions.sort((a, b) => a.chapter - b.chapter || a.id - b.id);
    }

    const totalSec = computeFullTimerSeconds(selectedQuestions.length);
    launchQuizSession({
      mode: 'full',
      title: `Thi Tổng Hợp: ${label || (selectedQuestions.length + ' câu')}`,
      subtitle: `Chức năng 2 (Tổng toàn bộ ${DATA.chapters.length} chương) • ${selectedQuestions.length} câu • Thang điểm 10`,
      chapterId: 0,
      questions: selectedQuestions,
      totalSeconds: totalSec,
      passScore: state.fullConfig.passScore,
      rounding: state.fullConfig.rounding,
      shuffleOpt: state.fullConfig.shuffleOpt,
      strictMode: state.fullConfig.strictMode,
      instantFeedback: false
    });
  }

  // ==================== 4. ACTIVE QUIZ ENGINE ====================
  function launchQuizSession(opts) {
    stopQuizTimer();
    if (state.autoNextTimeout) {
      clearTimeout(state.autoNextTimeout);
      state.autoNextTimeout = null;
    }

    const allLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const preparedQuestions = opts.questions.map((q, idx) => {
      const availKeys = Object.keys(q.options).sort();
      const origKeys = opts.shuffleOpt ? shuffleArray(availKeys) : availKeys.slice();
      const displayOptions = {};
      let displayCorrectLetter = q.answer;

      origKeys.forEach((origKey, i) => {
        const dispLetter = allLetters[i];
        displayOptions[dispLetter] = q.options[origKey];
        if (origKey === q.answer) {
          displayCorrectLetter = dispLetter;
        }
      });

      return {
        index: idx,
        id: q.id,
        source: q.source,
        sourceIndex: q.sourceIndex,
        sourceLabel: q.sourceLabel,
        origDocIndex: q.origDocIndex,
        chapter: q.chapter,
        sectionId: q.sectionId,
        sectionTitle: q.sectionTitle,
        pdfPage: q.pdfPage,
        question: q.question,
        code: q.code || '',
        isNegative: q.isNegative,
        displayOptions,
        displayCorrectLetter,
        originalAnswer: q.answer,
        explanation: q.explanation
      };
    });

    state.quiz = {
      mode: opts.mode, // 'practice' | 'chapter' | 'full'
      instantFeedback: !!opts.instantFeedback,
      lockFirst: opts.lockFirst !== false,
      autoNext: !!opts.autoNext,
      title: opts.title,
      subtitle: opts.subtitle,
      chapterId: opts.chapterId,
      questions: preparedQuestions,
      userAnswers: {}, // { [index]: 'A'|'B'|'C'|'D' }
      revealedHint: {}, // { [index]: true } for instant practice peek
      flagged: {},     // { [index]: true }
      currentIndex: 0,
      displayMode: 'single', // 'single' or 'all'
      totalSeconds: opts.totalSeconds,
      remainingSeconds: opts.totalSeconds,
      elapsedSeconds: 0,
      paused: false,
      strictMode: !!opts.strictMode,
      passScore: opts.passScore || 5.0,
      rounding: opts.rounding || '2',
      shuffleOpt: opts.shuffleOpt,
      submitted: false,
      timerInterval: null
    };

    navigate('quiz');
    renderQuizWorkspace();
    startQuizTimer();
  }

  function startQuizTimer() {
    stopQuizTimer();
    if (!state.quiz) return;
    updateTimerUI();

    state.quiz.timerInterval = setInterval(() => {
      if (!state.quiz || state.quiz.paused || state.quiz.submitted) return;
      state.quiz.elapsedSeconds++;
      if (state.quiz.totalSeconds > 0) {
        state.quiz.remainingSeconds--;
        updateTimerUI();
        if (state.quiz.remainingSeconds <= 0) {
          stopQuizTimer();
          alert('⏰ Đã hết thời gian làm bài! Hệ thống sẽ tự động tổng kết điểm theo thang 10.');
          submitQuiz();
        }
      } else {
        updateTimerUI();
      }
    }, 1000);
  }

  function stopQuizTimer() {
    if (state.quiz && state.quiz.timerInterval) {
      clearInterval(state.quiz.timerInterval);
      state.quiz.timerInterval = null;
    }
  }

  function updateTimerUI() {
    if (!state.quiz) return;
    const timerBox = document.getElementById('quiz-timer-box');
    const digitsEl = document.getElementById('quiz-timer-display');
    const pauseBtn = document.getElementById('quiz-pause-btn');

    if (!digitsEl || !timerBox) return;

    timerBox.classList.remove('warning', 'danger');
    if (state.quiz.totalSeconds > 0) {
      digitsEl.textContent = formatTimeMMSS(state.quiz.remainingSeconds);
      if (state.quiz.remainingSeconds <= 60) {
        timerBox.classList.add('danger');
      } else if (state.quiz.remainingSeconds <= 300) {
        timerBox.classList.add('warning');
      }
    } else {
      digitsEl.textContent = formatTimeMMSS(state.quiz.elapsedSeconds) + ' (Tự do)';
    }

    if (pauseBtn) {
      pauseBtn.style.display = state.quiz.strictMode ? 'none' : 'inline-flex';
      pauseBtn.textContent = state.quiz.paused ? '▶ Tiếp tục' : '⏸ Tạm dừng';
    }
  }

  function updateLivePracticeScoreUI() {
    const pillEl = document.getElementById('quiz-live-score-pill');
    const submitTopBtn = document.getElementById('quiz-submit-top-btn');
    if (!pillEl || !state.quiz) return;

    if (!state.quiz.instantFeedback) {
      pillEl.style.display = 'none';
      if (submitTopBtn) submitTopBtn.innerHTML = '✅ Nộp bài &amp; Chấm điểm';
      return;
    }

    pillEl.style.display = 'inline-flex';
    if (submitTopBtn) submitTopBtn.innerHTML = '🏁 Kết thúc &amp; Tổng kết phiên ôn';

    let right = 0;
    let wrong = 0;
    const total = state.quiz.questions.length;
    state.quiz.questions.forEach(q => {
      const u = state.quiz.userAnswers[q.index];
      if (u) {
        if (u === q.displayCorrectLetter) right++;
        else wrong++;
      }
    });

    const curScore10 = total > 0 ? ((right / total) * 10).toFixed(2) : '0.00';
    pillEl.innerHTML = `⚡ Đúng: ${right} | Sai: ${wrong} • Điểm Thang 10: ${curScore10}/10`;
  }

  function togglePauseQuiz() {
    if (!state.quiz || state.quiz.strictMode) return;
    state.quiz.paused = !state.quiz.paused;
    updateTimerUI();
    renderQuizQuestionsArea();
  }

  function toggleQuizDisplayMode() {
    if (!state.quiz) return;
    state.quiz.displayMode = state.quiz.displayMode === 'single' ? 'all' : 'single';
    const btn = document.getElementById('quiz-viewmode-btn');
    if (btn) {
      btn.textContent = state.quiz.displayMode === 'single' ? '📄 Xem tất cả câu' : '🎯 Xem từng câu';
    }
    renderQuizQuestionsArea();
  }

  function renderQuizWorkspace() {
    if (!state.quiz) return;
    document.getElementById('quiz-active-title').textContent = state.quiz.title;
    document.getElementById('quiz-active-subtitle').textContent = state.quiz.subtitle;
    const btn = document.getElementById('quiz-viewmode-btn');
    if (btn) {
      btn.textContent = state.quiz.displayMode === 'single' ? '📄 Xem tất cả câu' : '🎯 Xem từng câu';
    }
    updateTimerUI();
    updateLivePracticeScoreUI();
    renderQuizQuestionsArea();
    renderQuizPalette();
  }

  function renderQuizQuestionsArea() {
    const container = document.getElementById('quiz-questions-container');
    if (!container || !state.quiz) return;

    if (state.quiz.paused) {
      container.innerHTML = `
        <div class="question-stage" style="text-align:center; padding: 60px 20px;">
          <h3 style="margin-bottom: 10px;">⏸ Đang tạm dừng</h3>
          <p style="color: var(--text-secondary); margin-bottom: 20px;">Đồng hồ đang được tạm dừng. Nhấn nút bên dưới để tiếp tục.</p>
          <button class="btn btn-primary btn-lg" onclick="app.togglePauseQuiz()">▶ Tiếp tục</button>
        </div>
      `;
      return;
    }

    if (state.quiz.displayMode === 'single') {
      const q = state.quiz.questions[state.quiz.currentIndex];
      container.innerHTML = renderSingleQuestionCard(q, true);
    } else {
      container.innerHTML = state.quiz.questions.map(q => renderSingleQuestionCard(q, false)).join('');
    }
  }

  function renderSingleQuestionCard(q, isSingleView) {
    const selected = state.quiz.userAnswers[q.index];
    const isFlagged = !!state.quiz.flagged[q.index];
    const isInstant = !!state.quiz.instantFeedback;
    const isRevealed = isInstant && (!!selected || !!state.quiz.revealedHint[q.index]);
    const ch = getChapterById(q.chapter);
    const total = state.quiz.questions.length;

    const optionsHtml = Object.keys(q.displayOptions).map(letter => {
      const isSel = selected === letter;
      const isRightOpt = letter === q.displayCorrectLetter;
      const classes = ['option-item'];
      let badgeHtml = '';

      if (isRevealed) {
        if (isRightOpt) {
          classes.push('correct-reveal');
          badgeHtml = `<span class="rev-opt-tag" style="background:var(--success); color:#fff;">✓ Đáp án đúng</span>`;
        } else if (isSel && !isRightOpt) {
          classes.push('wrong-reveal');
          badgeHtml = `<span class="rev-opt-tag" style="background:var(--danger); color:#fff;">✗ Bạn đã chọn</span>`;
        }
      } else if (isSel) {
        classes.push('selected');
      }

      return `
        <button type="button" class="${classes.join(' ')}" onclick="app.selectQuizOption(${q.index}, '${letter}')">
          <span class="opt-letter">${letter}</span>
          <span class="opt-text">${escapeHtml(q.displayOptions[letter])}</span>
          ${badgeHtml}
        </button>
      `;
    }).join('');

    let instantFeedbackBlock = '';
    if (isRevealed) {
      const isUserRight = selected === q.displayCorrectLetter;
      const bannerClass = isUserRight ? 'fb-correct' : 'fb-wrong';
      const bannerText = selected
        ? (isUserRight
            ? `✅ Chính xác! Đáp án đúng là ${q.displayCorrectLetter}.`
            : `❌ Chưa chính xác! Bạn đã chọn ${selected} — Đáp án đúng phải là ${q.displayCorrectLetter}.`)
        : `👁️ Đang hiển thị đáp án đúng: Phương án ${q.displayCorrectLetter}.`;

      instantFeedbackBlock = `
        <div class="instant-feedback-banner ${bannerClass}">
          <span>${bannerText}</span>
          <button type="button" class="btn btn-sm btn-subtle" onclick="app.resetPracticeQuestion(${q.index})">
            🔄 Chọn lại câu này
          </button>
        </div>
        <div class="explanation-box">
          <div class="expl-header">
            <span>💡 Giải thích chi tiết OOP C# (${ch.code} • ${escapeHtml(q.sectionTitle)})</span>
            <button type="button" class="btn btn-sm btn-outline" onclick="app.openPdfModal(${q.pdfPage}, 'Câu #${q.id} - ${ch.code} (Trang PDF ${q.pdfPage})')">
              📖 Mở trang Đề cương PDF (Tr.${q.pdfPage})
            </button>
          </div>
          <p>${escapeHtml(q.explanation)}</p>
        </div>
      `;
    }

    const navFooter = isSingleView ? `
      <div class="q-nav-footer">
        <button type="button" class="btn btn-outline" ${q.index === 0 ? 'disabled' : ''} onclick="app.goToQuizQuestion(${q.index - 1})">
          ← Câu trước
        </button>
        <div style="font-size: 0.84rem; color: var(--text-secondary);">
          Câu <strong>${q.index + 1}</strong> / ${total}
        </div>
        ${q.index < total - 1 ? `
          <button type="button" class="btn btn-primary" onclick="app.goToQuizQuestion(${q.index + 1})">
            Câu tiếp theo →
          </button>
        ` : `
          <button type="button" class="btn btn-success" onclick="app.confirmSubmitQuiz()">
            ✅ Hoàn thành &amp; Xem tổng kết
          </button>
        `}
      </div>
    ` : '';

    return `
      <div class="question-stage" id="quiz-qcard-${q.index}" style="margin-bottom: 18px;">
        <div class="q-header">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="q-number-badge">Câu ${q.index + 1} / ${total}</span>
            <span class="q-chapter-tag">${ch.code} • Mã NH: #${q.id}</span>
            ${q.source === 'syllabus' ? `<span class="pill" style="background:#dbeafe; color:#1d4ed8; font-weight:600;">📘 Đề cương #${q.sourceIndex}</span>` : `<span class="pill" style="background:#fef3c7; color:#b45309; font-weight:600;">💻 Luyện tập #${q.sourceIndex}</span>`}
            ${isInstant ? `<span class="pill" style="background:var(--success-bg); color:var(--success);">⚡ Hiện đáp án ngay</span>` : ''}
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${isInstant && !isRevealed ? `
              <button type="button" class="btn btn-sm btn-outline" onclick="app.revealPracticeHint(${q.index})">
                👁️ Xem đáp án luôn
              </button>
            ` : ''}
            <button type="button" class="btn btn-sm ${isFlagged ? 'btn-primary' : 'btn-subtle'}" onclick="app.toggleFlagQuestion(${q.index})">
              🚩 ${isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}
            </button>
          </div>
        </div>

        ${q.isNegative ? `<div class="q-negative-alert">⚠️ Lưu ý: Câu hỏi yêu cầu tìm phương án SAI / KHÔNG PHẢI</div>` : ''}
        <div class="q-stem">${escapeHtml(q.question)}</div>
        ${renderCodeBlock(q.code)}

        <div class="options-list">
          ${optionsHtml}
        </div>

        ${instantFeedbackBlock}
        ${navFooter}
      </div>
    `;
  }

  function selectQuizOption(qIndex, letter) {
    if (!state.quiz || state.quiz.paused || state.quiz.submitted) return;

    if (state.quiz.instantFeedback && state.quiz.lockFirst && state.quiz.userAnswers[qIndex]) {
      // Already answered and locked; user can click "Chọn lại câu này" to reset
      return;
    }

    state.quiz.userAnswers[qIndex] = letter;

    // Record wrong answer immediately in practice mode if wrong
    const q = state.quiz.questions[qIndex];
    if (state.quiz.instantFeedback && q && letter !== q.displayCorrectLetter) {
      state.wrongStats[q.id] = (state.wrongStats[q.id] || 0) + 1;
      saveJson(STORAGE_KEYS.WRONG_STATS, state.wrongStats);
    }

    updateLivePracticeScoreUI();
    renderQuizQuestionsArea();
    renderQuizPalette();

    // Auto-advance if configured in practice mode and answer is correct
    if (
      state.quiz.instantFeedback &&
      state.quiz.autoNext &&
      state.quiz.displayMode === 'single' &&
      q &&
      letter === q.displayCorrectLetter &&
      qIndex < state.quiz.questions.length - 1
    ) {
      if (state.autoNextTimeout) clearTimeout(state.autoNextTimeout);
      state.autoNextTimeout = setTimeout(() => {
        if (state.quiz && state.quiz.currentIndex === qIndex) {
          goToQuizQuestion(qIndex + 1);
        }
      }, 1200);
    }
  }

  function resetPracticeQuestion(qIndex) {
    if (!state.quiz) return;
    delete state.quiz.userAnswers[qIndex];
    delete state.quiz.revealedHint[qIndex];
    updateLivePracticeScoreUI();
    renderQuizQuestionsArea();
    renderQuizPalette();
  }

  function revealPracticeHint(qIndex) {
    if (!state.quiz) return;
    state.quiz.revealedHint[qIndex] = true;
    renderQuizQuestionsArea();
  }

  function toggleFlagQuestion(qIndex) {
    if (!state.quiz) return;
    state.quiz.flagged[qIndex] = !state.quiz.flagged[qIndex];
    renderQuizQuestionsArea();
    renderQuizPalette();
  }

  function goToQuizQuestion(qIndex) {
    if (!state.quiz) return;
    if (state.autoNextTimeout) {
      clearTimeout(state.autoNextTimeout);
      state.autoNextTimeout = null;
    }
    const clamped = Math.max(0, Math.min(state.quiz.questions.length - 1, qIndex));
    state.quiz.currentIndex = clamped;
    if (state.quiz.displayMode === 'single') {
      renderQuizQuestionsArea();
      renderQuizPalette();
    } else {
      renderQuizPalette();
      const el = document.getElementById(`quiz-qcard-${clamped}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function renderQuizPalette() {
    if (!state.quiz) return;
    const total = state.quiz.questions.length;
    const answeredCount = Object.keys(state.quiz.userAnswers).length;
    const isInstant = !!state.quiz.instantFeedback;

    const pill = document.getElementById('quiz-progress-pill');
    if (pill) pill.textContent = `${answeredCount} / ${total} đã chọn`;

    const grid = document.getElementById('quiz-palette-grid');
    if (!grid) return;

    grid.innerHTML = state.quiz.questions.map(q => {
      const classes = ['pal-btn'];
      if (q.index === state.quiz.currentIndex && state.quiz.displayMode === 'single') classes.push('current');
      const u = state.quiz.userAnswers[q.index];
      if (u) {
        if (isInstant) {
          classes.push(u === q.displayCorrectLetter ? 'pal-correct' : 'pal-wrong');
        } else {
          classes.push('answered');
        }
      }
      if (state.quiz.flagged[q.index]) classes.push('flagged');
      return `<button type="button" class="${classes.join(' ')}" onclick="app.goToQuizQuestion(${q.index})">${q.index + 1}</button>`;
    }).join('');
  }

  function confirmSubmitQuiz() {
    if (!state.quiz || state.quiz.submitted) return;
    const total = state.quiz.questions.length;
    const answeredCount = Object.keys(state.quiz.userAnswers).length;
    const unanswered = total - answeredCount;

    if (state.quiz.instantFeedback) {
      let msg = `Bạn đã ôn tập được ${answeredCount}/${total} câu hỏi.`;
      if (unanswered > 0) {
        msg += `\nCòn ${unanswered} câu chưa chọn.`;
      }
      msg += `\nBạn có muốn kết thúc phiên ôn tập và xem bảng tổng kết Thang điểm 10 không?`;
      if (confirm(msg)) submitQuiz();
      return;
    }

    let msg = `Bạn đã trả lời ${answeredCount}/${total} câu hỏi.`;
    if (unanswered > 0) {
      msg += `\n⚠️ Còn ${unanswered} câu chưa chọn đáp án (sẽ bị tính 0 điểm).`;
    }
    msg += `\nBạn có chắc chắn muốn nộp bài để hệ thống chấm điểm Thang 10 và hiển thị đáp án + giải thích?`;

    if (confirm(msg)) {
      submitQuiz();
    }
  }

  function cancelQuiz() {
    if (!confirm('Hủy phiên hiện tại và quay lại màn hình thiết lập?')) return;
    const prevMode = state.quiz ? state.quiz.mode : 'home';
    stopQuizTimer();
    state.quiz = null;
    if (prevMode === 'practice') navigate('practice-config');
    else if (prevMode === 'chapter') navigate('chapter-config');
    else navigate('full-config');
  }

  // ==================== 5. GRADING (SCALE 10) & RESULTS VIEW ====================
  function submitQuiz() {
    if (!state.quiz || state.quiz.submitted) return;
    stopQuizTimer();
    state.quiz.submitted = true;

    const qList = state.quiz.questions;
    const total = qList.length;
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;

    const chapterBreakdown = {};
    DATA.chapters.forEach(c => {
      chapterBreakdown[c.id] = { chapter: c, total: 0, correct: 0, wrong: 0, unanswered: 0 };
    });

    qList.forEach(q => {
      const userChoice = state.quiz.userAnswers[q.index] || null;
      const isCorrect = userChoice === q.displayCorrectLetter;
      const b = chapterBreakdown[q.chapter];
      b.total++;

      if (!userChoice) {
        unanswered++;
        b.unanswered++;
      } else if (isCorrect) {
        correct++;
        b.correct++;
      } else {
        wrong++;
        b.wrong++;
        if (!state.quiz.instantFeedback) {
          state.wrongStats[q.id] = (state.wrongStats[q.id] || 0) + 1;
        }
      }
    });

    saveJson(STORAGE_KEYS.WRONG_STATS, state.wrongStats);

    const rawScore10 = total > 0 ? (correct / total) * 10 : 0;
    const score10 = getNumericScore10(rawScore10, state.quiz.rounding);
    const score10Str = formatScore10(rawScore10, state.quiz.rounding);
    const passed = score10 >= state.quiz.passScore;
    const rank = getAcademicRank(score10);

    const now = new Date();
    const dateStr = now.toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const resultRecord = {
      id: Date.now(),
      mode: state.quiz.mode,
      title: state.quiz.title,
      chapterId: state.quiz.chapterId,
      dateStr,
      total,
      correct,
      wrong,
      unanswered,
      score10,
      score10Str,
      passScore: state.quiz.passScore,
      rounding: state.quiz.rounding,
      passed,
      rankLabel: rank.label,
      elapsedSeconds: state.quiz.elapsedSeconds,
      totalSeconds: state.quiz.totalSeconds
    };

    if (state.quiz.mode === 'practice') {
      state.historyPractice.unshift(resultRecord);
      if (state.historyPractice.length > 50) state.historyPractice.pop();
      saveJson(STORAGE_KEYS.HISTORY_PRAC, state.historyPractice);
    } else if (state.quiz.mode === 'chapter') {
      state.historyChapter.unshift(resultRecord);
      if (state.historyChapter.length > 50) state.historyChapter.pop();
      saveJson(STORAGE_KEYS.HISTORY_CH, state.historyChapter);
    } else {
      state.historyFull.unshift(resultRecord);
      if (state.historyFull.length > 50) state.historyFull.pop();
      saveJson(STORAGE_KEYS.HISTORY_FULL, state.historyFull);
    }

    state.lastResult = {
      record: resultRecord,
      questions: qList,
      userAnswers: Object.assign({}, state.quiz.userAnswers),
      flagged: Object.assign({}, state.quiz.flagged),
      chapterBreakdown
    };

    state.resultFilter = 'all';
    navigate('result');
    renderResultView();
  }

  function renderResultView() {
    if (!state.lastResult) return;
    const { record, chapterBreakdown } = state.lastResult;
    const summaryContainer = document.getElementById('result-summary-container');

    const chFilterEl = document.getElementById('result-chapter-filter');
    if (chFilterEl) {
      const activeChs = Object.values(chapterBreakdown).filter(b => b.total > 0);
      chFilterEl.innerHTML = `<option value="all">Tất cả chương trong bài (${record.total} câu)</option>` +
        activeChs.map(b => `<option value="${b.chapter.id}">${b.chapter.code}: ${b.chapter.shortTitle} (${b.correct}/${b.total})</option>`).join('');
      chFilterEl.value = 'all';
    }

    const activeBreakdowns = Object.values(chapterBreakdown).filter(b => b.total > 0);
    const breakdownRowsHtml = activeBreakdowns.map(b => {
      const chScore10 = formatScore10((b.correct / b.total) * 10, record.rounding);
      const pct = Math.round((b.correct / b.total) * 100);
      return `
        <tr>
          <td><strong>${b.chapter.code}</strong>: ${b.chapter.shortTitle}</td>
          <td><strong>${b.correct}</strong> / ${b.total} câu (${pct}%)</td>
          <td><span style="color:var(--danger)">${b.wrong} sai</span> • <span style="color:var(--warning)">${b.unanswered} trống</span></td>
          <td><strong style="color:var(--primary)">${chScore10} / 10</strong></td>
        </tr>
      `;
    }).join('');

    const wrongOrUnansweredCount = record.wrong + record.unanswered;
    const avgSecPerQ = record.total > 0 ? (record.elapsedSeconds / record.total).toFixed(1) : 0;

    const modeHeaderLabel = record.mode === 'practice'
      ? 'Chế độ Ôn tập Hiện đáp án ngay'
      : (record.mode === 'chapter' ? 'Chức năng 1 • Điểm Chương' : 'Chức năng 2 • Điểm Tổng Hợp');

    const configViewTarget = record.mode === 'practice'
      ? 'practice-config'
      : (record.mode === 'chapter' ? 'chapter-config' : 'full-config');

    summaryContainer.innerHTML = `
      <div class="result-hero">
        <div class="score-circle-wrap ${record.passed ? 'passed' : 'failed'}">
          <div style="font-size:0.78rem; font-weight:700; text-transform:uppercase; margin-bottom:6px;">
            ${modeHeaderLabel}
          </div>
          <div class="big-score-10">${record.score10Str}</div>
          <div class="score-scale-label">THANG ĐIỂM 10 (Chuẩn ≥ ${record.passScore.toFixed(1)})</div>
          <div class="grade-pill">${record.passed ? '🎉 ĐẠT' : '⚠️ CHƯA ĐẠT'} • ${record.rankLabel}</div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
            <div>
              <h2 style="font-size:1.35rem; font-weight:800;">${record.title}</h2>
              <p style="font-size:0.84rem; color:var(--text-secondary);">Hoàn thành lúc ${record.dateStr} • Công thức: (${record.correct} / ${record.total}) × 10 = <strong>${record.score10Str} điểm</strong></p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${wrongOrUnansweredCount > 0 ? `
                <button class="btn btn-success btn-sm" onclick="app.retryWrongFromLastResult(true)">
                  ⚡ Ôn lại ${wrongOrUnansweredCount} câu Sai (Hiện đáp án ngay)
                </button>
                <button class="btn btn-primary btn-sm" onclick="app.retryWrongFromLastResult(false)">
                  🔥 Kiểm tra lại ${wrongOrUnansweredCount} câu Sai
                </button>
              ` : ''}
              <button class="btn btn-subtle btn-sm" onclick="app.retrySameQuiz()">
                🔄 Làm lại đề này
              </button>
              <button class="btn btn-outline btn-sm" onclick="app.navigate('${configViewTarget}')">
                ⚙️ Thiết lập mới
              </button>
            </div>
          </div>

          <div class="result-metrics-grid">
            <div class="metric-box">
              <div class="m-val" style="color:var(--success)">${record.correct} / ${record.total}</div>
              <div class="m-lbl">Câu trả lời Đúng (${Math.round((record.correct / record.total) * 100)}%)</div>
            </div>
            <div class="metric-box">
              <div class="m-val" style="color:var(--danger)">${record.wrong} câu</div>
              <div class="m-lbl">Câu trả lời Sai</div>
            </div>
            <div class="metric-box">
              <div class="m-val" style="color:var(--warning)">${record.unanswered} câu</div>
              <div class="m-lbl">Câu bỏ trống (Chưa làm)</div>
            </div>
            <div class="metric-box">
              <div class="m-val">${formatTimeMMSS(record.elapsedSeconds)}</div>
              <div class="m-lbl">Thời gian (${avgSecPerQ}s/câu)</div>
            </div>
          </div>

          <div style="margin-top: 12px;">
            <strong style="font-size: 0.86rem;">📊 Bảng phân tích kết quả &amp; quy đổi Thang điểm 10 theo Chương kiến thức:</strong>
            <table class="breakdown-table">
              <thead>
                <tr>
                  <th>Chương trong Đề cương OOP C#</th>
                  <th>Số câu Đúng</th>
                  <th>Sai / Bỏ trống</th>
                  <th>Điểm Thang 10 của Chương</th>
                </tr>
              </thead>
              <tbody>
                ${breakdownRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    setResultFilter('all');
  }

  function setResultFilter(filterType) {
    state.resultFilter = filterType;
    const container = document.getElementById('result-filter-chips');
    if (container) {
      const types = ['all', 'wrong', 'unanswered', 'correct', 'flagged'];
      container.querySelectorAll('.chip-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', types[idx] === filterType);
      });
    }
    renderResultQuestionsList();
  }

  function renderResultQuestionsList() {
    if (!state.lastResult) return;
    const listEl = document.getElementById('result-questions-list');
    const chFilter = document.getElementById('result-chapter-filter').value;
    const { questions, userAnswers, flagged } = state.lastResult;

    const filtered = questions.filter(q => {
      if (chFilter !== 'all' && q.chapter !== Number(chFilter)) return false;
      const u = userAnswers[q.index];
      const isCorrect = u === q.displayCorrectLetter;
      if (state.resultFilter === 'correct') return !!u && isCorrect;
      if (state.resultFilter === 'wrong') return !!u && !isCorrect;
      if (state.resultFilter === 'unanswered') return !u;
      if (state.resultFilter === 'flagged') return !!flagged[q.index];
      return true;
    });

    if (!filtered.length) {
      listEl.innerHTML = `<div class="panel-card" style="text-align:center; color:var(--text-secondary);">Không có câu hỏi nào khớp với bộ lọc hiện tại.</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(q => {
      const userChoice = userAnswers[q.index] || null;
      const isCorrect = userChoice === q.displayCorrectLetter;
      const ch = getChapterById(q.chapter);

      let cardStatusClass = 'is-unanswered';
      let badgeHtml = `<span class="review-status-badge status-unanswered">⚠️ Chưa trả lời (0 điểm)</span>`;
      if (userChoice && isCorrect) {
        cardStatusClass = 'is-correct';
        badgeHtml = `<span class="review-status-badge status-correct">✅ Chính xác (Bạn chọn ${userChoice})</span>`;
      } else if (userChoice && !isCorrect) {
        cardStatusClass = 'is-wrong';
        badgeHtml = `<span class="review-status-badge status-wrong">❌ Sai (Bạn chọn ${userChoice} • Đáp án đúng: ${q.displayCorrectLetter})</span>`;
      }

      const optsHtml = Object.keys(q.displayOptions).map(letter => {
        const isRightOpt = letter === q.displayCorrectLetter;
        const isUserOpt = letter === userChoice;
        let cls = 'rev-opt';
        let tag = '';

        if (isRightOpt && isUserOpt) {
          cls += ' opt-is-correct';
          tag = `<span class="rev-opt-tag" style="background:var(--success); color:#fff;">✓ Bạn chọn &amp; Đáp án đúng</span>`;
        } else if (isRightOpt) {
          cls += ' opt-is-correct';
          tag = `<span class="rev-opt-tag" style="background:var(--success); color:#fff;">✓ Đáp án đúng</span>`;
        } else if (isUserOpt) {
          cls += ' opt-user-wrong';
          tag = `<span class="rev-opt-tag" style="background:var(--danger); color:#fff;">✗ Đáp án bạn chọn</span>`;
        }

        return `
          <div class="${cls}">
            <div><strong>${letter}.</strong> ${escapeHtml(q.displayOptions[letter])}</div>
            ${tag}
          </div>
        `;
      }).join('');

      return `
        <div class="review-card ${cardStatusClass}">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <span class="q-number-badge">Câu ${q.index + 1}</span>
              <span class="q-chapter-tag">${ch.code} • ${q.sectionTitle}</span>
              <span class="pill">Mã NH #${q.id}</span>
              ${q.source === 'syllabus' ? `<span class="pill" style="background:#dbeafe; color:#1d4ed8; font-weight:600;">📘 Đề cương #${q.sourceIndex}</span>` : `<span class="pill" style="background:#fef3c7; color:#b45309; font-weight:600;">💻 Luyện tập #${q.sourceIndex}</span>`}
            </div>
            ${badgeHtml}
          </div>

          <div class="q-stem" style="font-size:1.02rem; margin-bottom:12px;">${escapeHtml(q.question)}</div>
          ${renderCodeBlock(q.code)}

          <div class="review-options">
            ${optsHtml}
          </div>

          <div class="explanation-box">
            <div class="expl-header">
              <span>💡 Giải thích chi tiết OOP C# (${ch.code} - Trang PDF ${q.pdfPage})</span>
              <button type="button" class="btn btn-sm btn-subtle" onclick="app.openPdfModal(${q.pdfPage}, 'Câu #${q.id} - ${ch.code} (Trang PDF ${q.pdfPage})')">
                📖 Mở trang Đề cương PDF (Tr.${q.pdfPage})
              </button>
            </div>
            <p>${escapeHtml(q.explanation)}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  function retryWrongFromLastResult(asInstantPractice) {
    if (!state.lastResult) return;
    const { record, questions, userAnswers } = state.lastResult;
    const wrongIds = questions
      .filter(q => userAnswers[q.index] !== q.displayCorrectLetter)
      .map(q => q.id);

    const rawPool = DATA.questions.filter(q => wrongIds.includes(q.id));
    if (!rawPool.length) return;

    const useInstant = asInstantPractice || record.mode === 'practice';
    launchQuizSession({
      mode: useInstant ? 'practice' : record.mode,
      title: `${useInstant ? '⚡ Ôn lại' : '🔥 Kiểm tra lại'} ${rawPool.length} câu Sai / Chưa làm`,
      subtitle: `${useInstant ? 'Hiện đáp án & giải thích ngay khi chọn' : 'Chấm điểm sau khi hoàn thành'} • Thang điểm 10`,
      chapterId: record.chapterId,
      questions: shuffleArray(rawPool),
      totalSeconds: useInstant ? 0 : (record.totalSeconds > 0 ? Math.max(60, Math.round((record.totalSeconds / record.total) * rawPool.length)) : 0),
      passScore: record.passScore,
      rounding: record.rounding,
      shuffleOpt: false,
      strictMode: false,
      instantFeedback: useInstant,
      lockFirst: true,
      autoNext: false
    });
  }

  function retrySameQuiz() {
    if (!state.lastResult) return;
    const { record, questions } = state.lastResult;
    const ids = questions.map(q => q.id);
    const rawPool = ids.map(id => DATA.questions.find(q => q.id === id)).filter(Boolean);
    const isPrac = record.mode === 'practice';

    launchQuizSession({
      mode: record.mode,
      title: record.title,
      subtitle: `Làm lại • ${rawPool.length} câu • Thang điểm 10`,
      chapterId: record.chapterId,
      questions: shuffleArray(rawPool),
      totalSeconds: record.totalSeconds,
      passScore: record.passScore,
      rounding: record.rounding,
      shuffleOpt: false,
      strictMode: false,
      instantFeedback: isPrac,
      lockFirst: true,
      autoNext: false
    });
  }

  // ==================== 6. QUESTION BANK & TEXTBOOK VIEW ====================
  function renderBankView() {
    updateBankChapterDropdown();
    populateBankSectionFilter();
    renderBankList();
  }

  function updateBankChapterDropdown() {
    const chSel = document.getElementById('bank-chapter-select');
    const srcSel = document.getElementById('bank-source-select');
    const srcVal = srcSel ? srcSel.value : 'all';
    if (!chSel) return;
    const currentVal = chSel.value || 'all';

    const totalInSrc = srcVal === 'all' ? DATA.questions.length : DATA.questions.filter(q => q.source === srcVal).length;
    let opts = `<option value="all">Tất cả ${DATA.chapters.length} Chương (${totalInSrc} câu)</option>`;
    DATA.chapters.forEach(c => {
      const cnt = getQuestionsByChapter(c.id, 'all', srcVal).length;
      opts += `<option value="${c.id}">${c.code}: ${c.shortTitle} (${cnt} câu)</option>`;
    });
    chSel.innerHTML = opts;
    if ([...chSel.options].some(o => o.value === currentVal)) {
      chSel.value = currentVal;
    } else {
      chSel.value = 'all';
    }
  }

  function onBankSourceChange() {
    updateBankChapterDropdown();
    populateBankSectionFilter();
    renderBankList();
  }

  function onBankChapterChange() {
    populateBankSectionFilter();
    renderBankList();
  }

  function populateBankSectionFilter() {
    const chVal = document.getElementById('bank-chapter-select').value;
    const secSel = document.getElementById('bank-section-select');
    if (!secSel) return;

    if (chVal === 'all') {
      secSel.innerHTML = `<option value="all">Tất cả các Mục kiến thức</option>`;
      return;
    }
    const ch = getChapterById(Number(chVal));
    secSel.innerHTML = `<option value="all">Tất cả các Mục trong ${ch.code}</option>` +
      ch.sections.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
  }

  function toggleBankShowAnswers() {
    state.bankShowAnswers = !state.bankShowAnswers;
    const btn = document.getElementById('bank-toggle-ans-btn');
    if (btn) {
      btn.textContent = state.bankShowAnswers
        ? '🙈 Ẩn tất cả Đáp án & Giải thích'
        : '👁️ Hiện tất cả Đáp án & Giải thích';
    }
    renderBankList();
  }

  function toggleSingleBankReveal(qId) {
    state.bankRevealedIds[qId] = !state.bankRevealedIds[qId];
    renderBankList();
  }

  function renderBankList() {
    const query = (document.getElementById('bank-search-input').value || '').trim().toLowerCase();
    const chVal = document.getElementById('bank-chapter-select').value;
    const secVal = document.getElementById('bank-section-select').value;
    const typeVal = document.getElementById('bank-type-select').value;
    const srcSel = document.getElementById('bank-source-select');
    const srcVal = srcSel ? srcSel.value : 'all';

    const filtered = DATA.questions.filter(q => {
      if (srcVal !== 'all' && q.source !== srcVal) return false;
      if (chVal !== 'all' && q.chapter !== Number(chVal)) return false;
      if (secVal !== 'all' && q.sectionId !== secVal) return false;
      if (typeVal === 'negative' && !q.isNegative) return false;
      if (typeVal === 'wrong_history' && !(state.wrongStats[q.id] > 0)) return false;

      if (query) {
        const hay = `${q.id} ${q.question} ${q.code || ''} ${Object.values(q.options).join(' ')} ${q.explanation}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    const countLbl = document.getElementById('bank-count-label');
    if (countLbl) {
      countLbl.innerHTML = `Đang hiển thị <strong>${filtered.length}</strong> / ${DATA.questions.length} câu hỏi trong ngân hàng đề.`;
    }

    const container = document.getElementById('bank-questions-container');
    if (!container) return;

    if (!filtered.length) {
      container.innerHTML = `<div class="panel-card" style="text-align:center;">Không tìm thấy câu hỏi nào phù hợp với điều kiện lọc.</div>`;
      return;
    }

    container.innerHTML = filtered.map(q => {
      const ch = getChapterById(q.chapter);
      const showAns = state.bankShowAnswers || !!state.bankRevealedIds[q.id];
      const wrongCount = state.wrongStats[q.id] || 0;

      const optsHtml = Object.keys(q.options).sort().map(letter => {
        const isCorrect = showAns && letter === q.answer;
        return `
          <div class="rev-opt ${isCorrect ? 'opt-is-correct' : ''}">
            <div><strong>${letter}.</strong> ${escapeHtml(q.options[letter])}</div>
            ${isCorrect ? `<span class="rev-opt-tag" style="background:var(--success); color:#fff;">✓ Đáp án đúng</span>` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="review-card ${showAns ? 'is-correct' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <span class="q-number-badge">Câu #${q.id}</span>
              ${q.source === 'syllabus' ? `<span class="pill" style="background:#dbeafe; color:#1d4ed8; font-weight:600;">📘 Đề cương #${q.sourceIndex}</span>` : `<span class="pill" style="background:#fef3c7; color:#b45309; font-weight:600;">💻 Luyện tập #${q.sourceIndex}</span>`}
              <span class="q-chapter-tag">${ch.code}: ${ch.shortTitle}</span>
              <span class="pill">${q.sectionTitle}</span>
              ${wrongCount > 0 ? `<span class="pill" style="background:var(--danger-bg); color:var(--danger);">Từng sai ${wrongCount} lần</span>` : ''}
            </div>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn btn-sm btn-subtle" onclick="app.toggleSingleBankReveal(${q.id})">
                ${showAns ? '🙈 Ẩn đáp án' : '👁️ Xem đáp án & Giải thích'}
              </button>
              <button type="button" class="btn btn-sm btn-outline" onclick="app.openPdfModal(${q.pdfPage}, 'Câu #${q.id} - ${ch.code} (Trang PDF ${q.pdfPage})')">
                📖 PDF tr.${q.pdfPage}
              </button>
            </div>
          </div>

          <div class="q-stem" style="font-size:1rem; margin-bottom:10px;">${escapeHtml(q.question)}</div>
          ${renderCodeBlock(q.code)}
          <div class="review-options">${optsHtml}</div>

          ${showAns ? `
            <div class="explanation-box">
              <div class="expl-header">
                <span>💡 Đáp án đúng: ${q.answer} • Giải thích chi tiết OOP C# (${ch.code} - Trang PDF ${q.pdfPage})</span>
              </div>
              <p>${escapeHtml(q.explanation)}</p>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // ==================== 7. HISTORY & ANALYTICS VIEW ====================
  function renderHistoryView() {
    document.getElementById('hist-prac-count').textContent = `${state.historyPractice.length} lượt`;
    document.getElementById('hist-ch-count').textContent = `${state.historyChapter.length} lượt`;
    document.getElementById('hist-full-count').textContent = `${state.historyFull.length} lượt`;

    const pracListEl = document.getElementById('history-practice-list');
    if (pracListEl) {
      if (!state.historyPractice.length) {
        pracListEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.86rem;">Chưa có lịch sử ôn tập hiện đáp án ngay.</p>`;
      } else {
        pracListEl.innerHTML = `
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Phạm vi</th>
                <th>Kết quả</th>
                <th>Điểm Thang 10</th>
              </tr>
            </thead>
            <tbody>
              ${state.historyPractice.slice(0, 12).map(h => `
                <tr>
                  <td style="font-size:0.78rem;">${h.dateStr}</td>
                  <td><strong>${h.chapterId ? 'Chương ' + h.chapterId : 'Tổng hợp'}</strong></td>
                  <td>${h.correct}/${h.total} câu</td>
                  <td><strong style="color:var(--success)">${h.score10Str} / 10</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    }

    const chListEl = document.getElementById('history-chapter-list');
    if (chListEl) {
      if (!state.historyChapter.length) {
        chListEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.86rem;">Chưa có lịch sử làm bài theo chương.</p>`;
      } else {
        chListEl.innerHTML = `
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Chương</th>
                <th>Kết quả</th>
                <th>Điểm Thang 10</th>
              </tr>
            </thead>
            <tbody>
              ${state.historyChapter.slice(0, 12).map(h => `
                <tr>
                  <td style="font-size:0.78rem;">${h.dateStr}</td>
                  <td><strong>Chương ${h.chapterId}</strong></td>
                  <td>${h.correct}/${h.total} câu (${formatTimeMMSS(h.elapsedSeconds)})</td>
                  <td><strong style="color:${h.passed ? 'var(--success)' : 'var(--danger)'}">${h.score10Str} / 10</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    }

    const fullListEl = document.getElementById('history-full-list');
    if (fullListEl) {
      if (!state.historyFull.length) {
        fullListEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.86rem;">Chưa có lịch sử thi tổng hợp toàn bộ kiến thức.</p>`;
      } else {
        fullListEl.innerHTML = `
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Quy mô</th>
                <th>Kết quả</th>
                <th>Điểm Thang 10</th>
              </tr>
            </thead>
            <tbody>
              ${state.historyFull.slice(0, 12).map(h => `
                <tr>
                  <td style="font-size:0.78rem;">${h.dateStr}</td>
                  <td><strong>${h.total} câu</strong></td>
                  <td>${h.correct}/${h.total} câu (${formatTimeMMSS(h.elapsedSeconds)})</td>
                  <td><strong style="color:${h.passed ? 'var(--success)' : 'var(--danger)'}">${h.score10Str} / 10</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    }

    const wrongEl = document.getElementById('history-wrong-questions');
    if (wrongEl) {
      const wrongEntries = Object.entries(state.wrongStats)
        .filter(([, cnt]) => cnt > 0)
        .sort((a, b) => b[1] - a[1]);

      if (!wrongEntries.length) {
        wrongEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.86rem;">Tuyệt vời! Hiện chưa có câu hỏi nào bị ghi nhận làm sai.</p>`;
      } else {
        wrongEl.innerHTML = wrongEntries.slice(0, 20).map(([qId, cnt]) => {
          const q = DATA.questions.find(item => item.id === Number(qId));
          if (!q) return '';
          const ch = getChapterById(q.chapter);
          return `
            <div style="padding: 12px; border:1px solid var(--border-color); border-radius:8px; margin-bottom:8px; background:var(--bg-subtle);">
              <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
                <strong>Câu #${q.id} (${ch.code})</strong>
                <span class="pill" style="background:var(--danger-bg); color:var(--danger);">Sai ${cnt} lần • Đáp án đúng: ${q.answer}</span>
              </div>
              <div style="font-size:0.88rem; margin-bottom:6px;">${escapeHtml(q.question)}</div>
              ${renderCodeBlock(q.code)}
              <div style="font-size:0.82rem; color:var(--success); font-weight:600;">✓ ${q.answer}. ${escapeHtml(q.options[q.answer])}</div>
            </div>
          `;
        }).join('');
      }
    }
  }

  function practiceAllWrongQuestions() {
    const wrongIds = Object.keys(state.wrongStats).filter(id => state.wrongStats[id] > 0).map(Number);
    if (!wrongIds.length) {
      alert('Bạn chưa có câu hỏi nào nằm trong danh sách làm sai!');
      return;
    }
    const pool = DATA.questions.filter(q => wrongIds.includes(q.id));
    launchQuizSession({
      mode: 'practice',
      title: `⚡ Ôn tập khắc phục ${pool.length} câu từng làm sai`,
      subtitle: `Chế độ Ôn tập Hiện đáp án ngay • Thang điểm 10`,
      chapterId: 0,
      questions: shuffleArray(pool),
      totalSeconds: 0,
      passScore: 5.0,
      rounding: '2',
      shuffleOpt: false,
      strictMode: false,
      instantFeedback: true,
      lockFirst: true,
      autoNext: false
    });
  }

  function clearAllHistory() {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử điểm và thống kê câu sai?')) return;
    state.historyPractice = [];
    state.historyChapter = [];
    state.historyFull = [];
    state.wrongStats = {};
    saveJson(STORAGE_KEYS.HISTORY_PRAC, []);
    saveJson(STORAGE_KEYS.HISTORY_CH, []);
    saveJson(STORAGE_KEYS.HISTORY_FULL, []);
    saveJson(STORAGE_KEYS.WRONG_STATS, {});
    renderHistoryView();
  }

  // ==================== PDF TEXTBOOK VIEWER MODAL ====================
  function openPdfModal(pageNumber, titleText) {
    const maxPages = DATA.course.totalPages || 137;
    const page = Math.max(1, Math.min(maxPages, Number(pageNumber) || 1));
    const modal = document.getElementById('pdf-modal');
    const titleEl = document.getElementById('pdf-modal-title');
    const badgeEl = document.getElementById('pdf-modal-page-badge');
    const bodyEl = document.getElementById('pdf-modal-body');
    const extLink = document.getElementById('pdf-external-link');

    if (titleEl && titleText) titleEl.textContent = titleText;
    if (badgeEl) badgeEl.textContent = `Trang PDF ${page} / ${maxPages}`;
    const pdfUrl = `${DATA.course.pdfFile}#page=${page}`;
    if (extLink) extLink.href = pdfUrl;
    if (bodyEl) {
      bodyEl.innerHTML = `<iframe src="${pdfUrl}" title="Đề cương bài giảng Lập trình hướng đối tượng với C#"></iframe>`;
    }
    if (modal) modal.classList.add('open');
  }

  function jumpPdfPage(pageNumber) {
    openPdfModal(pageNumber, 'Đề cương bài giảng Lập trình hướng đối tượng với C#');
  }

  function closePdfModal() {
    const modal = document.getElementById('pdf-modal');
    const bodyEl = document.getElementById('pdf-modal-body');
    if (modal) modal.classList.remove('open');
    if (bodyEl) bodyEl.innerHTML = '';
  }

  // Keyboard shortcuts during active single-question quiz
  document.addEventListener('keydown', function (e) {
    if (state.currentView !== 'quiz' || !state.quiz || state.quiz.paused || state.quiz.submitted) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target && e.target.tagName) || '')) return;

    const key = e.key.toUpperCase();
    const qIdx = state.quiz.currentIndex;

    const curQ = state.quiz.questions[qIdx];
    if (['A', 'B', 'C', 'D', 'E'].includes(key) && curQ && curQ.displayOptions[key] !== undefined) {
      selectQuizOption(qIdx, key);
    } else if (['1', '2', '3', '4', '5'].includes(key)) {
      const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' };
      if (curQ && curQ.displayOptions[map[key]] !== undefined) {
        selectQuizOption(qIdx, map[key]);
      }
    } else if (e.key === 'ArrowRight') {
      if (qIdx < state.quiz.questions.length - 1) goToQuizQuestion(qIdx + 1);
    } else if (e.key === 'ArrowLeft') {
      if (qIdx > 0) goToQuizQuestion(qIdx - 1);
    } else if (key === 'F') {
      toggleFlagQuestion(qIdx);
    } else if (key === 'R' && state.quiz.instantFeedback) {
      resetPracticeQuestion(qIdx);
    }
  });

  // Expose public API
  window.app = {
    navigate,
    toggleTheme,
    quickStartPracticeChapter,
    quickStartSyllabusPractice,
    quickStartChapter,
    openChapterInBank,
    setPracticeSource,
    onPracticeScopeChange,
    setPracticeQCountMode,
    setPracticeTimerPreset,
    updatePracticePreview,
    startPracticeQuiz,
    setChapterSource,
    onChapterSelectChange,
    onChapterSectionChange,
    setChapterQCountMode,
    setChapterTimerPreset,
    updateChapterPreview,
    openChapterPdfFromConfig,
    startChapterQuiz,
    onMatrixInputChange,
    resetFullMatrixToProportional,
    setFullQMode,
    setFullTimerPreset,
    updateFullPreview,
    startFullQuiz,
    selectQuizOption,
    resetPracticeQuestion,
    revealPracticeHint,
    toggleFlagQuestion,
    goToQuizQuestion,
    togglePauseQuiz,
    toggleQuizDisplayMode,
    confirmSubmitQuiz,
    cancelQuiz,
    setResultFilter,
    renderResultQuestionsList,
    retryWrongFromLastResult,
    retrySameQuiz,
    onBankSourceChange,
    onBankChapterChange,
    toggleBankShowAnswers,
    toggleSingleBankReveal,
    renderBankList,
    practiceAllWrongQuestions,
    clearAllHistory,
    openPdfModal,
    jumpPdfPage,
    closePdfModal
  };

  // Initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderHome();
  });
})();