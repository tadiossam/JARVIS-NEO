
import React, { useState, useEffect } from 'react';
import { IntegrationConfig, KnowledgeSource, SmartDevice, User } from '../types';
import { getGoogleClientId, setGoogleClientId, signOutGoogle } from '../utils/googleAuth';
import { executeTieredGeminiRequest, DEFAULT_MODEL_TIERS, getFailoverTelemetry } from '../utils/geminiClient';

interface IntegrationSettingsProps {
  config: IntegrationConfig;
  onSave: (newConfig: IntegrationConfig) => void;
  onClose: () => void;
  knowledgeSources?: KnowledgeSource[];
  onUpdateKnowledgeSources?: (sources: KnowledgeSource[]) => void;
  smartDevices?: SmartDevice[];
  onUpdateSmartDevices?: (devices: SmartDevice[]) => void;
}

const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({ config, onSave, onClose, knowledgeSources = [], onUpdateKnowledgeSources, smartDevices = [], onUpdateSmartDevices }) => {
  const [formData, setFormData] = useState<IntegrationConfig>(config);
  const [activeTab, setActiveTab] = useState<'network' | 'knowledge' | 'smarthome' | 'user' | 'failover'>('failover');
  
  // Failover Diagnostic State
  const [isTestingFailover, setIsTestingFailover] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState(getFailoverTelemetry());

  const runFailoverProbe = async () => {
    setIsTestingFailover(true);
    setTestLogs([]);
    setTestResponse(null);
    const logs: string[] = [];
    const addLog = (msg: string) => {
      logs.push(msg);
      setTestLogs([...logs]);
    };

    addLog("Initiating Tiered Failover Diagnostic Request...");
    try {
      const res = await executeTieredGeminiRequest({
        contents: "Respond in 1 concise sentence acknowledging status of the J.A.R.V.I.S. neural core.",
        onLog: (msg) => addLog(msg),
        onTierChange: (from, to, reason, tierIdx) => {
          addLog(`[ALERT] Failover from ${from} to Tier ${tierIdx + 1} (${to}): ${reason}`);
        }
      });
      setTestResponse(`[${res.modelUsed}] ${res.text}`);
      setTelemetry(getFailoverTelemetry());
      addLog(`[SUCCESS] Request successfully resolved by ${res.modelUsed} (Fallback used: ${res.isFallback ? 'YES' : 'NO'})`);
    } catch (e: any) {
      addLog(`[CRITICAL FAILURE] All tiers failed: ${e.message}`);
    } finally {
      setIsTestingFailover(false);
    }
  };
  
  // Knowledge Base State
  const [localSources, setLocalSources] = useState<KnowledgeSource[]>(knowledgeSources);
  const [currentSource, setCurrentSource] = useState<Partial<KnowledgeSource>>({});
  const [isEditingSource, setIsEditingSource] = useState(false);

  // Smart Device State
  const [localDevices, setLocalDevices] = useState<SmartDevice[]>(smartDevices);
  const [currentDevice, setCurrentDevice] = useState<Partial<SmartDevice>>({});
  const [isEditingDevice, setIsEditingDevice] = useState(false);

  // Google Auth & User State
  const [googleClientId, setGoogleClientIdState] = useState(() => getGoogleClientId());
  const [googleClientIdSaved, setGoogleClientIdSaved] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const s = localStorage.getItem('jarvis_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const handleChange = (key: keyof IntegrationConfig, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveGoogleClientId = () => {
    setGoogleClientId(googleClientId);
    setGoogleClientIdSaved(true);
    setTimeout(() => setGoogleClientIdSaved(false), 2500);
  };

  const handleSave = () => {
    onSave(formData);
    if (onUpdateKnowledgeSources) onUpdateKnowledgeSources(localSources);
    if (onUpdateSmartDevices) onUpdateSmartDevices(localDevices);
    onClose();
  };

  // --- SOURCE HANDLERS ---
  const addSource = () => {
      if (!currentSource.name || !currentSource.endpoint) return;
      const newSource: KnowledgeSource = {
          id: currentSource.id || Date.now().toString(),
          name: currentSource.name,
          endpoint: currentSource.endpoint,
          description: currentSource.description || 'Custom Knowledge Source',
          authKey: currentSource.authKey,
          method: 'GET'
      };
      if (currentSource.id) setLocalSources(prev => prev.map(s => s.id === currentSource.id ? newSource : s));
      else setLocalSources(prev => [...prev, newSource]);
      setIsEditingSource(false);
      setCurrentSource({});
  };

  const deleteSource = (id: string) => setLocalSources(prev => prev.filter(s => s.id !== id));

  // --- DEVICE HANDLERS ---
  const addDevice = () => {
      if (!currentDevice.name) return;
      const newDevice: SmartDevice = {
          id: currentDevice.id || `dev-${Date.now()}`,
          name: currentDevice.name,
          type: currentDevice.type || 'SWITCH',
          brand: 'CUSTOM_API',
          status: 'off',
          controlUrl: currentDevice.controlUrl,
          method: currentDevice.method || 'POST',
          payloadTemplate: currentDevice.payloadTemplate,
          authHeader: currentDevice.authHeader
      };
      if (currentDevice.id) setLocalDevices(prev => prev.map(d => d.id === currentDevice.id ? newDevice : d));
      else setLocalDevices(prev => [...prev, newDevice]);
      setIsEditingDevice(false);
      setCurrentDevice({});
  };

  const deleteDevice = (id: string) => setLocalDevices(prev => prev.filter(d => d.id !== id));

  return (
    <div className="h-full w-full bg-slate-900/90 p-6 flex flex-col font-mono relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

      <div className="flex justify-between items-center mb-6 border-b border-cyan-900/50 pb-4 z-10">
        <div>
           <h2 className="text-2xl text-cyan-400 font-bold tracking-widest uppercase">System Integration</h2>
           <p className="text-cyan-700 text-xs">MANUAL BACKEND CONFIGURATION CONSOLE</p>
        </div>
        <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs border border-cyan-800 text-cyan-600 hover:text-cyan-400 hover:border-cyan-500 rounded uppercase">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 text-xs bg-cyan-900/30 border border-cyan-500 text-cyan-300 hover:bg-cyan-500 hover:text-slate-900 rounded uppercase tracking-wider transition-all">Save Config</button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 z-10 overflow-x-auto">
        {[
          { id: 'failover', label: 'Tiered Failover' },
          { id: 'knowledge', label: 'Knowledge' },
          { id: 'smarthome', label: 'Smart Home' },
          { id: 'network', label: 'Network' },
          { id: 'user', label: 'Identity / Wallpaper' }
        ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`flex-1 min-w-[120px] py-2 text-xs uppercase border-b-2 transition-all font-mono tracking-wider ${
                activeTab === tab.id 
                  ? 'border-cyan-400 text-cyan-200 bg-cyan-950/40 font-bold shadow-[0_4px_12px_rgba(6,182,212,0.15)]' 
                  : 'border-cyan-900/40 text-cyan-600 hover:text-cyan-400 hover:border-cyan-700'
              }`}
            >
              {tab.label}
            </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 z-10 pr-2 scrollbar-thin scrollbar-thumb-cyan-900">
        
        {/* TIERED FAILOVER & SAFEGUARD TAB */}
        {activeTab === 'failover' && (
          <div className="space-y-5 h-full flex flex-col">
            {/* Requirement Directive Banner */}
            <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-lg p-3 text-xs text-cyan-300 font-mono shadow-[0_0_20px_rgba(6,182,212,0.1)]">
              <div className="flex items-center gap-2 mb-1 text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Automated Failover Architecture</span>
              </div>
              <p className="text-[11px] text-cyan-500 leading-relaxed">
                "Attempts to use our primary, higher tier model first. If it encounters rate limits or errors, cycles through a prioritized list of alternative tiers before falling back to Gemini 1.5 Flash as a final safeguard, ensuring uninterrupted service."
              </p>
            </div>

            {/* Real-time Telemetry Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-950 border border-cyan-900/60 rounded-lg text-center">
                <div className="text-[10px] text-cyan-600 uppercase font-bold">Total Requests</div>
                <div className="text-xl text-cyan-300 font-bold mt-0.5">{telemetry.totalRequests}</div>
                <div className="text-[9px] text-cyan-700 mt-0.5">Dispatched</div>
              </div>
              <div className="p-3 bg-slate-950 border border-emerald-900/40 rounded-lg text-center">
                <div className="text-[10px] text-emerald-600 uppercase font-bold">Primary Success</div>
                <div className="text-xl text-emerald-400 font-bold mt-0.5">{telemetry.primarySuccesses}</div>
                <div className="text-[9px] text-emerald-700 mt-0.5">Tier 1 Resolved</div>
              </div>
              <div className="p-3 bg-slate-950 border border-amber-900/40 rounded-lg text-center">
                <div className="text-[10px] text-amber-500 uppercase font-bold">Failovers Triggered</div>
                <div className="text-xl text-amber-400 font-bold mt-0.5">{telemetry.fallbacksTriggered}</div>
                <div className="text-[9px] text-amber-600 mt-0.5">Adaptive Shifts</div>
              </div>
              <div className="p-3 bg-slate-950 border border-cyan-800/60 rounded-lg text-center">
                <div className="text-[10px] text-cyan-500 uppercase font-bold">Final Safeguard</div>
                <div className="text-xl text-cyan-300 font-bold mt-0.5">{telemetry.finalSafeguardActivations}</div>
                <div className="text-[9px] text-cyan-600 mt-0.5">1.5 Flash Armed</div>
              </div>
            </div>

            {/* Model Tiering Hierarchy */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-cyan-400 font-bold uppercase tracking-wider">
                <span>Prioritized Model Tiering Pipeline</span>
                <span className="text-[10px] text-cyan-600 font-normal">5 TIERS REGISTERED</span>
              </div>
              <div className="space-y-2">
                {[
                  {
                    tier: 'TIER 1 (PRIMARY)',
                    model: 'gemini-3.1-pro-preview',
                    role: 'Flagship Complex Reasoning & Synthesis',
                    desc: 'Prioritized first for all queries, deep synthesis, code orchestration, and document analysis.',
                    badge: 'PRIMARY HIGH-TIER',
                    badgeColor: 'border-cyan-400 text-cyan-300 bg-cyan-950/60'
                  },
                  {
                    tier: 'TIER 2 (ALTERNATIVE)',
                    model: 'gemini-3.8-flash',
                    role: 'High-Performance Reasoning',
                    desc: 'First recovery target if Tier 1 encounters 429 rate limits or server overload.',
                    badge: 'PERFORMANCE',
                    badgeColor: 'border-blue-500 text-blue-300 bg-blue-950/50'
                  },
                  {
                    tier: 'TIER 3 (ALTERNATIVE)',
                    model: 'gemini-3.1-flash-lite',
                    role: 'High-Throughput Lightweight',
                    desc: 'Extremely high request capacity for rapid failover continuity.',
                    badge: 'THROUGHPUT',
                    badgeColor: 'border-indigo-500 text-indigo-300 bg-indigo-950/50'
                  },
                  {
                    tier: 'TIER 4 (ALTERNATIVE)',
                    model: 'gemini-flash-latest',
                    role: 'Adaptive General Intelligence',
                    desc: 'Stable production-tested fallback before invoking terminal safeguards.',
                    badge: 'RESILIENT',
                    badgeColor: 'border-purple-500 text-purple-300 bg-purple-950/50'
                  },
                  {
                    tier: 'TIER 5 (FINAL SAFEGUARD)',
                    model: 'gemini-1.5-flash',
                    role: 'Terminal Service Safeguard',
                    desc: 'Ultra-reliable foundational safeguard guaranteeing zero downtime and uninterrupted service.',
                    badge: 'FINAL SAFEGUARD',
                    badgeColor: 'border-emerald-500 text-emerald-300 bg-emerald-950/60'
                  }
                ].map((item, idx) => (
                  <div key={item.model} className="p-3 rounded-lg border border-cyan-900/40 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:border-cyan-700/60 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-cyan-600 font-bold">{item.tier}</span>
                        <span className="text-xs font-bold text-cyan-200">{item.model}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-cyan-400">{item.role}</div>
                      <div className="text-[10px] text-cyan-700 leading-relaxed">{item.desc}</div>
                    </div>
                    <div className="shrink-0 flex sm:flex-col items-center justify-end gap-1">
                      <span className="text-[9px] text-cyan-600 font-mono">Priority #{idx + 1}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Live Failover Diagnostic Tester */}
            <div className="p-4 rounded-lg border border-cyan-800/60 bg-slate-950 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Live Failover Diagnostic Probe</h4>
                  <p className="text-[10px] text-cyan-600">Simulates real request processing through the full prioritized tiered loop.</p>
                </div>
                <button
                  onClick={runFailoverProbe}
                  disabled={isTestingFailover}
                  className="px-4 py-2 text-xs bg-cyan-950/80 border border-cyan-400 text-cyan-200 hover:bg-cyan-500 hover:text-slate-950 disabled:opacity-50 rounded uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-2 shrink-0"
                >
                  {isTestingFailover ? (
                    <>
                      <span className="animate-spin h-3 w-3 border-2 border-cyan-400 border-t-transparent rounded-full" />
                      Cycling Tiers...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Execute Diagnostic Probe
                    </>
                  )}
                </button>
              </div>

              {testLogs.length > 0 && (
                <div className="p-3 bg-black/60 rounded border border-cyan-900/50 space-y-1 font-mono text-[10px] max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-900">
                  <div className="text-cyan-500 font-bold border-b border-cyan-900/40 pb-1 mb-1">PROBE TELEMETRY STREAM:</div>
                  {testLogs.map((log, i) => (
                    <div key={i} className={`leading-relaxed ${
                      log.includes('[SUCCESS]') ? 'text-emerald-400 font-bold' :
                      log.includes('[ALERT]') ? 'text-amber-400' :
                      log.includes('[CRITICAL') ? 'text-red-400 font-bold' : 'text-cyan-400/80'
                    }`}>
                      {log}
                    </div>
                  ))}
                  {testResponse && (
                    <div className="mt-2 pt-2 border-t border-cyan-800/40 text-cyan-200">
                      <span className="text-cyan-500 font-bold">PAYLOAD RESPONSE:</span> {testResponse}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* KNOWLEDGE BASE TAB */}
        {activeTab === 'knowledge' && (
            <div className="space-y-4 h-full flex flex-col">
                <div className="bg-blue-900/10 border border-blue-900/50 p-2 text-[10px] text-blue-300 mb-2 rounded">
                    Add multiple knowledge endpoints (Wikis, Portals, APIs). J.A.R.V.I.S. will check these sources during queries.
                </div>
                {isEditingSource ? (
                    <div className="p-4 border border-cyan-500 rounded bg-slate-900">
                        <h3 className="text-cyan-400 text-sm font-bold mb-4">{currentSource.id ? 'EDIT SOURCE' : 'ADD NEW SOURCE'}</h3>
                        <div className="space-y-3">
                            <input type="text" placeholder="Name (e.g. Finance Wiki)" value={currentSource.name || ''} onChange={e => setCurrentSource(prev => ({...prev, name: e.target.value}))} className="w-full bg-slate-950 border border-cyan-800 p-2 rounded text-cyan-300 text-xs" />
                            <input type="text" placeholder="Description" value={currentSource.description || ''} onChange={e => setCurrentSource(prev => ({...prev, description: e.target.value}))} className="w-full bg-slate-950 border border-cyan-800 p-2 rounded text-cyan-300 text-xs" />
                            <input type="text" placeholder="Endpoint URL" value={currentSource.endpoint || ''} onChange={e => setCurrentSource(prev => ({...prev, endpoint: e.target.value}))} className="w-full bg-slate-950 border border-cyan-800 p-2 rounded text-cyan-300 text-xs" />
                            <input type="password" placeholder="Auth Key (Optional)" value={currentSource.authKey || ''} onChange={e => setCurrentSource(prev => ({...prev, authKey: e.target.value}))} className="w-full bg-slate-950 border border-cyan-800 p-2 rounded text-cyan-300 text-xs" />
                            <div className="flex gap-2 justify-end mt-4">
                                <button onClick={() => { setIsEditingSource(false); setCurrentSource({}); }} className="px-3 py-1 text-xs text-red-400 border border-red-900/50 rounded">CANCEL</button>
                                <button onClick={addSource} className="px-3 py-1 text-xs text-cyan-900 bg-cyan-500 font-bold rounded">CONFIRM</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <button onClick={() => setIsEditingSource(true)} className="w-full py-3 border-2 border-dashed border-cyan-900/50 text-cyan-700 rounded hover:border-cyan-500 hover:text-cyan-500 mb-4 transition-all">+ CONNECT NEW DATA SOURCE</button>
                        {localSources.map(source => (
                            <div key={source.id} className="p-3 bg-slate-950/50 border border-cyan-900/30 rounded flex justify-between items-center">
                                <div><div className="text-sm font-bold text-cyan-300">{source.name}</div><div className="text-[10px] text-cyan-700 truncate">{source.endpoint}</div></div>
                                <div className="flex gap-2"><button onClick={() => { setCurrentSource(source); setIsEditingSource(true); }} className="text-xs text-cyan-500">EDIT</button><button onClick={() => deleteSource(source.id)} className="text-xs text-red-500">REMOVE</button></div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        )}

        {/* SMART HOME / GOOGLE HOME API TAB */}
        {activeTab === 'smarthome' && (
            <div className="space-y-4 h-full flex flex-col">
                <div className="bg-yellow-900/10 border border-yellow-900/50 p-2 text-[10px] text-yellow-500 mb-2 rounded">
                    REAL INTEGRATION: Add Webhooks (Home Assistant / Node-RED / Bridge APIs) to control physical devices without a cloud backend.
                </div>
                {isEditingDevice ? (
                    <div className="p-4 border border-cyan-500 rounded bg-slate-900">
                        <h3 className="text-cyan-400 text-sm font-bold mb-4">{currentDevice.id ? 'EDIT DEVICE' : 'ADD NEW DEVICE'}</h3>
                        <div className="space-y-3">
                            <input type="text" placeholder="Device Name (e.g. Office Light)" value={currentDevice.name || ''} onChange={e => setCurrentDevice(prev => ({...prev, name: e.target.value}))} className="w-full bg-slate-950 border border-cyan-800 p-2 rounded text-cyan-300 text-xs" />
                            <select value={currentDevice.type} onChange={e => setCurrentDevice(prev => ({...prev, type: e.target.value as any}))} className="w-full bg-slate-950 border border-cyan-800 p-2 rounded text-cyan-300 text-xs">
                                <option value="LIGHT">LIGHT</option><option value="SWITCH">SWITCH</option><option value="THERMOSTAT">THERMOSTAT</option><option value="LOCK">LOCK</option>
                            </select>
                            <input type="text" placeholder="API Endpoint URL (Webhook)" value={currentDevice.controlUrl || ''} onChange={e => setCurrentDevice(prev => ({...prev, controlUrl: e.target.value}))} className="w-full bg-slate-950 border border-cyan-800 p-2 rounded text-cyan-300 text-xs" />
                            <select value={currentDevice.method} onChange={e => setCurrentDevice(prev => ({...prev, method: e.target.value as any}))} className="w-full bg-slate-950 border border-cyan-800 p-2 rounded text-cyan-300 text-xs">
                                <option value="POST">POST</option><option value="GET">GET</option><option value="PUT">PUT</option>
                            </select>
                            <input type="text" placeholder='Body Template (e.g. {"entity_id": "light.office", "state": "{state}"})' value={currentDevice.payloadTemplate || ''} onChange={e => setCurrentDevice(prev => ({...prev, payloadTemplate: e.target.value}))} className="w-full bg-slate-950 border border-cyan-800 p-2 rounded text-cyan-300 text-xs" />
                            <input type="text" placeholder="Auth Header (e.g. Bearer xyz)" value={currentDevice.authHeader || ''} onChange={e => setCurrentDevice(prev => ({...prev, authHeader: e.target.value}))} className="w-full bg-slate-950 border border-cyan-800 p-2 rounded text-cyan-300 text-xs" />
                            <div className="flex gap-2 justify-end mt-4">
                                <button onClick={() => { setIsEditingDevice(false); setCurrentDevice({}); }} className="px-3 py-1 text-xs text-red-400 border border-red-900/50 rounded">CANCEL</button>
                                <button onClick={addDevice} className="px-3 py-1 text-xs text-cyan-900 bg-cyan-500 font-bold rounded">CONFIRM</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <button onClick={() => setIsEditingDevice(true)} className="w-full py-3 border-2 border-dashed border-cyan-900/50 text-cyan-700 rounded hover:border-cyan-500 hover:text-cyan-500 mb-4 transition-all">+ CONNECT REAL DEVICE (WEBHOOK)</button>
                        {localDevices.filter(d => d.brand === 'CUSTOM_API').map(dev => (
                            <div key={dev.id} className="p-3 bg-slate-950/50 border border-cyan-900/30 rounded flex justify-between items-center">
                                <div><div className="text-sm font-bold text-cyan-300">{dev.name}</div><div className="text-[10px] text-cyan-700 truncate">{dev.controlUrl}</div></div>
                                <div className="flex gap-2"><button onClick={() => { setCurrentDevice(dev); setIsEditingDevice(true); }} className="text-xs text-cyan-500">EDIT</button><button onClick={() => deleteDevice(dev.id)} className="text-xs text-red-500">REMOVE</button></div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        )}

        {/* NETWORK TAB */}
        {activeTab === 'network' && (
            <div className="p-4 border border-cyan-900/30 rounded bg-slate-950/50">
                 <h3 className="text-cyan-400 text-sm font-bold mb-3 border-b border-cyan-900/30 pb-1">NETWORK INFRASTRUCTURE</h3>
                 <p className="text-[10px] text-cyan-700 mb-4">Monitor real-time connection stats via the main dashboard. Add controllers here for specific API integration.</p>
                 <div className="space-y-2">
                     <label className="text-[10px] text-cyan-600 uppercase">Controller URL</label>
                     <input type="text" value={formData.unifiControllerUrl} onChange={(e) => handleChange('unifiControllerUrl', e.target.value)} className="w-full bg-slate-900 border border-cyan-800 text-cyan-300 p-2 rounded text-xs" />
                 </div>
            </div>
        )}

        {/* GOOGLE & USER AUTHENTICATION TAB */}
        {activeTab === 'user' && (
            <div className="space-y-4">
              <div className="p-4 border border-cyan-900/30 rounded-lg bg-slate-950/50 space-y-4">
                <div className="flex items-center justify-between border-b border-cyan-900/40 pb-3">
                  <div>
                    <h3 className="text-cyan-400 text-sm font-bold tracking-wider">GOOGLE AUTHENTICATION & IDENTITY</h3>
                    <p className="text-[10px] text-cyan-700">OAuth 2.0 Identity Federation & Profile Management</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-400 text-[10px] flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    GOOGLE GSI CONNECTED
                  </span>
                </div>

                {/* Active User Card */}
                {currentUser && (
                  <div className="p-3 bg-slate-900/80 border border-cyan-800/60 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img 
                          src={currentUser.avatar} 
                          alt={currentUser.name} 
                          className="w-10 h-10 rounded-full border border-cyan-500 object-cover" 
                        />
                        {currentUser.authProvider === 'google' && (
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
                      <div>
                        <div className="text-xs font-bold text-cyan-200">{currentUser.name}</div>
                        <div className="text-[10px] text-cyan-500 font-mono">{currentUser.email}</div>
                        <div className="text-[9px] text-emerald-400 mt-0.5">
                          {currentUser.authProvider === 'google' ? '✓ Google OAuth 2.0 Authenticated' : 'Terminal Access Session'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        signOutGoogle();
                        window.location.reload();
                      }}
                      className="px-3 py-1.5 rounded border border-red-900/60 bg-red-950/30 text-red-400 hover:border-red-500 text-xs transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}

                {/* Google Client ID Field */}
                <div className="space-y-2 pt-2 border-t border-cyan-900/40">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-cyan-400 font-bold uppercase">
                      Google OAuth 2.0 Web Client ID
                    </label>
                    {googleClientIdSaved && (
                      <span className="text-[10px] text-emerald-400 font-bold animate-pulse">
                        ✓ CLIENT ID SAVED
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com" 
                      value={googleClientId} 
                      onChange={(e) => setGoogleClientIdState(e.target.value)} 
                      className="flex-1 bg-slate-900 border border-cyan-800 text-cyan-300 p-2 rounded text-xs outline-none focus:border-cyan-400 font-mono" 
                    />
                    <button
                      type="button"
                      onClick={handleSaveGoogleClientId}
                      className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors"
                    >
                      Save ID
                    </button>
                  </div>
                  <p className="text-[10px] text-cyan-700">
                    Configured Client ID enables production Google One Tap and federated token exchange.
                  </p>
                </div>

                {/* Authorized Origin Details */}
                <div className="bg-slate-900/50 p-3 rounded border border-cyan-950 space-y-1 text-[10px] text-cyan-600 font-mono">
                  <div className="text-cyan-400 font-bold">OAUTH DEPLOYMENT INFORMATION:</div>
                  <div className="flex justify-between">
                    <span>Authorized Origin:</span>
                    <span className="text-cyan-300">{window.location.origin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Scopes:</span>
                    <span className="text-cyan-300">userinfo.profile, userinfo.email</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Registered Gmail User:</span>
                    <span className="text-cyan-300">{formData.gmailUser || 'tafesetadios@gmail.com'}</span>
                  </div>
                </div>

                {/* System Wallpaper & Ambience Preview */}
                <div className="space-y-3 pt-2 border-t border-cyan-900/40">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-cyan-400 font-bold uppercase">
                      Universal Landing Page Wallpaper
                    </label>
                    <span className="text-[10px] text-cyan-500 font-mono">
                      ACTIVE: /jarvis-wallpaper.jpg
                    </span>
                  </div>

                  <div className="relative rounded-lg overflow-hidden border border-cyan-800/60 bg-slate-950 p-3 flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0 relative group">
                      <img 
                        src="/jarvis-wallpaper.jpg" 
                        alt="J.A.R.V.I.S. Sci-Fi Hologram Wallpaper" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none" />
                    </div>
                    <div className="space-y-1 text-xs font-mono flex-1">
                      <div className="text-cyan-300 font-bold">Holographic Neural Persona</div>
                      <p className="text-[11px] text-cyan-600 leading-relaxed">
                        Displayed as the backdrop across all landing pages: Secure Access Gateway, Command Deck, Voice Link room, and system shell.
                      </p>
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-[10px] text-cyan-500">Opacity Presets:</span>
                        {[
                          { label: 'Subtle (20%)', val: 0.2 },
                          { label: 'Standard (35%)', val: 0.35 },
                          { label: 'Vivid (55%)', val: 0.55 },
                          { label: 'High (75%)', val: 0.75 }
                        ].map(preset => (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => {
                              localStorage.setItem('jarvis_wallpaper_opacity', preset.val.toString());
                              window.dispatchEvent(new Event('storage'));
                              window.location.reload();
                            }}
                            className="px-2 py-0.5 rounded border border-cyan-900 bg-cyan-950/40 text-[10px] text-cyan-400 hover:border-cyan-400 hover:text-cyan-200"
                          >
                            {preset.label.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationSettings;
