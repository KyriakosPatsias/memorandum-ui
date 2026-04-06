import React, { useState, useMemo, useEffect } from 'react';
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
  Loader2
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

// --- Components ---

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active = false, 
  collapsed = false,
  onClick
}: { 
  icon: any, 
  label: string, 
  active?: boolean, 
  collapsed?: boolean,
  onClick?: () => void
}) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
      active 
        ? 'bg-primary/10 text-primary font-semibold' 
        : 'text-slate-600 hover:bg-slate-100 font-medium'
    } ${collapsed ? 'justify-center' : ''}`}
  >
    <Icon size={20} className={active ? 'text-primary' : 'text-slate-400'} />
    {!collapsed && <span className="text-sm">{label}</span>}
  </button>
);

export default function App() {
  const auth = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);

  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (auth.user?.access_token) {
      headers.set('Authorization', `Bearer ${auth.user.access_token}`);
    }
    return fetch(input, { ...init, headers });
  };

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

  if (!auth.isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white relative overflow-hidden">
        {/* Abstract background blobs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[100px]" />
          <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[120px]" />
        </div>
        
        <div className="relative z-10 max-w-md w-full p-8 flex flex-col items-center text-center">
          <div className="bg-primary/20 p-4 rounded-2xl mb-6 backdrop-blur-md border border-primary/30">
            <FileText size={48} className="text-white" />
          </div>
          <h1 className="text-5xl font-black mb-4 tracking-tight">Memorandum</h1>
          <p className="text-lg text-slate-300 mb-8 font-medium">Your intelligent workspace for brilliant ideas. Sign in to access your secure notes.</p>
          
          <button 
            onClick={() => auth.signinRedirect()}
            className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Sign In with Cognito
            <Sparkles size={20} />
          </button>
        </div>
      </div>
    );
  }
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const focusedNote = useMemo(() => 
    notes.find(n => n.id === focusedNoteId), 
    [notes, focusedNoteId]
  );

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/notes`);
      const data = await res.json();
      setNotes(data);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(note => 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [notes, searchQuery]);

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
      for (const id of selectedNoteIds) {
        await apiFetch(`${API_BASE_URL}/api/v1/notes/${id}`, { method: 'DELETE' });
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
    try {
      await apiFetch(`${API_BASE_URL}/api/v1/notes/${idToSave}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent, updatedOn }),
      });
      
      setNotes(notes.map(n => 
        n.id === idToSave 
          ? { ...n, title: editTitle, content: editContent, updatedOn } 
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
      await apiFetch(`${API_BASE_URL}/api/v1/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: newStatus }),
      });
      setNotes(notes.map(n => n.id === note.id ? { ...n, isFavorite: newStatus } : n));
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const generateAINote = async () => {
    setIsGenerating(true);
    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
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
      
      await apiFetch(`${API_BASE_URL}/api/v1/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote),
      });
      
      setNotes([newNote, ...notes]);
    } catch (error) {
      console.error("Error generating note:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const createNewNote = async () => {
    const now = new Date().toISOString();
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'New Note',
      content: 'Start writing...',
      category: 'General',
      createdOn: now,
      updatedOn: now,
      isFavorite: false,
    };
    
    try {
      await apiFetch(`${API_BASE_URL}/api/v1/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote),
      });
      setNotes([newNote, ...notes]);
      openFocus(newNote);
    } catch (error) {
      console.error("Error creating note:", error);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-light font-sans text-slate-900 antialiased">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 256 }}
        className="flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-300"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg text-white">
            <FileText size={24} />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex-1 overflow-hidden">
              <h1 className="text-slate-900 text-lg font-bold leading-none truncate">Memorandum</h1>
              <p className="text-slate-500 text-xs mt-1 font-medium">Workspace</p>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 text-slate-400 hover:text-primary transition-colors"
          >
            {isSidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <SidebarItem icon={FileText} label="All Notes" active collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Star} label="Favorites" collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Trash2} label="Trash" collapsed={isSidebarCollapsed} />
          
          {!isSidebarCollapsed && (
            <div className="pt-4 pb-2">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Categories</p>
            </div>
          )}
          
          <SidebarItem icon={Folder} label="Work Projects" collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Folder} label="Personal" collapsed={isSidebarCollapsed} />
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <button 
            onClick={generateAINote}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-3 px-4 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {!isSidebarCollapsed && <span className="text-sm font-bold">AI Generate</span>}
          </button>
          <button 
            onClick={createNewNote}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-lg py-3 px-4 transition-all shadow-lg shadow-primary/20"
          >
            <PlusCircle size={18} />
            {!isSidebarCollapsed && <span className="text-sm font-bold">New Note</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 bg-white border-b border-slate-200">
          <div className="flex-1 max-w-2xl">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search through your notes..."
                className="w-full bg-slate-100 border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all placeholder:text-slate-500"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4 ml-8">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              <Bell size={20} />
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              <Settings size={20} />
            </button>
            <button onClick={() => auth.removeUser()} className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">
              Sign Out
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${process.env.USER_EMAIL || 'default'}`} 
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
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">All Notes</h2>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="select-all"
                  checked={selectedNoteIds.size === filteredNotes.length && filteredNotes.length > 0}
                  onChange={toggleAllSelection}
                  className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary/20"
                />
                <label htmlFor="select-all" className="text-xs font-bold uppercase tracking-wider text-slate-400 cursor-pointer">
                  Select All
                </label>
              </div>
              
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                  <Filter size={16} />
                  Filter
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
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
                  className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all flex flex-col h-64 relative"
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
                          className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={saveEdit}
                          className="px-3 py-1 text-xs font-bold bg-primary text-white rounded hover:bg-primary/90"
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
                        className="flex-1 text-slate-600 text-sm leading-relaxed overflow-hidden cursor-pointer"
                        onClick={() => openFocus(note)}
                      >
                        {note.content}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
                          {note.category}
                        </span>
                        <button 
                          onClick={() => toggleFavorite(note)}
                          className={`transition-colors ${note.isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-primary'}`}
                        >
                          <Star size={18} fill={note.isFavorite ? 'currentColor' : 'none'} />
                        </button>
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
                <button className="flex items-center gap-2 text-slate-600 hover:text-primary transition-colors text-sm font-semibold">
                  <FolderOpen size={18} />
                  Move
                </button>
                <button className="flex items-center gap-2 text-slate-600 hover:text-primary transition-colors text-sm font-semibold">
                  <Tag size={18} />
                  Tag
                </button>
                <button className="flex items-center gap-2 text-slate-600 hover:text-primary transition-colors text-sm font-semibold">
                  <Star size={18} />
                  Favorite
                </button>
                <button 
                  onClick={deleteSelected}
                  className="flex items-center gap-2 text-rose-500 hover:text-rose-600 transition-colors text-sm font-semibold ml-2"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              </div>
              
              <button 
                onClick={() => setSelectedNoteIds(new Set())}
                className="ml-4 p-1 text-slate-400 hover:text-slate-600"
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
                    <button 
                      onClick={() => toggleFavorite(focusedNote)}
                      className={`p-2 rounded-lg transition-colors ${focusedNote.isFavorite ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:bg-slate-100'}`}
                    >
                      <Star size={20} fill={focusedNote.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button 
                      onClick={cancelEdit}
                      className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
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
                    className="text-4xl font-black text-slate-900 w-full border-none focus:ring-0 p-0 mb-6 placeholder:text-slate-200"
                  />
                  <textarea 
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Start writing..."
                    className="text-lg text-slate-600 w-full border-none focus:ring-0 p-0 min-h-[300px] resize-none placeholder:text-slate-200 leading-relaxed"
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
                      className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={saveEdit}
                      className="px-8 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
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
