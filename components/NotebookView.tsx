
import React, { useState, useRef } from 'react';
import { ProjectFile, FileSystemActions, AppMode } from '../types';
import { Modality } from "@google/genai";
import { playAudioData } from '../utils/audio';
import { executeTieredGeminiRequest, TTS_MODEL_TIERS } from '../utils/geminiClient';
import Hologram from './Hologram';

interface NotebookViewProps {
  files: ProjectFile[];
  actions: FileSystemActions;
  onNavigate: (mode: AppMode) => void;
  onLog: (msg: string) => void;
  setChatInput?: (val: string) => void;
}

const NotebookView: React.FC<NotebookViewProps> = ({ files, actions, onNavigate, onLog, setChatInput }) => {
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [isGeneratingDeepDive, setIsGeneratingDeepDive] = useState(false);
  const [briefing, setBriefing] = useState<{ summary: string; themes: string[]; questions: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sources = files.filter(f => f.type === 'source' || f.tags.includes('knowledge') || f.tags.includes('notebook'));

  const toggleSource = (id: string) => {
    setSelectedSourceIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onLog(`Ingesting source: ${file.name}...`);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const id = await actions.createFile(file.name, content, 'source', ['notebook', 'ingested']);
      setSelectedSourceIds(prev => [...prev, id]);
      onLog(`Source ${file.name} successfully indexed.`);
    };
    reader.readAsText(file);
  };

  const getActiveContext = () => {
    return files
      .filter(f => selectedSourceIds.includes(f.id))
      .map(f => `DOCUMENT: ${f.name}\nCONTENT: ${f.content}`)
      .join('\n\n---\n\n');
  };

  const generateBriefing = async () => {
    if (selectedSourceIds.length === 0) {
      onLog("Warning: No sources selected for synthesis.");
      return;
    }
    setIsGeneratingBriefing(true);
    onLog("Synthesizing multi-source intelligence...");
    
    try {
      const context = getActiveContext();
      
      const failoverResult = await executeTieredGeminiRequest({
        contents: `Analyze the following document corpus and generate a structured JSON briefing.
        
        CORPUS:
        ${context}

        JSON Structure Required:
        {
          "summary": "Detailed overall summary",
          "themes": ["Key Theme 1", "Key Theme 2"],
          "questions": ["Probing question based on content", "Another specific question"]
        }
        
        Return ONLY valid JSON.`,
        config: {
            responseMimeType: "application/json"
        },
        onLog: (msg) => onLog(`[Briefing Synthesis] ${msg}`)
      });

      const data = JSON.parse(failoverResult.text || '{}');
      setBriefing(data);
      onLog(`Neural Briefing finalized using ${failoverResult.modelUsed}.`);
    } catch (e: any) {
      onLog(`Synthesis Error: ${e.message}`);
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  const generateDeepDive = async () => {
    if (selectedSourceIds.length === 0) return;
    setIsGeneratingDeepDive(true);
    onLog("Generating deep-dive audio script...");
    
    try {
      const context = getActiveContext();
      
      // We use our primary higher-tier model first with failover fallback
      const scriptResponse = await executeTieredGeminiRequest({
        contents: `Create a professional podcast-style deep dive conversation between 'Kore' (Host) and 'Puck' (Researcher) discussing this corpus. 
        Kore should be curious and facilitate the flow. Puck should explain the core technical or conceptual breakthroughs.
        Format: "Kore: [speech]" and "Puck: [speech]".
        
        CORPUS:
        ${context}`,
        onLog: (msg) => onLog(`[DeepDive Script] ${msg}`)
      });
      
      const script = scriptResponse.text;
      if (!script) throw new Error("Script generation failed.");

      onLog(`Encoding audio packets (Script built via ${scriptResponse.modelUsed})...`);

      const audioResponse = await executeTieredGeminiRequest({
        contents: [{ parts: [{ text: `TTS this transcript with realistic pacing:\n${script}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                { speaker: 'Kore', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                { speaker: 'Puck', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
              ]
            }
          }
        },
        prioritizedTiers: TTS_MODEL_TIERS,
        onLog: (msg) => onLog(`[DeepDive Audio] ${msg}`)
      });

      const base64Audio = audioResponse.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        onLog("Deep Dive transmission active.");
        await playAudioData(base64Audio);
      }
    } catch (e: any) {
      onLog(`Audio Synthesis Error: ${e.message}`);
    } finally {
      setIsGeneratingDeepDive(false);
    }
  };

  const askSuggestedQuestion = (question: string) => {
      if (setChatInput) setChatInput(question);
      onNavigate(AppMode.CHAT);
  };

  return (
    <div className="flex h-full w-full bg-slate-950 font-mono text-cyan-400 overflow-hidden">
      {/* Source Sidebar */}
      <div className="w-80 border-r border-cyan-900/50 flex flex-col bg-slate-900/30">
        <div className="p-4 border-b border-cyan-900/50 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-xs font-bold tracking-widest text-cyan-600">SOURCE REPOSITORY</h2>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="text-[10px] bg-cyan-900/30 border border-cyan-700 px-2 py-1 rounded text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 transition-all"
          >
            ADD SOURCE
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload}
            accept=".txt,.md,.pdf,.json"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-cyan-900">
          {sources.map(s => (
            <div 
              key={s.id}
              className={`group p-3 rounded border transition-all relative ${selectedSourceIds.includes(s.id) ? 'bg-cyan-900/40 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'bg-slate-900/50 border-cyan-900/30 opacity-60 hover:opacity-100'}`}
            >
              <div 
                className="cursor-pointer pr-6" 
                onClick={() => toggleSource(s.id)}
              >
                <div className="text-[11px] font-bold truncate text-cyan-100">{s.name}</div>
                <div className="text-[8px] opacity-50 mt-1 flex justify-between uppercase">
                    <span>{s.type}</span>
                    <span>{s.content.length} bytes</span>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); actions.deleteFile(s.id); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-red-900 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
          {sources.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
                <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p className="text-[10px] uppercase font-bold tracking-widest">No Intelligence Uploaded</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Synthesis Area */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto relative bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900/40 via-transparent to-transparent">
        <div className="max-w-4xl mx-auto w-full space-y-8">
          <header className="flex justify-between items-center border-b border-cyan-900/30 pb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-[0.3em] text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)] uppercase">Research Hub</h1>
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-1.5 h-1.5 rounded-full ${selectedSourceIds.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`}></div>
                <p className="text-[10px] text-cyan-700 uppercase tracking-widest font-bold">
                    Contextual Focus: {selectedSourceIds.length} {selectedSourceIds.length === 1 ? 'Source' : 'Sources'} Active
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={generateDeepDive}
                disabled={isGeneratingDeepDive || selectedSourceIds.length === 0}
                className="flex flex-col items-center gap-1 group disabled:opacity-30"
              >
                <div className={`w-10 h-10 rounded border border-cyan-500/50 flex items-center justify-center transition-all ${isGeneratingDeepDive ? 'animate-pulse bg-cyan-500/20' : 'group-hover:bg-cyan-500/10 group-hover:border-cyan-400'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </div>
                <span className="text-[8px] uppercase font-bold tracking-tighter opacity-70">Deep Dive</span>
              </button>
              <button 
                onClick={generateBriefing}
                disabled={isGeneratingBriefing || selectedSourceIds.length === 0}
                className="flex flex-col items-center gap-1 group disabled:opacity-30"
              >
                <div className={`w-10 h-10 rounded border border-cyan-500/50 flex items-center justify-center transition-all ${isGeneratingBriefing ? 'animate-pulse bg-cyan-500/20' : 'group-hover:bg-cyan-500/10 group-hover:border-cyan-400'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span className="text-[8px] uppercase font-bold tracking-tighter opacity-70">Briefing</span>
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-8">
            {isGeneratingBriefing && (
              <div className="p-12 border border-cyan-900/30 rounded-lg flex flex-col items-center gap-6 bg-slate-900/20 backdrop-blur-sm">
                <Hologram size="md" />
                <div className="text-sm font-bold tracking-[0.2em] animate-pulse text-cyan-500">SYNTHESIZING DOCUMENT INTELLIGENCE...</div>
              </div>
            )}

            {briefing && !isGeneratingBriefing && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                
                {/* Executive Summary */}
                <section className="bg-slate-900/60 border border-cyan-900/30 rounded-xl p-8 shadow-2xl relative">
                  <div className="absolute top-0 right-0 p-3 flex gap-2">
                      <button onClick={() => { actions.createFile(`Briefing_${Date.now()}.txt`, briefing.summary, 'text', ['notebook', 'briefing']); onLog("Insight pinned."); }} className="text-[9px] text-cyan-600 hover:text-cyan-300 font-bold uppercase">Pin Note</button>
                  </div>
                  <h3 className="text-sm font-bold text-cyan-500 tracking-widest uppercase mb-4 border-b border-cyan-900/30 pb-2">Cognitive Summary</h3>
                  <div className="text-cyan-100 text-sm leading-relaxed whitespace-pre-wrap">
                    {briefing.summary}
                  </div>
                </section>

                {/* Key Themes & Suggested Inquiries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section className="bg-slate-900/40 border border-cyan-900/30 rounded-xl p-6">
                        <h3 className="text-[10px] font-bold text-cyan-700 tracking-widest uppercase mb-4">Thematic Analysis</h3>
                        <div className="space-y-3">
                            {briefing.themes.map((theme, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="w-1 h-1 bg-cyan-500 rounded-full mt-1.5 shadow-[0_0_5px_cyan]"></div>
                                    <span className="text-xs text-cyan-300">{theme}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-slate-900/40 border border-cyan-900/30 rounded-xl p-6">
                        <h3 className="text-[10px] font-bold text-cyan-700 tracking-widest uppercase mb-4">Neural Inquiries</h3>
                        <div className="flex flex-col gap-2">
                            {briefing.questions.map((q, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => askSuggestedQuestion(q)}
                                    className="text-left text-[11px] p-2 rounded bg-cyan-900/10 border border-cyan-900/30 text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 transition-all"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
              </div>
            )}

            {!briefing && !isGeneratingBriefing && (
              <div className="h-96 border-2 border-dashed border-cyan-900/20 rounded-2xl flex flex-col items-center justify-center text-cyan-900/50 bg-slate-900/10">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full"></div>
                    <svg className="w-16 h-16 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Initialize Intelligence Synthesis</p>
                <p className="text-[10px] mt-2 opacity-50">Select sources from the repository and trigger neural processing.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotebookView;
