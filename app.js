document.addEventListener('DOMContentLoaded', () => {
  // Configuration defaults and storage keys
  const DEFAULT_ENDPOINT = 'https://ilfts.org/l1dev/api/ləkwəŋən/lesson/2/';
  const DEFAULT_TOKEN = 'd3d6b1018f3ce5f58096d3f977e95d3a5970d91f';
  const STORAGE_URL_KEY = 'ilfts_lesson_url';
  const STORAGE_TOKEN_KEY = 'ilfts_auth_token';

  // Game state
  let vocabData = [];
  let sortableInstances = [];

  // DOM Elements - Config Panel
  const configPanel = document.getElementById('config-panel');
  const configBody = document.getElementById('config-body');
  const toggleConfigBtn = document.getElementById('toggle-config-btn');
  const toggleConfigIcon = document.getElementById('toggle-config-icon');
  const toggleConfigLabel = document.getElementById('toggle-config-label');
  const configForm = document.getElementById('config-form');
  const endpointUrlInput = document.getElementById('endpoint-url');
  const presetSelector = document.getElementById('preset-selector');
  const authTokenInput = document.getElementById('auth-token');
  const toggleTokenBtn = document.getElementById('toggle-token-btn');
  const loadBtn = document.getElementById('load-btn');
  const loadBtnText = document.getElementById('load-btn-text');
  const loadSpinner = document.getElementById('load-spinner');
  const statusBanner = document.getElementById('status-banner');
  const changeLessonBtn = document.getElementById('change-lesson-btn');

  // DOM Elements - Game Board
  const wordPoolEl = document.getElementById('word-pool');
  const targetsGridEl = document.getElementById('targets-grid');
  const scoreCounterEl = document.getElementById('score-counter');
  const poolCountEl = document.getElementById('pool-count');
  const lessonTitleEl = document.getElementById('lesson-title');
  const resetBtn = document.getElementById('reset-btn');
  const playAgainBtn = document.getElementById('play-again-btn');
  const winBanner = document.getElementById('win-banner');

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  // Safely encode URL containing non-ASCII / Unicode characters like ləkwəŋən
  function safeEncodeURI(url) {
    if (!url) return '';
    const trimmed = url.trim();
    try {
      return encodeURI(decodeURI(trimmed));
    } catch (e) {
      return encodeURI(trimmed);
    }
  }

  // Format token with "Token " prefix required by Django REST framework
  function formatAuthHeader(rawToken) {
    if (!rawToken) return null;
    const trimmed = rawToken.trim();
    if (!trimmed) return null;
    if (/^Token\s+/i.test(trimmed)) {
      return trimmed;
    }
    return `Token ${trimmed}`;
  }

  // Parse lesson data from the live ILFTS API structure
  function parseLessonData(data) {
    const title = data.title || (data.number ? `Lesson ${data.number}` : 'Vocabulary Matching Game');
    const rawVocab = data.vocab || [];

    const vocab = rawVocab.map((item, idx) => {
      const id = String(item.id !== undefined && item.id !== null ? item.id : idx);
      const ind = item.ind || '';
      const eng = item.eng || '';
      const image = item.image || '';
      const recording = item.recording || '';
      return { id, ind, eng, image, recording };
    }).filter((item) => item.ind); // Must have indigenous word

    return { title, vocab };
  }

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function setLoading(isLoading) {
    loadBtn.disabled = isLoading;
    if (isLoading) {
      loadSpinner.classList.remove('hidden');
      loadBtnText.textContent = 'Loading...';
    } else {
      loadSpinner.classList.add('hidden');
      loadBtnText.textContent = 'Load Lesson';
    }
  }

  function clearStatus() {
    statusBanner.className = 'status-banner hidden';
    statusBanner.innerHTML = '';
  }

  function showStatus(message, type = 'info', showFallbackAction = false) {
    statusBanner.className = `status-banner status-${type}`;
    statusBanner.innerHTML = '';

    const textEl = document.createElement('div');
    textEl.className = 'status-text';
    textEl.textContent = message;
    statusBanner.appendChild(textEl);

    if (showFallbackAction) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'status-actions';

      const fallbackBtn = document.createElement('button');
      fallbackBtn.type = 'button';
      fallbackBtn.className = 'btn secondary-btn small-btn';
      fallbackBtn.textContent = 'Load Local Demo Instead';
      fallbackBtn.addEventListener('click', () => {
        endpointUrlInput.value = 'data/lesson2_data.json';
        presetSelector.value = 'data/lesson2_data.json';
        fetchLessonData('data/lesson2_data.json', '');
      });

      actionsEl.appendChild(fallbackBtn);
      statusBanner.appendChild(actionsEl);
    }

    statusBanner.classList.remove('hidden');
  }

  function toggleConfig(collapse) {
    const shouldCollapse = collapse !== undefined ? collapse : !configBody.classList.contains('collapsed');
    if (shouldCollapse) {
      configBody.classList.add('collapsed');
      toggleConfigIcon.textContent = '▼';
      toggleConfigLabel.textContent = 'Settings';
      toggleConfigBtn.setAttribute('aria-expanded', 'false');
      changeLessonBtn.classList.remove('hidden');
    } else {
      configBody.classList.remove('collapsed');
      toggleConfigIcon.textContent = '▲';
      toggleConfigLabel.textContent = 'Collapse';
      toggleConfigBtn.setAttribute('aria-expanded', 'true');
      changeLessonBtn.classList.add('hidden');
    }
  }

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------

  async function fetchLessonData(rawUrl, rawToken) {
    if (!rawUrl || !rawUrl.trim()) {
      showStatus('Please enter a lesson endpoint URL.', 'error');
      return false;
    }

    setLoading(true);
    clearStatus();

    const url = safeEncodeURI(rawUrl);
    const tokenHeader = formatAuthHeader(rawToken);

    const headers = {};
    // Only send Authorization header if provided and not fetching a local file
    if (tokenHeader && !url.startsWith('data/') && !url.startsWith('./') && !url.startsWith('../')) {
      headers['Authorization'] = tokenHeader;
    }

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Authorization failed (HTTP ${response.status}). Please check your API token.`);
        } else if (response.status === 404) {
          throw new Error(`Endpoint not found (HTTP 404). Please check the lesson URL.`);
        } else {
          throw new Error(`HTTP error ${response.status}: ${response.statusText || 'Failed to fetch'}`);
        }
      }

      const data = await response.json();
      const parsed = parseLessonData(data);

      if (!parsed.vocab || parsed.vocab.length === 0) {
        showStatus('Lesson loaded successfully, but no vocabulary items were found in the response.', 'info');
      } else {
        showStatus(`Loaded "${parsed.title}" (${parsed.vocab.length} items).`, 'success');
      }

      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_URL_KEY, rawUrl.trim());
        if (rawToken && rawToken.trim()) {
          localStorage.setItem(STORAGE_TOKEN_KEY, rawToken.trim());
        }
      } catch (e) {
        // Ignore localStorage errors (e.g. cookies disabled)
      }

      initGame(parsed);
      return true;
    } catch (err) {
      console.error('Fetch error:', err);
      let errorMsg = err.message;

      const isNetworkOrCors = err instanceof TypeError || /failed to fetch/i.test(err.message) || /network/i.test(err.message);
      if (isNetworkOrCors && !url.startsWith('data/')) {
        errorMsg = `Connection error loading "${rawUrl}". If you are running on GitHub Pages or localhost, the API server at ilfts.org needs to return CORS headers (Access-Control-Allow-Origin and allow the Authorization header) for browser requests.`;
      }

      showStatus(errorMsg, 'error', true);
      return false;
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------------------------------
  // Game Initialization and Rendering
  // --------------------------------------------------------------------------

  function initGame(data) {
    if (data.title) {
      lessonTitleEl.textContent = data.title;
    }
    vocabData = data.vocab || [];
    renderBoard();
  }

  function destroySortables() {
    sortableInstances.forEach((instance) => {
      try {
        instance.destroy();
      } catch (e) {
        // Ignore destruction errors
      }
    });
    sortableInstances = [];
  }

  function updateScore() {
    const matchedCount = document.querySelectorAll('.target-dropzone.matched').length;
    scoreCounterEl.textContent = `Matched: ${matchedCount} / ${vocabData.length}`;

    if (poolCountEl) {
      const remaining = vocabData.length - matchedCount;
      poolCountEl.textContent = `${remaining} left`;
    }

    if (matchedCount === vocabData.length && vocabData.length > 0) {
      setTimeout(() => {
        winBanner.classList.remove('hidden');
      }, 300);
    }
  }

  function renderBoard() {
    destroySortables();
    winBanner.classList.add('hidden');
    wordPoolEl.innerHTML = '';
    targetsGridEl.innerHTML = '';

    if (vocabData.length === 0) {
      wordPoolEl.innerHTML = '<p style="color:var(--text-muted); padding: 12px;">No vocabulary items to display.</p>';
      targetsGridEl.innerHTML = '<p style="color:var(--text-muted); padding: 12px;">No target cards to display.</p>';
      updateScore();
      return;
    }

    // Render target picture cards
    vocabData.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'target-card';
      if (item.eng) {
        card.setAttribute('title', item.eng);
      }

      const hasImage = Boolean(item.image);
      const imageHtml = hasImage
        ? `<img src="${item.image}" alt="${item.eng || 'Vocab image'}" class="target-image" loading="lazy">`
        : `<div class="no-image-placeholder">
             <span class="no-image-icon">🖼️</span>
             <span class="no-image-text">${item.eng || 'No Image'}</span>
           </div>`;

      const audioHtml = item.recording
        ? `<button class="audio-btn" type="button" aria-label="Play audio for ${item.eng || 'word'}" data-audio="${item.recording}">
             🔊
           </button>`
        : '';

      card.innerHTML = `
        <div class="image-container">
          ${imageHtml}
          ${audioHtml}
        </div>
        <div class="target-dropzone" data-target-id="${item.id}" aria-label="Dropzone for ${item.eng || 'item'}"></div>
      `;

      targetsGridEl.appendChild(card);
    });

    // Add audio button click handlers
    document.querySelectorAll('.audio-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const audioUrl = e.currentTarget.getAttribute('data-audio');
        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audio.play().catch((err) => console.log('Audio playback error:', err));
        }
      });
    });

    // Shuffle and render words in pool
    const shuffledWords = shuffle(vocabData);
    shuffledWords.forEach((item) => {
      const chip = document.createElement('div');
      chip.className = 'word-chip';
      chip.setAttribute('data-id', item.id);
      chip.innerHTML = `
        <span class="indigenous-word">${item.ind}</span>
        <span class="drag-handle">⠿</span>
      `;
      wordPoolEl.appendChild(chip);
    });

    // Initialize Sortable for Word Pool
    const poolSortable = new Sortable(wordPoolEl, {
      group: {
        name: 'vocab-group',
        pull: true,
        put: true
      },
      animation: 150,
      sort: false
    });
    sortableInstances.push(poolSortable);

    // Initialize Sortable for each Target Dropzone
    const dropzones = document.querySelectorAll('.target-dropzone');
    dropzones.forEach((dropzone) => {
      const targetSortable = new Sortable(dropzone, {
        group: {
          name: 'vocab-group',
          put: (to) => {
            // Only allow dropping if empty and not already matched
            return to.el.children.length === 0 && !to.el.classList.contains('matched');
          }
        },
        animation: 150,
        onAdd: (evt) => {
          const targetId = dropzone.getAttribute('data-target-id');
          const chipId = evt.item.getAttribute('data-id');

          if (targetId === chipId) {
            // Correct match
            dropzone.classList.add('matched');
            evt.item.classList.add('correct');
            // Disable dragging on this dropzone
            targetSortable.option('disabled', true);
            updateScore();
          } else {
            // Incorrect match: shake effect and return to pool
            dropzone.classList.add('shake');
            setTimeout(() => {
              dropzone.classList.remove('shake');
              wordPoolEl.appendChild(evt.item);
            }, 600);
          }
        }
      });
      sortableInstances.push(targetSortable);
    });

    updateScore();
  }

  // --------------------------------------------------------------------------
  // Event Handlers & Initialization
  // --------------------------------------------------------------------------

  // Form submit -> load lesson
  configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    fetchLessonData(endpointUrlInput.value, authTokenInput.value);
  });

  // Preset selector change
  presetSelector.addEventListener('change', () => {
    const selectedUrl = presetSelector.value;
    if (selectedUrl) {
      endpointUrlInput.value = selectedUrl;
      fetchLessonData(selectedUrl, authTokenInput.value);
    }
  });

  // Toggle token visibility (show/hide password)
  toggleTokenBtn.addEventListener('click', () => {
    const isPassword = authTokenInput.type === 'password';
    authTokenInput.type = isPassword ? 'text' : 'password';
    toggleTokenBtn.textContent = isPassword ? '🙈' : '👁️';
    toggleTokenBtn.setAttribute('title', isPassword ? 'Hide Token' : 'Show Token');
  });

  // Toggle configuration panel collapse
  toggleConfigBtn.addEventListener('click', () => {
    toggleConfig();
  });

  // "Change Lesson" button in header (un-collapses config panel and scrolls to it)
  changeLessonBtn.addEventListener('click', () => {
    toggleConfig(false);
    configPanel.scrollIntoView({ behavior: 'smooth' });
  });

  // Reset Game button
  resetBtn.addEventListener('click', () => {
    renderBoard();
  });

  // Play Again button
  playAgainBtn.addEventListener('click', () => {
    renderBoard();
  });

  // Initial load: parse URL query params, localStorage, or defaults
  function initializeSettings() {
    const urlParams = new URLSearchParams(window.location.search);

    // Support ?lesson=2 or ?url=...
    let initialUrl = urlParams.get('url');
    const lessonParam = urlParams.get('lesson');
    if (!initialUrl && lessonParam) {
      initialUrl = `https://ilfts.org/l1dev/api/ləkwəŋən/lesson/${lessonParam}/`;
    }

    if (!initialUrl) {
      try {
        initialUrl = localStorage.getItem(STORAGE_URL_KEY);
      } catch (e) {
        // Ignore
      }
    }
    if (!initialUrl) {
      initialUrl = DEFAULT_ENDPOINT;
    }

    let initialToken = urlParams.get('token');
    if (!initialToken) {
      try {
        initialToken = localStorage.getItem(STORAGE_TOKEN_KEY);
      } catch (e) {
        // Ignore
      }
    }
    if (!initialToken) {
      initialToken = DEFAULT_TOKEN;
    }

    endpointUrlInput.value = initialUrl;
    authTokenInput.value = initialToken;

    // Match preset dropdown if initialUrl matches one of the options
    Array.from(presetSelector.options).forEach((opt) => {
      if (opt.value && opt.value === initialUrl) {
        presetSelector.value = opt.value;
      }
    });

    // Auto-fetch lesson on load
    fetchLessonData(initialUrl, initialToken);
  }

  initializeSettings();
});
