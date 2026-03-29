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

      // Route 1: Google Docs — export as plain text via Drive API (no auth/documents needed)
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const exportUrl = "https://www.googleapis.com/drive/v2/files/" + file.id + "/export?mimeType=text/plain";
        const token = ScriptApp.getOAuthToken();
        const resp = UrlFetchApp.fetch(exportUrl, {
          headers: { Authorization: "Bearer " + token },
          muteHttpExceptions: true
        });
        if (resp.getResponseCode() === 200) {
          textContent = resp.getContentText();
        }
        scannedFiles.push("📄 " + file.title);
      }
      // Route 2: PDFs + images — download and send as binary to Gemini (read-only, no temp files)
      else if (
        file.mimeType === "application/pdf" ||
        file.mimeType === "image/png" ||
        file.mimeType === "image/jpeg" ||
        file.mimeType === "image/gif"
      ) {
        const downloadUrl = file.downloadUrl || ("https://www.googleapis.com/drive/v2/files/" + file.id + "?alt=media");
        const token = ScriptApp.getOAuthToken();
        const resp = UrlFetchApp.fetch(downloadUrl, {
          headers: { Authorization: "Bearer " + token },
          muteHttpExceptions: true
        });
        if (resp.getResponseCode() === 200) {
          const blob = resp.getBlob();
          const base64Data = Utilities.base64Encode(blob.getBytes());
          evidence.push({
            type: file.mimeType === "application/pdf" ? "pdf" : "image",
            mimeType: file.mimeType,
            title: file.title,
            url: file.alternateLink,
            content: base64Data
          });
          scannedFiles.push((file.mimeType === "application/pdf" ? "📑 " : "🖼️ ") + file.title);
          return; // binary evidence handled separately
        }
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