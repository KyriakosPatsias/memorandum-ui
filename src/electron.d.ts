export interface ElectronNote {
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
  platform: 'darwin' | 'win32' | 'linux' | string;
  storage: {
    getNotes: () => Promise<ElectronNote[]>;
    saveNotes: (notes: ElectronNote[]) => Promise<boolean>;
    createNote: (note: ElectronNote) => Promise<ElectronNote>;
    updateNote: (id: string, updates: Partial<ElectronNote>) => Promise<ElectronNote | null>;
    deleteNote: (id: string) => Promise<boolean>;
  };
  exportMarkdown: (title: string, content: string) => Promise<{ success: boolean; path?: string }>;
  showNotification: (title: string, body: string) => Promise<void>;
  onMenuAction: (callback: (action: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
