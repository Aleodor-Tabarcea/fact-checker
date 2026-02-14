// main.js — RIFACTS UI Logic

// State & DOM
const folderPicker = document.getElementById('folder-picker');
const runBtn = document.getElementById('run-btn');
const loader = document.getElementById('loader');
const resultsArea = document.getElementById('results-area');

// Initialize
window.addEventListener('load', () => {
  if (typeof google !== 'undefined') {
    google.script.run
      .withSuccessHandler(populateFolders)
      .withFailureHandler(() => {
        folderPicker.innerHTML = '<option value="" disabled selected>⚠️ Failed to load folders</option>';
      })
      .getUserFolders();
  } else {
    // Local dev mock
    populateFolders([
      { id: "123", name: "⭐ Q3 Investigations" },
      { id: "456", name: "⭐ Election Coverage" }
    ]);
  }
});

function populateFolders(folders) {
  folderPicker.innerHTML = '';

  if (!folders || folders.length === 0) {
    folderPicker.innerHTML = '<option value="" disabled selected>No starred folders found</option>';
    return;
  }

  folders.forEach((f, i) => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    if (i === 0) opt.selected = true;
    folderPicker.appendChild(opt);
  });
}

// Execution
runBtn.addEventListener('click', () => {
  const selectedId = folderPicker.value;
  if (!selectedId || selectedId === 'loading') return;

  // UI → Loading
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
      .performFactCheck(selectedId);
  } else {
    // Local dev mock
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

// Render
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

  // Scanned files summary
  if (data.scanned && data.scanned.length > 0) {
    const chips = data.scanned.map(f => `<span class="scanned-chip">${escapeHtml(f)}</span>`).join('');
    resultsArea.innerHTML += `
      <div class="scanned-section">
        <div class="scanned-label">Sources scanned</div>
        <div class="scanned-list">${chips}</div>
      </div>`;
  }

  // Score cards
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

        const card = `
          <div class="score-card" style="animation-delay: ${i * 0.08}s">
            <div class="card-top">
              <div class="card-title">${escapeHtml(item.doc_title)}</div>
              <span class="score-badge ${variant}">${item.score}%</span>
            </div>
            <div class="card-snippet">
              <blockquote>"${escapeHtml(item.snippet)}"</blockquote>
            </div>
            <div class="card-footer">
              <span class="card-location">📍 ${escapeHtml(item.location)}</span>
              <a href="${escapeHtml(item.doc_url)}" target="_blank" class="card-link">
                View source ↗
              </a>
            </div>
          </div>`;

        resultsArea.insertAdjacentHTML('beforeend', card);
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