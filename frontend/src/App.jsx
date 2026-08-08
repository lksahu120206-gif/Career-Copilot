import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'
import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/clerk-react";

function App() {
  // 1. Core Chat & Session State
  const initialMessage = { role: 'ai', text: 'Hello! I am your Engineering Career Copilot. How can I help you navigate your career path today?' };
  const [messages, setMessages] = useState([initialMessage]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // 2. Sidebar & Database State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  
  // Renaming State
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitleText, setEditTitleText] = useState("");

// 3. Theme & Profile State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Prefer saved preference, fall back to system preference
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState({
    year: 3,
    branch: "Computer Science",
    current_skills: "Python, React, Tailwind", 
    interests: "Web Development, AI",
    target_goal: "Full Stack Developer",
    timeline: "6 months"
  });

  // Fetch past sessions when the app loads
  const fetchSessions = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/sessions");
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  };

useEffect(() => {
    fetchSessions();
  }, []);

  // Apply dark mode class to the root <html> element and persist preference
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Auto-scroll logic
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Handle switching to a past chat
  const loadSession = async (sessionId) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages([initialMessage, ...data.messages]);
        setCurrentSessionId(sessionId);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  };

  // Handle starting a fresh chat
  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([initialMessage]);
  };

  // Submit a renamed chat to the backend
  const submitRename = async (sessionId) => {
    if (!editTitleText.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      await fetch(`http://127.0.0.1:8000/api/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitleText })
      });
      setEditingSessionId(null);
      fetchSessions();
    } catch (error) {
      console.error("Failed to rename session:", error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMessage = inputText;
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInputText('');
    setIsTyping(true);

    try {
      const formattedProfile = {
        ...userProfile,
        current_skills: userProfile.current_skills.split(',').map(s => s.trim()),
        interests: userProfile.interests.split(',').map(s => s.trim()),
      };

      const response = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: currentSessionId,
          message: userMessage,
          history: messages.filter(m => m !== initialMessage).map(m => ({ role: m.role, text: m.text })), 
          profile: formattedProfile
        })
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      
      setMessages(prev => [...prev, { role: 'ai', text: data.message }]);
      
      if (!currentSessionId) {
        setCurrentSessionId(data.session_id);
        fetchSessions();
      }
      
    } catch (error) {
      console.error("Connection error:", error);
      setMessages(prev => [...prev, { role: 'ai', text: "⚠️ Server connection failed." }]);
    } finally {
      setIsTyping(false); 
    }
  };

  const handleProfileChange = (e) => {
    setUserProfile({ ...userProfile, [e.target.name]: e.target.value });
  };

  return (
    <>
      <SignedOut>
        <div className="flex h-screen w-full items-center justify-center bg-slate-50">
          <SignIn />
        </div>
      </SignedOut>

<SignedIn>
        {/* The Outer Div that controls the Dark Mode UI */}
        <div>
          <div className="flex h-screen bg-slate-50 dark:bg-black font-sans text-slate-800 dark:text-neutral-100 overflow-hidden transition-colors duration-300">
            
            {/* --- SIDEBAR --- */}
            <aside className={`${isSidebarOpen ? 'w-64' : 'w-0'} shrink-0 bg-slate-50/50 dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800 transition-all duration-300 overflow-hidden flex flex-col`}>
              <div className="p-4">
                <button 
                  onClick={startNewChat}
                  className="w-full flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  New Chat
                </button>
              </div>
              
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">
                Recents
              </div>
              
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {sessions.map(session => (
                  <div key={session.id} className="relative group flex items-center mb-1">
                    {editingSessionId === session.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editTitleText}
                        onChange={(e) => setEditTitleText(e.target.value)}
                        onBlur={() => submitRename(session.id)}
                        onKeyDown={(e) => e.key === 'Enter' && submitRename(session.id)}
                        className="w-full bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white px-3 py-2.5 rounded-lg border border-emerald-500 focus:outline-none shadow-sm"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => loadSession(session.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors flex items-center gap-2 ${
                            currentSessionId === session.id 
                              ? 'bg-emerald-100 dark:bg-neutral-800 text-emerald-800 dark:text-emerald-400 font-medium' 
                              : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-200/70 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-neutral-100'
                          }`}
                        >
                          <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          <span className="truncate pr-6">{session.title}</span>
                        </button>
                        
                        <button 
                          onClick={() => {
                            setEditingSessionId(session.id);
                            setEditTitleText(session.title);
                          }}
                          className="absolute right-2 p-1 text-slate-400 dark:text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </aside>

            {/* --- MAIN CHAT AREA --- */}
            <div className="flex-1 flex flex-col h-screen relative min-w-0">
              
              {/* Header */}
              <header className="shrink-0 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-slate-200 dark:border-neutral-800 px-4 sm:px-6 py-4 flex items-center justify-between transition-colors duration-300">
                <div className="flex items-center gap-3 sm:gap-4">
                  <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                  <div className="bg-emerald-600 p-2 rounded-lg shadow-sm hidden sm:block">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">Career Copilot</h1>
                </div>
                
                <div className="flex items-center gap-2 sm:gap-4">
                  {/* Dark Mode Toggle */}
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 text-slate-500 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800"
                  >
                    {isDarkMode ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                    )}
                  </button>

                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Profile
                  </button>
                  {/* Clerk Profile/Logout Button */}
                  <UserButton />
                </div>
              </header>

              {/* Settings Modal */}
              {isSettingsOpen && (
                <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-md p-6 relative transition-colors border border-transparent dark:border-neutral-800">
                    <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Student Profile</h2>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Target Goal</label>
                        <input type="text" name="target_goal" value={userProfile.target_goal} onChange={handleProfileChange} className="w-full p-2 bg-white dark:bg-black border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Year</label>
                          <input type="number" name="year" value={userProfile.year} onChange={handleProfileChange} className="w-full p-2 bg-white dark:bg-black border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Branch</label>
                          <input type="text" name="branch" value={userProfile.branch} onChange={handleProfileChange} className="w-full p-2 bg-white dark:bg-black border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">Current Skills (comma separated)</label>
                        <input type="text" name="current_skills" value={userProfile.current_skills} onChange={handleProfileChange} className="w-full p-2 bg-white dark:bg-black border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                      </div>
                      <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg mt-4 transition-colors">
                        Save Profile
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat History Area */}
              <main className="flex-1 overflow-y-auto p-4 sm:p-6 w-full flex flex-col items-center">
                <div className="w-full max-w-3xl space-y-6 pb-32">
                  {messages.map((msg, index) => (
                    <div key={index} className={`flex gap-4 p-4 sm:p-6 rounded-2xl transition-all ${msg.role === 'user' ? 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm' : 'bg-transparent'}`}>
                      
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-100 dark:bg-neutral-800' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-sm'}`}>
                        {msg.role === 'user' ? (
                          <svg className="w-5 h-5 text-slate-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        )}
                      </div>
                      
                      <div className="flex-1 text-[15px] sm:text-base leading-relaxed text-slate-700 dark:text-neutral-300 pt-1">
                        {msg.role === 'user' ? (
                          <div className="whitespace-pre-wrap">{msg.text}</div>
                        ) : (
                          <div className="prose prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-neutral-800 prose-pre:text-slate-50">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="flex gap-4 p-4 sm:p-6">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-sm flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </div>
                      <div className="flex-1 flex items-center gap-1.5 pt-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </main>

              {/* Input Form */}
              <footer className="absolute bottom-0 w-full bg-gradient-to-t from-slate-50 dark:from-black via-slate-50 dark:via-black to-transparent pt-4 pb-6 px-4 flex justify-center transition-colors duration-300">
                <form 
                  onSubmit={handleSendMessage} 
                  className="w-full max-w-3xl relative flex items-end shadow-md bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent transition-all"
                >
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Ask for engineering career advice..."
                    className="w-full max-h-32 bg-transparent border-none pl-6 pr-14 py-4 text-[15px] dark:text-white focus:outline-none resize-none placeholder-slate-400 dark:placeholder-neutral-500"
                    rows="1"
                  />
                  <div className="absolute right-2 bottom-2">
                    <button 
                      type="submit"
                      disabled={!inputText.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-neutral-800 disabled:text-slate-400 dark:disabled:text-neutral-500 text-white p-2.5 rounded-full transition-colors flex items-center justify-center shadow-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                      </svg>
                    </button>
                  </div>
                </form>
              </footer>
            </div>
          </div>
        </div>
      </SignedIn>
    </>
  )
}

export default App