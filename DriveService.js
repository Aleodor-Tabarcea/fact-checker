/**
 * DRIVE SERVICE
 * Folder navigation + evidence extraction via DriveAPIConnector (REST v3)
 */

/**
 * Lists folders inside a parent folder, or returns root-level entry points.
 * @param {string|null} parentId - Folder ID to list children of. Null = root level.
 * @returns {Object} { folders: [{id, name}], breadcrumb: {id, name} }
 */
function listFolders(parentId) {
  const folders = [];

  if (!parentId || parentId === 'root') {
    // Root level: show My Drive root contents + "Shared with me" entry point
    try {
      const response = DriveAPIConnector.Files.list({
        q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
        orderBy: "title",
        maxResults: 50,
        fields: "items(id,title)"
      });

      if (response.items) {
        response.items.forEach(f => folders.push({ id: f.id, name: f.title }));
      }
    } catch (e) {
      console.warn("Failed to list root folders: " + e.message);
    }

    return {
      folders: folders,
      currentId: 'root',
      currentName: 'My Drive',
      parentId: null,
      hasSharedDrives: true
    };
  }

  if (parentId === 'shared') {
    // List folders shared with the user (not in My Drive)
    try {
      const response = DriveAPIConnector.Files.list({
        q: "mimeType='application/vnd.google-apps.folder' and sharedWithMe=true and trashed=false",
        orderBy: "title",
        maxResults: 50,
        fields: "items(id,title)"
      });

      if (response.items) {
        response.items.forEach(f => folders.push({ id: f.id, name: f.title }));
      }
    } catch (e) {
      console.warn("Failed to list shared folders: " + e.message);
    }

    return {
      folders: folders,
      currentId: 'shared',
      currentName: 'Shared with me',
      parentId: 'root',
      hasSharedDrives: false
    };
  }

  // Navigate into a specific folder
  let folderName = "Folder";
  let folderParentId = 'root';

  try {
    // Get folder metadata for name and parent
    const meta = DriveAPIConnector.Files.get(parentId, { fields: "title,parents" });
    folderName = meta.title || "Folder";
    if (meta.parents && meta.parents.length > 0) {
      folderParentId = meta.parents[0].id || 'root';
      // If parent is the actual root, normalize to 'root'
      if (meta.parents[0].isRoot) {
        folderParentId = 'root';
      }
    }
  } catch (e) {
    console.warn("Could not fetch folder metadata: " + e.message);
  }

  try {
    const response = DriveAPIConnector.Files.list({
      q: `mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      orderBy: "title",
      maxResults: 50,
      fields: "items(id,title)"
    });

    if (response.items) {
      response.items.forEach(f => folders.push({ id: f.id, name: f.title }));
    }
  } catch (e) {
    console.warn("Failed to list subfolders: " + e.message);
  }

  return {
    folders: folders,
    currentId: parentId,
    currentName: folderName,
    parentId: folderParentId,
    hasSharedDrives: false
  };
}

/**
 * Legacy function kept for backward compat — returns starred folders.
 */
function getUserFolders() {
  const result = listFolders('root');
  return result.folders;
}

function getFolderEvidence(folderId) {
  const evidence = [];
  const scannedFiles = [];

  const query = `'${folderId}' in parents and (mimeType='application/vnd.google-apps.document' or mimeType='application/pdf' or mimeType='application/vnd.google-apps.spreadsheet') and trashed=false`;

  const response = DriveAPIConnector.Files.list({
    q: query,
    maxResults: 5,
    fields: "items(id,title,mimeType,alternateLink)"
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
      // Route 2: PDFs (OCR Backend via custom identifier)
      else if (file.mimeType === 'application/pdf') {
        const tempDoc = DriveAPIConnector.Files.copy({ title: "Temp_OCR_" + file.id }, file.id, { ocr: true });
        textContent = DocumentApp.openById(tempDoc.id).getBody().getText();
        DriveAPIConnector.Files.remove(tempDoc.id);
        scannedFiles.push("📑 " + file.title);
      }
      // Route 3: Google Sheets (Raw Database Fetch)
      else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
        textContent = extractSheetData(file.id, file.title);
        scannedFiles.push("📊 " + file.title);
      }

      if (textContent.length > 20) {
        // Hydration Layer: Pass through YouTube interceptor
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