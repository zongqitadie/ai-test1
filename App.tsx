import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import HandController from './components/HandController';
import { useGeminiLive } from './hooks/useGeminiLive';
import { Point } from './types';

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [handPos, setHandPos] = useState<Point | null>(null);
  const [logs, setLogs] = useState<string[]>(["SYSTEM BOOT...", "WAITING FOR PILOT INPUT..."]);
  const [showLogs, setShowLogs] = useState(true);

  // Auto-scroll logs
  useEffect(() => {
    const el = document.getElementById('log-container');
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-4), msg]); // Keep last 5
  };

  const { connect, disconnect, isConnected, isSpeaking } = useGeminiLive({
    onAiMessage: (text) => addLog(`AI: ${text}`)
  });

  const handleStart = () => {
    setIsPlaying(true);
    addLog("BATTLE STARTED. GOOD LUCK.");
    if (!isConnected) connect();
  };

  const handleGameOver = (score: number) => {
    setIsPlaying(false);
    addLog(`GAME OVER. FINAL SCORE: ${score}`);
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-mono text-cyan-300 select-none">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('https://picsum.photos/1920/1080?grayscale&blur=5')] opacity-20 bg-cover"></div>
      <div className="scanline"></div>
      <div className="crt fixed inset-0 pointer-events-none"></div>

      {/* Main Game Layer */}
      <div className="absolute inset-0 z-10">
        <GameCanvas 
          handPos={handPos} 
          isPlaying={isPlaying} 
          onGameOver={handleGameOver}
          onLog={addLog}
        />
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]">
              NEON GARDEN DEFENSE
            </h1>
            <p className="text-sm opacity-70">Bio-Mech Interface: {handPos ? "ONLINE" : "SEARCHING..."}</p>
          </div>
          <div className="flex flex-col items-end gap-2 pointer-events-auto">
             <div className={`flex items-center gap-2 px-3 py-1 border rounded ${isConnected ? 'border-green-500 text-green-400' : 'border-red-500 text-red-500'}`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-xs font-bold">{isConnected ? (isSpeaking ? "AI SPEAKING" : "AI ONLINE") : "AI OFFLINE"}</span>
             </div>
             {!isConnected && (
               <button 
                onClick={connect}
                className="text-xs bg-cyan-900/50 hover:bg-cyan-800 border border-cyan-500 px-2 py-1 text-cyan-200"
               >
                 CONNECT VOICE COMMS
               </button>
             )}
          </div>
        </div>

        {/* Start Screen */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm z-30">
            <div className="text-center space-y-6 p-10 border-2 border-cyan-500/50 bg-black/80 rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.2)] max-w-lg">
              <h2 className="text-3xl font-orbitron text-white">MISSION BRIEFING</h2>
              <div className="text-left text-sm space-y-2 text-cyan-100/80 font-mono">
                <p>> HOSTILES DETECTED: SECTOR 7</p>
                <p>> CONTROL: INDEX FINGER TO AIM</p>
                <p>> WEAPON: AUTO-FIRE PLASMA</p>
                <p>> SUPPORT: GEMINI TACTICAL AI (VOICE)</p>
                <p>> INSTRUCTION: PRESS SPACE FOR TACTICAL SCAN</p>
              </div>
              <button 
                onClick={handleStart}
                className="group relative px-8 py-3 bg-transparent overflow-hidden rounded-md border border-cyan-500 text-cyan-400 font-bold tracking-widest hover:text-black hover:bg-cyan-400 transition-all duration-300"
              >
                <span className="absolute inset-0 w-full h-full bg-cyan-400/20 group-hover:bg-cyan-400 transition-all"></span>
                <span className="relative">INITIATE DEFENSE</span>
              </button>
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="flex items-end justify-between w-full pointer-events-auto">
          <div className="relative w-96">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs bg-cyan-900/80 px-2 text-cyan-300">SYS.LOG</span>
              <button onClick={() => setShowLogs(!showLogs)} className="text-[10px] text-cyan-500 hover:text-white">[TOGGLE]</button>
            </div>
            {showLogs && (
              <div 
                id="log-container"
                className="h-32 bg-black/80 border border-cyan-500/30 p-2 overflow-y-auto text-xs font-mono space-y-1 shadow-[0_0_10px_rgba(0,0,0,0.5)] scrollbar-hide"
              >
                {logs.map((log, i) => (
                  <div key={i} className={`border-l-2 pl-2 ${log.startsWith("AI:") ? "border-purple-500 text-purple-300" : "border-cyan-500 text-cyan-300"}`}>
                    <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="text-right">
             <div className="text-[10px] text-cyan-600">Gemini 2.5 Flash / MediaPipe Vision</div>
          </div>
        </div>

      </div>

      {/* Hand Controller (Hidden or corner) */}
      <HandController 
        onHandMove={setHandPos} 
        debug={false} // Set true to see webcam feedback
      />
    </div>
  );
}
