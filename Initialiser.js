/**
 * INIT.GS - App entry point and React UI server.
 */

function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('🕵️‍♂️ Fact Check', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  const ui = HtmlService.createHtmlOutputFromFile('sidebar')
    .setTitle('AI Fact Checker')
    .setWidth(300);
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

    return {
      status: "success",
      analysis: analysis,
      scanned: driveData.scannedFiles
    };
  } catch (e) {
    return { status: "error", message: e.message };
  }
}