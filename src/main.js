// main.js

// 1. Register ALL Spectrum Components instantly
import '@spectrum-web-components/bundle/elements.js';

// 2. State & DOM Nodes
const folderPicker = document.getElementById('folder-picker');
const runBtn = document.getElementById('run-btn');
const loader = document.getElementById('loader');
const resultsArea = document.getElementById('results-area');

// 3. Initialize App
window.addEventListener('load', () => {
  // Mock data for local testing, actual google.script.run for production
  if (typeof google !== 'undefined') {
    google.script.run
      .withSuccessHandler(populateFolders)
      .getUserFolders();
  } else {
    // Local Dev Mock
    populateFolders([{id: "123", name: "⭐ Q3 Roadmaps"}]);
  }
});

function populateFolders(folders) {
  folderPicker.innerHTML = ''; // Clear loading state
  if (folders.length === 0) {
    const item = document.createElement('sp-menu-item');
    item.value = "";
    item.textContent = "No Folders Found";
    folderPicker.appendChild(item);
    return;
  }

  folders.forEach(f => {
    const item = document.createElement('sp-menu-item');
    item.value = f.id;
    item.textContent = f.name;
    folderPicker.appendChild(item);
  });
  
  // Set default selection
  folderPicker.value = folders[0].id;
}

// 4. Handle Execution
runBtn.addEventListener('click', () => {
  const selectedId = folderPicker.value;
  if (!selectedId || selectedId === "loading") return;

  // UI State: Loading
  runBtn.disabled = true;
  resultsArea.innerHTML = '';
  loader.style.display = 'flex';

  if (typeof google !== 'undefined') {
    google.script.run
      .withSuccessHandler(renderResults)
      .withFailureHandler((err) => {
         loader.style.display = 'none';
         runBtn.disabled = false;
         alert("Error: " + err.message);
      })
      .performFactCheck(selectedId);
  } else {
    // Local Dev Mock Delay
    setTimeout(() => renderResults({ status: "no_docs" }), 2000);
  }
});

// 5. Render Output
function renderResults(data) {
  loader.style.display = 'none';
  runBtn.disabled = false;

  if (data.status === "error" || data.status === "no_docs") {
    resultsArea.innerHTML = `<sp-field-label>${data.message || "No matches found."}</sp-field-label>`;
    return;
  }

  // Render AI Score Cards
  if (data.analysis && data.analysis.length > 0) {
    data.analysis.forEach(item => {
      if (item.score === 0) return;

      const variant = item.score > 80 ? 'positive' : item.score > 50 ? 'notice' : 'negative';
      
      const cardHtml = `
        <sp-card heading="${item.doc_title}" subheading="📍 ${item.location}" style="width: 100%;">
          <sp-badge slot="heading" variant="${variant}">${item.score}% Match</sp-badge>
          <div slot="description" style="font-style: italic; background: #f4f4f4; padding: 8px; border-left: 2px solid #ccc;">
            "${item.snippet}"
          </div>
          <div slot="footer">
            <a href="${item.doc_url}" target="_blank" style="color: #1473e6; text-decoration: none; font-size: 12px;">View Source ↗</a>
          </div>
        </sp-card>
      `;
      
      resultsArea.insertAdjacentHTML('beforeend', cardHtml);
    });
  }
}