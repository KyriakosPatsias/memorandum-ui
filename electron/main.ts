import { app, BrowserWindow, ipcMain, dialog, Menu, shell, Notification } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as http from 'http';

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  createdOn: string;
  updatedOn: string;
  isFavorite: boolean;
}

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

let mainWindow: BrowserWindow | null = null;
let loopbackServer: http.Server | null = null;

const DEFAULT_NOTES: Note[] = [
  {
    id: 'welcome-desktop-1',
    title: 'Welcome to Memorandum Desktop',
    content: 'Welcome to your native desktop workspace! Memorandum brings seamless note taking, AI generation, and full offline persistence to your Mac.\n\nTips to get started:\n- Press Cmd+N to instantly create a new note\n- Press Cmd+Shift+A to generate smart notes with Gemini AI\n- Press Cmd+F to quickly search your notes\n- Press Cmd+S to save changes',
    category: 'Work Projects',
    createdOn: new Date().toISOString(),
    updatedOn: new Date().toISOString(),
    isFavorite: true,
  },
  {
    id: 'welcome-desktop-2',
    title: 'Offline & Local Storage Support',
    content: 'Your notes in Local Mode are stored safely on your computer. You can work without an internet connection or backend server, and all changes are immediately preserved.',
    category: 'Personal',
    createdOn: new Date(Date.now() - 3600000).toISOString(),
    updatedOn: new Date().toISOString(),
    isFavorite: false,
  }
];

function getNotesFilePath(): string {
  return path.join(app.getPath('userData'), 'notes.json');
}

function getWindowStateFilePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

async function loadWindowState(): Promise<WindowState> {
  try {
    const raw = await fs.readFile(getWindowStateFilePath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { width: 1200, height: 800 };
  }
}

async function saveWindowState(window: BrowserWindow) {
  try {
    const bounds = window.getBounds();
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: window.isMaximized(),
    };
    await fs.writeFile(getWindowStateFilePath(), JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save window state:', err);
  }
}

async function readNotes(): Promise<Note[]> {
  try {
    const filePath = getNotesFilePath();
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return DEFAULT_NOTES;
  } catch {
    // If file doesn't exist yet, seed with default notes and save
    await writeNotes(DEFAULT_NOTES);
    return DEFAULT_NOTES;
  }
}

async function writeNotes(notes: Note[]): Promise<boolean> {
  try {
    const filePath = getNotesFilePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(notes, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write notes:', err);
    return false;
  }
}

function setupApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:action', 'new-note')
        },
        {
          label: 'AI Generate Note',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => mainWindow?.webContents.send('menu:action', 'ai-generate')
        },
        { type: 'separator' as const },
        {
          label: 'Save Active Note',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:action', 'save-note')
        },
        { type: 'separator' as const },
        { role: isMac ? 'close' as const : 'quit' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
        { type: 'separator' as const },
        {
          label: 'Find Notes...',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow?.webContents.send('menu:action', 'focus-search')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function setupIpcHandlers() {
  ipcMain.handle('memorandum:get-notes', async () => {
    return await readNotes();
  });

  ipcMain.handle('memorandum:save-notes', async (_event, notes: Note[]) => {
    return await writeNotes(notes);
  });

  ipcMain.handle('memorandum:create-note', async (_event, note: Note) => {
    const notes = await readNotes();
    const updated = [note, ...notes];
    await writeNotes(updated);
    return note;
  });

  ipcMain.handle('memorandum:update-note', async (_event, id: string, updates: Partial<Note>) => {
    const notes = await readNotes();
    let updatedNote: Note | null = null;
    const updatedList = notes.map(n => {
      if (n.id === id) {
        updatedNote = { ...n, ...updates, updatedOn: new Date().toISOString() };
        return updatedNote;
      }
      return n;
    });
    if (updatedNote) {
      await writeNotes(updatedList);
    }
    return updatedNote;
  });

  ipcMain.handle('memorandum:delete-note', async (_event, id: string) => {
    const notes = await readNotes();
    const updatedList = notes.filter(n => n.id !== id);
    await writeNotes(updatedList);
    return true;
  });

  ipcMain.handle('memorandum:export-markdown', async (_event, { title, content }: { title: string; content: string }) => {
    if (!mainWindow) return { success: false };
    
    const safeTitle = (title || 'untitled').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Note as Markdown',
      defaultPath: `${safeTitle}.md`,
      filters: [{ name: 'Markdown Files', extensions: ['md', 'markdown', 'txt'] }]
    });

    if (canceled || !filePath) return { success: false };

    const mdContent = `# ${title}\n\n${content}\n`;
    await fs.writeFile(filePath, mdContent, 'utf-8');
    return { success: true, path: filePath };
  });

  ipcMain.handle('memorandum:show-notification', async (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });
}

function startLoopbackServerIfNeeded(distDir: string): Promise<number> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqPath = decodeURIComponent(req.url?.split('?')[0] || '/');
        let filePath = path.join(distDir, reqPath === '/' ? 'index.html' : reqPath);
        
        try {
          const stat = await fs.stat(filePath);
          if (stat.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
          }
        } catch {
          // SPA fallback to index.html
          filePath = path.join(distDir, 'index.html');
        }

        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(data);
      } catch (e) {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    // Try port 3000 to match Cognito callback URI, fallback to ephemeral port if 3000 is occupied
    server.listen(3000, '127.0.0.1', () => {
      loopbackServer = server;
      resolve(3000);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        // Port 3000 might already be in use by Vite dev server or another instance
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address();
          const port = typeof addr === 'object' && addr ? addr.port : 3000;
          loopbackServer = server;
          resolve(port);
        });
      }
    });
  });
}

async function createWindow() {
  const windowState = await loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width || 1200,
    height: windowState.height || 800,
    x: windowState.x,
    y: windowState.y,
    minWidth: 860,
    minHeight: 560,
    title: 'Memorandum',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#f6f6f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Handle external links opening in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const isDev = (process.env.NODE_ENV === 'development' || !app.isPackaged) && !process.env.ELECTRON_PROD;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';

  if (isDev) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    const distPath = path.join(__dirname, '../dist');
    const port = await startLoopbackServerIfNeeded(distPath);
    await mainWindow.loadURL(`http://localhost:${port}`);
  }

  mainWindow.on('close', () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  setupApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (loopbackServer) {
    loopbackServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
