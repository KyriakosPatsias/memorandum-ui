<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Memorandum UI


## Run Locally

**Prerequisites:** Node.js (v20+)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the `GEMINI_API_KEY` in `.env` or `.env.local` to your Gemini API key.

### Web Application
Run the web development server:
```bash
npm run dev
```

### Desktop Application
Run the desktop application in development mode with live hot-reload:
```bash
npm run desktop:dev
```

Build and test the desktop application:
```bash
npm run desktop:build
```

Package a native standalone macOS application (`release/mac-arm64/Memorandum.app`):
```bash
npm run desktop:pack
```

### Desktop Native Features & Shortcuts
- **macOS Native Window**: Integrated traffic light controls with draggable title bar and clean gutter spacing.
- **Local Storage / Offline Mode**: Full offline persistence storing notes directly in your machine's app data folder (`notes.json`), without requiring a remote server.
- **Loopback OAuth Server**: Automatically handles AWS Cognito redirects on `http://localhost:3000`.
- **Global Shortcuts**:
  - `Cmd+N` / `Ctrl+N`: New Note
  - `Cmd+Shift+A` / `Ctrl+Shift+A`: Generate Note with Gemini AI
  - `Cmd+F` / `Ctrl+F`: Focus search input
  - `Cmd+S` / `Ctrl+S`: Save active note
  - `Esc`: Close note modal / cancel editing
- **Markdown Export**: Export notes directly to `.md` files via native save dialogs.

