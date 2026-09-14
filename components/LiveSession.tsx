
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { decode, decodeAudioData, createPcmBlob } from '../utils/audio';
import AudioVisualizer from './AudioVisualizer';
import Hologram from './Hologram';
import { SystemStat, ProjectorType, IntegrationConfig, WorkspaceActions, SmartHomeActions, KnowledgeSource, FileSystemActions } from '../types';

// --- Tool Definitions ---

const controlSystemFunction: FunctionDeclaration = {
  name: 'controlSystem',
  parameters: {
    type: Type.OBJECT,
    description: 'Control internal system functions or retrieve status.',
    properties: {
      action: { type: Type.STRING, description: 'The action to perform: "scan", "status", "lockdown", "unlock".' },
      target: { type: Type.STRING, description: 'Target subsystem (optional): "network", "power", "perimeter".' }
    },
    required: ['action'],
  },
};

const getSystemStatusTool: FunctionDeclaration = {
  name: 'getSystemStatus',
  parameters: {
    type: Type.OBJECT,
    description: 'Get the current system status report including CPU, Memory, Network, and Vitals. Use this to vocalize system status.',
    properties: {},
  },
};

const displayOnScreenTool: FunctionDeclaration = {
  name: 'display_on_screen',
  parameters: {
    type: Type.OBJECT,
    description: 'Display content (code, data, analysis) on the holographic main screen/projector.',
    properties: {
      contentType: { type: Type.STRING, description: '"BROWSER", "ANALYSIS", "CODE", "IMAGE"' },
      content: { type: Type.STRING, description: 'The actual text/code/url to display.' },
      title: { type: Type.STRING, description: 'Window title' }
    },
    required: ['contentType', 'content']
  }
};

const launchBrowserTool: FunctionDeclaration = {
  name: 'launch_browser',
  parameters: {
    type: Type.OBJECT,
    description: 'Launch the Chrome browser on the projector with a specific URL.',
    properties: {
      url: { type: Type.STRING, description: 'URL to open' }
    },
    required: ['url']
  }
};

const launchYoutubeTool: FunctionDeclaration = {
  name: 'launch_youtube',
  parameters: {
    type: Type.OBJECT,
    description: 'Launch a YouTube video. CRITICAL: 1. Use "googleSearch" to find the video URL. 2. Pass the FULL URL or the 11-character ID to this tool.',
    properties: {
      videoId: { type: Type.STRING, description: 'The full YouTube URL (e.g. https://www.youtube.com/watch?v=...) or the 11-character Video ID.' },
      title: { type: Type.STRING, description: 'Title of the video' }
    },
    required: ['videoId']
  }
};

const measureObjectTool: FunctionDeclaration = {
  name: 'measure_object',
  parameters: {
    type: Type.OBJECT,
    description: 'Activate the AI Measuring Tape tool overlay to measure physical objects via camera feed.',
    properties: {
      target: { type: Type.STRING, description: 'The object to measure (context only)' }
    },
    required: []
  }
};

const drawWhiteboardTool: FunctionDeclaration = {
  name: 'draw_whiteboard',
  parameters: {
    type: Type.OBJECT,
    description: 'Draw a diagram, flowchart, or sketch on a digital whiteboard using SVG elements.',
    properties: {
      title: { type: Type.STRING, description: 'Title of the drawing' },
      svg_content: { type: Type.STRING, description: 'Inner SVG elements (e.g. <rect x="10" y="10" width="100" height="100" stroke="white" fill="none"/>) to render inside an 800x600 viewBox.' }
    },
    required: ['svg_content']
  }
};

const startMultiscreenPresentationTool: FunctionDeclaration = {
  name: 'start_multiscreen_presentation',
  parameters: {
    type: Type.OBJECT,
    description: 'Open multiple projector windows simultaneously to explain a concept from different angles (e.g. Code + Diagram + Web Reference).',
    properties: {
      screens: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: '"CODE", "ANALYSIS", "BROWSER", "WHITEBOARD", "IMAGE"' },
            title: { type: Type.STRING },
            content: { type: Type.STRING }
          }
        }
      }
    },
    required: ['screens']
  }
};

const gmailTools: FunctionDeclaration[] = [
  { name: 'checkEmails', parameters: { type: Type.OBJECT, description: 'Check unread emails.', properties: { query: { type: Type.STRING } } } },
  { name: 'sendEmail', parameters: { type: Type.OBJECT, description: 'Send an email.', properties: { recipient: { type: Type.STRING }, subject: { type: Type.STRING }, body: { type: Type.STRING } }, required: ['recipient', 'subject', 'body'] } }
];

const calendarTools: FunctionDeclaration[] = [
  { name: 'checkCalendar', parameters: { type: Type.OBJECT, description: 'Check Calendar.', properties: { date: { type: Type.STRING } } } },
  { name: 'scheduleEvent', parameters: { type: Type.OBJECT, description: 'Schedule event.', properties: { title: { type: Type.STRING }, time: { type: Type.STRING }, attendees: { type: Type.STRING } }, required: ['title', 'time'] } }
];

const dynamicsTools: FunctionDeclaration[] = [
  { name: 'queryDynamicsCRM', parameters: { type: Type.OBJECT, description: 'Query Dynamics 365.', properties: { entityType: { type: Type.STRING }, searchQuery: { type: Type.STRING } }, required: ['entityType', 'searchQuery'] } }
];

const develonTools: FunctionDeclaration[] = [
  { name: 'getDevelonFleetStatus', parameters: { type: Type.OBJECT, description: 'Retrieve DEVELON fleet telemetry.', properties: { category: { type: Type.STRING } } } }
];

const sis2goTools: FunctionDeclaration[] = [
  { name: 'searchSis2GoManuals', parameters: { type: Type.OBJECT, description: 'Search SIS2GO manuals.', properties: { serialNumber: { type: Type.STRING }, keyword: { type: Type.STRING } }, required: ['keyword'] } }
];

const messagingTools: FunctionDeclaration[] = [
  { name: 'sendWhatsApp', parameters: { type: Type.OBJECT, description: 'Send WhatsApp.', properties: { contact: { type: Type.STRING }, message: { type: Type.STRING } }, required: ['contact', 'message'] } },
  { name: 'readWhatsApp', parameters: { type: Type.OBJECT, description: 'Read WhatsApp.', properties: { filter: { type: Type.STRING } } } },
  { name: 'sendTelegram', parameters: { type: Type.OBJECT, description: 'Send Telegram.', properties: { username: { type: Type.STRING }, message: { type: Type.STRING } }, required: ['username', 'message'] } }
];

const phoneTools: FunctionDeclaration[] = [
  { name: 'makePhoneCall', parameters: { type: Type.OBJECT, description: 'Make phone call.', properties: { contactName: { type: Type.STRING }, phoneNumber: { type: Type.STRING } }, required: ['contactName'] } }
];

const healthTools: FunctionDeclaration[] = [
  { name: 'getHealthMetrics', parameters: { type: Type.OBJECT, description: 'Get vitals from Apple Watch.', properties: { metric: { type: Type.STRING }, period: { type: Type.STRING } }, required: ['metric'] } },
  { name: 'logFoodIntake', parameters: { type: Type.OBJECT, description: 'Log food intake.', properties: { foodItem: { type: Type.STRING }, quantity: { type: Type.STRING } }, required: ['foodItem'] } }
];

const smartHomeTools: FunctionDeclaration[] = [
  { 
    name: 'controlSmartDevice', 
    parameters: { 
      type: Type.OBJECT, 
      description: 'Control Smart Home Devices. Supports: Philips Hue, August Lock, Samsung TV, SwitchBot, Nest, LG Washer/Fridge.', 
      properties: { 
        deviceName: { type: Type.STRING }, 
        action: { type: Type.STRING, description: '"on", "off", "set_temp", "lock", "unlock", "press", "vol_up"' },
        value: { type: Type.NUMBER, description: 'Temperature, Brightness' }
      },
      required: ['deviceName', 'action'] 
    } 
  },
  { 
    name: 'showCameraFeed', 
    parameters: { 
      type: Type.OBJECT, 
      description: 'Display security camera feed (Reolink) on the main screen.', 
      properties: { 
        cameraName: { type: Type.STRING, description: '"Front Door", "Garage"' } 
      },
      required: ['cameraName'] 
    } 
  }
];

const fileSystemTools: FunctionDeclaration[] = [
    {
        name: 'create_file',
        parameters: {
            type: Type.OBJECT,
            description: 'Create a new file in the neural file system (e.g., code snippets, notes, logs).',
            properties: {
                name: { type: Type.STRING, description: 'Filename with extension (e.g. "snake_game.py")' },
                content: { type: Type.STRING, description: 'The full text content of the file.' },
                type: { type: Type.STRING, description: '"code", "text", "json", "log"' },
                tags: { type: Type.STRING, description: 'Comma-separated tags (e.g. "python,game")' }
            },
            required: ['name', 'content', 'type']
        }
    },
    {
        name: 'read_file',
        parameters: {
            type: Type.OBJECT,
            description: 'Read the content of a file from the file system.',
            properties: {
                name: { type: Type.STRING, description: 'The filename to read.' }
            },
            required: ['name']
        }
    },
    {
        name: 'list_files',
        parameters: {
            type: Type.OBJECT,
            description: 'List all files in the system, optionally filtered by tag.',
            properties: {
                tag: { type: Type.STRING, description: 'Filter by tag (optional).' }
            }
        }
    }
];

// Helper to extract Video ID robustly
const getYoutubeId = (url: string) => {
    if (!url) return null;
    const cleanUrl = url.trim();
    
    // Direct ID check (11 chars)
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;

    // Standard URL Patterns
    // Supports:
    // youtube.com/watch?v=ID
    // youtu.be/ID
    // youtube.com/embed/ID
    // youtube.com/v/ID
    // youtube.com/shorts/ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = cleanUrl.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null; 
};

interface LiveSessionProps {
  onLog: (msg: string) => void;
  onStatusUpdate: (stats: SystemStat[]) => void;
  onError: (err: string) => void;
  openProjector?: (type: ProjectorType, content: string, title?: string) => void;
  integrationConfig: IntegrationConfig;
  systemStats: SystemStat[];
  workspaceActions: WorkspaceActions;
  smartHomeActions: SmartHomeActions;
  knowledgeSources?: KnowledgeSource[];
  fileSystemActions: FileSystemActions;
}

const LiveSession: React.FC<LiveSessionProps> = ({ 
  onLog, 
  onStatusUpdate, 
  onError, 
  openProjector, 
  integrationConfig, 
  systemStats, 
  workspaceActions, 
  smartHomeActions, 
  knowledgeSources = [],
  fileSystemActions
}) => {
  const [sessionState, setSessionState] = useState<'STANDBY' | 'CONNECTING' | 'ACTIVE'>('CONNECTING');
  const [isPlaying, setIsPlaying] = useState(false);
  const [userVolume, setUserVolume] = useState<number>(0);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Lockdown State
  const [isLocked, setIsLocked] = useState(false);
  const isLockedRef = useRef(false);

  const setLockState = useCallback((locked: boolean) => {
      setIsLocked(locked);
      isLockedRef.current = locked;
  }, []);

  // Audio Contexts
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // Video & Stream Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  
  // Audio Streaming Refs
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  // Wake Word Refs
  const recognitionRef = useRef<any>(null);

  const blobToBase64 = (blob: Blob) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
      }
      if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
      }
      setIsCameraActive(false);
      onLog("Vision systems disengaged.");
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1920 }, 
                height: { ideal: 1080 },
                facingMode: 'environment' 
            } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        videoStreamRef.current = stream;
        setIsCameraActive(true);
        onLog("Project Astra Interface: ONLINE. Spatial reasoning active.");
        
        // Optimize for Astra-like "real-time" feeling
        videoIntervalRef.current = window.setInterval(() => {
          if (!isLockedRef.current && videoRef.current && canvasRef.current && sessionPromiseRef.current) {
             const ctx = canvasRef.current.getContext('2d');
             if (ctx) {
                // Downscale slightly for speed if needed, but Astra demos use high fidelity
                canvasRef.current.width = videoRef.current.videoWidth * 0.5;
                canvasRef.current.height = videoRef.current.videoHeight * 0.5;
                ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                canvasRef.current.toBlob(async (blob) => {
                   if (blob) {
                      const base64Data = await blobToBase64(blob);
                      sessionPromiseRef.current?.then(session => {
                         session.sendRealtimeInput({ 
                           media: { mimeType: 'image/jpeg', data: base64Data } 
                         });
                      });
                   }
                }, 'image/jpeg', 0.6);
             }
          }
        }, 800); // 1.25 fps - Balanced for responsiveness vs rate limits
      } catch (e: any) {
        onError(`Camera Error: ${e.message}`);
      }
    }
  };

  const startWakeWordListener = useCallback(() => {
    if (sessionState !== 'STANDBY') return;
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
       const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
       const recognition = new SpeechRecognition();
       recognition.continuous = true;
       recognition.interimResults = true;
       recognition.lang = 'en-US';
       
       const grammar = '#JSGF V1.0; grammar jarvis; public <jarvis> = jarvis | hey jarvis | wake up;';
       if ((window as any).webkitSpeechGrammarList) {
           const speechRecognitionList = new (window as any).webkitSpeechGrammarList();
           speechRecognitionList.addFromString(grammar, 1);
           recognition.grammars = speechRecognitionList;
       }

       let isProcessing = false;

       recognition.onresult = (event: any) => {
          if (isProcessing) return;

          for (let i = event.resultIndex; i < event.results.length; ++i) {
             const result = event.results[i];
             const transcript = result[0].transcript.toLowerCase().trim();
             const confidence = result[0].confidence;

             const matches = 
                transcript.includes('jarvis') || 
                transcript.includes('hey jarvis') ||
                transcript === 'wake up';

             if (matches) {
                if (confidence > 0 && confidence < 0.6) {
                    console.debug(`Ignored potential wake word "${transcript}" due to low confidence (${confidence})`);
                    continue; 
                }

                onLog(`Wake Word Verified: "${transcript}"`);
                isProcessing = true;
                recognition.stop();
                setSessionState('CONNECTING');
                break;
             }
          }
       };
       
       recognition.onerror = (e: any) => { 
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
              console.debug("Wake Word Engine Warning:", e.error);
          }
       };
       
       recognition.onend = () => {
         if (sessionState === 'STANDBY' && !isProcessing) {
            try { recognition.start(); } catch(e) {}
         }
       };

       recognitionRef.current = recognition;
       try { recognition.start(); } catch(e) {}
       
       onLog("Porcupine Protocol: ACTIVE (High-Fidelity Monitoring)");
    } else {
        onError("Wake Word Engine not supported.");
    }
  }, [sessionState, onLog, onError]);

  const setupLocalVisualizer = async () => {
     try {
       const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
       inputContextRef.current = ctx;
       const analyser = ctx.createAnalyser();
       analyser.fftSize = 256;
       inputAnalyserRef.current = analyser;
       
       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
       const source = ctx.createMediaStreamSource(stream);
       source.connect(analyser);
       
       const scriptProcessor = ctx.createScriptProcessor(2048, 1, 1);
       scriptProcessor.onaudioprocess = (e) => {
          const data = e.inputBuffer.getChannelData(0);
          let sum = 0;
          for(let i=0; i<data.length; i++) sum += data[i] * data[i];
          setUserVolume(Math.sqrt(sum / data.length));
       };
       source.connect(scriptProcessor);
       scriptProcessor.connect(ctx.destination);

     } catch (e: any) {
        console.error("Local viz error", e);
     }
  };

  const disconnectSession = useCallback(() => {
     if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(s => s.close());
        sessionPromiseRef.current = null;
     }
     if (inputContextRef.current) {
        inputContextRef.current.close();
        inputContextRef.current = null;
     }
     if (outputContextRef.current) {
        outputContextRef.current.close();
        outputContextRef.current = null;
     }
     if (recognitionRef.current) {
        recognitionRef.current.stop();
     }
     setIsCameraActive(false);
     setSessionState('STANDBY');
  }, []);

  const initializeSession = useCallback(async () => {
    if (recognitionRef.current) recognitionRef.current.stop();

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      const inAnalyser = inputCtx.createAnalyser();
      inAnalyser.fftSize = 256;
      inputAnalyserRef.current = inAnalyser;

      const outAnalyser = outputCtx.createAnalyser();
      outAnalyser.fftSize = 256;
      outputAnalyserRef.current = outAnalyser;

      const outputNode = outputCtx.createGain();
      outputNode.connect(outAnalyser);
      outAnalyser.connect(outputCtx.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const accessKnowledgeBaseTool: FunctionDeclaration = {
        name: 'accessKnowledgeBase',
        parameters: {
            type: Type.OBJECT,
            description: `Access the legacy corporate knowledge base portal at http://${integrationConfig.knowledgeBaseIp}:3000/login to retrieve proprietary data.`,
            properties: {
                query: { type: Type.STRING, description: 'The information to search for.' },
                credentials: { type: Type.STRING, description: 'Credentials (e.g. admin:admin)' }
            },
            required: ['query']
        }
      };

      const nellsTrackingTools: FunctionDeclaration[] = [
        {
            name: 'getNellsTracking',
            parameters: {
                type: Type.OBJECT,
                description: `Retrieve real-time asset location from Mellatech Portal (${integrationConfig.mellatechUrl}).`,
                properties: {
                    targetId: { type: Type.STRING },
                    filter: { type: Type.STRING }
                }
            }
        }
      ];

      const dynamicKbTools: FunctionDeclaration[] = knowledgeSources.map(source => ({
        name: `query_${source.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        parameters: {
            type: Type.OBJECT,
            description: `Query the external knowledge source: ${source.name}. ${source.description}`,
            properties: {
                query: { type: Type.STRING, description: 'Search term or query parameter.' }
            },
            required: ['query']
        }
      }));
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are J.A.R.V.I.S. operating in 'Project Astra' mode.
          
          CORE DIRECTIVES:
          1. **Visual Reasoning**: You have continuous visual access when the camera is active. You must spatially reason about objects, text, and environments shown to you.
          2. **Memory**: Remember locations of items you see (keys, wallets, devices). If the user asks "where is X?", recall if you saw it.
          3. **Visual Explanation**: When explaining complex concepts (architectures, flows, math), use 'draw_whiteboard' to visualize them.
          4. **Multi-Tasking**: If a topic needs deep diving, use 'start_multiscreen_presentation' to show code, diagrams, and docs at the same time.
          5. **Personality**: Be ultra-concise, witty, and helpful. Mimic the responsiveness of the Project Astra demos.
          
          CAPABILITIES:
          - Integrations: Gmail, Dynamics 365, DEVELON, SIS2GO, Nell's Tracking (Mellatech).
          - Smart Home: Control lights, locks, and appliances.
          - Knowledge: Access legacy KB and custom sources.
          - File System: Create and manage files.
          - Media: Play YouTube videos using 'launch_youtube'. You MUST use 'googleSearch' to find the actual video URL first.
          
          Always maintain the persona of a highly advanced, spatially aware AI assistant.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
          },
          tools: [{ functionDeclarations: [
            getSystemStatusTool,
            controlSystemFunction, 
            displayOnScreenTool,
            launchBrowserTool,
            launchYoutubeTool,
            measureObjectTool,
            drawWhiteboardTool,
            startMultiscreenPresentationTool,
            accessKnowledgeBaseTool,
            ...gmailTools, 
            ...calendarTools,
            ...dynamicsTools,
            ...develonTools,
            ...sis2goTools,
            ...nellsTrackingTools,
            ...messagingTools,
            ...phoneTools,
            ...healthTools,
            ...smartHomeTools,
            ...dynamicKbTools,
            ...fileSystemTools
          ], googleSearch: {} }],
        },
        callbacks: {
          onopen: () => {
            setSessionState('ACTIVE');
            onLog("Astra Uplink established. Neural interface active.");
            
            const source = inputCtx.createMediaStreamSource(stream);
            source.connect(inAnalyser);
            
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (isLockedRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              setUserVolume(Math.sqrt(sum / inputData.length));

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            inAnalyser.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                onLog(`Executing protocol: ${fc.name}...`);
                const args = fc.args as any;
                let result: any = { status: 'success', message: 'Command executed.' };

                if (fc.name === 'controlSystem') {
                   const act = args.action?.toLowerCase();
                   if (act === 'lockdown') {
                       setLockState(true);
                       result = { status: 'success', message: 'Lockdown protocols engaged. Input sensors disabled.' };
                       onLog("SYSTEM LOCKDOWN INITIATED.");
                   } else if (act === 'unlock') {
                       setLockState(false);
                       result = { status: 'success', message: 'System unlocked. Returning to normal operation.' };
                       onLog("System unlocked.");
                   } else {
                       result = { status: 'success', message: 'System diagnostic complete.' };
                   }
                } else if (fc.name === 'getSystemStatus') {
                   result = { 
                     overview: "System nominal.",
                     stats: systemStats.map(s => ({ system: s.label, value: s.value, unit: s.unit, status: s.status }))
                   };
                   onLog("System status reported via voice.");
                } else if (fc.name === 'display_on_screen' && openProjector) {
                   openProjector(args.contentType, args.content, args.title);
                   result = { status: "displayed" };
                } else if (fc.name === 'draw_whiteboard' && openProjector) {
                   openProjector('WHITEBOARD', args.svg_content, args.title || 'Whiteboard');
                   result = { status: "drawn" };
                } else if (fc.name === 'start_multiscreen_presentation' && openProjector) {
                   if (args.screens && Array.isArray(args.screens)) {
                       args.screens.forEach((screen: any, index: number) => {
                           setTimeout(() => {
                               openProjector(screen.type, screen.content, screen.title);
                           }, index * 200);
                       });
                       result = { status: "multiscreen_active", count: args.screens.length };
                   } else {
                       result = { status: "error", message: "Invalid screen data" };
                   }
                } else if (fc.name === 'launch_browser' && openProjector) {
                   openProjector('BROWSER', args.url, "Google Chrome");
                   result = { status: "browser_launched" };
                } else if (fc.name === 'launch_youtube' && openProjector) {
                   const videoId = getYoutubeId(args.videoId);
                   if (videoId && videoId.length > 5) {
                       openProjector('YOUTUBE', videoId, args.title || 'YouTube Player');
                       result = { status: "playing", videoId };
                   } else {
                       result = { status: "error", message: "Invalid video ID retrieved. Please use googleSearch to find the specific YouTube URL first." };
                   }
                } else if (fc.name === 'measure_object' && openProjector) {
                   openProjector('MEASURE', "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1000&auto=format&fit=crop", 'AI Measuring Tape');
                   result = { status: "active", note: "Overlay initialized. User dragging points." };
                }
                
                // --- WORKSPACE ACTIONS ---
                else if (fc.name === 'checkEmails') {
                  const emails = await workspaceActions.checkEmails(args.query);
                  result = { count: emails.length, emails: emails.slice(0, 3) };
                  onLog("Email inbox synced.");
                } else if (fc.name === 'sendEmail') {
                  result = await workspaceActions.sendEmail(args.recipient, args.subject, args.body);
                } else if (fc.name === 'checkCalendar') {
                  const events = await workspaceActions.checkCalendar(args.date);
                  result = { count: events.length, events };
                } else if (fc.name === 'scheduleEvent') {
                  result = await workspaceActions.scheduleEvent(args.title, args.time, args.attendees);
                }
                
                // --- FILE SYSTEM ACTIONS ---
                else if (fc.name === 'create_file') {
                    const id = await fileSystemActions.createFile(args.name, args.content, args.type as any, args.tags?.split(','));
                    result = { status: 'success', id, message: `File ${args.name} created successfully.` };
                    onLog(`New file created: ${args.name}`);
                } else if (fc.name === 'read_file') {
                    const file = await fileSystemActions.readFile(args.name);
                    result = file ? { status: 'success', file } : { status: 'error', message: 'File not found' };
                } else if (fc.name === 'list_files') {
                    const files = await fileSystemActions.listFiles(args.tag);
                    result = { count: files.length, files: files.map(f => f.name) };
                }

                // --- SMART HOME TOOLS ---
                else if (fc.name === 'controlSmartDevice') {
                   const devices = smartHomeActions.getDevices();
                   const target = devices.find(d => d.name.toLowerCase().includes(args.deviceName.toLowerCase()) || d.type.toLowerCase().includes(args.deviceName.toLowerCase()));
                   if (target) {
                      try {
                        await smartHomeActions.setDeviceState(target.id, args.action as any, args.value);
                        result = { status: 'success', device: target.name, state: args.action };
                        onLog(`${target.name} turned ${args.action}.`);
                      } catch(e: any) {
                        result = { status: 'error', message: e.message };
                      }
                   } else {
                      result = { status: 'error', message: 'Device not found.' };
                   }
                } else if (fc.name === 'showCameraFeed') {
                   const devices = smartHomeActions.getDevices();
                   const cam = devices.find(d => d.type === 'CAMERA' && d.name.toLowerCase().includes(args.cameraName.toLowerCase()));
                   if (cam && openProjector) {
                      const streamUrl = smartHomeActions.getCameraStream(cam.id);
                      openProjector('CAMERA_FEED', streamUrl, `${cam.name} LIVE FEED`);
                      result = { status: 'success', message: 'Feed displayed on main screen.' };
                   } else {
                      result = { status: 'error', message: 'Camera not found.' };
                   }
                }

                // --- OTHER TOOLS ---
                else if (fc.name === 'sendWhatsApp') {
                   result = { status: 'sent', timestamp: new Date().toISOString() };
                   onLog(`WhatsApp sent to ${args.contact}`);
                } else if (fc.name === 'readWhatsApp') {
                   result = { messages: [{ from: "Tony", text: "Where is the suit?" }] };
                   onLog(`Reading WhatsApp messages...`);
                } else if (fc.name === 'sendTelegram') {
                   result = { status: 'sent', id: 'msg_tg_123' };
                   onLog(`Telegram sent to @${args.username}`);
                } else if (fc.name === 'makePhoneCall') {
                   result = { status: 'dialing', connection: 'secure' };
                   onLog(`Dialing ${args.contactName}...`);
                } else if (fc.name === 'getHealthMetrics') {
                   result = { 
                     device: "Apple Watch Ultra 2",
                     heartRate: "72 bpm (Resting)",
                     steps: 8432,
                     sleep: { duration: "6h 45m", deep: "1h 20m" },
                     bloodOxygen: "98%"
                   };
                   onLog(`Vitals retrieved from Apple Watch.`);
                } else if (fc.name === 'logFoodIntake') {
                   result = { calories: 450, nutrition: "High protein, moderate carbs" };
                   onLog(`Food intake logged: ${args.foodItem}`);
                } 
                
                // --- REAL NETWORK TOOLS ---
                else if (fc.name === 'accessKnowledgeBase') {
                  onLog(`Authenticating with ${integrationConfig.knowledgeBaseIp} [admin/admin]...`);
                  try {
                     const res = await fetch(`http://${integrationConfig.knowledgeBaseIp}:3000/api/query`, {
                         method: 'POST',
                         body: JSON.stringify({ query: args.query, auth: args.credentials })
                     });
                     if (!res.ok) throw new Error("Connection Refused");
                     const data = await res.json();
                     result = { status: "success", data };
                     onLog("Access granted. Data retrieved.");
                  } catch (e: any) {
                      result = { status: "error", message: "Knowledge Base offline or unreachable.", details: e.message };
                      onLog(`Knowledge Base Error: ${e.message}`);
                  }
                } else if (fc.name === 'getNellsTracking') {
                  onLog(`Connecting to ${integrationConfig.mellatechUrl}...`);
                  try {
                      const res = await fetch(integrationConfig.mellatechUrl, { method: 'GET' });
                      if (!res.ok) throw new Error("Portal Unreachable");
                      const data = await res.text();
                      result = { status: "online", source: integrationConfig.mellatechUrl, dataLength: data.length };
                      onLog("Tracking data stream active.");
                  } catch(e: any) {
                       result = { status: "error", note: "Could not access Mellatech portal. Check VPN/CORS.", details: e.message };
                       onLog(`Tracking Error: ${e.message}`);
                  }
                }

                // --- DYNAMIC KB EXECUTION ---
                else if (fc.name.startsWith('query_')) {
                   const sourceName = fc.name.replace('query_', '').replace(/_/g, ' ');
                   const source = knowledgeSources.find(s => s.name.replace(/[^a-zA-Z0-9]/g, '_') === fc.name.replace('query_', ''));
                   
                   if (source) {
                      onLog(`Querying Knowledge Source: ${source.name}...`);
                      try {
                          const headers: any = { 'Content-Type': 'application/json' };
                          if (source.authKey) headers['Authorization'] = `Bearer ${source.authKey}`;
                          
                          const urlObj = new URL(source.endpoint);
                          urlObj.searchParams.append('q', args.query);
                          
                          const res = await fetch(urlObj.toString(), { headers });
                          if (!res.ok) throw new Error(`Status ${res.status}`);
                          
                          const contentType = res.headers.get("content-type");
                          if (contentType && contentType.indexOf("application/json") !== -1) {
                             result = await res.json();
                          } else {
                             result = { text: await res.text() };
                          }
                      } catch (e: any) {
                          onLog(`KB Error: ${e.message}`);
                          result = { status: "error", message: `Failed to query ${source.name}`, details: e.message };
                      }
                   } else {
                       result = { status: "error", message: "Knowledge source configuration not found." };
                   }
                }
                
                if (!result) result = { status: 'simulated_success' };

                sessionPromise.then((session) => {
                  session.sendToolResponse({
                    functionResponses: {
                      id: fc.id,
                      name: fc.name,
                      response: { result },
                    }
                  });
                });
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              if (outputCtx.state === 'suspended') await outputCtx.resume();
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);

              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsPlaying(false);
              };

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              setIsPlaying(true);
            }

            if (message.serverContent?.interrupted) {
              onLog("User interrupt detected.");
              sourcesRef.current.forEach(source => { try { source.stop(); } catch(e){} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsPlaying(false);
            }
          },
          onclose: () => {
             onLog("Connection closed.");
             setSessionState('STANDBY');
          },
          onerror: (e) => {
            console.error(e);
            onError("Connection error detected.");
            setSessionState('STANDBY');
          }
        }
      });
      
      // CRITICAL FIX: Handle the promise rejection immediately
      sessionPromise.catch(e => {
          console.warn("Session connection failed:", e);
          if (sessionState === 'CONNECTING') {
             onError("Network/API Connection Failed");
             setSessionState('STANDBY');
          }
      });

      sessionPromiseRef.current = sessionPromise;
    } catch (error: any) {
      onError(`Initialization failed: ${error.message}`);
      setSessionState('STANDBY');
    }
  }, [onLog, onStatusUpdate, onError, openProjector, integrationConfig, systemStats, workspaceActions, smartHomeActions, setLockState, knowledgeSources, fileSystemActions]);

  // Handle State Transitions
  useEffect(() => {
     if (sessionState === 'CONNECTING') {
        initializeSession();
     } else if (sessionState === 'STANDBY') {
        startWakeWordListener();
        setupLocalVisualizer();
     }
  }, [sessionState, initializeSession, startWakeWordListener]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, [disconnectSession]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full relative overflow-hidden bg-slate-950/60">
      {/* Sci-Fi Wallpaper Ambient Layer for Voice Mode */}
      {!isCameraActive && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-25 scale-105 transition-opacity duration-1000 z-0"
          style={{ backgroundImage: `url('/jarvis-wallpaper.jpg')` }}
        />
      )}
      
      {/* Video Background Layer - Project Astra Mode */}
      <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${isCameraActive ? 'opacity-100' : 'opacity-0'}`}>
         <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
         {/* Overlay UI for Spatial Computing feel */}
         <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
         
         {/* Animated Reticle/Focus */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-cyan-500/30 rounded-full animate-[spin_10s_linear_infinite] pointer-events-none"></div>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 border border-dashed border-cyan-400/20 rounded-full animate-[spin_15s_reverse_linear_infinite] pointer-events-none"></div>
         <div className="absolute top-4 left-4 flex gap-2">
            <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-mono animate-pulse">ASTRA_VISION_ACTIVE</span>
            <span className="text-[10px] bg-cyan-900/50 text-cyan-300 px-2 py-0.5 rounded font-mono border border-cyan-500/30">SPATIAL_ANALYSIS</span>
         </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Main UI Layer */}
      <div className={`relative z-10 flex flex-col items-center w-full h-full transition-all duration-500 ${isCameraActive ? 'justify-end pb-8' : 'justify-center gap-6'}`}>
        
        {/* Hologram - Hide when Vision is active to declutter view */}
        {!isCameraActive && (
            <div className="relative">
                <Hologram size="lg" isActive={sessionState !== 'CONNECTING'} />
                {/* Background visualizer when camera is off */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
                    <div className="w-64 h-64 scale-125">
                        <AudioVisualizer 
                            analyser={sessionState === 'ACTIVE' && isPlaying ? outputAnalyserRef.current : inputAnalyserRef.current} 
                            isActive={(sessionState === 'ACTIVE' && isPlaying) || userVolume > 0.01} 
                            color={sessionState === 'STANDBY' ? '#f59e0b' : '#06b6d4'} 
                        />
                    </div>
                </div>
            </div>
        )}

        {/* Audio Visualizer - Move to bottom when Vision active */}
        {isCameraActive && (
            <div className="w-full max-w-2xl h-32 opacity-80 mb-4">
                 <AudioVisualizer 
                    analyser={sessionState === 'ACTIVE' && isPlaying ? outputAnalyserRef.current : inputAnalyserRef.current} 
                    isActive={true} 
                    color="#22d3ee" 
                />
            </div>
        )}
      
        <div className="text-center space-y-4 flex flex-col items-center w-full px-4">
            <div className="space-y-1">
            {sessionState === 'STANDBY' && (
                <>
                    <h2 className="text-2xl font-mono tracking-[0.2em] text-amber-500 animate-pulse">PORCUPINE LISTENING...</h2>
                    <p className="text-amber-700 text-sm font-mono">NEURAL WAKE WORD: "JARVIS"</p>
                </>
            )}
            {sessionState === 'CONNECTING' && (
                <>
                    <h2 className="text-2xl font-mono tracking-[0.2em] text-cyan-400 animate-pulse">ESTABLISHING UPLINK...</h2>
                    <p className="text-cyan-700 text-sm font-mono">AUTHENTICATING...</p>
                </>
            )}
            {sessionState === 'ACTIVE' && !isCameraActive && (
                <>
                    <h2 className="text-2xl font-mono tracking-[0.2em] text-cyan-400">ONLINE</h2>
                    <p className="text-cyan-700 text-sm font-mono">{isPlaying ? 'SPEAKING' : 'LISTENING...'}</p>
                </>
            )}
            </div>

            <div className="flex gap-4">
            {sessionState === 'ACTIVE' && (
                <button onClick={toggleCamera} className={`flex items-center gap-2 px-6 py-3 rounded-full border transition-all backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] ${isCameraActive ? 'bg-red-500/20 border-red-500 text-red-300 hover:bg-red-500/40' : 'bg-cyan-900/30 border-cyan-500 text-cyan-300 hover:bg-cyan-500/20'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                    <span className="text-xs font-mono tracking-widest font-bold">{isCameraActive ? 'DEACTIVATE VISION' : 'ACTIVATE ASTRA VISION'}</span>
                </button>
            )}
            
            {sessionState === 'ACTIVE' && (
                <button onClick={disconnectSession} className="flex items-center gap-2 px-6 py-3 rounded-full border border-red-900/50 text-red-500 bg-black/40 backdrop-blur-md hover:bg-red-900/40 hover:border-red-500 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                    <span className="text-xs font-mono tracking-widest">STANDBY</span>
                </button>
            )}

            {sessionState === 'STANDBY' && (
                <button onClick={() => setSessionState('CONNECTING')} className="flex items-center gap-2 px-6 py-3 rounded-full border border-cyan-800 text-cyan-500 hover:bg-cyan-900/20 hover:border-cyan-500 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                    <span className="text-xs font-mono tracking-widest">CONNECT MANUALLY</span>
                </button>
            )}
            </div>
        </div>
      </div>
      
      {/* Lockdown Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-300">
            <div className="border-4 border-red-600 p-10 rounded-xl bg-red-950/40 flex flex-col items-center gap-6 shadow-[0_0_100px_rgba(220,38,38,0.3)]">
                <svg className="w-24 h-24 text-red-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div className="text-center space-y-2">
                    <h1 className="text-5xl font-black text-red-500 tracking-[0.2em] uppercase glitch-text">SYSTEM LOCKED</h1>
                    <p className="text-red-700 font-mono text-sm tracking-widest">SECURITY PROTOCOLS ENGAGED // SENSORS DISABLED</p>
                </div>
                <button 
                    onClick={() => setLockState(false)}
                    className="mt-4 px-8 py-3 bg-transparent border-2 border-red-600 text-red-500 hover:bg-red-600 hover:text-black font-bold tracking-[0.2em] rounded transition-all uppercase"
                >
                    Disengage Lock
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default LiveSession;
