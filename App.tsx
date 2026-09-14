
import React, { useState, useEffect, useCallback, useRef } from 'react';
import LiveSession from './components/LiveSession';
import ChatInterface from './components/ChatInterface';
import SystemStatus from './components/SystemStatus';
import Dashboard from './components/Dashboard';
import Projector from './components/Projector';
import IntegrationSettings from './components/IntegrationSettings';
import ChessGame from './components/ChessGame';
import LoginScreen from './components/LoginScreen';
import FileManager from './components/FileManager';
import NotebookView from './components/NotebookView';
import { AppMode, SystemStat, ProjectorData, ProjectorType, IntegrationConfig, Alert, Email, CalendarEvent, WorkspaceActions, User, SmartDevice, SmartHomeActions, KnowledgeSource, ProjectFile, FileSystemActions } from './types';
import { signOutGoogle } from './utils/googleAuth';

// Default Config
const DEFAULT_CONFIG: IntegrationConfig = {
  knowledgeBaseIp: '196.188.72.250',
  openAiApiKey: '',
  mellatechUrl: 'https://hs.mellatech.com/mct/index.php',
  dynamicsUrl: 'https://org.crm.dynamics.com',
  dynamicsToken: '',
  gmailUser: 'tafesetadios@gmail.com',
  develonId: 'FLEET-77',
  develonToken: '',
  sis2goKey: '',
  sis2goUrl: 'https://api.sis2go.com/v1',
  hueBridgeIp: '',
  hueUsername: '',
  switchBotToken: '',
  switchBotSecret: '',
  smartThingsToken: '',
  augustApiKey: '',
  lgThinQToken: '',
  unifiControllerUrl: 'https://192.168.1.1:8443',
  unifiUser: 'admin',
  unifiPass: ''
};

function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('jarvis_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [mode, setMode] = useState<AppMode>(AppMode.DASHBOARD);
  const [config, setConfig] = useState<IntegrationConfig>(DEFAULT_CONFIG);
  const [logs, setLogs] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSidebar, setShowSidebar] = useState(true);
  
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  
  const [projectorWindows, setProjectorWindows] = useState<ProjectorData[]>([]);
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [sharedChatInput, setSharedChatInput] = useState('');

  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>(() => {
    try {
        const saved = localStorage.getItem('jarvis_knowledge_sources');
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const updateKnowledgeSources = (sources: KnowledgeSource[]) => {
      setKnowledgeSources(sources);
      localStorage.setItem('jarvis_knowledge_sources', JSON.stringify(sources));
      addLog(`Knowledge Base updated. ${sources.length} sources active.`);
  };

  const [files, setFiles] = useState<ProjectFile[]>(() => {
    try {
        const saved = localStorage.getItem('jarvis_files');
        return saved ? JSON.parse(saved) : [
            {
                id: 'sys-prefs-default',
                name: 'user_preferences.txt',
                content: '# J.A.R.V.I.S. CONFIG\n',
                type: 'text',
                timestamp: new Date().toISOString(),
                tags: ['system']
            }
        ];
    } catch { return []; }
  });

  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);

  const saveFilesToStorage = (newFiles: ProjectFile[]) => {
      setFiles(newFiles);
      filesRef.current = newFiles;
      localStorage.setItem('jarvis_files', JSON.stringify(newFiles));
  };

  const fileSystemActions: FileSystemActions = {
      createFile: async (name, content, type, tags = []) => {
          const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
          const newFile: ProjectFile = { id, name, content, type, timestamp: new Date().toISOString(), tags };
          saveFilesToStorage([...filesRef.current, newFile]);
          return id;
      },
      readFile: async (name) => filesRef.current.find(f => f.name.toLowerCase() === name.toLowerCase()) || null,
      listFiles: async (tag) => tag ? filesRef.current.filter(f => f.tags.includes(tag)) : filesRef.current,
      deleteFile: (id) => saveFilesToStorage(filesRef.current.filter(f => f.id !== id)),
      updateFile: (id, content) => saveFilesToStorage(filesRef.current.map(f => f.id === id ? { ...f, content } : f))
  };

  const [smartDevices, setSmartDevices] = useState<SmartDevice[]>(() => {
      try {
          const saved = localStorage.getItem('jarvis_smart_devices');
          return saved ? JSON.parse(saved) : [
             { id: 'local-uplink', name: 'Browser Uplink', type: 'NETWORK', brand: 'BROWSER_API', status: 'online', ip: '127.0.0.1', location: 'Local', latency: 0, frequency: 'Scanning', channel: 0 }
          ];
      } catch { 
          return [{ id: 'local-uplink', name: 'Browser Uplink', type: 'NETWORK', brand: 'BROWSER_API', status: 'online', ip: '127.0.0.1', location: 'Local', latency: 0 }];
      }
  });

  const saveDevices = (devices: SmartDevice[]) => {
      setSmartDevices(devices);
      localStorage.setItem('jarvis_smart_devices', JSON.stringify(devices));
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  };

  useEffect(() => {
    const connection = (navigator as any).connection;
    const updateNetworkStats = () => {
        if (connection) {
            setSmartDevices(prev => prev.map(d => {
                if (d.type === 'NETWORK' && d.id === 'local-uplink') {
                    return {
                        ...d,
                        status: navigator.onLine ? 'online' : 'offline',
                        latency: connection.rtt || 0,
                        download: connection.downlink ? `${connection.downlink} Mbps` : 'Unknown',
                    };
                }
                return d;
            }));
        }
    };
    if (connection) {
        connection.addEventListener('change', updateNetworkStats);
        updateNetworkStats();
    }
  }, []);

  const smartHomeActions: SmartHomeActions = {
    setDeviceState: async (id, state, value) => {
       const device = smartDevices.find(d => d.id === id);
       if (!device) return "Device not found";
       addLog(`Commanding ${device.name}: ${state} ${value || ''}`);
       const updated = smartDevices.map(d => d.id === id ? { ...d, status: state as any, value: value !== undefined ? value : d.value } : d);
       saveDevices(updated);
       return "OK";
    },
    getDevices: () => smartDevices,
    getCameraStream: (id) => "https://images.unsplash.com/photo-1558002038-10914cba6023?q=80&w=1000",
    addDevice: (device) => saveDevices([...smartDevices, device]),
    removeDevice: (id) => saveDevices(smartDevices.filter(d => d.id !== id))
  };

  const [emails, setEmails] = useState<Email[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!user || mode === AppMode.LIVE) {
      if (recognitionRef.current) recognitionRef.current.stop();
      return;
    }
  }, [user, mode]);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('jarvis_wallpaper_opacity');
    return saved ? parseFloat(saved) : 0.35;
  });

  const cycleWallpaperOpacity = () => {
    const levels = [0.2, 0.35, 0.55, 0.75, 0.1];
    const currentIndex = levels.findIndex(l => Math.abs(l - wallpaperOpacity) < 0.05);
    const nextLevel = levels[(currentIndex + 1) % levels.length];
    setWallpaperOpacity(nextLevel);
    localStorage.setItem('jarvis_wallpaper_opacity', nextLevel.toString());
  };

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('jarvis_user', JSON.stringify(u));
    addLog(`Identity confirmed: ${u.name} (${u.email}) authenticated via ${u.authProvider || 'google'}.`);
  };

  const handleLogout = () => {
    signOutGoogle();
    setUser(null);
    setShowUserMenu(false);
    localStorage.removeItem('jarvis_user');
    addLog('User session terminated. Logged out.');
  };

  const workspaceActions: WorkspaceActions = {
    sendEmail: async (to, subject, body) => ({ status: 'sent', id: '1' }),
    checkEmails: async (query) => emails,
    scheduleEvent: async (title, time, attendees) => ({ status: 'scheduled', event: {} as any }),
    checkCalendar: async (date) => calendarEvents
  };

  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStat[]>([
    { label: 'CORES', value: navigator.hardwareConcurrency || 4, unit: 'THR', status: 'normal' },
    { label: 'BATTERY', value: '--', unit: '%', status: 'normal' },
    { label: 'LATENCY', value: 0, unit: 'ms', status: 'normal' },
    { label: 'HOME', value: 'SECURE', unit: '', status: 'normal' },
  ]);

  const closeProjector = (id: string) => setProjectorWindows(prev => prev.filter(w => w.id !== id));
  const openProjector = (type: ProjectorType, content: string, title?: string) => {
    const newWindow: ProjectorData = { id: Date.now().toString(), type, content, title, zIndex: projectorWindows.length + 1 };
    setProjectorWindows(prev => [...prev, newWindow]);
  };

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="relative min-h-screen bg-slate-950 text-cyan-400 font-sans selection:bg-cyan-500 selection:text-slate-900 overflow-hidden flex flex-col">
      {/* Universal Hologram AI Wallpaper (Applies to Every Landing Page & View) */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0 transition-opacity duration-700"
        style={{ 
          backgroundImage: `url('/jarvis-wallpaper.jpg')`,
          opacity: wallpaperOpacity,
        }}
      />
      {/* Sci-Fi Atmospheric Vignette & Contrast Control */}
      <div className="fixed inset-0 bg-slate-950/70 pointer-events-none z-0" />
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.12)_0%,_rgba(2,6,23,0.85)_75%)]" />
      <div 
        className="fixed inset-0 opacity-10 pointer-events-none z-0" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }}
      />

      <Projector windows={projectorWindows} onClose={closeProjector} />

      <div className="relative z-10 container mx-auto h-screen p-2 md:p-4 flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between border-b border-cyan-800/50 pb-2 bg-slate-900/80 p-3 rounded-lg backdrop-blur-md shrink-0 gap-2">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setMode(AppMode.DASHBOARD)}>
             <h1 className="text-xl md:text-2xl font-bold tracking-widest font-mono">J.A.R.V.I.S.</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex gap-1 md:gap-2">
              {[
                { id: AppMode.DASHBOARD, label: 'DASH' },
                { id: AppMode.NOTEBOOK, label: 'NOTEBOOK' },
                { id: AppMode.CHAT, label: 'CHAT' },
                { id: AppMode.LIVE, label: 'VOICE' },
                { id: AppMode.FILES, label: 'FILES' },
                { id: AppMode.SETTINGS, label: 'CFG' }
              ].map((btn) => (
                <button key={btn.id} onClick={() => setMode(btn.id)}
                  className={`px-3 py-2 rounded font-mono text-xs border transition-all ${mode === btn.id ? 'bg-cyan-500 text-slate-900 border-cyan-400' : 'border-cyan-800 text-cyan-700 bg-slate-900/50'}`}>
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-2 border-l border-cyan-900/50 pl-3 relative">
              {/* Wallpaper Ambience Adjuster */}
              <button
                onClick={cycleWallpaperOpacity}
                className="flex items-center gap-1 p-2 rounded text-cyan-800 hover:text-cyan-400 transition-all group"
                title={`Wallpaper Ambience: ${Math.round(wallpaperOpacity * 100)}% (Click to toggle intensity)`}
              >
                <svg className="w-4 h-4 text-cyan-600 group-hover:text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] font-mono text-cyan-700 group-hover:text-cyan-400 hidden sm:inline">
                  {Math.round(wallpaperOpacity * 100)}%
                </span>
              </button>

              <button 
                onClick={() => setShowSidebar(!showSidebar)} 
                className={`p-2 rounded transition-all group ${showSidebar ? 'text-cyan-400 bg-cyan-900/20' : 'text-cyan-800 hover:text-cyan-600'}`}
                title={showSidebar ? "Minimize Diagnostics" : "Expand Diagnostics"}
              >
                <svg className={`w-5 h-5 ${showSidebar ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>

              {/* User Avatar with Google Badge & Dropdown */}
              <div className="relative">
                <button
                  id="user-profile-menu-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1 rounded-lg border border-cyan-800/60 hover:border-cyan-400 bg-slate-950/60 transition-all group focus:outline-none"
                  title="Google Account & Authentication"
                >
                  <div className="relative">
                    <img 
                      src={user.avatar} 
                      alt={user.name} 
                      className="w-8 h-8 rounded-full border border-cyan-500 object-cover" 
                    />
                    {user.authProvider === 'google' && (
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center p-0.5 shadow">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="hidden md:flex flex-col text-left pr-1">
                    <span className="text-xs font-bold text-cyan-300 truncate max-w-[110px] leading-tight">
                      {user.name}
                    </span>
                    <span className="text-[9px] text-cyan-600 font-mono flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                      {user.authProvider === 'google' ? 'Google Auth' : 'Passcode'}
                    </span>
                  </div>
                  <svg className={`w-3.5 h-3.5 text-cyan-600 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile & Authentication Dropdown */}
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-cyan-800/80 rounded-xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 animate-in fade-in zoom-in-95 duration-150 font-mono">
                    <div className="flex items-center gap-3 border-b border-cyan-900/60 pb-3 mb-3">
                      <img 
                        src={user.avatar} 
                        alt={user.name} 
                        className="w-11 h-11 rounded-full border border-cyan-500 object-cover" 
                      />
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold text-cyan-200 truncate">
                          {user.name}
                        </div>
                        <div className="text-[10px] text-cyan-600 truncate">
                          {user.email}
                        </div>
                        <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-[9px] text-cyan-400">
                          <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                          {user.authProvider === 'google' ? 'Google Verified' : 'Standard Session'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[10px] text-cyan-600 mb-3 bg-slate-950/60 p-2.5 rounded border border-cyan-950">
                      <div className="flex justify-between">
                        <span>PROVIDER:</span>
                        <span className="text-cyan-400 font-bold">{user.authProvider === 'google' ? 'Google OAuth 2.0' : 'Terminal Access'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SESSION:</span>
                        <span className="text-emerald-400">ACTIVE // ENCRYPTED</span>
                      </div>
                      {user.authenticatedAt && (
                        <div className="flex justify-between truncate">
                          <span>AUTH TIME:</span>
                          <span className="text-cyan-500">{new Date(user.authenticatedAt).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 pt-1 border-t border-cyan-900/40">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950/80 border border-cyan-900/60 hover:border-cyan-400 hover:text-cyan-200 text-cyan-400 text-xs transition-all"
                      >
                        <span>Switch Account</span>
                        <span className="text-[10px] text-cyan-600">&rarr;</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/40 hover:border-red-500 text-red-400 hover:text-red-300 text-xs transition-all"
                      >
                        <span>Sign Out (Disconnect)</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex gap-4 min-h-0 relative">
          <main className="flex-1 bg-slate-900/40 border border-cyan-900/30 rounded-lg backdrop-blur-sm relative overflow-hidden flex flex-col transition-all duration-300">
            {mode === AppMode.DASHBOARD && (
              <Dashboard onNavigate={setMode} onLog={addLog} integrationConfig={config} onAlertClick={() => {}} logs={logs} smartDevices={smartDevices} smartHomeActions={smartHomeActions} openProjector={openProjector} />
            )}
            {mode === AppMode.NOTEBOOK && (
              <NotebookView files={files} actions={fileSystemActions} onNavigate={setMode} onLog={addLog} setChatInput={setSharedChatInput} />
            )}
            {mode === AppMode.LIVE && (
              <LiveSession onLog={addLog} onStatusUpdate={setSystemStats} onError={addLog} openProjector={openProjector} integrationConfig={config} systemStats={systemStats} workspaceActions={workspaceActions} smartHomeActions={smartHomeActions} knowledgeSources={knowledgeSources} fileSystemActions={fileSystemActions} />
            )}
            {mode === AppMode.CHAT && (
              <ChatInterface 
                onLog={addLog} 
                openProjector={openProjector} 
                integrationConfig={config} 
                messages={chatHistory} 
                setMessages={setChatHistory} 
                workspaceActions={workspaceActions} 
                smartHomeActions={smartHomeActions} 
                knowledgeSources={knowledgeSources} 
                fileSystemActions={fileSystemActions} 
                files={files}
                initialInput={sharedChatInput}
                clearInitialInput={() => setSharedChatInput('')}
              />
            )}
            {mode === AppMode.FILES && (
              <FileManager files={files} actions={fileSystemActions} onClose={() => setMode(AppMode.DASHBOARD)} />
            )}
            {mode === AppMode.SETTINGS && (
               <IntegrationSettings config={config} onSave={setConfig} onClose={() => setMode(AppMode.DASHBOARD)} knowledgeSources={knowledgeSources} onUpdateKnowledgeSources={updateKnowledgeSources} smartDevices={smartDevices} onUpdateSmartDevices={saveDevices} />
            )}
            {mode === AppMode.CHESS && <ChessGame onLog={addLog} />}
          </main>
          
          <aside className={`w-72 hidden xl:flex flex-col gap-4 shrink-0 transition-all duration-300 transform ${showSidebar ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0 pointer-events-none !w-0 !gap-0 !ml-0'}`}>
            <SystemStatus stats={systemStats} />
            <div className="flex-1 bg-slate-950 border border-cyan-900/50 rounded-lg p-3 overflow-hidden flex flex-col font-mono text-xs">
              <div className="border-b border-cyan-900/50 pb-2 mb-2 text-cyan-600 font-bold tracking-wider">SYSTEM LOGS</div>
              <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-cyan-900">
                {logs.map((log, i) => <div key={i} className="text-cyan-700/80 truncate"><span className="mr-2 text-cyan-900">{'>'}</span>{log}</div>)}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default App;
