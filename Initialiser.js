/**
 * INIT.GS - App entry point and RIFACTS UI server.
 */

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

function performFactCheck(folderId) {
  try {
    const claim = getSelectedText();
    if (!claim) throw new Error("Please highlight the text you want to check.");

    const driveData = getFolderEvidence(folderId);
    if (driveData.evidence.length === 0) {
      return { status: "no_docs", message: "No readable text or PDFs found." };
    }

    const analysis = callGeminiMultimodal(claim, driveData.evidence);

    // Post-process: inject real Drive URLs (Gemini can't know them)
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