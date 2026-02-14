# 🔍 RIFACTS

> A Google Docs sidebar add-on for independent press journalists to fact-check claims against their own Drive evidence, powered by Gemini 2.0 Flash. Built for **RISE Project** (Romania).

![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-V8-4285F4?logo=google&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini%202.0-Flash-8E75B2?logo=googlegemini&logoColor=white)

## How It Works

1. **Highlight a claim** in a Google Doc
2. **Browse and select a Drive folder** containing your evidence (docs, PDFs, spreadsheets)
3. **Click "Verify Selected Claim"** — the system scans your files, hydrates YouTube links, and sends everything to Gemini
4. **Get scored results** — each source document receives a 0-100 match score with exact quotes

## Architecture

A decoupled micro-service ETL pipeline running on Google Apps Script:

| Service | Role |
|---------|------|
| `Initialiser.js` | Entry point — menu, sidebar, orchestrator |
| `DocumentService.js` | Extracts highlighted text from the active Doc |
| `DriveService.js` | Folder browser + evidence gathering (Docs, PDFs via OCR, Sheets) |
| `SheetService.js` | Raw spreadsheet extraction via Sheets API v4 |
| `YouTubeService.js` | Hydration middleware — detects YT links, fetches metadata & captions |
| `GeminiService.js` | Sends claim + evidence to Gemini 2.0 Flash, returns scored JSON |

### Key Design Decisions

- **Native multimodal** — Images sent as base64 to Gemini instead of lossy text transcription
- **PDF OCR hack** — Clones PDFs with `{ocr: true}` on Google's backend for instant text extraction
- **No raw video** — Apps Script has a 50MB memory limit; video context comes via YouTube caption-ripping
- **Lightweight frontend** — Native HTML/CSS/JS (21 KB total) instead of heavy component frameworks
- **Drive folder browser** — Full navigation of My Drive + Shared folders, not just starred

## Stack

- **Backend:** Google Apps Script (V8) + Advanced REST Services
- **AI:** Gemini 2.0 Flash API (native multimodal)
- **Frontend:** Vanilla HTML/CSS/JS with Inter font, built via Vite single-file plugin
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
| `auth/script.container.ui` | Display sidebar in Docs |

## License

MIT
