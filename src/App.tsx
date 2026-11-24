import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  Bell, 
  Settings, 
  Menu, 
  FileText, 
  Star, 
  Trash2, 
  Folder, 
  PlusCircle, 
  Grid, 
  Filter, 
  X, 
  FolderOpen, 
  Tag, 
  ChevronLeft,
  Sparkles,
  Loader2,
  HardDrive,
  Cloud,
  Download,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { useAuth } from 'react-oidc-context';

// --- Types ---

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  createdOn: string;
  updatedOn: string;
  isFavorite: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Detect Desktop environment
const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI?.isDesktop);
const isMac = isDesktop && window.electronAPI?.platform === 'darwin';

// --- Components ---

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active = false, 
  collapsed = false,
  count,
  onClick
}: { 
  icon: any, 
  label: string, 
  active?: boolean, 
  collapsed?: boolean,
  count?: number,
  onClick?: () => void
}) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
      active 
        ? 'bg-primary/10 text-primary font-semibold' 
        : 'text-slate-600 hover:bg-slate-100 font-medium'
    } ${collapsed ? 'justify-center' : ''}`}
  >
    <div className="flex items-center gap-3">
      <Icon size={20} className={active ? 'text-primary' : 'text-slate-400'} />
      {!collapsed && <span className="text-sm">{label}</span>}
    </div>
    {!collapsed && count !== undefined && count > 0 && (
      <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-primary/20 text-primary font-bold' : 'bg-slate-100 text-slate-500'}`}>
        {count}
      </span>
    )}
  </button>
);

export default function App() {
  const auth = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Local Mode state (default to true on desktop if user preferred or not logged into cognito)
  const [isLocalMode, setIsLocalMode] = useState<boolean>(() => {
    if (isDesktop) {
      const saved = localStorage.getItem('memorandum_local_mode');
      return saved !== null ? saved === 'true' : true;
    }
    return false;
  });

  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (auth.user?.access_token) {
      headers.set('Authorization', `Bearer ${auth.user.access_token}`);
    }
    return fetch(input, { ...init, headers });
  };

  const focusedNote = useMemo(() => 
    notes.find(n => n.id === focusedNoteId), 
    [notes, focusedNoteId]
  );

  const fetchNotes = useCallback(async () => {
    if (isDesktop && isLocalMode && window.electronAPI?.storage) {
      try {
        const localNotes = await window.electronAPI.storage.getNotes();
        setNotes(localNotes);
      } catch (err) {
        console.error("Error fetching local notes:", err);
      }
      return;
    }

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/notes`);
      if (!res.ok) throw new Error('API server returned error');
      const data = await res.json();
      setNotes(data);
    } catch (error) {
      console.error("Error fetching remote notes:", error);
      // Fallback to local storage if running in desktop
      if (isDesktop && window.electronAPI?.storage) {
        const fallback = await window.electronAPI.storage.getNotes();
        setNotes(fallback);
        setIsLocalMode(true);
        localStorage.setItem('memorandum_local_mode', 'true');
      }
    }
  }, [isLocalMode]);

  useEffect(() => {
    if (auth.isAuthenticated || (isDesktop && isLocalMode)) {
      fetchNotes();
    }
  }, [auth.isAuthenticated, isLocalMode, fetchNotes]);

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      // Search filter
      const matchesSearch = 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Sidebar category / tag filter
      if (activeFilter === 'favorites') return note.isFavorite;
      if (activeFilter === 'trash') return false; // Placeholder for deleted items
      if (activeFilter === 'Work Projects') return note.category === 'Work Projects';
      if (activeFilter === 'Personal') return note.category === 'Personal';
      return true;
    });
  }, [notes, searchQuery, activeFilter]);

  const toggleNoteSelection = (id: string) => {
    const newSelection = new Set(selectedNoteIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedNoteIds(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedNoteIds.size === filteredNotes.length) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(filteredNotes.map(n => n.id)));
    }
  };

  const deleteSelected = async () => {
    try {
      if (isDesktop && isLocalMode && window.electronAPI?.storage) {
        for (const id of selectedNoteIds) {
          await window.electronAPI.storage.deleteNote(id);
        }
      } else {
        for (const id of selectedNoteIds) {
          await apiFetch(`${API_BASE_URL}/api/v1/notes/${id}`, { method: 'DELETE' });
        }
      }
      setNotes(notes.filter(n => !selectedNoteIds.has(n.id)));
      setSelectedNoteIds(new Set());
    } catch (error) {
      console.error("Error deleting notes:", error);
    }
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const openFocus = (note: Note) => {
    setFocusedNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const saveEdit = async () => {
    const idToSave = editingNoteId || focusedNoteId;
    if (!idToSave) return;
    
    const updatedOn = new Date().toISOString();
    const updates = { title: editTitle, content: editContent, updatedOn };

    try {
      if (isDesktop && isLocalMode && window.electronAPI?.storage) {
        await window.electronAPI.storage.updateNote(idToSave, updates);
      } else {
        await apiFetch(`${API_BASE_URL}/api/v1/notes/${idToSave}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
      }
      
      setNotes(notes.map(n => 
        n.id === idToSave 
          ? { ...n, ...updates } 
          : n
      ));
      setEditingNoteId(null);
      setFocusedNoteId(null);
    } catch (error) {
      console.error("Error saving note:", error);
    }
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setFocusedNoteId(null);
  };

  const toggleFavorite = async (note: Note) => {
    try {
      const newStatus = !note.isFavorite;
      if (isDesktop && isLocalMode && window.electronAPI?.storage) {
        await window.electronAPI.storage.updateNote(note.id, { isFavorite: newStatus });
      } else {
        await apiFetch(`${API_BASE_URL}/api/v1/notes/${note.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isFavorite: newStatus }),
        });
      }
      setNotes(notes.map(n => n.id === note.id ? { ...n, isFavorite: newStatus } : n));
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const generateAINote = useCallback(async () => {
    setIsGenerating(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        alert("GEMINI_API_KEY is not configured in .env");
        setIsGenerating(false);
        return;
      }
      const genAI = new GoogleGenAI({ apiKey });
      const model = "gemini-3-flash-preview";
      const result = await genAI.models.generateContent({
        model,
        contents: "Generate a creative and useful note for a professional workspace. Include a title and a short paragraph of content. Format it as JSON with 'title' and 'content' fields.",
        config: { responseMimeType: "application/json" }
      });
      
      const data = JSON.parse(result.text || '{}');
      const now = new Date().toISOString();
      const newNote: Note = {
        id: Date.now().toString(),
        title: data.title || 'AI Generated Note',
        content: data.content || 'No content generated.',
        category: 'AI',
        createdOn: now,
        updatedOn: now,
        isFavorite: false,
      };
      
      if (isDesktop && isLocalMode && window.electronAPI?.storage) {
        await window.electronAPI.storage.createNote(newNote);
        if (window.electronAPI?.showNotification) {
          window.electronAPI.showNotification('AI Note Created', `"${newNote.title}" has been added to your notes.`);
        }
      } else {
        await apiFetch(`${API_BASE_URL}/api/v1/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newNote),
        });
      }
      
      setNotes(prev => [newNote, ...prev]);
    } catch (error) {
      console.error("Error generating note:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [isLocalMode, apiFetch]);

  const createNewNote = useCallback(async () => {
    const now = new Date().toISOString();
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'New Note',
      content: 'Start writing...',
      category: activeFilter.startsWith('Work') ? 'Work Projects' : (activeFilter.startsWith('Personal') ? 'Personal' : 'General'),
      createdOn: now,
      updatedOn: now,
      isFavorite: false,
    };
    
    try {
      if (isDesktop && isLocalMode && window.electronAPI?.storage) {
        await window.electronAPI.storage.createNote(newNote);
      } else {
        await apiFetch(`${API_BASE_URL}/api/v1/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newNote),
        });
      }
      setNotes(prev => [newNote, ...prev]);
      openFocus(newNote);
    } catch (error) {
      console.error("Error creating note:", error);
    }
  }, [activeFilter, isLocalMode, apiFetch]);

  const exportNoteToMarkdown = async (note: Note) => {
    if (window.electronAPI?.exportMarkdown) {
      const res = await window.electronAPI.exportMarkdown(note.title, note.content);
      if (res.success) {
        setExportNotice(`Exported "${note.title}" successfully!`);
        setTimeout(() => setExportNotice(null), 3500);
      }
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      
      if (isCmdOrCtrl && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        createNewNote();
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        generateAINote();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (editingNoteId || focusedNoteId) {
          saveEdit();
        }
      } else if (e.key === 'Escape') {
        if (focusedNoteId || editingNoteId) {
          cancelEdit();
        } else if (selectedNoteIds.size > 0) {
          setSelectedNoteIds(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingNoteId, focusedNoteId, selectedNoteIds, editTitle, editContent, createNewNote, generateAINote]);

  // Native Menu Listeners
  useEffect(() => {
    if (!window.electronAPI?.onMenuAction) return;
    const cleanup = window.electronAPI.onMenuAction((action) => {
      if (action === 'new-note') createNewNote();
      else if (action === 'ai-generate') generateAINote();
      else if (action === 'save-note') saveEdit();
      else if (action === 'focus-search') searchInputRef.current?.focus();
    });
    return cleanup;
  }, [createNewNote, generateAINote, saveEdit]);

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (auth.error) {
    return <div className="p-8 text-rose-500">Authentication Error: {auth.error.message}</div>;
  }

  // Auth Screen: Displays if not authenticated AND not running in Local Mode
  if (!auth.isAuthenticated && !isLocalMode) {
    return (
      <div className={`flex items-center justify-center h-screen bg-slate-900 text-white relative overflow-hidden ${isMac ? 'pt-8' : ''}`}>
        {/* Abstract background blobs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[100px]" />
          <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[120px]" />
        </div>
        
        {isMac && <div className="absolute top-0 left-0 right-0 h-10 drag-region z-50" />}

        <div className="relative z-10 max-w-md w-full p-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl mb-6 overflow-hidden shadow-2xl shadow-primary/40 border border-primary/30 flex items-center justify-center bg-slate-950">
            <img src="./logo.png" alt="Memorandum Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-5xl font-black mb-4 tracking-tight">Memorandum</h1>
          <p className="text-lg text-slate-300 mb-8 font-medium">Your intelligent workspace for brilliant ideas. Sign in with Cognito or use local desktop storage.</p>
          
          <div className="w-full space-y-3 no-drag">
            <button 
              onClick={() => auth.signinRedirect()}
              className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Sign In with Cognito
              <Sparkles size={20} />
            </button>

            {isDesktop && (
              <button 
                onClick={() => {
                  setIsLocalMode(true);
                  localStorage.setItem('memorandum_local_mode', 'true');
                  fetchNotes();
                }}
                className="w-full py-3.5 px-6 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 cursor-pointer backdrop-blur-sm"
              >
                <HardDrive size={18} className="text-indigo-400" />
                Continue in Local / Offline Mode
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background-light font-sans text-slate-900 antialiased select-none">
      {/* Toast notification for exports */}
      <AnimatePresence>
        {exportNotice && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-8 z-[70] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium border border-slate-700"
          >
            <Check size={16} className="text-emerald-400" />
            <span>{exportNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 256 }}
        className={`flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${isMac ? 'pt-8' : ''}`}
      >
        <div className={`p-6 flex items-center gap-3 drag-region ${isMac ? 'pt-2' : ''}`}>
          <div className="w-9 h-9 rounded-lg overflow-hidden shadow-md shadow-primary/25 border border-primary/20 flex-shrink-0 no-drag bg-slate-950">
            <img src="./logo.png" alt="Memorandum Logo" className="w-full h-full object-cover" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex-1 overflow-hidden">
              <h1 className="text-slate-900 text-lg font-bold leading-none truncate">Memorandum</h1>
              <p className="text-slate-500 text-xs mt-1 font-medium">Workspace</p>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 text-slate-400 hover:text-primary transition-colors no-drag cursor-pointer"
          >
            {isSidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <SidebarItem 
            icon={FileText} 
            label="All Notes" 
            active={activeFilter === 'all'} 
            collapsed={isSidebarCollapsed} 
            count={notes.length}
            onClick={() => setActiveFilter('all')}
          />
          <SidebarItem 
            icon={Star} 
            label="Favorites" 
            active={activeFilter === 'favorites'} 
            collapsed={isSidebarCollapsed} 
            count={notes.filter(n => n.isFavorite).length}
            onClick={() => setActiveFilter('favorites')}
          />
          <SidebarItem 
            icon={Trash2} 
            label="Trash" 
            active={activeFilter === 'trash'} 
            collapsed={isSidebarCollapsed} 
            onClick={() => setActiveFilter('trash')}
          />
          
          {!isSidebarCollapsed && (
            <div className="pt-4 pb-2">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Categories</p>
            </div>
          )}
          
          <SidebarItem 
            icon={Folder} 
            label="Work Projects" 
            active={activeFilter === 'Work Projects'} 
            collapsed={isSidebarCollapsed} 
            count={notes.filter(n => n.category === 'Work Projects').length}
            onClick={() => setActiveFilter('Work Projects')}
          />
          <SidebarItem 
            icon={Folder} 
            label="Personal" 
            active={activeFilter === 'Personal'} 
            collapsed={isSidebarCollapsed} 
            count={notes.filter(n => n.category === 'Personal').length}
            onClick={() => setActiveFilter('Personal')}
          />
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <button 
            onClick={generateAINote}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-3 px-4 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 cursor-pointer"
            title="AI Generate Note (Cmd+Shift+A)"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {!isSidebarCollapsed && <span className="text-sm font-bold">AI Generate</span>}
          </button>
          <button 
            onClick={createNewNote}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-lg py-3 px-4 transition-all shadow-lg shadow-primary/20 cursor-pointer"
            title="New Note (Cmd+N)"
          >
            <PlusCircle size={18} />
            {!isSidebarCollapsed && <span className="text-sm font-bold">New Note</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header with macOS window drag support */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 bg-white border-b border-slate-200 drag-region">
          <div className="flex-1 max-w-2xl no-drag">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <input 
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search through your notes... (Cmd+F)"
                className="w-full bg-slate-100 border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all placeholder:text-slate-500"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 ml-8 no-drag">
            {/* Desktop Storage Mode Indicator */}
            {isDesktop && (
              <button 
                onClick={() => {
                  const nextMode = !isLocalMode;
                  setIsLocalMode(nextMode);
                  localStorage.setItem('memorandum_local_mode', String(nextMode));
                  fetchNotes();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  isLocalMode 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                }`}
                title="Click to switch between Local and Cloud Sync"
              >
                {isLocalMode ? <HardDrive size={14} /> : <Cloud size={14} />}
                <span>{isLocalMode ? 'Local Storage' : 'Cloud Sync'}</span>
              </button>
            )}

            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
              <Bell size={20} />
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
              <Settings size={20} />
            </button>
            
            {auth.isAuthenticated ? (
              <button onClick={() => auth.removeUser()} className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">
                Sign Out
              </button>
            ) : (
              <button 
                onClick={() => auth.signinRedirect()} 
                className="text-sm font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                Sign In
              </button>
            )}

            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.user?.profile?.email || 'default'}`} 
                alt="User Profile" 
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight capitalize">
                {activeFilter === 'all' ? 'All Notes' : activeFilter}
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {filteredNotes.length} note{filteredNotes.length === 1 ? '' : 's'} found
              </p>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="select-all"
                  checked={selectedNoteIds.size === filteredNotes.length && filteredNotes.length > 0}
                  onChange={toggleAllSelection}
                  className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary/20 cursor-pointer"
                />
                <label htmlFor="select-all" className="text-xs font-bold uppercase tracking-wider text-slate-400 cursor-pointer">
                  Select All
                </label>
              </div>
              
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                  <Filter size={16} />
                  Filter
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                  <Grid size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredNotes.map((note) => (
                <motion.div 
                  layout
                  key={note.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all flex flex-col h-64 relative select-text"
                >
                  {editingNoteId === note.id ? (
                    <div className="flex flex-col h-full">
                      <input 
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="font-bold text-slate-900 text-lg w-full bg-slate-50 border-none rounded p-1 mb-2 focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                      <textarea 
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="flex-1 text-slate-600 text-sm leading-relaxed w-full bg-slate-50 border-none rounded p-1 resize-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="mt-4 flex justify-end gap-2">
                        <button 
                          onClick={cancelEdit}
                          className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={saveEdit}
                          className="px-3 py-1 text-xs font-bold bg-primary text-white rounded hover:bg-primary/90 cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="absolute top-3 left-3 z-10">
                        <input 
                          type="checkbox" 
                          checked={selectedNoteIds.has(note.id)}
                          onChange={() => toggleNoteSelection(note.id)}
                          className="note-checkbox w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary/20 bg-white cursor-pointer"
                        />
                      </div>
                      
                      <div className="mb-4 cursor-pointer" onClick={() => openFocus(note)}>
                        <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors text-lg truncate">
                          {note.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Updated {new Date(note.updatedOn).toLocaleString()}</p>
                      </div>
                      
                      <div 
                        className="flex-1 text-slate-600 text-sm leading-relaxed overflow-hidden cursor-pointer line-clamp-5 whitespace-pre-wrap"
                        onClick={() => openFocus(note)}
                      >
                        {note.content}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
                          {note.category}
                        </span>
                        <div className="flex items-center gap-2">
                          {isDesktop && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                exportNoteToMarkdown(note);
                              }}
                              title="Export to Markdown"
                              className="text-slate-300 hover:text-primary transition-colors cursor-pointer"
                            >
                              <Download size={16} />
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(note);
                            }}
                            className={`transition-colors cursor-pointer ${note.isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-primary'}`}
                          >
                            <Star size={18} fill={note.isFavorite ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            <button 
              onClick={createNewNote}
              className="group border-2 border-dashed border-slate-200 p-5 rounded-xl flex flex-col items-center justify-center h-64 hover:border-primary/50 hover:bg-white transition-all cursor-pointer"
            >
              <PlusCircle className="text-slate-300 group-hover:text-primary mb-2 transition-colors" size={40} />
              <p className="text-sm font-bold text-slate-400 group-hover:text-primary transition-colors">Create New Note</p>
              <span className="text-xs text-slate-400 mt-1 font-medium">Cmd+N</span>
            </button>
          </div>
        </div>

        {/* Multi-select Bar */}
        <AnimatePresence>
          {selectedNoteIds.size > 0 && (
            <motion.div 
              initial={{ y: 100, x: '-50%', opacity: 0 }}
              animate={{ y: 0, x: '-50%', opacity: 1 }}
              exit={{ y: 100, x: '-50%', opacity: 0 }}
              className="fixed bottom-8 left-1/2 z-50 bg-white border border-slate-200 rounded-full px-6 py-3 shadow-2xl flex items-center gap-6"
            >
              <div className="flex items-center gap-2 border-r border-slate-200 pr-6">
                <span className="text-sm font-bold text-primary">{selectedNoteIds.size}</span>
                <span className="text-sm font-medium text-slate-500">Selected</span>
              </div>
              
              <div className="flex items-center gap-4">
                {isDesktop && (
                  <button 
                    onClick={async () => {
                      const selected = notes.filter(n => selectedNoteIds.has(n.id));
                      for (const n of selected) {
                        await exportNoteToMarkdown(n);
                      }
                    }}
                    className="flex items-center gap-2 text-slate-600 hover:text-primary transition-colors text-sm font-semibold cursor-pointer"
                  >
                    <Download size={18} />
                    Export
                  </button>
                )}
                <button className="flex items-center gap-2 text-slate-600 hover:text-primary transition-colors text-sm font-semibold cursor-pointer">
                  <FolderOpen size={18} />
                  Move
                </button>
                <button className="flex items-center gap-2 text-slate-600 hover:text-primary transition-colors text-sm font-semibold cursor-pointer">
                  <Tag size={18} />
                  Tag
                </button>
                <button 
                  onClick={async () => {
                    const selected = notes.filter(n => selectedNoteIds.has(n.id));
                    for (const n of selected) {
                      await toggleFavorite(n);
                    }
                  }}
                  className="flex items-center gap-2 text-slate-600 hover:text-primary transition-colors text-sm font-semibold cursor-pointer"
                >
                  <Star size={18} />
                  Favorite
                </button>
                <button 
                  onClick={deleteSelected}
                  className="flex items-center gap-2 text-rose-500 hover:text-rose-600 transition-colors text-sm font-semibold ml-2 cursor-pointer"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              </div>
              
              <button 
                onClick={() => setSelectedNoteIds(new Set())}
                className="ml-4 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Focused Note Modal */}
        <AnimatePresence>
          {focusedNoteId && focusedNote && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={cancelEdit}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {focusedNote.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDesktop && (
                      <button 
                        onClick={() => exportNoteToMarkdown(focusedNote)}
                        title="Export as Markdown"
                        className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Download size={20} />
                      </button>
                    )}
                    <button 
                      onClick={() => toggleFavorite(focusedNote)}
                      className={`p-2 rounded-lg transition-colors cursor-pointer ${focusedNote.isFavorite ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:bg-slate-100'}`}
                    >
                      <Star size={20} fill={focusedNote.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button 
                      onClick={cancelEdit}
                      className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                  <input 
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Note Title"
                    className="text-4xl font-black text-slate-900 w-full border-none focus:ring-0 p-0 mb-6 placeholder:text-slate-200 outline-none"
                  />
                  <textarea 
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Start writing..."
                    className="text-lg text-slate-600 w-full border-none focus:ring-0 p-0 min-h-[300px] resize-none placeholder:text-slate-200 leading-relaxed outline-none"
                  />
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                  <div className="flex flex-col">
                    <p className="text-[10px] text-slate-400 font-medium">
                      Created {new Date(focusedNote.createdOn).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Updated {new Date(focusedNote.updatedOn).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={cancelEdit}
                      className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={saveEdit}
                      className="px-8 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
