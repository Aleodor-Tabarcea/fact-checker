// main.js — RIFACTS UI Logic

// DOM — Setup
const setupScreen = document.getElementById('setup-screen');
const mainUI = document.getElementById('main-ui');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeySave = document.getElementById('api-key-save');
const keyStatus = document.getElementById('key-status');
const headerSettings = document.getElementById('header-settings');
const setupBack = document.getElementById('setup-back');

// DOM — Main
const folderSearch = document.getElementById('folder-search');
const searchResults = document.getElementById('search-results');
const selectedChip = document.getElementById('selected-chip');
const chipName = document.getElementById('chip-name');
const chipRemove = document.getElementById('chip-remove');
const runBtn = document.getElementById('run-btn');
const docScanBtn = document.getElementById('doc-scan-btn');
const loader = document.getElementById('loader');
const resultsArea = document.getElementById('results-area');
const loaderText = document.querySelector('.loader-text');
const loaderSubtext = document.querySelector('.loader-subtext');

// State
let selectedFolderId = null;
let searchTimeout = null;
let hasKeyStored = false;
let ytUrls = [];

// DOM — YouTube
const ytUrlInput = document.getElementById('yt-url');
const ytAddBtn = document.getElementById('yt-add');
const ytChips = document.getElementById('yt-chips');

// ── Initialization ──
window.addEventListener('load', () => {
  if (typeof google !== 'undefined') {
    google.script.run
      .withSuccessHandler(hasKey => {
        hasKeyStored = hasKey;
        if (hasKey) {
          showMainUI();
          google.script.run
            .withSuccessHandler(mode => {
              if (mode === 'full_document') {
                setTimeout(() => {
                  if (selectedFolderId || ytUrls.length > 0) docScanBtn.click();
                }, 500);
              }
            })
            .consumePendingScanMode();
        } else {
          showSetup(false); // first run, no back button
        }
      })
      .withFailureHandler(() => showSetup(false))
      .hasApiKey();
  } else {
    hasKeyStored = true;
    showMainUI();
  }
});

function showSetup(showBack) {
  setupScreen.style.display = 'flex';
  mainUI.style.display = 'none';
  setupBack.style.display = showBack ? 'flex' : 'none';
  if (typeof google !== 'undefined') {
    google.script.run
      .withSuccessHandler(key => { if (key) apiKeyInput.value = key; })
      .getApiKey();
  }
}

function showMainUI() {
  setupScreen.style.display = 'none';
  mainUI.style.display = 'flex';
  mainUI.style.flexDirection = 'column';
  mainUI.style.gap = '14px';
}

// ── Settings Navigation ──
headerSettings.addEventListener('click', () => showSetup(true));
setupBack.addEventListener('click', () => {
  if (hasKeyStored) {
    showMainUI();
  }
});

// ── API Key Save ──
apiKeySave.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = 'Please paste your API key.';
    keyStatus.className = 'key-status error';
    return;
  }

  apiKeySave.disabled = true;
  apiKeySave.textContent = 'Saving…';
  keyStatus.textContent = '';

  if (typeof google !== 'undefined') {
    google.script.run
      .withSuccessHandler(() => {
        hasKeyStored = true;
        keyStatus.textContent = '✓ Key saved! Loading RIFACTS…';
        keyStatus.className = 'key-status success';
        setTimeout(showMainUI, 800);
        apiKeySave.disabled = false;
        apiKeySave.textContent = 'Save';
      })
      .withFailureHandler(err => {
        keyStatus.textContent = err.message;
        keyStatus.className = 'key-status error';
        apiKeySave.disabled = false;
        apiKeySave.textContent = 'Save';
      })
      .saveApiKey(key);
  } else {
    setTimeout(() => {
      hasKeyStored = true;
      keyStatus.textContent = '✓ Key saved (mock)!';
      keyStatus.className = 'key-status success';
      setTimeout(showMainUI, 800);
    }, 500);
  }
});

// ── Folder Search (debounced) ──
folderSearch.addEventListener('input', () => {
  const query = folderSearch.value.trim();
  clearTimeout(searchTimeout);

  if (query.length < 2) {
    searchResults.innerHTML = '<div class="search-hint">Type at least 2 characters to search</div>';
    searchResults.classList.add('active');
    return;
  }

  searchResults.innerHTML = '<div class="search-loading"><div class="mini-spinner"></div>Searching…</div>';
  searchResults.classList.add('active');

  searchTimeout = setTimeout(() => {
    if (typeof google !== 'undefined') {
      google.script.run
        .withSuccessHandler(renderSearchResults)
        .withFailureHandler(err => {
          searchResults.innerHTML = `<div class="search-hint">⚠️ ${escapeHtml(err.message)}</div>`;
        })
        .searchFolders(query);
    } else {
      setTimeout(() => {
        const mockFolders = [
          { id: "f1", name: "Investigations 2024", shared: false },
          { id: "f2", name: "Election Investigation Files", shared: true },
          { id: "f3", name: "EU Funds Investigation", shared: false }
        ].filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
        renderSearchResults(mockFolders);
      }, 300);
    }
  }, 350);
});

folderSearch.addEventListener('focus', () => {
  if (folderSearch.value.trim().length >= 2 || searchResults.querySelector('.search-item')) {
    searchResults.classList.add('active');
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('#folder-section')) searchResults.classList.remove('active');
});

function renderSearchResults(folders) {
  searchResults.innerHTML = '';
  if (!folders || folders.length === 0) {
    searchResults.innerHTML = '<div class="search-hint">No folders found</div>';
    searchResults.classList.add('active');
    return;
  }
  folders.forEach(folder => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.innerHTML = `
      <span class="search-item-icon">${folder.shared ? '👥' : '📁'}</span>
      <span class="search-item-name">${escapeHtml(folder.name)}</span>
    `;
    item.addEventListener('click', () => selectFolder(folder.id, folder.name));
    searchResults.appendChild(item);
  });
  searchResults.classList.add('active');
}

function selectFolder(id, name) {
  selectedFolderId = id;
  chipName.textContent = name;
  selectedChip.classList.add('active');
  searchResults.classList.remove('active');
  folderSearch.value = '';
  updateRunBtn();
}

chipRemove.addEventListener('click', () => {
  selectedFolderId = null;
  selectedChip.classList.remove('active');
  updateRunBtn();
  folderSearch.focus();
});

function updateRunBtn() {
  const ok = !!(selectedFolderId || ytUrls.length > 0);
  runBtn.disabled = !ok;
  docScanBtn.disabled = !ok;
}

// ── YouTube URL Handling ──
function extractVideoId(url) {
  // youtu.be/ID
  let m = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  // youtube.com/watch?v=ID
  m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  // youtube.com/embed/ID
  m = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  return null;
}

ytAddBtn.addEventListener('click', addYouTubeUrl);
ytUrlInput.addEventListener('keydown', e => { if (e.key === 'Enter') addYouTubeUrl(); });

function addYouTubeUrl() {
  const url = ytUrlInput.value.trim();
  if (!url) return;

  const videoId = extractVideoId(url);
  if (!videoId) {
    ytUrlInput.style.borderColor = '#EF4444';
    setTimeout(() => { ytUrlInput.style.borderColor = ''; }, 1500);
    return;
  }

  if (ytUrls.find(y => y.id === videoId)) {
    ytUrlInput.value = '';
    return;
  }

  ytUrls.push({ id: videoId, url: url });
  ytUrlInput.value = '';
  renderYtChips();
  updateRunBtn();
}

function renderYtChips() {
  ytChips.innerHTML = '';
  ytUrls.forEach((yt, i) => {
    const chip = document.createElement('div');
    chip.className = 'yt-chip';
    chip.innerHTML = `
      <span class="yt-chip-icon">▶️</span>
      <span class="yt-chip-name">youtube.com/watch?v=${escapeHtml(yt.id)}</span>
      <button class="yt-chip-remove">✕</button>
    `;
    chip.querySelector('.yt-chip-remove').addEventListener('click', () => {
      ytUrls.splice(i, 1);
      renderYtChips();
      updateRunBtn();
    });
    ytChips.appendChild(chip);
  });
}

// ── Fact Check (selection) ──
runBtn.addEventListener('click', () => {
  if (!selectedFolderId && ytUrls.length === 0) return;
  runBtn.disabled = true;
  docScanBtn.disabled = true;
  runBtn.textContent = 'Analyzing…';
  resultsArea.innerHTML = '';
  loader.style.display = 'flex';
  if (loaderText) loaderText.textContent = 'Analyzing evidence…';
  if (loaderSubtext) loaderSubtext.textContent = 'Scanning documents against your selection';

  if (typeof google !== 'undefined') {
    google.script.run
      .withSuccessHandler(renderResults)
      .withFailureHandler(err => {
        resetUI();
        renderError(err.message || 'An unexpected error occurred.');
      })
      .performFactCheck(selectedFolderId, ytUrls.map(y => y.url));
  } else {
    setTimeout(() => renderResults({
      status: "success",
      mode: "selection",
      scanned: ["📄 Investigation Notes", "📊 Budget Data", "📑 Ministry Report.pdf"],
      analysis: [
        { doc_title: "Investigation Notes Q3", doc_url: "#", score: 92, snippet: "The minister confirmed the allocation of €2.4M to the infrastructure fund during the July session.", location: "Page 3, Paragraph 2" },
        { doc_title: "Investigation Notes Q3", doc_url: "#", score: 45, snippet: "A separate reference mentions €2.1M, which contradicts the headline figure.", location: "Page 7, Footnote 3" },
        { doc_title: "Budget Spreadsheet 2024", doc_url: "#", score: 67, snippet: "Row 14 shows a discrepancy between reported and actual disbursement figures.", location: "Sheet 1, Row 14" },
        { doc_title: "Ministry Press Release", doc_url: "#", score: 12, snippet: "No direct reference to the claimed timeline was found in this document.", location: "Section 2" }
      ]
    }), 2000);
  }
});

// ── Fact Check (full document, every qualifying paragraph) ──
docScanBtn.addEventListener('click', () => {
  if (!selectedFolderId && ytUrls.length === 0) return;
  runBtn.disabled = true;
  docScanBtn.disabled = true;
  docScanBtn.textContent = 'Scanning document…';
  resultsArea.innerHTML = '';
  loader.style.display = 'flex';
  if (loaderText) loaderText.textContent = 'Fact-checking each paragraph…';
  if (loaderSubtext) loaderSubtext.textContent = 'One Gemini request per paragraph; large docs are capped per run.';

  if (typeof google !== 'undefined') {
    google.script.run
      .withSuccessHandler(renderResults)
      .withFailureHandler(err => {
        resetUI();
        renderError(err.message || 'An unexpected error occurred.');
      })
      .performDocumentParagraphFactCheck(selectedFolderId, ytUrls.map(y => y.url));
  } else {
    setTimeout(() => renderResults({
      status: "success",
      mode: "full_document",
      scanned: ["📄 Investigation Notes"],
      totalParagraphs: 2,
      runParagraphs: 2,
      truncated: false,
      paragraphs: [
        {
          seq: 0,
          childIndex: 0,
          preview: "The ministry announced €2.4M in new infrastructure funding in July 2024.",
          analysis: [
            { doc_title: "Investigation Notes Q3", doc_url: "#", score: 88, snippet: "€2.4M infrastructure allocation confirmed July session.", location: "p.3" }
          ]
        },
        {
          seq: 1,
          childIndex: 2,
          preview: "No evidence supports the alleged timeline for the rural broadband rollout.",
          analysis: [
            { doc_title: "Ministry Press Release", doc_url: "#", score: 15, snippet: "Timeline not specified in official releases.", location: "Section 1" }
          ]
        }
      ]
    }), 2000);
  }
});

function resetUI() {
  loader.style.display = 'none';
  runBtn.disabled = false;
  runBtn.textContent = 'Verify Selected Claim';
  docScanBtn.disabled = false;
  docScanBtn.textContent = 'Scan all paragraphs';
  updateRunBtn();
}

// ── Semantic Tags ──
function getAccuracyTag(score) {
  if (score >= 85) return { label: 'Exact match', cls: 'exact' };
  if (score >= 65) return { label: 'Strong alignment', cls: 'strong' };
  if (score >= 40) return { label: 'Partial match', cls: 'partial' };
  if (score >= 20) return { label: 'Opposite meaning', cls: 'opposite' };
  return { label: 'Definitely wrong', cls: 'wrong' };
}

function bestParagraphScore(analysis) {
  if (!analysis || !Array.isArray(analysis)) return 0;
  return analysis.reduce((m, a) => Math.max(m, typeof a.score === 'number' ? a.score : 0), 0);
}

// ── Render Results ──
function renderResults(data) {
  resetUI();

  if (data.status === 'error') { renderError(data.message || 'Analysis failed.'); return; }

  if (data.mode === 'full_document') {
    renderFullDocumentResults(data);
    return;
  }

  if (data.status === 'no_paragraphs') {
    resultsArea.innerHTML = `
      <div class="state-message">
        <div class="state-icon">📝</div>
        <div class="state-title">No paragraphs to check</div>
        <div class="state-desc">${escapeHtml(data.message || '')}</div>
      </div>`;
    return;
  }

  if (data.status === 'no_docs') {
    resultsArea.innerHTML = `
      <div class="state-message">
        <div class="state-icon">📂</div>
        <div class="state-title">No Evidence Found</div>
        <div class="state-desc">The selected folder contains no readable documents, PDFs, or spreadsheets.</div>
      </div>`;
    return;
  }

  // Scanned files
  if (data.scanned && data.scanned.length > 0) {
    const chips = data.scanned.map(f => `<span class="scanned-chip">${escapeHtml(f)}</span>`).join('');
    resultsArea.innerHTML += `
      <div class="scanned-section">
        <div class="scanned-label">Sources scanned</div>
        <div class="scanned-list">${chips}</div>
      </div>`;
  }

  if (!data.analysis || data.analysis.length === 0) return;

  const relevant = data.analysis.filter(item => item.score > 0);
  if (relevant.length === 0) {
    resultsArea.innerHTML += `
      <div class="state-message">
        <div class="state-icon">🔎</div>
        <div class="state-title">No Matches</div>
        <div class="state-desc">None of the scanned documents contained relevant evidence for this claim.</div>
      </div>`;
    return;
  }

  resultsArea.innerHTML += `
    <div class="results-header">
      <span class="results-title">Evidence Matches</span>
      <span class="results-count">${relevant.length} found</span>
    </div>`;

  // Group by source document
  const groups = {};
  relevant
    .sort((a, b) => b.score - a.score)
    .forEach(item => {
      const key = item.doc_title;
      if (!groups[key]) groups[key] = { url: item.doc_url, items: [] };
      groups[key].items.push(item);
    });

  let cardIndex = 0;

  Object.entries(groups).forEach(([title, group]) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'source-group';

    // Source header
    const sourceLink = group.url
      ? `<a href="${escapeHtml(group.url)}" target="_blank" class="source-link">Open ↗</a>`
      : '';

    groupEl.innerHTML = `
      <div class="source-header">
        <span class="source-icon">📄</span>
        <span class="source-name">${escapeHtml(title)}</span>
        ${sourceLink}
      </div>`;

    // Cards within this source
    group.items.forEach(item => {
      const tag = getAccuracyTag(item.score);
      const card = document.createElement('div');
      card.className = 'score-card';
      card.style.animationDelay = `${cardIndex * 0.06}s`;

      card.innerHTML = `
        <div class="card-header">
          <span class="card-expand">▶</span>
          <div class="card-tags">
            <span class="score-badge ${tag.cls}">${item.score}%</span>
            <span class="accuracy-tag">${tag.label}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="card-body-inner">
            <div class="card-snippet">
              <blockquote>"${escapeHtml(item.snippet)}"</blockquote>
            </div>
            <div class="card-location">📍 ${escapeHtml(item.location)}</div>
          </div>
        </div>`;

      card.querySelector('.card-header').addEventListener('click', () => {
        card.classList.toggle('open');
      });

      groupEl.appendChild(card);
      cardIndex++;
    });

    resultsArea.appendChild(groupEl);
  });
}

function renderFullDocumentResults(data) {
  if (data.scanned && data.scanned.length > 0) {
    const chips = data.scanned.map(f => `<span class="scanned-chip">${escapeHtml(f)}</span>`).join('');
    resultsArea.innerHTML = `
      <div class="scanned-section">
        <div class="scanned-label">Sources scanned</div>
        <div class="scanned-list">${chips}</div>
      </div>`;
  }

  let meta = `<div class="doc-scan-meta"><strong>Full-document report.</strong> Checked ${data.runParagraphs || 0} paragraph(s)`;
  if (typeof data.totalParagraphs === 'number' && data.totalParagraphs > (data.runParagraphs || 0)) {
    meta += ` of ${data.totalParagraphs} qualifying`;
  }
  meta += '. ';
  if (data.truncated) {
    meta += 'Some paragraphs were skipped this run (per-run cap for Apps Script time limits). Run again after editing, or shorten the doc.';
  }
  meta += '</div>';
  resultsArea.innerHTML += meta;

  const header = document.createElement('div');
  header.className = 'results-header';
  header.innerHTML = `
    <span class="results-title">Per-paragraph results</span>
    <span class="results-count">${data.paragraphs ? data.paragraphs.length : 0}</span>`;
  resultsArea.appendChild(header);

  if (!data.paragraphs || data.paragraphs.length === 0) return;

  data.paragraphs.forEach((block, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'para-report';
    const best = bestParagraphScore(block.analysis);
    const tag = getAccuracyTag(best);

    const head = document.createElement('div');
    head.className = 'para-report-header';
    head.innerHTML = `
      <span class="para-chevron">▶</span>
      <div class="para-report-title">
        <div class="para-num">Paragraph ${block.seq + 1} · body index ${block.childIndex}</div>
        <div class="para-preview">${escapeHtml(block.preview || '')}</div>
      </div>
      <span class="score-badge ${block.error ? 'wrong' : tag.cls}">${block.error ? '!' : best + '%'}</span>`;
    head.addEventListener('click', () => wrap.classList.toggle('open'));

    const body = document.createElement('div');
    body.className = 'para-report-body';

    if (block.error) {
      body.innerHTML = `<div class="para-error">${escapeHtml(block.error)}</div>`;
    } else if (!block.analysis || block.analysis.length === 0) {
      body.innerHTML = '<div class="state-desc">No analysis returned.</div>';
    } else {
      const relevant = block.analysis.filter(item => item.score > 0);
      if (relevant.length === 0) {
        body.innerHTML = '<div class="state-desc">No matching evidence for this paragraph.</div>';
      } else {
        relevant.sort((a, b) => b.score - a.score).forEach(item => {
          const t = getAccuracyTag(item.score);
          const row = document.createElement('div');
          row.className = 'score-card open';
          row.style.marginTop = '8px';
          const link = item.doc_url
            ? `<a href="${escapeHtml(item.doc_url)}" target="_blank" class="source-link">Open ↗</a>`
            : '';
          row.innerHTML = `
            <div class="source-header" style="margin-bottom:6px">
              <span class="source-icon">📄</span>
              <span class="source-name">${escapeHtml(item.doc_title)}</span>
              ${link}
            </div>
            <div class="card-tags" style="margin-bottom:6px">
              <span class="score-badge ${t.cls}">${item.score}%</span>
              <span class="accuracy-tag">${t.label}</span>
            </div>
            <blockquote class="card-snippet">"${escapeHtml(item.snippet)}"</blockquote>
            <div class="card-location">📍 ${escapeHtml(item.location || '')}</div>`;
          body.appendChild(row);
        });
      }
    }

    wrap.appendChild(head);
    wrap.appendChild(body);
    resultsArea.appendChild(wrap);

    if (idx === 0) wrap.classList.add('open');
  });
}

function renderError(message) {
  resultsArea.innerHTML = `
    <div class="state-message">
      <div class="state-icon">⚠️</div>
      <div class="state-title">Something went wrong</div>
      <div class="state-desc">${escapeHtml(message)}</div>
    </div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}