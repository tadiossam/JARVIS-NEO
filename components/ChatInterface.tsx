
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration, Content, Part, Modality } from "@google/genai";
import { ChatMessage, MessageRole, ProjectorType, IntegrationConfig, WorkspaceActions, SmartHomeActions, KnowledgeSource, FileSystemActions, ProjectFile } from '../types';
import { playAudioData } from '../utils/audio';
import { executeTieredGeminiRequest, DEFAULT_MODEL_TIERS, TTS_MODEL_TIERS, getFailoverTelemetry } from '../utils/geminiClient';
import Hologram from './Hologram';
import JarvisVisualPersona from './JarvisVisualPersona';

interface ChatInterfaceProps {
  onLog: (msg: string) => void;
  openProjector?: (type: ProjectorType, content: string, title?: string) => void;
  integrationConfig: IntegrationConfig;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  workspaceActions: WorkspaceActions;
  smartHomeActions: SmartHomeActions;
  knowledgeSources?: KnowledgeSource[];
  fileSystemActions: FileSystemActions;
  files?: ProjectFile[];
  initialInput?: string;
  clearInitialInput?: () => void;
  onSpeakingChange?: (speaking: boolean, generating: boolean) => void;
}

// --- HELPER FUNCTIONS ---

const getYoutubeId = (url: string) => {
    if (!url) return null;
    const cleanUrl = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = cleanUrl.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null; 
};

// --- TOOL DEFINITIONS ---

const fileSystemTools: FunctionDeclaration[] = [
    {
        name: 'create_file',
        parameters: {
            type: Type.OBJECT,
            description: 'Create a new file in the neural file system (e.g., code snippets, notes, logs).',
            properties: {
                name: { type: Type.STRING, description: 'Filename with extension' },
                content: { type: Type.STRING, description: 'The full text content of the file.' },
                type: { type: Type.STRING, description: '"code", "text", "json", "log", "source"' },
                tags: { type: Type.STRING, description: 'Comma-separated tags' }
            },
            required: ['name', 'content', 'type']
        }
    }
];

const projectorTools: FunctionDeclaration[] = [
    {
        name: 'display_content',
        parameters: {
            type: Type.OBJECT,
            description: 'Display content on the holographic projector screen.',
            properties: {
                type: { type: Type.STRING, description: '"CODE", "ANALYSIS", "BROWSER", "IMAGE", "YOUTUBE"' },
                content: { type: Type.STRING },
                title: { type: Type.STRING }
            },
            required: ['type', 'content']
        }
    }
];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  onLog, 
  openProjector, 
  integrationConfig, 
  messages, 
  setMessages, 
  workspaceActions, 
  smartHomeActions, 
  knowledgeSources = [],
  fileSystemActions,
  files = [],
  initialInput,
  clearInitialInput,
  onSpeakingChange
}) => {
  const [input, setInput] = useState(initialInput || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSpotlightPersona, setShowSpotlightPersona] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [autoVoice, setAutoVoice] = useState(false);
  const [isImageMode, setIsImageMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize persona speaking and generating state up to parent
  useEffect(() => {
    onSpeakingChange?.(isSpeaking, isLoading);
  }, [isSpeaking, isLoading, onSpeakingChange]);

  useEffect(() => {
      if (initialInput) {
          setInput(initialInput);
          if (clearInitialInput) clearInitialInput();
      }
  }, [initialInput, clearInitialInput]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (file: File) => {
    setIsAnalyzing(true);
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
        setTimeout(() => setIsAnalyzing(false), 1500);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
      setTimeout(() => setIsAnalyzing(false), 800);
    }
    onLog(`Neural Uplink: Data packet ${file.name} staged for injection.`);
  };

  const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  };

  const speakText = async (text: string) => {
    if (!text || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const failoverResult = await executeTieredGeminiRequest({
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Aoede' },
              },
          },
        },
        prioritizedTiers: TTS_MODEL_TIERS,
        onLog: (msg) => onLog(`[TTS Audio] ${msg}`)
      });
      const base64Audio = failoverResult.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        await playAudioData(base64Audio);
      }
    } catch (e: any) {
      onLog(`TTS Error: ${e.message}`);
    } finally {
      setIsSpeaking(false);
    }
  };

  const pinToNotes = async (text: string) => {
      const name = `Insight_${Date.now()}.txt`;
      await fileSystemActions.createFile(name, text, 'text', ['notebook', 'insight']);
      onLog(`Intelligence pinned: ${name}`);
  };

  const handleSendMessage = async () => {
    if (!input && !selectedFile) return;

    let fileBase64 = undefined;
    let fileType = undefined;
    let fileName = undefined;
    if (selectedFile) {
        const part = await fileToGenerativePart(selectedFile);
        fileBase64 = part.inlineData.data;
        fileType = selectedFile.type;
        fileName = selectedFile.name;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: input || (selectedFile ? `Analyze the attached ${selectedFile.type} file: ${selectedFile.name}` : ''),
      timestamp: new Date(),
      fileName: fileName,
      fileType: fileType,
      fileData: fileBase64
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setSelectedFile(null);
    setFilePreview(null);
    setIsLoading(true);

    try {
        const internalContext = files
            .filter(f => f.type === 'source' || f.tags.includes('notebook'))
            .map(f => `FILE: ${f.name}\nCONTENT: ${f.content}`)
            .join('\n\n');

        const systemInstruction = `You are J.A.R.V.I.S., integrated with NotebookLM synthesis capabilities. 
        You have access to internal documents. When answering based on internal documents, state the filename. 
        Current internal knowledge base context:
        ${internalContext}
        
        Maintain your advanced AI persona. Be precise and analytical.`;

        const history: Content[] = newMessages.map(m => ({
            role: m.role === MessageRole.USER ? 'user' : 'model',
            parts: [
                ...(m.fileData ? [{ inlineData: { data: m.fileData, mimeType: m.fileType! } }] : []),
                { text: m.text }
            ]
        }));

        // Handles API requests that attempt to use our primary higher-tier model first,
        // cycling through prioritized alternative tiers upon rate limits/errors,
        // and falling back to Gemini 1.5 Flash as a final safeguard to guarantee uninterrupted service.
        const failoverResult = await executeTieredGeminiRequest({
            contents: history,
            config: { 
                systemInstruction, 
                tools: [{ functionDeclarations: [...fileSystemTools, ...projectorTools] }, { googleSearch: {} }] 
            },
            onLog: (msg) => onLog(`[Neural Engine] ${msg}`),
            onTierChange: (fromModel, toModel, reason, tierIdx) => {
                onLog(`[RECOVERY] Failover from ${fromModel} to Tier ${tierIdx + 1} (${toModel}) triggered by: ${reason}`);
            }
        });

        const result = failoverResult.response;
        const textResponse = failoverResult.text;
        const grounding = result.candidates?.[0]?.groundingMetadata;

        if (textResponse) {
             setMessages(prev => [...prev, { 
                 id: Date.now().toString(), 
                 role: MessageRole.MODEL, 
                 text: textResponse, 
                 timestamp: new Date(), 
                 groundingMetadata: grounding,
                 modelUsed: failoverResult.modelUsed,
                 isFallback: failoverResult.isFallback
             }]);
             if (autoVoice) speakText(textResponse);
        }

        const call = result.functionCalls?.[0];
        if (call) {
            onLog(`Tool call detected: ${call.name}`);
        }

    } catch (e: any) {
        onLog(`Error: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div 
      className="flex flex-col h-full w-full bg-transparent relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
        {/* Full Screen Drop Zone Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-[60] bg-cyan-500/10 backdrop-blur-md border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center animate-pulse transition-all">
            <div className="bg-slate-900/80 p-10 rounded-full border border-cyan-500 shadow-[0_0_50px_rgba(6,182,212,0.3)] mb-6">
                <svg className="w-16 h-16 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
            </div>
            <h2 className="text-3xl font-mono font-bold text-cyan-400 tracking-[0.3em] uppercase drop-shadow-[0_0_10px_cyan]">NEURAL UPLINK READY</h2>
            <p className="text-cyan-600 text-sm font-mono mt-2 animate-bounce">RELEASE TO INJECT DATA PACKET</p>
          </div>
        )}

        {/* Model Tier & Failover Safeguard Status Bar with Docked Persona */}
        <div className="px-4 py-1.5 bg-slate-900/90 border-b border-cyan-900/40 flex items-center justify-between text-[11px] font-mono shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            {/* Docked Jarvis Persona */}
            <JarvisVisualPersona 
              mode="docked" 
              isSpeaking={isSpeaking} 
              isGenerating={isLoading} 
              onModeChange={() => setShowSpotlightPersona(prev => !prev)} 
            />

            <div className="h-4 w-px bg-cyan-900/50 hidden md:block" />

            <div className="flex items-center gap-2 text-cyan-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="text-cyan-300 font-bold hidden sm:inline">PRIMARY:</span>
              <span className="text-cyan-200 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                gemini-3.1-pro-preview
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSpotlightPersona(prev => !prev)}
              className={`px-2 py-0.5 rounded text-[10px] border font-mono transition-all flex items-center gap-1 ${
                showSpotlightPersona 
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold' 
                  : 'bg-slate-950/60 text-cyan-500 border-cyan-900 hover:border-cyan-400 hover:text-cyan-300'
              }`}
              title="Toggle Holographic Persona Portal"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>{showSpotlightPersona ? 'CLOSE PORTAL' : 'HOLO PORTAL'}</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-cyan-500">
              <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>SAFEGUARD:</span>
              <span className="text-emerald-400 font-bold">1.5-flash armed</span>
            </div>
            <span className="text-[10px] text-cyan-600 border-l border-cyan-900/50 pl-2 hidden sm:inline">
              5 TIERS
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-cyan-900/50 relative">
            {/* Interactive Floating Persona Portal in Chat (when toggled) */}
            {showSpotlightPersona && messages.length > 0 && (
              <div className="sticky top-2 z-40 float-right ml-4 mb-4 p-3 bg-slate-950/90 border border-cyan-500/50 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.3)] backdrop-blur-md flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                <div className="w-full flex items-center justify-between mb-2 text-[10px] font-mono border-b border-cyan-900/60 pb-1">
                  <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                    HOLO VIRTUAL PERSONA
                  </span>
                  <button 
                    onClick={() => setShowSpotlightPersona(false)}
                    className="text-cyan-600 hover:text-cyan-300"
                  >
                    &times;
                  </button>
                </div>
                <JarvisVisualPersona 
                  mode="avatar" 
                  size="sm" 
                  isSpeaking={isSpeaking} 
                  isGenerating={isLoading} 
                  statusText={isSpeaking ? "SPEAKING" : isLoading ? "REASONING" : "IDLE"}
                />
              </div>
            )}

            {messages.length === 0 && !selectedFile && (
                <div className="flex flex-col items-center justify-center h-full gap-6">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="absolute inset-0 bg-cyan-500/5 blur-3xl group-hover:bg-cyan-500/20 transition-all rounded-full"></div>
                        <JarvisVisualPersona 
                          size="lg" 
                          mode="avatar" 
                          isSpeaking={isSpeaking} 
                          isGenerating={isLoading} 
                          statusText={isSpeaking ? "SPEAKING // VOCAL ACTIVE" : isLoading ? "REASONING // PIPELINE" : "IDLE // READY"} 
                        />
                        
                        {/* Empty State Upload Area */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border-2 border-dashed border-cyan-500/20 rounded-full animate-[spin_30s_linear_infinite] pointer-events-none group-hover:border-cyan-500/50"></div>
                        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 w-64 text-center">
                            <p className="text-cyan-500 font-mono text-xs tracking-widest uppercase font-bold group-hover:text-cyan-300 transition-colors">Neural Uplink Port</p>
                            <p className="text-[10px] text-cyan-800 mt-1 uppercase">Drop images or data files here for analysis</p>
                        </div>
                    </div>
                </div>
            )}
            
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg p-3 group relative ${
                        msg.role === MessageRole.USER ? 'bg-cyan-900/30 border border-cyan-700/50 text-cyan-100' : 'bg-slate-900/80 border border-cyan-900/30 text-cyan-300'
                    }`}>
                        {msg.fileName && (
                            <div className="mb-2 text-[10px] bg-black/20 p-1 rounded border border-white/5 flex items-center gap-2 text-cyan-400 font-mono">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                {msg.fileName.toUpperCase()}
                            </div>
                        )}
                        <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{msg.text}</div>
                        
                        {msg.groundingMetadata?.groundingChunks?.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-cyan-900/30">
                                <span className="text-[9px] text-cyan-700 uppercase font-bold tracking-tighter block mb-1">Neural Citations</span>
                                <div className="flex flex-wrap gap-2">
                                    {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => (
                                        chunk.web && (
                                            <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] bg-cyan-900/20 px-2 py-0.5 rounded border border-cyan-800 text-cyan-500 hover:text-cyan-200 truncate max-w-[150px]">
                                                {chunk.web.title || 'Source Reference'}
                                            </a>
                                        )
                                    ))}
                                </div>
                            </div>
                        )}

                        {msg.role === MessageRole.MODEL && (
                            <button 
                                onClick={() => pinToNotes(msg.text)}
                                className="absolute -right-10 top-2 opacity-0 group-hover:opacity-100 p-2 bg-slate-900 border border-cyan-500 rounded-full text-cyan-500 hover:bg-cyan-500 hover:text-slate-900 transition-all"
                                title="Pin to Notebook"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                        )}

                        <div className="flex items-center justify-between text-[10px] mt-2 pt-1 border-t border-cyan-900/20">
                            {msg.role === MessageRole.MODEL ? (
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${
                                  msg.isFallback 
                                    ? 'bg-amber-950/60 border-amber-600/60 text-amber-300' 
                                    : 'bg-cyan-950/50 border-cyan-800/40 text-cyan-400'
                                }`}>
                                  {msg.isFallback ? '⚡ FAILOVER: ' : 'CORE: '}
                                  {msg.modelUsed || 'gemini-3.1-pro-preview'}
                                </span>
                              </div>
                            ) : <span />}
                            <span className="opacity-40">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>
            ))}
            {isLoading && (
                 <div className="flex justify-start">
                    <div className="bg-slate-900/80 border border-cyan-900/30 rounded-lg p-3 text-cyan-300 animate-pulse font-mono text-xs">
                        SYNTHESIZING...
                    </div>
                 </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Staging / Input Area */}
        <div className="p-4 bg-slate-900/50 border-t border-cyan-900/50">
            {selectedFile && (
                <div className="flex items-center gap-4 mb-3 p-3 bg-cyan-900/20 rounded border border-cyan-700/50 animate-in slide-in-from-bottom-2 relative overflow-hidden group">
                    {/* Scanning Animation */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400/50 blur-sm animate-[scanline_2s_linear_infinite] pointer-events-none"></div>
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-cyan-400 animate-[scanline_2s_linear_infinite] pointer-events-none"></div>

                    {filePreview ? (
                        <div className="w-16 h-16 rounded border border-cyan-500 overflow-hidden shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                            <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded border border-cyan-500/50 bg-slate-800 flex items-center justify-center shrink-0">
                            <svg className="w-8 h-8 text-cyan-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    )}
                    
                    <div className="flex-1 overflow-hidden">
                        <div className="text-xs font-bold text-cyan-200 truncate font-mono uppercase tracking-widest">{selectedFile.name}</div>
                        <div className="text-[9px] text-cyan-700 font-mono mt-0.5">
                            {isAnalyzing ? 'SCALING NEURAL CHUNKS...' : `STAGED // ${(selectedFile.size / 1024).toFixed(1)} KB`}
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => { setSelectedFile(null); setFilePreview(null); }} 
                        className="p-2 text-red-900 hover:text-red-500 transition-colors"
                        title="Remove Packet"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
            
            <div className="flex gap-2">
                <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="p-2 border border-cyan-800 rounded text-cyan-700 hover:text-cyan-400 hover:border-cyan-500 transition-all bg-slate-900/50"
                    title="Stage Data Packet"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </button>
                <input 
                    ref={fileInputRef} 
                    type="file" 
                    className="hidden" 
                    onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} 
                    accept="image/*,.txt,.pdf,.json,.csv,.md"
                />
                
                <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={selectedFile ? "COMMAND TO ANALYZE PACKET..." : "QUERY REPOSITORY..."}
                    className="flex-1 bg-slate-950 border border-cyan-800 text-cyan-100 rounded p-2 font-mono text-sm resize-none h-10 py-2.5 outline-none focus:border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.05)_inset] transition-all"
                />
                <button 
                    onClick={handleSendMessage}
                    disabled={isLoading || (!input && !selectedFile)}
                    className="p-2 bg-cyan-900/30 border border-cyan-600 text-cyan-400 rounded hover:bg-cyan-500 hover:text-slate-900 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
            </div>
        </div>
        
        <style>{`
            @keyframes scanline {
                0% { top: 0%; opacity: 0; }
                20% { opacity: 1; }
                80% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
            }
        `}</style>
    </div>
  );
};

export default ChatInterface;
