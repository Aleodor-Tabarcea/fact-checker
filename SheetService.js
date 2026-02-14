/**
 * SHEETS SERVICE
 * Purpose: Raw data extraction, bypassing the heavy Spreadsheet UI layer.
 */

function extractSheetData(fileId, fileName) {
  try {
    // 1. Get the schema (metadata) using your custom identifier
    const spreadsheet = SheetsAPIConnector.Spreadsheets.get(fileId);
    if (!spreadsheet.sheets || spreadsheet.sheets.length === 0) return "";

    const firstSheetName = spreadsheet.sheets[0].properties.title;

    // 2. Query the raw database values. 
    const range = `'${firstSheetName}'!A1:Z200`;
    const response = SheetsAPIConnector.Spreadsheets.Values.get(fileId, range);

    const values = response.values;
    if (!values || values.length === 0) return "";

    // 3. Transform the 2D array into a pipeline-delimited string
    const formattedData = values.map(row => row.join(" | ")).join("\n");
    
    return `[SPREADSHEET TAB: ${firstSheetName}]\n${formattedData}`;

  } catch (e) {
    console.warn(`Sheets API Failed for ${fileName}: ${e.message}`);
    return "";
  }
}