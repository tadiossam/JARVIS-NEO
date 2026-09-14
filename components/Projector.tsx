
import React, { useState, useEffect, useRef } from 'react';
import { ProjectorData } from '../types';

interface ProjectorProps {
  windows: ProjectorData[];
  onClose: (id: string) => void;
}

const ProjectorWindow: React.FC<{ data: ProjectorData, onClose: () => void, zIndex: number, onFocus: () => void }> = ({ data, onClose, zIndex, onFocus }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    
    // Responsive Initial Position
    const [position, setPosition] = useState(() => {
        // If mobile (iPhone/Android), ignore cascaded position and center/top it
        if (window.innerWidth < 768) {
             return { x: window.innerWidth * 0.05, y: 80 }; // 5% margin, 80px from top
        }
        return data.position || { x: 50, y: 50 };
    });

    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Measuring Tool State
    const [measurePoints, setMeasurePoints] = useState<{a: {x:number, y:number}, b: {x:number, y:number}}>({ a: {x: 150, y: 150}, b: {x: 350, y: 150} });
    const [activePoint, setActivePoint] = useState<'a' | 'b' | null>(null);
    const [scanLine, setScanLine] = useState(0);

    useEffect(() => {
        if (data.type === 'CAMERA_FEED' || data.type === 'MEASURE') {
           const timer = setInterval(() => setCurrentTime(new Date()), 1000);
           return () => clearInterval(timer);
        }
    }, [data]);

    // Simulated Scanning Effect for LiDAR
    useEffect(() => {
        if (data.type === 'MEASURE') {
            const scan = setInterval(() => {
                setScanLine(prev => (prev + 1) % 100);
            }, 30);
            return () => clearInterval(scan);
        }
    }, [data.type]);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent dragging the window if we are interacting with content
        if ((e.target as HTMLElement).closest('.interactive-content')) return;

        setIsDragging(true);
        onFocus();
        const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.current.x,
                    y: e.clientY - dragOffset.current.y
                });
            }
        };
        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // Measuring Point Drag Logic
    const handlePointDragStart = (point: 'a' | 'b', e: React.MouseEvent) => {
        e.stopPropagation();
        setActivePoint(point);
    };

    const handleContentMouseMove = (e: React.MouseEvent) => {
        if (activePoint && data.type === 'MEASURE') {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setMeasurePoints(prev => ({
                ...prev,
                [activePoint]: { x, y }
            }));
        }
    };

    const handleContentMouseUp = () => {
        setActivePoint(null);
    };

    // Calculate simulated distance (pixels to 'cm' approximation)
    const getDistance = () => {
        const dx = measurePoints.b.x - measurePoints.a.x;
        const dy = measurePoints.b.y - measurePoints.a.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        // Mock conversion: 100px = 5 inches
        return {
            pixels: Math.round(dist),
            inches: (dist * 0.05).toFixed(1),
            cm: (dist * 0.127).toFixed(1)
        };
    };

    const dist = getDistance();

    // Determine initial dimensions based on screen size (Mobile Proportionality)
    const getInitialDimensions = () => {
        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            switch(data.type) {
                case 'BROWSER': return { width: '90vw', height: '70vh' };
                case 'YOUTUBE': return { width: '90vw', height: 'auto', aspectRatio: '16/9' };
                case 'CAMERA_FEED': 
                case 'MEASURE': return { width: '90vw', height: '60vh' };
                case 'WHITEBOARD': return { width: '95vw', height: '60vh' };
                case 'CODE': return { width: '90vw', height: '60vh' };
                case 'REPORT': return { width: '95vw', height: '80vh' };
                case 'ANALYSIS': return { width: '90vw', height: '50vh' };
                default: return { width: '85vw', height: '50vh' };
            }
        }

        switch(data.type) {
            case 'BROWSER': return { width: '800px', height: '600px' };
            case 'YOUTUBE': return { width: '560px', height: '315px' }; // Standard 16:9
            case 'CAMERA_FEED': 
            case 'MEASURE': return { width: '640px', height: '480px' };
            case 'WHITEBOARD': return { width: '700px', height: '500px' };
            case 'REPORT': return { width: '700px', height: '800px' };
            default: return { width: '600px', height: '400px' };
        }
    };

    const dims = getInitialDimensions();

    return (
        <div 
            className={`absolute rounded-lg overflow-hidden border flex flex-col min-w-[300px] min-h-[200px] resize overflow-auto shadow-[0_0_30px_rgba(6,182,212,0.3)]
                ${data.type === 'WHITEBOARD' ? 'bg-slate-900/40 border-cyan-500/30 backdrop-blur-sm' : 
                  data.type === 'REPORT' ? 'bg-slate-900 border-slate-700 shadow-2xl' :
                  'bg-slate-950 border-cyan-500/50'}
            `}
            style={{ 
                left: position.x, 
                top: position.y, 
                zIndex: zIndex + 100, // Ensure high Z above app
                width: dims.width,
                height: dims.height,
                aspectRatio: (dims as any).aspectRatio,
                maxWidth: '100vw',
                maxHeight: '90vh'
            }}
            onMouseDown={onFocus}
        >
            {/* Header / Drag Handle */}
            <div 
                className={`flex items-center justify-between p-2 border-b border-cyan-900/50 cursor-move select-none transition-colors 
                    ${data.type === 'YOUTUBE' ? 'bg-red-900/20' : 
                      data.type === 'MEASURE' ? 'bg-yellow-900/20' : 
                      data.type === 'WHITEBOARD' ? 'bg-white/5' :
                      data.type === 'REPORT' ? 'bg-slate-800' :
                      'bg-cyan-900/30'}
                `}
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse 
                        ${data.type === 'YOUTUBE' ? 'bg-red-500' : 
                          data.type === 'MEASURE' ? 'bg-yellow-500' : 
                          data.type === 'WHITEBOARD' ? 'bg-white' :
                          data.type === 'REPORT' ? 'bg-indigo-500' :
                          'bg-cyan-500'}
                    `}></div>
                    <span className={`font-mono tracking-widest text-xs uppercase truncate max-w-[200px] 
                        ${data.type === 'WHITEBOARD' ? 'text-white' : 
                          data.type === 'REPORT' ? 'text-slate-300' : 
                          'text-cyan-300'}`}>
                        {data.title || `WIN_${data.id.substring(0,4)}`}
                    </span>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="text-cyan-700 hover:text-red-400 transition-colors p-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            {/* Content Container */}
            <div className={`flex-1 overflow-auto relative group flex flex-col ${data.type === 'WHITEBOARD' ? 'bg-transparent' : 'bg-slate-900/90'}`}>
                {/* Background Grid for tech feel */}
                {(data.type !== 'WHITEBOARD' && data.type !== 'REPORT') && <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>}

                {data.type === 'BROWSER' && (
                    <div className="w-full h-full flex flex-col">
                        <div className="flex items-center gap-2 p-1 bg-slate-800 border-b border-cyan-900/30 text-[10px] text-cyan-500 font-mono">
                            <span className="opacity-50">URL:</span>
                            <span className="text-cyan-300 truncate flex-1">{data.content}</span>
                        </div>
                        <iframe 
                            src={data.content} 
                            className="flex-1 w-full bg-white" 
                            title="Browser"
                            sandbox="allow-scripts allow-same-origin allow-popups"
                        />
                    </div>
                )}

                {data.type === 'YOUTUBE' && (
                    <div className="w-full h-full bg-black flex flex-col">
                        <iframe
                            width="100%"
                            height="100%"
                            src={`https://www.youtube.com/embed/${data.content.trim()}?autoplay=1&origin=${window.location.origin}&enablejsapi=1`}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="flex-1"
                        ></iframe>
                    </div>
                )}

                {data.type === 'CODE' && (
                    <div className="p-4 font-mono text-xs text-cyan-100 whitespace-pre overflow-x-auto">
                        {data.content}
                    </div>
                )}

                {data.type === 'ANALYSIS' && (
                    <div className="p-4 font-mono text-cyan-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {data.content}
                    </div>
                )}

                {data.type === 'REPORT' && (
                    <div className="w-full h-full bg-slate-900 flex flex-col overflow-hidden">
                        {/* Report Toolbar */}
                        <div className="h-8 bg-slate-800 border-b border-slate-700 flex items-center justify-end px-2 gap-2">
                             <span className="text-[10px] text-slate-500 font-mono">SECURE DOCUMENT VIEWER // V1.0</span>
                             <div className="w-px h-4 bg-slate-700 mx-2"></div>
                             <button className="text-[9px] text-indigo-400 hover:text-indigo-200">PRINT</button>
                             <button className="text-[9px] text-indigo-400 hover:text-indigo-200">EXPORT_PDF</button>
                        </div>
                        {/* Document Page */}
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-900">
                             <div className="max-w-2xl mx-auto bg-slate-800/50 min-h-[800px] p-10 shadow-lg border border-slate-700/50 rounded-sm">
                                <div className="border-b-2 border-slate-600 pb-4 mb-6 flex justify-between items-end">
                                    <h1 className="text-2xl font-bold text-slate-200 font-sans tracking-tight">{data.title}</h1>
                                    <span className="text-xs font-mono text-slate-500">{new Date().toLocaleDateString()}</span>
                                </div>
                                <div className="prose prose-invert prose-sm max-w-none text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">
                                    {data.content}
                                </div>
                                <div className="mt-12 pt-4 border-t border-slate-700 flex justify-between text-[10px] text-slate-600 font-mono">
                                    <span>CONFIDENTIAL</span>
                                    <span>GENERATED BY J.A.R.V.I.S.</span>
                                </div>
                             </div>
                        </div>
                    </div>
                )}

                {data.type === 'IMAGE' && (
                    <div className="w-full h-full flex items-center justify-center p-2 bg-black">
                        <img src={data.content} alt="Projected" className="max-w-full max-h-full rounded border border-cyan-500/30 object-contain" />
                    </div>
                )}

                {data.type === 'WHITEBOARD' && (
                    <div className="w-full h-full flex items-center justify-center relative bg-white/5">
                        <svg 
                            className="w-full h-full p-4 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" 
                            viewBox="0 0 800 600" 
                            preserveAspectRatio="xMidYMid meet"
                            style={{ stroke: 'white', fill: 'transparent', strokeWidth: 2, strokeLinecap: 'round' }}
                            dangerouslySetInnerHTML={{ __html: data.content }}
                        />
                        <div className="absolute bottom-2 right-2 text-[10px] text-white/50 font-mono">ASTRA_WHITEBOARD_LINK</div>
                    </div>
                )}

                {(data.type === 'CAMERA_FEED' || data.type === 'MEASURE') && (
                    <div 
                        className="relative w-full h-full bg-black flex flex-col font-mono interactive-content select-none overflow-hidden"
                        onMouseMove={handleContentMouseMove}
                        onMouseUp={handleContentMouseUp}
                        onMouseLeave={handleContentMouseUp}
                    >
                        {/* Main Feed */}
                        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                            
                            {/* Normal Camera / Measure Image */}
                            <img 
                                src={data.content} 
                                alt="Live Feed" 
                                className={`w-full h-full object-cover pointer-events-none transition-all duration-1000 ${data.type === 'MEASURE' ? 'contrast-125 saturate-50' : 'opacity-90'}`} 
                            />
                            
                            {data.type === 'MEASURE' && (
                                <>
                                    {/* LiDAR Mesh Overlay */}
                                    <div className="absolute inset-0 pointer-events-none opacity-20" 
                                         style={{ 
                                             backgroundImage: 'linear-gradient(rgba(251, 191, 36, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(251, 191, 36, 0.4) 1px, transparent 1px)', 
                                             backgroundSize: '30px 30px',
                                             transform: 'perspective(500px) rotateX(5deg) scale(1.1)'
                                         }}>
                                    </div>

                                    {/* Scanning Beam */}
                                    <div className="absolute left-0 w-full h-2 bg-yellow-400/30 blur-md pointer-events-none transition-all duration-75"
                                         style={{ top: `${scanLine}%` }}>
                                    </div>
                                    <div className="absolute left-0 w-full h-[1px] bg-yellow-400/80 pointer-events-none transition-all duration-75"
                                         style={{ top: `${scanLine}%` }}>
                                    </div>

                                    {/* Simulated Point Cloud Dots */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        {[...Array(15)].map((_, i) => (
                                            <div key={i} 
                                                 className="absolute w-1 h-1 bg-yellow-300 rounded-full opacity-60 animate-pulse"
                                                 style={{
                                                     left: `${(i * 17 + scanLine) % 100}%`,
                                                     top: `${(i * 23 + scanLine * 0.5) % 100}%`,
                                                     transition: 'top 0.5s linear'
                                                 }}>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Side HUD Analysis Data */}
                                    <div className="absolute top-10 right-2 w-32 flex flex-col gap-1 pointer-events-none">
                                        <div className="bg-black/60 border-l-2 border-yellow-500 p-1 text-[8px] text-yellow-100 font-mono">
                                            <div className="text-yellow-500 font-bold">DEPTH MAP</div>
                                            <div className="flex justify-between"><span>MIN:</span><span>0.2m</span></div>
                                            <div className="flex justify-between"><span>MAX:</span><span>4.5m</span></div>
                                        </div>
                                        <div className="bg-black/60 border-l-2 border-yellow-500 p-1 text-[8px] text-yellow-100 font-mono mt-1">
                                            <div className="text-yellow-500 font-bold">SURFACE</div>
                                            <div>DETECTED</div>
                                            <div className="text-xs tracking-wider">{Math.floor(scanLine)}%</div>
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            {/* Measuring Overlay */}
                            {data.type === 'MEASURE' && (
                                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                                    <defs>
                                        <filter id="glow">
                                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                            <feMerge>
                                                <feMergeNode in="coloredBlur"/>
                                                <feMergeNode in="SourceGraphic"/>
                                            </feMerge>
                                        </filter>
                                    </defs>
                                    {/* Connection Line */}
                                    <line 
                                        x1={measurePoints.a.x} y1={measurePoints.a.y} 
                                        x2={measurePoints.b.x} y2={measurePoints.b.y} 
                                        stroke="#fbbf24" strokeWidth="2" strokeDasharray="5,3" 
                                        filter="url(#glow)"
                                    />
                                    {/* Tick Marks on Line */}
                                    <line 
                                        x1={measurePoints.a.x} y1={measurePoints.a.y - 5} 
                                        x2={measurePoints.a.x} y2={measurePoints.a.y + 5} 
                                        stroke="#fbbf24" strokeWidth="2" 
                                    />
                                    <line 
                                        x1={measurePoints.b.x} y1={measurePoints.b.y - 5} 
                                        x2={measurePoints.b.x} y2={measurePoints.b.y + 5} 
                                        stroke="#fbbf24" strokeWidth="2" 
                                    />

                                    {/* Distance Label */}
                                    <g transform={`translate(${(measurePoints.a.x + measurePoints.b.x)/2}, ${(measurePoints.a.y + measurePoints.b.y)/2})`}>
                                        <rect x="-45" y="-18" width="90" height="36" rx="4" fill="rgba(0,0,0,0.8)" stroke="#fbbf24" strokeWidth="1" />
                                        <text x="0" y="5" textAnchor="middle" fill="#fbbf24" fontSize="14" fontWeight="bold" fontFamily="monospace">
                                            {dist.inches}"
                                        </text>
                                        <text x="0" y="14" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="normal" fontFamily="monospace" opacity="0.8">
                                            {dist.cm} CM
                                        </text>
                                    </g>
                                </svg>
                            )}

                            {/* Draggable Points for Measure */}
                            {data.type === 'MEASURE' && (
                                <>
                                    <div 
                                        className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border border-yellow-400 bg-yellow-400/10 flex items-center justify-center cursor-move pointer-events-auto z-30 group"
                                        style={{ left: measurePoints.a.x, top: measurePoints.a.y }}
                                        onMouseDown={(e) => handlePointDragStart('a', e)}
                                    >
                                        <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_10px_yellow]"></div>
                                        <div className="absolute w-full h-full border border-dashed border-yellow-400 rounded-full animate-spin opacity-50"></div>
                                        <span className="absolute -top-6 text-yellow-400 text-[10px] font-bold bg-black/50 px-1 rounded">START</span>
                                    </div>
                                    <div 
                                        className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border border-yellow-400 bg-yellow-400/10 flex items-center justify-center cursor-move pointer-events-auto z-30 group"
                                        style={{ left: measurePoints.b.x, top: measurePoints.b.y }}
                                        onMouseDown={(e) => handlePointDragStart('b', e)}
                                    >
                                        <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_10px_yellow]"></div>
                                        <div className="absolute w-full h-full border border-dashed border-yellow-400 rounded-full animate-spin opacity-50"></div>
                                        <span className="absolute -top-6 text-yellow-400 text-[10px] font-bold bg-black/50 px-1 rounded">END</span>
                                    </div>
                                </>
                            )}
                            
                            {/* Feed Overlays */}
                            <div className="absolute top-2 right-2 flex items-center gap-2 z-10 pointer-events-none">
                                <div className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse shadow-[0_0_10px_red]">LIVE</div>
                                <div className="bg-black/60 backdrop-blur text-cyan-500 text-[9px] px-1.5 py-0.5 rounded border border-cyan-900/50">
                                    {currentTime.toLocaleTimeString()}
                                </div>
                            </div>
                            
                            <div className="absolute top-2 left-2 text-white font-bold drop-shadow-md flex flex-col z-10 pointer-events-none">
                                <span className="text-cyan-400 font-mono tracking-widest text-xs">
                                    {data.type === 'MEASURE' ? 'LiDAR_ARRAY_V1' : 'REOLINK'}
                                </span>
                                <span className="text-[8px] opacity-70 tracking-wider">
                                    {data.type === 'MEASURE' ? 'SPATIAL_MAPPING_ACTIVE' : 'CAM_FEED_01'}
                                </span>
                            </div>

                            {/* Crosshairs/HUD */}
                            {data.type !== 'MEASURE' && (
                                <div className="absolute center w-4 h-4 border border-cyan-500/50 opacity-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                            )}
                        </div>

                        {/* Camera Controls Footer */}
                        <div className="h-10 bg-slate-900/90 border-t border-cyan-900/50 flex items-center justify-between px-2 shrink-0 z-10">
                            <div className="flex gap-2">
                                <button className="px-2 py-1 border border-cyan-800 rounded hover:bg-cyan-900/50 text-cyan-400 text-[9px] uppercase">Snap</button>
                                <button className="px-2 py-1 border border-cyan-800 rounded hover:bg-red-900/20 text-red-400 text-[9px] uppercase">Rec</button>
                            </div>
                            <div className="text-[8px] text-cyan-700 font-bold">
                                {data.type === 'MEASURE' ? 'AI_ASSISTED_METRICS' : 'PTZ ENABLED'}
                            </div>
                        </div>
                    </div>
                )}
            </div>

             {/* Resize Handle (Visual Only) */}
             <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-50 bg-gradient-to-tl from-cyan-500/50 to-transparent"></div>
        </div>
    );
};

const Projector: React.FC<ProjectorProps> = ({ windows, onClose }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!windows || windows.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
       {/* Dimmed Background if any windows open */}
       <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-auto"></div>
       
       {windows.map((win) => (
           <div key={win.id} className="pointer-events-auto">
               <ProjectorWindow 
                 data={win} 
                 onClose={() => onClose(win.id)}
                 zIndex={activeId === win.id ? 10 : 0}
                 onFocus={() => setActiveId(win.id)}
               />
           </div>
       ))}
    </div>
  );
};

export default Projector;
