
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import type { Move, Square, Piece } from 'chess.js';
import { GoogleGenAI, Modality } from "@google/genai";
import { playAudioData } from '../utils/audio';
import { SavedGame } from '../types';

interface ChessGameProps {
  onLog: (msg: string) => void;
}

const ChessGame: React.FC<ChessGameProps> = ({ onLog }) => {
  // Game State
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen()); // Driver for updates
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastMove, setLastMove] = useState<Pick<Move, 'from' | 'to'> | null>(null);
  const [view3D, setView3D] = useState(false); // Default to 2D for stability

  // Persistence State
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saveName, setSaveName] = useState('');

  // Load saves on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jarvis_chess_saves');
      if (saved) setSavedGames(JSON.parse(saved));
    } catch(e) { console.error("Failed to load saves", e); }
  }, []);

  // --- AUDIO HELPER ---
  const speak = async (text: string) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
            },
        });
        const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64) await playAudioData(base64);
    } catch(e) {}
  };

  // --- AI MOVE LOGIC ---
  const makeAiMove = useCallback(async (currentFen: string) => {
    setIsAiThinking(true);
    const tempGame = new Chess(currentFen);
    
    // Fallback random move generator if AI fails or hallucinates
    const playRandomMove = () => {
        const moves = tempGame.moves({ verbose: true });
        if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            const newGame = new Chess(currentFen);
            newGame.move(randomMove.san);
            setGame(newGame);
            setFen(newGame.fen());
            setLastMove({ from: randomMove.from, to: randomMove.to });
            onLog(`J.A.R.V.I.S. plays: ${randomMove.san}`);
            
            if (newGame.isCheckmate()) speak("Checkmate. Good game.");
            else if (newGame.isCheck()) speak("Check.");
        }
        setIsAiThinking(false);
    };

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Play chess as Black. FEN: ${currentFen}.
            Valid moves: ${tempGame.moves().join(', ')}.
            Reply ONLY with the move in SAN format (e.g. Nf6, exd5). Do not explain.`,
        });

        let moveSan = response.text?.trim() || "";
        // Clean up response (remove punctuation, quotes)
        moveSan = moveSan.replace(/['".]/g, '');

        onLog(`J.A.R.V.I.S. thinking... Protocol: ${moveSan}`);

        if (moveSan) {
            const newGame = new Chess(currentFen);
            try {
                const result = newGame.move(moveSan);
                if (result) {
                    setGame(newGame);
                    setFen(newGame.fen());
                    setLastMove({ from: result.from, to: result.to });
                    if (newGame.isCheckmate()) speak("Checkmate.");
                    else if (newGame.isCheck()) speak("Check.");
                    else if (result.captured) speak("Captured.");
                    setIsAiThinking(false);
                } else {
                    onLog("AI suggested invalid move. Executing fallback strategy.");
                    playRandomMove();
                }
            } catch (e) {
                playRandomMove();
            }
        } else {
            playRandomMove();
        }
    } catch (e: any) {
        onLog(`AI Error: ${e.message}`);
        playRandomMove();
    }
  }, [onLog]);

  // --- INTERACTION ---
  const handleSquareClick = (square: Square) => {
    // 1. If AI is thinking or game over, ignore
    if (isAiThinking || game.isGameOver()) return;

    // 2. Select Source Square
    if (!selectedSquare) {
        const piece = game.get(square);
        // Only allow selecting White pieces (User)
        if (piece && piece.color === 'w') {
            setSelectedSquare(square);
            // Highlight possible moves
            const moves = game.moves({ square, verbose: true });
            setPossibleMoves(moves.map(m => m.to));
        }
        return;
    }

    // 3. If clicking the same square, deselect
    if (selectedSquare === square) {
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
    }

    // 4. Attempt Move
    try {
        const gameCopy = new Chess(game.fen());
        const move = gameCopy.move({
            from: selectedSquare,
            to: square,
            promotion: 'q' // Auto-promote to Queen
        });

        if (move) {
            // Valid Move
            setGame(gameCopy);
            setFen(gameCopy.fen());
            setLastMove({ from: move.from, to: move.to });
            setSelectedSquare(null);
            setPossibleMoves([]);
            
            // Trigger AI response
            if (!gameCopy.isGameOver()) {
                setTimeout(() => makeAiMove(gameCopy.fen()), 500);
            } else {
                if (gameCopy.isCheckmate()) speak("Checkmate. You win.");
                else if (gameCopy.isDraw()) speak("Stalemate.");
            }
        } else {
            // Invalid Move
            // If clicking another white piece, switch selection
            const piece = game.get(square);
            if (piece && piece.color === 'w') {
                setSelectedSquare(square);
                const moves = game.moves({ square, verbose: true });
                setPossibleMoves(moves.map(m => m.to));
            } else {
                // Clicking empty square or invalid target
                setSelectedSquare(null);
                setPossibleMoves([]);
            }
        }
    } catch (e) {
        console.error(e);
        setSelectedSquare(null);
        setPossibleMoves([]);
    }
  };

  // --- PERSISTENCE ---
  const saveGame = () => {
      if (!saveName) return;
      const newSave: SavedGame = {
          id: Date.now().toString(),
          name: saveName,
          date: new Date().toLocaleString(),
          fen: game.fen(),
          pgn: game.pgn()
      };
      const newSaves = [...savedGames, newSave];
      setSavedGames(newSaves);
      localStorage.setItem('jarvis_chess_saves', JSON.stringify(newSaves));
      setShowSaveModal(false);
      setSaveName('');
      onLog("Game saved.");
  };

  const loadGame = (save: SavedGame) => {
      try {
          const newGame = new Chess();
          newGame.load(save.fen); // Prefer FEN for reliable state restore
          setGame(newGame);
          setFen(newGame.fen());
          setLastMove(null);
          setSelectedSquare(null);
          setPossibleMoves([]);
          setShowLoadModal(false);
          onLog(`Loaded game: ${save.name}`);
      } catch (e) {
          onLog("Error loading save file.");
      }
  };

  const deleteSave = (id: string) => {
      const newSaves = savedGames.filter(s => s.id !== id);
      setSavedGames(newSaves);
      localStorage.setItem('jarvis_chess_saves', JSON.stringify(newSaves));
  };

  // --- RENDERING HELPERS ---
  const getPieceImg = (p: Piece) => {
      const type = p.color === 'w' ? `l${p.type}` : `d${p.type}`; // Custom mapping naming
      const map: any = {
          'lp': 'https://upload.wikimedia.org/wikipedia/commons/1/10/Chess_plt45.svg',
          'ln': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
          'lb': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
          'lr': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
          'lq': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
          'lk': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
          'dp': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
          'dn': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
          'db': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
          'dr': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
          'dq': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
          'dk': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
      };
      return map[type];
  };

  const getCaptured = (color: 'w' | 'b') => {
    const history = game.history({ verbose: true });
    return history.filter(m => m.captured && m.color !== color).map((m, i) => (
        <img key={i} src={getPieceImg({ type: m.captured!, color: color === 'w' ? 'b' : 'w' } as Piece)} className="w-5 h-5 opacity-80" />
    ));
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-slate-900/50 p-4 gap-6 relative overflow-hidden">
        
        {/* GAME BOARD AREA */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-y-auto">
            
            <div className="mb-4 flex items-center gap-6">
                <div className="flex flex-col items-end">
                    <span className="text-xs font-mono text-cyan-600">J.A.R.V.I.S. (BLACK)</span>
                    <div className="flex h-6 bg-slate-900/50 rounded px-2 border border-cyan-900/30">{getCaptured('w')}</div>
                </div>
                
                <div className="text-xl font-bold font-mono text-cyan-400 tracking-widest bg-slate-950 px-4 py-2 rounded border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                   {isAiThinking ? "CALCULATING..." : game.isGameOver() ? "GAME OVER" : game.turn() === 'w' ? "YOUR TURN" : "AI TURN"}
                </div>
                
                <div className="flex flex-col items-start">
                    <span className="text-xs font-mono text-cyan-600">YOU (WHITE)</span>
                    <div className="flex h-6 bg-slate-900/50 rounded px-2 border border-cyan-900/30">{getCaptured('b')}</div>
                </div>
            </div>

            <div 
              className={`relative bg-slate-800 rounded-lg shadow-2xl border-4 border-slate-700 select-none ${view3D ? 'transform-gpu' : ''}`}
              style={{ 
                  width: 'min(80vw, 500px)', 
                  aspectRatio: '1/1',
                  perspective: view3D ? '1000px' : 'none'
              }}
            >
                <div className="grid grid-cols-8 grid-rows-8 w-full h-full"
                   style={view3D ? { transform: 'rotateX(20deg) scale(0.9)', transformStyle: 'preserve-3d' } : {}}
                >
                    {/* Render Squares */}
                    {(() => {
                        const board = [];
                        // Chess.js board() returns rank 8 (index 0) to rank 1 (index 7)
                        const currentBoard = game.board(); 
                        for(let r = 0; r < 8; r++) {
                            for(let c = 0; c < 8; c++) {
                                const piece = currentBoard[r][c];
                                const square = String.fromCharCode(97 + c) + String(8 - r) as Square;
                                const isDark = (r + c) % 2 === 1;
                                const isSelected = selectedSquare === square;
                                const isPossible = possibleMoves.includes(square);
                                const isLastFrom = lastMove?.from === square;
                                const isLastTo = lastMove?.to === square;

                                board.push(
                                    <div 
                                        key={square}
                                        onClick={() => handleSquareClick(square)}
                                        className={`
                                            relative flex items-center justify-center
                                            ${isDark ? 'bg-slate-600' : 'bg-slate-300'}
                                            ${isSelected ? 'ring-inset ring-4 ring-yellow-400' : ''}
                                            ${(isLastFrom || isLastTo) && !isSelected ? 'bg-yellow-200/50' : ''}
                                            cursor-pointer transition-colors
                                        `}
                                    >
                                        {/* Coordinate Labels */}
                                        {c === 0 && <span className={`absolute top-0.5 left-0.5 text-[8px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{8 - r}</span>}
                                        {r === 7 && <span className={`absolute bottom-0 right-0.5 text-[8px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{String.fromCharCode(97 + c)}</span>}

                                        {/* Possible Move Marker */}
                                        {isPossible && !piece && (
                                            <div className="w-3 h-3 rounded-full bg-cyan-500/50"></div>
                                        )}
                                        {isPossible && piece && (
                                            <div className="absolute inset-0 border-4 border-red-500/50 rounded-sm"></div>
                                        )}

                                        {/* Piece */}
                                        {piece && (
                                            <img 
                                                src={getPieceImg(piece)} 
                                                alt={`${piece.color}${piece.type}`}
                                                className={`w-[90%] h-[90%] object-contain ${view3D ? '-translate-y-2 drop-shadow-xl' : ''}`} 
                                                style={{ pointerEvents: 'none' }} // Ensure click passes to div
                                            />
                                        )}
                                    </div>
                                );
                            }
                        }
                        return board;
                    })()}
                </div>
            </div>
            
            <div className="mt-4 flex gap-4">
                <button onClick={() => setView3D(!view3D)} className="text-xs font-mono text-cyan-600 hover:text-cyan-400 underline uppercase">
                    {view3D ? "Switch to 2D View" : "Switch to 3D View"}
                </button>
            </div>
        </div>

        {/* CONTROLS AREA */}
        <div className="w-full lg:w-72 bg-slate-950/50 border-l border-cyan-900/30 p-4 flex flex-col gap-4">
            <div className="font-mono text-sm text-cyan-400 font-bold border-b border-cyan-900/50 pb-2">COMMAND PROTOCOLS</div>
            
            <button onClick={() => { setGame(new Chess()); setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"); setLastMove(null); setSelectedSquare(null); setPossibleMoves([]); onLog("Game Reset."); }} 
                className="w-full py-2 bg-red-900/20 border border-red-900/50 text-red-400 hover:bg-red-900/40 rounded text-xs uppercase tracking-wider transition-all">
                Reset Board
            </button>

            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowSaveModal(true)} className="py-2 bg-cyan-900/20 border border-cyan-800 text-cyan-400 hover:bg-cyan-900/40 rounded text-xs uppercase">Save State</button>
                <button onClick={() => setShowLoadModal(true)} className="py-2 bg-cyan-900/20 border border-cyan-800 text-cyan-400 hover:bg-cyan-900/40 rounded text-xs uppercase">Load State</button>
            </div>

            <div className="flex-1 bg-slate-900 rounded border border-cyan-900/30 p-2 flex flex-col min-h-[150px]">
                <div className="text-[10px] text-cyan-600 uppercase mb-2 font-bold">Move Log (PGN)</div>
                <div className="flex-1 overflow-y-auto font-mono text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed pr-1 scrollbar-thin scrollbar-thumb-cyan-900">
                    {game.pgn() || "-- No moves yet --"}
                </div>
            </div>
        </div>

        {/* MODALS */}
        {(showSaveModal || showLoadModal) && (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-slate-900 border border-cyan-500 rounded-lg p-6 w-full max-w-sm shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                    <h3 className="text-lg font-mono text-cyan-400 mb-4">{showSaveModal ? 'ARCHIVE GAME STATE' : 'RETRIEVE ARCHIVE'}</h3>
                    
                    {showSaveModal && (
                        <div className="space-y-4">
                            <input 
                                type="text" 
                                value={saveName} 
                                onChange={e => setSaveName(e.target.value)} 
                                placeholder="Enter save name..." 
                                className="w-full bg-slate-950 border border-cyan-800 p-2 rounded text-cyan-300 focus:border-cyan-500 outline-none"
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowSaveModal(false)} className="px-3 py-1 text-xs text-slate-400 hover:text-white">CANCEL</button>
                                <button onClick={saveGame} className="px-4 py-2 bg-cyan-600 text-slate-900 text-xs font-bold rounded hover:bg-cyan-500">SAVE</button>
                            </div>
                        </div>
                    )}

                    {showLoadModal && (
                        <div className="flex flex-col h-[300px]">
                            <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
                                {savedGames.length === 0 ? <div className="text-center text-slate-500 text-xs mt-10">No archives found.</div> : 
                                    savedGames.map(s => (
                                        <div key={s.id} className="flex justify-between items-center p-2 rounded border border-cyan-900/30 bg-slate-950 hover:border-cyan-500 group">
                                            <div onClick={() => loadGame(s)} className="flex-1 cursor-pointer">
                                                <div className="text-cyan-300 text-sm font-bold">{s.name}</div>
                                                <div className="text-[10px] text-slate-500">{s.date}</div>
                                            </div>
                                            <button onClick={() => deleteSave(s.id)} className="text-red-900 hover:text-red-500 px-2 group-hover:opacity-100 opacity-50">×</button>
                                        </div>
                                    ))
                                }
                            </div>
                            <button onClick={() => setShowLoadModal(false)} className="w-full py-2 border border-cyan-800 text-cyan-500 rounded text-xs hover:bg-cyan-900/20">CLOSE</button>
                        </div>
                    )}
                </div>
            </div>
        )}

    </div>
  );
};

export default ChessGame;
