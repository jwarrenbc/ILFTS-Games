document.addEventListener('DOMContentLoaded', () => {
  let vocabData = [];
  let sortableInstances = [];
  const wordPoolEl = document.getElementById('word-pool');
  const targetsGridEl = document.getElementById('targets-grid');
  const scoreCounterEl = document.getElementById('score-counter');
  const lessonTitleEl = document.getElementById('lesson-title');
  const resetBtn = document.getElementById('reset-btn');
  const playAgainBtn = document.getElementById('play-again-btn');
  const winBanner = document.getElementById('win-banner');

  // Load lesson data
  fetch('data/lesson2_data.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      initGame(data);
    })
    .catch((err) => {
      console.error('Failed to load lesson data:', err);
      wordPoolEl.innerHTML = `<p style="color:red; padding: 10px;">Failed to load vocabulary data. Make sure you are serving this folder with a local server.</p>`;
    });

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function initGame(data) {
    if (data.lesson_title) {
      lessonTitleEl.textContent = data.lesson_title;
    }
    vocabData = data.vocab || [];
    renderBoard();
  }

  function destroySortables() {
    sortableInstances.forEach((instance) => instance.destroy());
    sortableInstances = [];
  }

  function updateScore() {
    const matchedCount = document.querySelectorAll('.target-dropzone.matched').length;
    scoreCounterEl.textContent = `Matched: ${matchedCount} / ${vocabData.length}`;

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

    // Render target cards
    vocabData.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'target-card';

      card.innerHTML = `
        <div class="image-container">
          <img src="${item.image_url}" alt="${item.english || 'Vocab image'}" class="target-image" loading="lazy">
          ${item.audio_url ? `
            <button class="audio-btn" type="button" aria-label="Play audio for ${item.english || 'word'}" data-audio="${item.audio_url}">
              🔊
            </button>
          ` : ''}
        </div>
        <div class="target-dropzone" data-target-id="${item.id}" aria-label="Dropzone for ${item.english || 'item'}"></div>
      `;

      targetsGridEl.appendChild(card);
    });

    // Add audio button click handlers
    document.querySelectorAll('.audio-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
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
        <span class="lekwungen-word">${item.lekwungen}</span>
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
      sort: false // Keep pool clean or allow re-arrangement
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
            // Disable dragging on this chip
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

  // Event handlers
  resetBtn.addEventListener('click', () => {
    renderBoard();
  });

  playAgainBtn.addEventListener('click', () => {
    renderBoard();
  });
});
