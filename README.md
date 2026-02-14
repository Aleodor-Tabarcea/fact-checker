# 🕵️‍♂️ AI Fact Checker

> A Google Docs sidebar add-on for independent press journalists to fact-check claims against their own Drive evidence, powered by Gemini 2.0 Flash.

![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-V8-4285F4?logo=google&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini%202.0-Flash-8E75B2?logo=googlegemini&logoColor=white)
![Spectrum](https://img.shields.io/badge/Adobe%20Spectrum-Web%20Components-E1251B?logo=adobe&logoColor=white)

## How It Works

1. **Highlight a claim** in a Google Doc
2. **Select a Drive folder** containing your evidence (docs, PDFs, spreadsheets)
3. **Click "Run AI Analysis"** — the system scans your files, hydrates YouTube links, and sends everything to Gemini
4. **Get scored results** — each source document receives a 0-100 match score with exact quotes

## Architecture

A decoupled micro-service ETL pipeline running entirely on Google Apps Script:

| Service | Role |
|---------|------|
| `Initialiser.js` | Entry point — menu, sidebar, orchestrator |
| `DocumentService.js` | Extracts highlighted text from the active Doc |
| `DriveService.js` | Gathers evidence from Docs, PDFs (OCR), and Sheets |
| `SheetService.js` | Raw spreadsheet extraction via Sheets API v4 |
| `YouTubeService.js` | Hydration middleware — detects YT links, fetches metadata & captions |
| `GeminiService.js` | Sends claim + evidence to Gemini 2.0 Flash, returns scored JSON |

### Key Engineering Decisions

- **Native multimodal** — Images sent as base64 to Gemini instead of lossy text transcription
- **PDF OCR hack** — Clones PDFs with `{ocr: true}` on Google's backend for instant text extraction
- **No raw video** — Apps Script has a 50MB memory limit; video context comes via YouTube caption-ripping
- **Advanced Service aliases** — `DriveAPIConnector`, `SheetsAPIConnector`, `YouTubeAPIConnector` to prevent variable shadowing

## Stack

- **Backend:** Google Apps Script (V8) + Advanced REST Services
- **AI:** Gemini 2.0 Flash API (native multimodal)
- **Frontend:** [Adobe Spectrum Web Components](https://opensource.adobe.com/spectrum-web-components/) via Vite single-file build
- **CI/CD:** Local `npm run deploy` → Vite build → `clasp push`

## Setup

### Prerequisites
- Node.js
- [clasp](https://github.com/google/clasp) authenticated (`npx @google/clasp login`)
- A Gemini API key set in Apps Script properties (`GEMINI_API_KEY`)

### Install & Deploy

```bash
npm install
npm run deploy    # builds UI → copies to sidebar.html → pushes to Apps Script
```

### Local Development

```bash
npm run dev       # starts Vite dev server with mock data
```

## OAuth Scopes

| Scope | Purpose |
|-------|---------|
| `auth/documents` | Read selected text from Docs |
| `auth/drive` | Browse folders, read files, OCR PDFs |
| `auth/spreadsheets` | Extract spreadsheet data |
| `auth/youtube.readonly` | Video metadata |
| `auth/youtube.force-ssl` | Caption/transcript access |

## License

MIT
