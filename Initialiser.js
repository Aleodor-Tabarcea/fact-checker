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
    .addToUi();
}

function showSidebar() {
  const ui = HtmlService.createHtmlOutputFromFile('sidebar')
    .setTitle('RIFACTS')
    .setWidth(320);
  DocumentApp.getUi().showSidebar(ui);
}

function performFactCheck(folderId, ytUrls) {
  try {
    const claim = getSelectedText();
    if (!claim) throw new Error("Please highlight the text you want to check.");

    // Gather Drive evidence
    let driveData = { evidence: [], scannedFiles: [] };
    if (folderId) {
      driveData = getFolderEvidence(folderId);
    }

    // Gather YouTube evidence
    if (ytUrls && ytUrls.length > 0) {
      ytUrls.forEach(url => {
        try {
          console.log("🎬 Processing YouTube URL: " + url);
          const hydrated = hydrateYouTubeContext(url);
          console.log("🎬 Hydrated content length: " + (hydrated ? hydrated.length : 0));
          console.log("🎬 Hydrated content (first 2000 chars): " + (hydrated ? hydrated.substring(0, 2000) : "(empty)"));
          if (hydrated && hydrated.length > 20) {
            driveData.evidence.push({
              type: "text",
              title: "YouTube: " + url.substring(0, 60),
              url: url,
              content: hydrated.substring(0, 15000)
            });
            driveData.scannedFiles.push("📺 YouTube Video");
          } else {
            console.warn("🎬 YouTube content too short or empty, skipping. Length: " + (hydrated ? hydrated.length : 0));
          }
        } catch (e) {
          console.warn("YouTube processing failed: " + e.message);
        }
      });
    }

    if (driveData.evidence.length === 0) {
      return { status: "no_docs", message: "No readable evidence found." };
    }

    const analysis = callGeminiMultimodal(claim, driveData.evidence);

    // Post-process: inject real URLs (Gemini can't know them)
    const urlMap = {};
    driveData.evidence.forEach(e => { urlMap[e.title] = e.url; });

    if (Array.isArray(analysis)) {
      analysis.forEach(item => {
        item.doc_url = urlMap[item.doc_title] || "";
      });
    }

    return {
      status: "success",
      analysis: analysis,
      scanned: driveData.scannedFiles
    };
  } catch (e) {
    return { status: "error", message: e.message };
  }
}