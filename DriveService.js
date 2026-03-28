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

/**
 * Drive API copy with ocr:true → temporary Google Doc (supported: PDF, PNG, JPEG, GIF per Google).
 */
function extractTextViaDriveOcr_(sourceFileId, titleHint) {
  const safe = String(titleHint || "file")
    .replace(/[\[\]]/g, "")
    .substring(0, 60);
  const tempDoc = DriveAPIConnector.Files.copy(
    { title: "Temp_OCR_" + safe + "_" + sourceFileId },
    sourceFileId,
    { ocr: true }
  );
  try {
    return DocumentApp.openById(tempDoc.id).getBody().getText();
  } finally {
    try {
      DriveAPIConnector.Files.remove(tempDoc.id);
    } catch (ignore) {}
  }
}

function getFolderEvidence(folderId) {
  const evidence = [];
  const scannedFiles = [];

  const query =
    `'${folderId}' in parents and trashed=false and (` +
    `mimeType='application/vnd.google-apps.document' or ` +
    `mimeType='application/pdf' or ` +
    `mimeType='application/vnd.google-apps.spreadsheet' or ` +
    `mimeType='image/png' or mimeType='image/jpeg' or mimeType='image/gif'` +
    `)`;

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
      // Route 2: PDF + images (Drive OCR → temp Doc)
      else if (
        file.mimeType === "application/pdf" ||
        file.mimeType === "image/png" ||
        file.mimeType === "image/jpeg" ||
        file.mimeType === "image/gif"
      ) {
        textContent = extractTextViaDriveOcr_(file.id, file.title);
        scannedFiles.push((file.mimeType === "application/pdf" ? "📑 " : "🖼️ ") + file.title);
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