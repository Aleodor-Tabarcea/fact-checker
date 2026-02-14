// main.js — RIFACTS UI Logic

// DOM
const navBack = document.getElementById('nav-back');
const navCurrent = document.getElementById('nav-current');
const folderList = document.getElementById('folder-list');
const selectedBar = document.getElementById('folder-selected-bar');
const selectedName = document.getElementById('selected-name');
const selectedClear = document.getElementById('selected-clear');
const runBtn = document.getElementById('run-btn');
const loader = document.getElementById('loader');
const resultsArea = document.getElementById('results-area');

// State
let currentFolderId = 'root';
let selectedFolderId = null;
let selectedFolderName = null;
let parentStack = []; // history for back navigation

// ── Initialize ──
window.addEventListener('load', () => {
  navigateToFolder('root');
});

// ── Folder Navigation ──
function navigateToFolder(folderId) {
  folderList.innerHTML = '<div class="folder-loading"><div class="mini-spinner"></div>Loading…</div>';

  if (typeof google !== 'undefined') {
    google.script.run
      .withSuccessHandler(renderFolders)
      .withFailureHandler((err) => {
        folderList.innerHTML = `<div class="folder-empty">⚠️ ${escapeHtml(err.message)}</div>`;
      })
      .listFolders(folderId);
  } else {
    // Local dev mock
    setTimeout(() => {
      if (folderId === 'root') {
        renderFolders({
          folders: [
            { id: "f1", name: "Investigations 2024" },
            { id: "f2", name: "Election Coverage" },
            { id: "f3", name: "EU Funds Tracking" },
            { id: "f4", name: "Source Documents" },
            { id: "f5", name: "Archive" }
          ],
          currentId: 'root',
          currentName: 'My Drive',
          parentId: null,
          hasSharedDrives: true
        });
      } else if (folderId === 'shared') {
        renderFolders({
          folders: [
            { id: "s1", name: "OCCRP Shared Data" },
            { id: "s2", name: "Partner Newsroom Files" }
          ],
          currentId: 'shared',
          currentName: 'Shared with me',
          parentId: 'root',
          hasSharedDrives: false
        });
      } else {
        renderFolders({
          folders: [
            { id: "sub1", name: "Week 1 Reports" },
            { id: "sub2", name: "Interviews" }
          ],
          currentId: folderId,
          currentName: "Subfolder",
          parentId: 'root',
          hasSharedDrives: false
        });
      }
    }, 400);
  }
}

function renderFolders(data) {
  currentFolderId = data.currentId;
  navCurrent.textContent = data.currentName;

  // Back button
  if (data.parentId) {
    navBack.disabled = false;
    navBack.onclick = () => {
      navigateToFolder(data.parentId);
    };
  } else {
    navBack.disabled = true;
    navBack.onclick = null;
  }

  folderList.innerHTML = '';

  // "Shared with me" entry at root level
  if (data.hasSharedDrives) {
    const sharedItem = createFolderItem({ id: 'shared', name: 'Shared with me' }, '👥', true);
    folderList.appendChild(sharedItem);
  }

  if (data.folders.length === 0 && !data.hasSharedDrives) {
    folderList.innerHTML = '<div class="folder-empty">No subfolders here</div>';

    // Auto-select current folder if no subfolders — this IS the evidence folder
    if (currentFolderId !== 'root' && currentFolderId !== 'shared') {
      selectFolder(currentFolderId, data.currentName);
    }
    return;
  }

  data.folders.forEach(folder => {
    const item = createFolderItem(folder, '📁', true);
    folderList.appendChild(item);
  });

  // If we're inside a specific folder (not root/shared), allow selecting it
  if (currentFolderId !== 'root' && currentFolderId !== 'shared') {
    selectFolder(currentFolderId, data.currentName);
  }
}

function createFolderItem(folder, icon, navigable) {
  const item = document.createElement('div');
  item.className = 'folder-item';
  if (folder.id === selectedFolderId) item.classList.add('selected');

  item.innerHTML = `
    <span class="folder-icon">${icon}</span>
    <span class="folder-name">${escapeHtml(folder.name)}</span>
    <span class="folder-arrow">›</span>
  `;

  item.addEventListener('click', () => {
    navigateToFolder(folder.id);
  });

  return item;
}

function selectFolder(id, name) {
  selectedFolderId = id;
  selectedFolderName = name;
  selectedName.textContent = name;
  selectedBar.classList.add('active');
  runBtn.disabled = false;

  // Highlight selected in list
  document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('selected'));
}

selectedClear.addEventListener('click', () => {
  selectedFolderId = null;
  selectedFolderName = null;
  selectedBar.classList.remove('active');
  runBtn.disabled = true;
  document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('selected'));
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

        resultsArea.insertAdjacentHTML('beforeend', `
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
              <a href="${escapeHtml(item.doc_url)}" target="_blank" class="card-link">View source ↗</a>
            </div>
          </div>`);
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