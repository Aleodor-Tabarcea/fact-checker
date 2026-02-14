// main.js — RIFACTS UI Logic

// DOM
const folderSearch = document.getElementById('folder-search');
const searchResults = document.getElementById('search-results');
const selectedChip = document.getElementById('selected-chip');
const chipName = document.getElementById('chip-name');
const chipRemove = document.getElementById('chip-remove');
const runBtn = document.getElementById('run-btn');
const loader = document.getElementById('loader');
const resultsArea = document.getElementById('results-area');

// State
let selectedFolderId = null;
let searchTimeout = null;

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
        .withFailureHandler((err) => {
          searchResults.innerHTML = `<div class="search-hint">⚠️ ${escapeHtml(err.message)}</div>`;
        })
        .searchFolders(query);
    } else {
      // Local dev mock
      setTimeout(() => {
        const mockFolders = [
          { id: "f1", name: "Investigations 2024", shared: false },
          { id: "f2", name: "Election Investigation Files", shared: true },
          { id: "f3", name: "EU Funds Investigation", shared: false }
        ].filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
        renderSearchResults(mockFolders);
      }, 300);
    }
  }, 350); // 350ms debounce
});

folderSearch.addEventListener('focus', () => {
  if (folderSearch.value.trim().length >= 2 || searchResults.querySelector('.search-item')) {
    searchResults.classList.add('active');
  }
});

// Close results when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('#folder-section')) {
    searchResults.classList.remove('active');
  }
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

// ── Folder Selection ──
function selectFolder(id, name) {
  selectedFolderId = id;
  chipName.textContent = name;
  selectedChip.classList.add('active');
  searchResults.classList.remove('active');
  folderSearch.value = '';
  runBtn.disabled = false;
}

chipRemove.addEventListener('click', () => {
  selectedFolderId = null;
  selectedChip.classList.remove('active');
  runBtn.disabled = true;
  folderSearch.focus();
});

// ── Fact Check Execution ──
runBtn.addEventListener('click', () => {
  if (!selectedFolderId) return;

  runBtn.disabled = true;
  runBtn.textContent = 'Analyzing…';
  resultsArea.innerHTML = '';
  loader.style.display = 'flex';

  if (typeof google !== 'undefined') {
    google.script.run
      .withSuccessHandler(renderResults)
      .withFailureHandler((err) => {
        resetUI();
        renderError(err.message || 'An unexpected error occurred.');
      })
      .performFactCheck(selectedFolderId);
  } else {
    setTimeout(() => renderResults({
      status: "success",
      scanned: ["📄 Investigation Notes", "📊 Budget Data", "📑 Ministry Report.pdf"],
      analysis: [
        { doc_title: "Investigation Notes Q3", doc_url: "#", score: 92, snippet: "The minister confirmed the allocation of €2.4M to the infrastructure fund during the July session.", location: "Page 3, Paragraph 2" },
        { doc_title: "Budget Spreadsheet 2024", doc_url: "#", score: 67, snippet: "Row 14 shows a discrepancy between reported and actual disbursement figures.", location: "Sheet 1, Row 14" },
        { doc_title: "Ministry Press Release", doc_url: "#", score: 23, snippet: "No direct reference to the claimed timeline was found in this document.", location: "Section 2" }
      ]
    }), 2000);
  }
});

function resetUI() {
  loader.style.display = 'none';
  runBtn.disabled = false;
  runBtn.textContent = 'Verify Selected Claim';
}

// ── Render Results ──
function renderResults(data) {
  resetUI();

  if (data.status === 'error') {
    renderError(data.message || 'Analysis failed.');
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

  if (data.scanned && data.scanned.length > 0) {
    const chips = data.scanned.map(f => `<span class="scanned-chip">${escapeHtml(f)}</span>`).join('');
    resultsArea.innerHTML += `
      <div class="scanned-section">
        <div class="scanned-label">Sources scanned</div>
        <div class="scanned-list">${chips}</div>
      </div>`;
  }

  if (data.analysis && data.analysis.length > 0) {
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

    relevant
      .sort((a, b) => b.score - a.score)
      .forEach((item, i) => {
        const variant = item.score > 80 ? 'positive' : item.score > 50 ? 'warning' : 'negative';
        const sourceLink = item.doc_url
          ? `<a href="${escapeHtml(item.doc_url)}" target="_blank" class="card-link">View source ↗</a>`
          : '';

        const card = document.createElement('div');
        card.className = 'score-card';
        card.style.animationDelay = `${i * 0.06}s`;
        card.innerHTML = `
          <div class="card-header">
            <span class="card-expand">▶</span>
            <div class="card-title">${escapeHtml(item.doc_title)}</div>
            <span class="score-badge ${variant}">${item.score}%</span>
          </div>
          <div class="card-body">
            <div class="card-body-inner">
              <div class="card-snippet">
                <blockquote>"${escapeHtml(item.snippet)}"</blockquote>
              </div>
              <div class="card-footer">
                <span class="card-location">📍 ${escapeHtml(item.location)}</span>
                ${sourceLink}
              </div>
            </div>
          </div>`;

        card.querySelector('.card-header').addEventListener('click', () => {
          card.classList.toggle('open');
        });

        resultsArea.appendChild(card);
      });
  }
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