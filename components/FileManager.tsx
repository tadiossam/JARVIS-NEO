

import React, { useState, useEffect } from 'react';
import { ProjectFile, FileSystemActions } from '../types';

interface FileManagerProps {
  files: ProjectFile[];
  actions: FileSystemActions;
  onClose: () => void;
  activeFileId?: string | null;
}

const FileManager: React.FC<FileManagerProps> = ({ files, actions, onClose, activeFileId }) => {
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [filter, setFilter] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  // Effect to handle external file selection (e.g. from Global Search)
  useEffect(() => {
    if (activeFileId) {
      const file = files.find(f => f.id === activeFileId);
      if (file) {
        setSelectedFile(file);
        setIsEditing(false);
      }
    }
  }, [activeFileId, files]);

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(filter.toLowerCase()) || 
    f.tags.some(t => t.toLowerCase().includes(filter.toLowerCase()))
  );

  const handleSave = () => {
    if (selectedFile) {
        actions.updateFile(selectedFile.id, editContent);
        setSelectedFile({ ...selectedFile, content: editContent });
        setIsEditing(false);
    }
  };

  const getLanguageColor = (lang?: string) => {
      switch(lang?.toLowerCase()) {
          case 'python': return 'text-yellow-400';
          case 'javascript': return 'text-yellow-200';
          case 'typescript': return 'text-blue-400';
          case 'html': return 'text-orange-400';
          case 'css': return 'text-blue-300';
          case 'json': return 'text-green-300';
          default: return 'text-cyan-200';
      }
  };

  return (
    <div className="flex h-full w-full bg-slate-950 text-cyan-400 font-mono relative">
       {/* Sidebar */}
       <div className="w-1/3 min-w-[250px] border-r border-cyan-900/50 flex flex-col bg-slate-900/50">
           <div className="p-4 border-b border-cyan-900/50 bg-cyan-900/10">
               <div className="flex justify-between items-center mb-4">
                   <h2 className="text-lg font-bold tracking-widest flex items-center gap-2">
                       <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                       NEURAL FILES
                   </h2>
                   <button onClick={onClose} className="p-1 hover:bg-cyan-900/30 rounded text-cyan-600 hover:text-cyan-400">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                   </button>
               </div>
               
               <div className="relative">
                   <input 
                     type="text" 
                     placeholder="SEARCH PROTOCOLS..." 
                     value={filter}
                     onChange={(e) => setFilter(e.target.value)}
                     className="w-full bg-slate-950 border border-cyan-800 p-2 pl-8 rounded text-xs text-cyan-300 focus:border-cyan-500 outline-none placeholder-cyan-800"
                   />
                   <svg className="absolute left-2.5 top-2.5 w-3 h-3 text-cyan-700 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                   {filter && (
                       <button 
                         onClick={() => setFilter('')} 
                         className="absolute right-2 top-2 text-cyan-700 hover:text-cyan-400"
                       >
                           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                       </button>
                   )}
               </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-cyan-900/50">
               {filteredFiles.length === 0 && (
                   <div className="text-center text-xs text-slate-600 mt-10">NO FILES INDEXED</div>
               )}
               {filteredFiles.map(file => (
                   <div 
                     key={file.id} 
                     onClick={() => { setSelectedFile(file); setIsEditing(false); }}
                     className={`p-3 rounded cursor-pointer border transition-all group ${selectedFile?.id === file.id ? 'bg-cyan-900/30 border-cyan-500' : 'bg-transparent border-transparent hover:bg-slate-800 hover:border-cyan-900'}`}
                   >
                       <div className="flex justify-between items-start">
                           <span className={`font-bold text-sm truncate max-w-[150px] ${selectedFile?.id === file.id ? 'text-cyan-300' : 'text-slate-400 group-hover:text-cyan-200'}`}>{file.name}</span>
                           <span className="text-[9px] uppercase border border-cyan-900/50 px-1 rounded text-cyan-700">{file.type}</span>
                       </div>
                       <div className="flex justify-between items-end mt-1">
                           <div className="flex gap-1">
                               {file.tags.map(t => <span key={t} className="text-[8px] text-cyan-600">#{t}</span>)}
                           </div>
                           <span className="text-[9px] text-slate-600">{new Date(file.timestamp).toLocaleDateString()}</span>
                       </div>
                   </div>
               ))}
           </div>
       </div>

       {/* Editor / Viewer */}
       <div className="flex-1 flex flex-col bg-slate-950 relative">
           {selectedFile ? (
               <>
                   <div className="h-12 border-b border-cyan-900/50 flex items-center justify-between px-4 bg-slate-900/30">
                       <div className="flex items-center gap-2">
                           <span className="text-cyan-500 font-bold">{selectedFile.name}</span>
                           {selectedFile.language && <span className={`text-[10px] ${getLanguageColor(selectedFile.language)} opacity-70`}>.{selectedFile.language.toUpperCase()}</span>}
                       </div>
                       <div className="flex gap-2">
                           {isEditing ? (
                               <>
                                   <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs text-red-400 hover:bg-red-900/20 rounded">CANCEL</button>
                                   <button onClick={handleSave} className="px-3 py-1 text-xs bg-cyan-600 text-slate-900 font-bold hover:bg-cyan-500 rounded">SAVE CHANGES</button>
                               </>
                           ) : (
                               <>
                                   <button onClick={() => actions.deleteFile(selectedFile.id)} className="px-3 py-1 text-xs text-red-500 hover:text-red-300 hover:bg-red-900/20 rounded">DELETE</button>
                                   <button onClick={() => { setEditContent(selectedFile.content); setIsEditing(true); }} className="px-3 py-1 text-xs border border-cyan-700 text-cyan-400 hover:bg-cyan-900/30 rounded">EDIT</button>
                               </>
                           )}
                       </div>
                   </div>
                   
                   <div className="flex-1 overflow-hidden relative">
                       {isEditing ? (
                           <textarea 
                             value={editContent}
                             onChange={(e) => setEditContent(e.target.value)}
                             className="w-full h-full bg-slate-900 p-4 text-sm font-mono text-cyan-100 outline-none resize-none"
                             spellCheck={false}
                           />
                       ) : (
                           <div className="w-full h-full overflow-auto p-4 bg-slate-950 scrollbar-thin scrollbar-thumb-cyan-900/50">
                               <pre className={`text-sm font-mono whitespace-pre-wrap ${getLanguageColor(selectedFile.language || 'text')}`}>
                                   {selectedFile.content}
                               </pre>
                           </div>
                       )}
                   </div>
               </>
           ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-cyan-900/50">
                   <svg className="w-24 h-24 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                   <div className="text-sm tracking-widest">SELECT A FILE TO INITIALIZE VIEWER</div>
               </div>
           )}
       </div>
    </div>
  );
};

export default FileManager;
