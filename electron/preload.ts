import { contextBridge, ipcRenderer } from 'electron';

export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  createdOn: string;
  updatedOn: string;
  isFavorite: boolean;
}

export interface ElectronAPI {
  isDesktop: boolean;
  platform: NodeJS.Platform;
  storage: {
    getNotes: () => Promise<Note[]>;
    saveNotes: (notes: Note[]) => Promise<boolean>;
    createNote: (note: Note) => Promise<Note>;
    updateNote: (id: string, updates: Partial<Note>) => Promise<Note | null>;
    deleteNote: (id: string) => Promise<boolean>;
  };
  exportMarkdown: (title: string, content: string) => Promise<{ success: boolean; path?: string }>;
  showNotification: (title: string, body: string) => Promise<void>;
  onMenuAction: (callback: (action: string) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  isDesktop: true,
  platform: process.platform,
  storage: {
    getNotes: () => ipcRenderer.invoke('memorandum:get-notes'),
    saveNotes: (notes: Note[]) => ipcRenderer.invoke('memorandum:save-notes', notes),
    createNote: (note: Note) => ipcRenderer.invoke('memorandum:create-note', note),
    updateNote: (id: string, updates: Partial<Note>) => ipcRenderer.invoke('memorandum:update-note', id, updates),
    deleteNote: (id: string) => ipcRenderer.invoke('memorandum:delete-note', id),
  },
  exportMarkdown: (title: string, content: string) => 
    ipcRenderer.invoke('memorandum:export-markdown', { title, content }),
  showNotification: (title: string, body: string) => 
    ipcRenderer.invoke('memorandum:show-notification', { title, body }),
  onMenuAction: (callback: (action: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on('menu:action', listener);
    return () => {
      ipcRenderer.removeListener('menu:action', listener);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
