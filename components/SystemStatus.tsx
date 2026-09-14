import React from 'react';
import { SystemStat } from '../types';

interface SystemStatusProps {
  stats: SystemStat[];
}

const SystemStatus: React.FC<SystemStatusProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 border border-cyan-900/50 bg-slate-900/80 rounded-lg">
      <div className="col-span-2 text-xs font-mono text-cyan-500 border-b border-cyan-900/50 pb-1 mb-2">
        SYSTEM DIAGNOSTICS
      </div>
      {stats.map((stat, idx) => (
        <div key={idx} className="flex flex-col">
          <span className="text-cyan-700 text-[10px] uppercase font-bold tracking-widest">{stat.label}</span>
          <div className="flex items-end gap-2">
            <span className={`text-xl font-mono ${
              stat.status === 'critical' ? 'text-red-500' : 
              stat.status === 'warning' ? 'text-yellow-500' : 'text-cyan-300'
            }`}>
              {stat.value}
            </span>
            <span className="text-xs text-cyan-600 mb-1">{stat.unit}</span>
          </div>
          <div className="w-full bg-slate-800 h-1 mt-1 rounded-full overflow-hidden">
            <div 
              className={`h-full ${
                stat.status === 'critical' ? 'bg-red-500' : 
                stat.status === 'warning' ? 'bg-yellow-500' : 'bg-cyan-500'
              }`} 
              style={{ width: `${typeof stat.value === 'number' ? Math.min(stat.value, 100) : 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default SystemStatus;