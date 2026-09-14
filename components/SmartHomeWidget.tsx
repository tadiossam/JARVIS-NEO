
import React, { useState, useEffect, useRef } from 'react';
import { SmartDevice, SmartHomeActions } from '../types';

interface SmartHomeWidgetProps {
  devices: SmartDevice[];
  actions: SmartHomeActions;
  onCameraClick: (id: string) => void;
}

// REAL-TIME CONNECTION QUALITY MONITOR
const ConnectionMonitor: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const historyRef = useRef<number[]>(new Array(50).fill(50));
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const draw = () => {
            const connection = (navigator as any).connection;
            // Get RTT (Latency) - lower is better. Map 0-200ms to 0-100 height
            const rtt = connection ? (connection.rtt || 50) : 50;
            const value = Math.min(100, Math.max(0, rtt / 2)); 
            
            historyRef.current.push(value);
            historyRef.current.shift();

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Grid
            ctx.strokeStyle = '#0e7490';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            for(let x=0; x<canvas.width; x+=20) { ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); }
            ctx.stroke();

            // Draw Graph (Latency)
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < historyRef.current.length; i++) {
                const x = (i / (historyRef.current.length - 1)) * canvas.width;
                const y = canvas.height - (historyRef.current[i] / 100) * canvas.height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Fill area
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
            ctx.fill();

            // Text
            ctx.fillStyle = '#22d3ee';
            ctx.font = '10px monospace';
            ctx.fillText(`RTT: ${rtt}ms`, 5, 12);
            ctx.fillText(`DL: ${(connection?.downlink || 0)} Mbps`, 5, 24);

            animationFrameId = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return <canvas ref={canvasRef} width={300} height={80} className="w-full h-20 bg-slate-950/50 rounded border border-cyan-900/30 mb-2" />;
};

const SmartHomeWidget: React.FC<SmartHomeWidgetProps> = ({ devices, actions, onCameraClick }) => {
  const [activeTab, setActiveTab] = useState<'security' | 'living' | 'network'>('network');

  const securityDevices = devices.filter(d => ['CAMERA', 'LOCK'].includes(d.type));
  const livingDevices = devices.filter(d => !['CAMERA', 'LOCK', 'NETWORK'].includes(d.type));
  const networkDevices = devices.filter(d => d.type === 'NETWORK');

  return (
    <div className="bg-slate-900/40 border border-cyan-900/30 rounded-lg p-0 flex flex-col font-mono text-cyan-300 h-full overflow-hidden">
      {/* Header Tabs */}
      <div className="flex border-b border-cyan-900/30 bg-slate-900/50 overflow-x-auto">
        {['network', 'security', 'living'].map(tab => (
           <button 
             key={tab}
             onClick={() => setActiveTab(tab as any)}
             className={`flex-1 min-w-[60px] py-2 text-[10px] uppercase tracking-wider hover:bg-cyan-900/20 transition-colors ${activeTab === tab ? 'text-cyan-300 border-b-2 border-cyan-500' : 'text-cyan-700'}`}
           >
             {tab}
           </button>
        ))}
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-cyan-900/50">
        
        {/* NETWORK TAB - REAL TIME DATA */}
        {activeTab === 'network' && (
           <div className="space-y-3 animate-in slide-in-from-right-2">
              <div className="p-2 border border-cyan-900/30 rounded bg-slate-950/80">
                  <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] text-cyan-600 font-bold uppercase">LIVE CONNECTION QUALITY</span>
                      <span className="text-[8px] text-cyan-800 animate-pulse">MONITORING</span>
                  </div>
                  <ConnectionMonitor />
              </div>

              {networkDevices.map(dev => (
                 <div key={dev.id} className="group relative p-3 rounded bg-slate-950/80 border border-cyan-900/30 hover:border-cyan-500/50 transition-all overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${dev.status === 'online' ? 'bg-green-500 shadow-[0_0_10px_lime]' : 'bg-red-500'}`}></div>
                    
                    <div className="pl-3 flex justify-between items-start mb-2">
                        <div>
                            <div className="text-xs font-bold text-cyan-300">{dev.name}</div>
                            <div className="text-[10px] text-cyan-600 font-mono tracking-wider">{dev.brand} // {dev.ip}</div>
                        </div>
                        <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${dev.status === 'online' ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                            {dev.status}
                        </div>
                    </div>

                    <div className="pl-3 grid grid-cols-3 gap-2 text-[9px] font-mono opacity-80 mb-2 border-b border-cyan-900/20 pb-2">
                        <div className="flex flex-col">
                           <span className="text-cyan-700">RTT</span>
                           <span className={dev.latency && dev.latency < 50 ? 'text-green-400' : 'text-yellow-400'}>{dev.latency}ms</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-cyan-700">DL</span>
                           <span className="text-cyan-400">{dev.download}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-cyan-700">TYPE</span>
                           <span className="text-cyan-400 uppercase">{dev.frequency}</span>
                        </div>
                    </div>
                 </div>
              ))}
           </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="space-y-4 animate-in slide-in-from-right-2">
             <div className="grid grid-cols-2 gap-3">
               {securityDevices.filter(d => d.type === 'CAMERA').map(cam => (
                 <div key={cam.id} className="relative aspect-video bg-black rounded border border-cyan-900/50 overflow-hidden group cursor-pointer shadow-lg" onClick={() => onCameraClick(cam.id)}>
                   <img src={actions.getCameraStream(cam.id)} alt={cam.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                   <div className="absolute top-1 left-1 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_5px_red]"></div>
                      <span className="text-[6px] text-white font-bold bg-black/50 px-1 rounded">LIVE</span>
                   </div>
                   <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1">
                      <div className="text-[8px] font-bold text-cyan-300 truncate">{cam.name}</div>
                   </div>
                 </div>
               ))}
             </div>
             <div className="space-y-2">
               {securityDevices.filter(d => d.type === 'LOCK').map(lock => (
                 <div key={lock.id} className="flex items-center justify-between p-3 rounded bg-slate-950/50 border border-cyan-900/30 shadow-md">
                    <span className="text-xs font-bold text-cyan-200">{lock.name}</span>
                    <button 
                      onClick={() => actions.setDeviceState(lock.id, lock.status === 'locked' ? 'unlocked' : 'locked')}
                      className={`px-3 py-1 rounded font-bold text-[8px] border ${lock.status === 'locked' ? 'bg-red-900/20 text-red-400 border-red-900' : 'bg-green-900/20 text-green-400 border-green-900'}`}
                    >
                      {lock.status === 'locked' ? 'LOCKED' : 'UNLOCKED'}
                    </button>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* LIVING / CUSTOM TAB */}
        {activeTab === 'living' && (
           <div className="space-y-4 animate-in slide-in-from-right-2">
              {livingDevices.length === 0 && <div className="text-xs text-center opacity-50">No Devices Configured</div>}
              {livingDevices.map(dev => (
                 <div key={dev.id} className="p-3 rounded bg-slate-950/50 border border-cyan-900/30 flex items-center justify-between">
                    <div>
                       <div className="text-xs font-bold text-cyan-200">{dev.name}</div>
                       <div className="text-[10px] text-cyan-700">{dev.brand}</div>
                       {dev.controlUrl && <div className="text-[8px] text-green-700">WEBHOOK LINKED</div>}
                    </div>
                    <button 
                      onClick={() => actions.setDeviceState(dev.id, dev.status === 'on' ? 'off' : 'on')} 
                      className={`px-3 py-1 rounded text-[10px] border ${dev.status === 'on' ? 'border-green-500 text-green-400' : 'border-cyan-500 text-cyan-400'}`}
                    >
                      {dev.status === 'on' ? 'ACTIVE' : 'ACTIVATE'}
                    </button>
                 </div>
              ))}
           </div>
        )}
      </div>
    </div>
  );
};

export default SmartHomeWidget;
