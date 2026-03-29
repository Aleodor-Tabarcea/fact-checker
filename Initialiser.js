/**
 * INIT.GS - App entry point, RIFACTS UI server, and user settings.
 */

// ── API Key Management (per-user) ──
function saveApiKey(key) {
  if (!key || key.trim().length < 10) throw new Error('Please enter a valid API key.');
  PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', key.trim());
  return { success: true };
}

function getApiKey() {
  return PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
}

function hasApiKey() {
  const key = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
  return !!(key && key.length > 0);
}

function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('🔍 RIFACTS', 'showSidebar')
    .addItem('📄 Scan all paragraphs…', 'prepareFullDocumentScan')
    .addToUi();
}

/**
 * Google Workspace add-on homepage (required for test / Marketplace deployment).
 * Returns a card; button opens the HtmlService sidebar.
 */
function buildRifactsAddOnHomepage() {
  const openAction = CardService.newAction().setFunctionName('openRifactsSidebarFromCard');
  const openBtn = CardService.newTextButton()
    .setText('Open RIFACTS sidebar')
    .setOnClickAction(openAction);
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('RIFACTS').setSubtitle('Fact-check vs Drive & YouTube evidence'))
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextParagraph().setText(
            'Use the sidebar to verify a highlighted claim or scan all paragraphs. You still have RIFACTS under Extensions in the Doc menu after install.'
          )
        )
        .addWidget(CardService.newButtonSet().addButton(openBtn))
    )
    .build();
}

/** Card button handler: must return an action response after opening the sidebar. */
function openRifactsSidebarFromCard() {
  showSidebar();
  return CardService.newActionResponseBuilder().build();
}

function showSidebar() {
  const ui = HtmlService.createHtmlOutputFromFile('sidebar')
    .setTitle('RIFACTS')
    .setWidth(320);
  DocumentApp.getUi().showSidebar(ui);
}

/** Menu: open sidebar and auto-start full-document scan on load. */
function prepareFullDocumentScan() {
  PropertiesService.getUserProperties().setProperty('RIFACTS_PENDING_SCAN', 'full_document');
  showSidebar();
}

/** Sidebar calls once on load; clears the one-shot flag. */
function consumePendingScanMode() {
  const up = PropertiesService.getUserProperties();
  const v = up.getProperty('RIFACTS_PENDING_SCAN') || '';
  if (v) up.deleteProperty('RIFACTS_PENDING_SCAN');
  return v;
}

function collectEvidence_(folderId, ytUrls) {
  let driveData = { evidence: [], scannedFiles: [] };
  if (folderId) {
    driveData = getFolderEvidence(folderId);
  }
  if (ytUrls && ytUrls.length > 0) {
    ytUrls.forEach(url => {
      try {
        const hydrated = hydrateYouTubeContext(url);
        if (hydrated && hydrated.length > 20) {
          driveData.evidence.push({
            type: "text",
            title: "YouTube: " + url.substring(0, 60),
            url: url,
            content: hydrated.substring(0, 15000)
          });
          driveData.scannedFiles.push("📺 YouTube Video");
        }
      } catch (e) {
        console.warn("YouTube processing failed: " + e.message);
      }
    });
  }
  return driveData;
}

function performFactCheck(folderId, ytUrls) {
  try {
    const claim = getSelectedText();
    if (!claim) throw new Error("Please highlight the text you want to check.");

    const driveData = collectEvidence_(folderId, ytUrls);

    if (driveData.evidence.length === 0) {
      return { status: "no_docs", message: "No readable evidence found." };
    }

    const analysis = callGeminiMultimodal(claim, driveData.evidence);

    const urlMap = {};
    driveData.evidence.forEach(e => { urlMap[e.title] = e.url; });

    if (Array.isArray(analysis)) {
      analysis.forEach(item => {
        item.doc_url = urlMap[item.doc_title] || "";
      });
    }

    return {
      status: "success",
      mode: "selection",
      analysis: analysis,
      scanned: driveData.scannedFiles
    };
  } catch (e) {
    return { status: "error", message: e.message };
  }
}

/**
 * Fact-check each qualifying body paragraph against the same evidence (sequential Gemini calls).
 * Capped per run for execution time; see getParagraphClaimsForFactCheck_.
 */
function performDocumentParagraphFactCheck(folderId, ytUrls) {
  try {
    const pack = getParagraphClaimsForFactCheck_(25, 35);
    if (!pack.paragraphs || pack.paragraphs.length === 0) {
      return {
        status: "no_paragraphs",
        message: "No paragraphs to check (need at least 25 characters of text per paragraph)."
      };
    }

    const driveData = collectEvidence_(folderId, ytUrls);
    if (driveData.evidence.length === 0) {
      return { status: "no_docs", message: "No readable evidence found." };
    }

    const urlMap = {};
    driveData.evidence.forEach(e => { urlMap[e.title] = e.url; });

    const paragraphResults = [];
    for (let i = 0; i < pack.paragraphs.length; i++) {
      const p = pack.paragraphs[i];
      try {
        const analysis = callGeminiMultimodal(p.text, driveData.evidence);
        if (Array.isArray(analysis)) {
          analysis.forEach(item => {
            item.doc_url = urlMap[item.doc_title] || "";
          });
        }
        paragraphResults.push({
          seq: p.seq,
          childIndex: p.childIndex,
          preview: p.text.length > 180 ? p.text.substring(0, 180) + "…" : p.text,
          analysis: analysis
        });
      } catch (e) {
        paragraphResults.push({
          seq: p.seq,
          childIndex: p.childIndex,
          preview: p.text.length > 180 ? p.text.substring(0, 180) + "…" : p.text,
          error: e.message
        });
      }
    }

    return {
      status: "success",
      mode: "full_document",
      scanned: driveData.scannedFiles,
      totalParagraphs: pack.totalParagraphs,
      runParagraphs: pack.paragraphs.length,
      truncated: pack.truncated,
      paragraphs: paragraphResults
    };
  } catch (e) {
    return { status: "error", message: e.message };
  }
}