/**
 * DRIVE SERVICE
 * Updated to use DriveAPIConnector and route to SheetsAPIConnector
 */

function getUserFolders() {
  const folders = [];
  try {
    // Using your custom identifier for the REST Query
    const response = DriveAPIConnector.Files.list({
      q: "mimeType='application/vnd.google-apps.folder' and starred=true and trashed=false",
      maxResults: 20
    });
    
    if (response.items && response.items.length > 0) {
      response.items.forEach(f => folders.push({ id: f.id, name: "⭐ " + f.title }));
    } else {
      const root = DriveApp.getRootFolder();
      folders.push({ id: root.getId(), name: "📂 " + root.getName() });
    }
  } catch (e) {
    throw new Error("Drive API Error: " + e.message);
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
        
        // 🧪 THE HYDRATION LAYER: 
        // Pass the raw text through the YouTube interceptor before saving it.
        textContent = hydrateYouTubeContext(textContent);
        
        evidence.push({
          type: "text", 
          title: file.title,
          url: file.alternateLink,
          content: textContent.substring(0, 15000) 
        });
      }
    } catch(e) {
      console.warn("Skipped unreadable file: " + file.title);
    }
  });

  return { evidence: evidence, scannedFiles: scannedFiles };
}