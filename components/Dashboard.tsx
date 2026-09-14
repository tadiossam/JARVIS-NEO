
import React, { useState, useEffect } from 'react';
import { AppMode, IntegrationConfig, Alert, SmartDevice, SmartHomeActions } from '../types';
import { GoogleGenAI, Modality } from "@google/genai";
import { playAudioData } from '../utils/audio';
import Hologram from './Hologram';
import SmartHomeWidget from './SmartHomeWidget';

interface DashboardProps {
  onNavigate: (mode: AppMode) => void;
  onLog: (msg: string) => void;
  integrationConfig: IntegrationConfig;
  onAlertClick: (alert: Alert) => void;
  logs: string[];
  smartDevices: SmartDevice[];
  smartHomeActions: SmartHomeActions;
  openProjector: (type: any, content: string, title?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onNavigate, 
  onLog, 
  integrationConfig, 
  onAlertClick, 
  logs,
  smartDevices,
  smartHomeActions,
  openProjector
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  
  // Manual Input State
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [manualSource, setManualSource] = useState('VITALS');
  const [manualMessage, setManualMessage] = useState('');
  const [manualSeverity, setManualSeverity] = useState<'low'|'medium'|'high'|'critical'>('high');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const injectAlert = () => {
      if (!manualMessage) return;
      const newAlert: Alert = {
          id: Date.now().toString(),
          source: manualSource,
          message: manualMessage,
          severity: manualSeverity,
          timestamp: 'NOW',
          icon: getIconForSource(manualSource)
      };
      setAlerts(prev => [newAlert, ...prev]);
      onLog(`Manual Backend Injection: ${manualSource} alert created.`);
      setManualMessage('');
      
      // Auto-vocalize critical injections
      if (manualSeverity === 'critical') {
         announceStatus([newAlert]);
      }
  };

  const getIconForSource = (source: string) => {
      switch(source) {
          case 'VITALS': return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>;
          case 'DEVELON': return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
          case 'SECURITY': return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
          default: return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      }
  };

  const announceStatus = async (targetAlerts = alerts) => {
    if (isAnnouncing || targetAlerts.length === 0) return;
    setIsAnnouncing(true);
    onLog("Generating status report vocalization...");
    
    const criticalCount = targetAlerts.filter(a => a.severity === 'critical').length;
    const topMsg = targetAlerts[0].message;
    
    const summaryText = `Attention. Backend report received. ${targetAlerts.length} active alerts. ${criticalCount > 0 ? 'Critical status confirmed.' : ''} Latest update: ${topMsg}`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: summaryText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Aoede' },
              },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        await playAudioData(base64Audio);
      }
    } catch (e: any) {
      onLog(`Announcement Error: ${e.message}`);
    } finally {
      setIsAnnouncing(false);
    }
  };

  const handleCameraClick = (id: string) => {
    const cam = smartDevices.find(d => d.id === id);
    if(cam) {
       openProjector('CAMERA_FEED', smartHomeActions.getCameraStream(id), `${cam.name} LIVE FEED`);
    }
  }

  const checkStatus = (key?: string) => key && key.length > 5;

  return (
    <div className="h-full w-full relative flex flex-col font-mono">
      
      {/* Dashboard Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-cyan-900/30 bg-slate-900/40 shrink-0">
         <div className="text-xs text-cyan-500 font-bold tracking-widest flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${alerts.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
           COMMAND DECK
         </div>
         <div className="flex gap-2">
            <button onClick={() => onNavigate(AppMode.SETTINGS)} className="p-1.5 rounded border border-cyan-800 text-cyan-600 hover:text-cyan-400 hover:border-cyan-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <button onClick={() => setIsCompact(!isCompact)} className="p-1.5 rounded border border-cyan-800 text-cyan-600 hover:border-cyan-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/></svg>
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 lg:p-6 scrollbar-thin scrollbar-thumb-cyan-900/50">
        
        {isCompact ? (
          <div className="space-y-2">
             <div className="flex items-center justify-between p-3 rounded bg-slate-900/60 border border-cyan-900/30">
                <span className="text-cyan-500 font-bold">{currentTime.toLocaleTimeString()}</span>
                <span className="text-cyan-700 text-xs">MINIMIZED</span>
             </div>
             {alerts.map(alert => (
                <button key={alert.id} onClick={() => onAlertClick(alert)} className="w-full flex items-center justify-between p-2 rounded text-xs border text-left bg-slate-900/40 border-cyan-900/20 text-cyan-400">
                   <span>[{alert.source}] {alert.message}</span>
                </button>
             ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-rows-auto gap-4">
             
            {/* Priority Alerts */}
            <div className="md:col-span-2 bg-slate-900/40 border border-red-900/30 rounded-lg p-4 relative overflow-hidden min-h-[200px]">
              <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 to-transparent pointer-events-none" />
              <div className="flex items-center justify-between mb-4 border-b border-red-900/30 pb-2">
                <h2 className="text-red-400 font-bold tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  PRIORITY ALERTS
                </h2>
                <button onClick={() => announceStatus()} disabled={isAnnouncing} className="text-[10px] border px-2 py-0.5 rounded border-red-900/50 text-red-600/80 hover:text-red-400">
                  {isAnnouncing ? "TRANSMITTING..." : "VOCALIZE REPORT"}
                </button>
              </div>
              <div className="space-y-3">
                {alerts.length === 0 && (
                    <div className="text-center text-xs text-red-900/50 py-8 italic border border-dashed border-red-900/30 rounded">
                        NO ACTIVE BACKEND SIGNALS
                    </div>
                )}
                {alerts.map(alert => (
                  <button key={alert.id} onClick={() => onAlertClick(alert)} className="w-full flex items-center justify-between p-3 rounded border bg-slate-800/50 border-cyan-900/30 text-cyan-100 text-left hover:bg-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-cyan-900/30 text-cyan-400">{alert.icon}</div>
                      <div>
                        <div className="text-xs font-bold opacity-70 mb-0.5">{alert.source}</div>
                        <div className="text-sm">{alert.message}</div>
                      </div>
                    </div>
                    <div className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold border ${
                        alert.severity === 'critical' ? 'bg-red-900/50 border-red-500 text-red-400' : 'bg-cyan-900/50 border-cyan-500 text-cyan-400'
                    }`}>
                        {alert.severity}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Home Widget */}
            <div className="md:col-span-1 row-span-2">
               <SmartHomeWidget devices={smartDevices} actions={smartHomeActions} onCameraClick={handleCameraClick} />
            </div>

            {/* Status & Clock */}
            <div className="md:col-span-1 bg-slate-900/40 border border-cyan-900/30 rounded-lg p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[150px]">
              <div className="absolute inset-0 opacity-20 pointer-events-none scale-75 blur-sm group-hover:blur-0 transition-all">
                <Hologram size="lg" />
              </div>
              <div className="text-4xl font-bold text-cyan-300 z-10">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="flex gap-2 w-full px-4 z-10 mt-4">
                <button onClick={() => onNavigate(AppMode.LIVE)} className="flex-1 py-2 bg-cyan-900/20 border border-cyan-600/50 text-cyan-400 text-xs rounded hover:bg-cyan-500 hover:text-slate-900">VOICE LINK</button>
              </div>
            </div>

            {/* Backend Manual Input System */}
            <div className="md:col-span-1 bg-slate-900/40 border border-cyan-900/30 rounded-lg p-4 flex flex-col gap-4">
              
              {/* Manual Input Console */}
              <div>
                  <div className="text-cyan-600 text-xs font-bold tracking-widest mb-3 border-b border-cyan-900/30 pb-1">
                      BACKEND MANUAL INPUT
                  </div>
                  <div className="space-y-2">
                      <div className="flex gap-2">
                          <select 
                             value={manualSource} 
                             onChange={(e) => setManualSource(e.target.value)}
                             className="bg-slate-950 border border-cyan-900 text-cyan-400 text-[10px] rounded p-1 flex-1 outline-none"
                          >
                              <option value="VITALS">VITALS</option>
                              <option value="SECURITY">SECURITY</option>
                              <option value="DEVELON">DEVELON</option>
                              <option value="SYSTEM">SYSTEM</option>
                              <option value="GMAIL">GMAIL</option>
                          </select>
                          <select 
                             value={manualSeverity} 
                             onChange={(e) => setManualSeverity(e.target.value as any)}
                             className="bg-slate-950 border border-cyan-900 text-cyan-400 text-[10px] rounded p-1 w-24 outline-none"
                          >
                              <option value="low">LOW</option>
                              <option value="medium">MEDIUM</option>
                              <option value="high">HIGH</option>
                              <option value="critical">CRITICAL</option>
                          </select>
                      </div>
                      <input 
                         type="text" 
                         value={manualMessage}
                         onChange={(e) => setManualMessage(e.target.value)}
                         placeholder="Inject Alert Message..."
                         className="w-full bg-slate-950 border border-cyan-900 text-cyan-300 text-xs p-2 rounded outline-none focus:border-cyan-500 placeholder-cyan-900"
                      />
                      <button 
                        onClick={injectAlert}
                        disabled={!manualMessage}
                        className="w-full py-1 bg-cyan-900/30 border border-cyan-700 text-cyan-400 text-[10px] rounded hover:bg-cyan-500 hover:text-slate-900 uppercase font-bold tracking-wider transition-all disabled:opacity-50"
                      >
                          INJECT SIGNAL
                      </button>
                  </div>
              </div>

              {/* Integration Access Status */}
              <div className="flex-1">
                  <div className="text-cyan-600 text-xs font-bold tracking-widest mb-3 border-b border-cyan-900/30 pb-1">
                      INTEGRATION ACCESS
                  </div>
                  <div className="space-y-2 h-32 overflow-y-auto pr-1">
                      {[
                          { name: 'Dynamics 365', status: checkStatus(integrationConfig.dynamicsToken) },
                          { name: 'DEVELON Fleet', status: checkStatus(integrationConfig.develonToken) },
                          { name: 'SIS2GO API', status: checkStatus(integrationConfig.sis2goKey) },
                          { name: 'SwitchBot', status: checkStatus(integrationConfig.switchBotToken) },
                          { name: 'Philips Hue', status: checkStatus(integrationConfig.hueBridgeIp) },
                          { name: 'OpenAI (Fallback)', status: checkStatus(integrationConfig.openAiApiKey) },
                      ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-slate-950/30 rounded border border-cyan-900/10">
                              <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${item.status ? 'bg-green-500 shadow-[0_0_5px_lime]' : 'bg-red-500'}`}></div>
                                  <span className="text-[10px] text-cyan-400">{item.name}</span>
                              </div>
                              {!item.status && (
                                  <button onClick={() => onNavigate(AppMode.SETTINGS)} className="text-[8px] bg-red-900/20 text-red-400 border border-red-900/50 px-2 py-0.5 rounded hover:bg-red-500 hover:text-white transition-colors">
                                      GRANT ACCESS
                                  </button>
                              )}
                              {item.status && <span className="text-[8px] text-green-500 font-mono">ACTIVE</span>}
                          </div>
                      ))}
                  </div>
              </div>

            </div>

          </div>
        )}
        
        {/* Logs Toggle */}
        <div className="mt-4 border border-cyan-900/30 rounded bg-slate-900/40 overflow-hidden shrink-0">
            <button onClick={() => setShowLogs(!showLogs)} className="w-full flex items-center justify-between p-2 text-xs font-bold text-cyan-600 bg-slate-900/50 hover:bg-cyan-900/20">
                <span>SYSTEM LOGS</span>
                <span>{showLogs ? '[-]' : '[+]'}</span>
            </button>
            {showLogs && (
                <div className="h-40 overflow-y-auto p-2 font-mono text-[10px] space-y-1 bg-slate-950/80">
                    {logs.map((log, i) => <div key={i} className="text-cyan-700/80 truncate"><span className="mr-2 text-cyan-900">{'>'}</span>{log}</div>)}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
