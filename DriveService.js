/**
 * DRIVE SERVICE
 * Folder search + evidence extraction via DriveAPIConnector (REST v2)
 */

/**
 * Searches for folders by name across My Drive and shared folders.
 * @param {string} query - Search term for folder name
 * @returns {Array} [{id, name, path}]
 */
function searchFolders(query) {
  if (!query || query.trim().length < 2) return [];

  const folders = [];
  const escaped = query.replace(/'/g, "\\'");

  try {
    const response = DriveAPIConnector.Files.list({
      q: `mimeType='application/vnd.google-apps.folder' and title contains '${escaped}' and trashed=false`,
      maxResults: 10,
      orderBy: "title"
    });

    if (response.items) {
      response.items.forEach(f => {
        folders.push({
          id: f.id,
          name: f.title,
          shared: f.shared || false
        });
      });
    }
  } catch (e) {
    console.warn("Folder search failed: " + e.message);
  }

  return folders;
}

function getFolderEvidence(folderId) {
  const evidence = [];
  const scannedFiles = [];

  const query = `'${folderId}' in parents and (mimeType='application/vnd.google-apps.document' or mimeType='application/pdf' or mimeType='application/vnd.google-apps.spreadsheet') and trashed=false`;

  const response = DriveAPIConnector.Files.list({
    q: query,
    maxResults: 5
  });

  if (!response.items) return { evidence: [], scannedFiles: [] };

  response.items.forEach(file => {
    try {
      let textContent = "";

      // Route 1: Google Docs
      if (file.mimeType === 'application/vnd.google-apps.document') {
        textContent = DocumentApp.openById(file.id).getBody().getText();
        scannedFiles.push("📄 " + file.title);
      }
      // Route 2: PDFs (OCR Backend)
      else if (file.mimeType === 'application/pdf') {
        const tempDoc = DriveAPIConnector.Files.copy({ title: "Temp_OCR_" + file.id }, file.id, { ocr: true });
        textContent = DocumentApp.openById(tempDoc.id).getBody().getText();
        DriveAPIConnector.Files.remove(tempDoc.id);
        scannedFiles.push("📑 " + file.title);
      }
      // Route 3: Google Sheets
      else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
        textContent = extractSheetData(file.id, file.title);
        scannedFiles.push("📊 " + file.title);
      }

      if (textContent.length > 20) {
        textContent = hydrateYouTubeContext(textContent);
        evidence.push({
          type: "text",
          title: file.title,
          url: file.alternateLink,
          content: textContent.substring(0, 15000)
        });
      }
    } catch (e) {
      console.warn("Skipped unreadable file: " + file.title);
    }
  });

  return { evidence: evidence, scannedFiles: scannedFiles };
}