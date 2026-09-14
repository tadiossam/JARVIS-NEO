import React, { useState } from 'react';

interface HologramProps {
  size?: 'sm' | 'md' | 'lg';
  isActive?: boolean;
}

const AVATAR_URL = "/jarvis_avatar.png";
const FALLBACK_URL = "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?q=80&w=600&auto=format&fit=crop";

const Hologram: React.FC<HologramProps> = ({ size = 'md', isActive = true }) => {
  const [mode, setMode] = useState<'CORE' | 'AVATAR'>('CORE');
  const [imgSrc, setImgSrc] = useState(AVATAR_URL);
  const [scanSpeed, setScanSpeed] = useState(2); 

  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-48 h-48',
    lg: 'w-72 h-72',
  };

  return (
    <div className={`relative flex items-center justify-center group ${sizeClasses[size]} ${isActive ? 'opacity-100' : 'opacity-50 grayscale'}`}>
      {/* Inline Styles for specific animations */}
      <style>{`
        @keyframes complexFloat {
          0% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -10px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        
        @keyframes ringSpin {
           0% { transform: rotate(0deg); border-color: rgba(6,182,212,0.3); }
           50% { border-color: rgba(34,211,238,0.6); }
           100% { transform: rotate(360deg); border-color: rgba(6,182,212,0.3); }
        }

        @keyframes reverseSpin {
           0% { transform: rotate(360deg); }
           100% { transform: rotate(0deg); }
        }

        @keyframes scanline {
            0% { top: -20%; opacity: 0; }
            50% { opacity: 1; }
            100% { top: 120%; opacity: 0; }
        }

        @keyframes corePulse {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 30px rgba(6,182,212,0.6); }
            100% { transform: scale(0.95); opacity: 0.8; }
        }
      `}</style>

      {/* Ambient Pulsing Glow (Background) */}
      <div className="absolute inset-[-20%] rounded-full bg-cyan-500/10 blur-[50px] pointer-events-none animate-pulse"></div>
      
      {/* Floating Particles */}
      {isActive && (
        <div className="absolute inset-[-50%] pointer-events-none z-0 overflow-hidden rounded-full">
          {[...Array(15)].map((_, i) => (
             <div 
               key={i}
               className="absolute bg-cyan-400 rounded-full opacity-60"
               style={{
                 width: Math.random() * 2 + 1 + 'px',
                 height: Math.random() * 2 + 1 + 'px',
                 left: `${Math.random() * 100}%`,
                 top: `${Math.random() * 100}%`,
                 animation: `complexFloat ${2 + Math.random() * 3}s ease-in-out infinite`,
                 animationDelay: `${Math.random() * 2}s`
               }}
             />
          ))}
        </div>
      )}

      {/* Main Container */}
      <div className="absolute inset-2 rounded-full overflow-hidden border border-cyan-500/30 z-10 bg-black shadow-[0_0_50px_rgba(6,182,212,0.2)_inset] relative flex items-center justify-center">
         
         {mode === 'AVATAR' ? (
             <img 
                src={imgSrc} 
                onError={() => setImgSrc(FALLBACK_URL)}
                alt="AI Avatar" 
                className="w-full h-full object-cover"
                style={{
                    mixBlendMode: 'lighten', 
                    opacity: 0.95,
                    filter: 'contrast(1.1) brightness(1.1)' 
                }}
             />
         ) : (
             // Pure CSS/SVG Reactor Core
             <div className="w-full h-full relative flex items-center justify-center bg-black">
                 {/* Inner Glow */}
                 <div className="absolute w-[40%] h-[40%] bg-cyan-500 rounded-full blur-xl animate-[corePulse_3s_ease-in-out_infinite]"></div>
                 <div className="absolute w-[30%] h-[30%] bg-white rounded-full blur-md opacity-80"></div>
                 
                 {/* Rotating Rings */}
                 <svg className="absolute w-[90%] h-[90%] animate-[spin_10s_linear_infinite]" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" stroke="rgba(6,182,212,0.3)" strokeWidth="1" fill="none" strokeDasharray="20,10" />
                 </svg>
                 
                 <svg className="absolute w-[70%] h-[70%] animate-[reverseSpin_7s_linear_infinite]" viewBox="0 0 100 100">
                    <path d="M50 5 A 45 45 0 0 1 95 50" stroke="rgba(6,182,212,0.6)" strokeWidth="2" fill="none" />
                    <path d="M50 95 A 45 45 0 0 1 5 50" stroke="rgba(6,182,212,0.6)" strokeWidth="2" fill="none" />
                 </svg>

                 <svg className="absolute w-[50%] h-[50%] animate-[spin_4s_linear_infinite]" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="48" stroke="rgba(34,211,238,0.8)" strokeWidth="4" fill="none" strokeDasharray="10,40" />
                 </svg>

                 {/* Tech HUD Overlay */}
                 <div className="absolute inset-0 bg-cyan-900/20 mix-blend-overlay"></div>
             </div>
         )}
         
         {/* Scanlines & Glitch Overlay - Subtle to not obscure the content */}
         <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,255,255,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none z-20"></div>
         <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/40 via-transparent to-transparent z-20"></div>
         
         {/* Vertical Scanning Light - Dynamic Speed */}
         <div 
            className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent z-30 pointer-events-none"
            style={{ animation: `scanline ${scanSpeed}s linear infinite` }}
         ></div>
      </div>

      {/* Orbital Rings - Rotating around */}
      <div className="absolute w-[110%] h-[110%] rounded-full border border-cyan-500/20 border-t-transparent border-l-transparent shadow-[0_0_15px_rgba(6,182,212,0.1)]" style={{ animation: 'ringSpin 10s linear infinite' }}></div>
      <div className="absolute w-[95%] h-[95%] rounded-full border border-cyan-400/30 border-b-transparent border-r-transparent animate-[spin_15s_reverse_linear_infinite]"></div>
      
      {/* Data Points / Face Mapping Markers - Subtle Overlay */}
      <div className="absolute inset-0 z-40 opacity-40 pointer-events-none">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" fill="none" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="0.5">
             <path d="M20,50 Q50,90 80,50" fill="none" strokeDasharray="2,2" className="animate-pulse" />
             <circle cx="50" cy="50" r="35" stroke="rgba(6, 182, 212, 0.1)" strokeWidth="1" />
             <line x1="50" y1="15" x2="50" y2="25" stroke="rgba(6, 182, 212, 0.5)" />
             <line x1="50" y1="75" x2="50" y2="85" stroke="rgba(6, 182, 212, 0.5)" />
             <line x1="15" y1="50" x2="25" y2="50" stroke="rgba(6, 182, 212, 0.5)" />
             <line x1="75" y1="50" x2="85" y2="50" stroke="rgba(6, 182, 212, 0.5)" />
          </svg>
      </div>

      {/* Hover Controls */}
      {isActive && (
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 flex flex-col gap-2 items-center bg-black/90 p-3 rounded-lg border border-cyan-900/50 backdrop-blur-md">
            
            {/* Mode Toggle */}
            <div className="flex bg-slate-800 rounded p-0.5 w-full">
                <button 
                    onClick={() => setMode('CORE')} 
                    className={`flex-1 text-[8px] py-1 rounded transition-colors ${mode === 'CORE' ? 'bg-cyan-600 text-white' : 'text-cyan-500 hover:text-cyan-300'}`}
                >
                    CORE
                </button>
                <button 
                    onClick={() => setMode('AVATAR')} 
                    className={`flex-1 text-[8px] py-1 rounded transition-colors ${mode === 'AVATAR' ? 'bg-cyan-600 text-white' : 'text-cyan-500 hover:text-cyan-300'}`}
                >
                    AVATAR
                </button>
            </div>

            {/* Scan Speed */}
            <div className="w-full">
                <div className="flex justify-between w-full text-[6px] font-mono text-cyan-500 mb-1 uppercase tracking-wider">
                    <span>SCAN RATE</span>
                    <span>{scanSpeed}s</span>
                </div>
                <input
                    type="range"
                    min="0.5"
                    max="8"
                    step="0.5"
                    value={scanSpeed}
                    onChange={(e) => setScanSpeed(parseFloat(e.target.value))}
                    className="w-full h-1 bg-cyan-900/50 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-cyan-200"
                />
            </div>
        </div>
      )}

    </div>
  );
};

export default Hologram;
