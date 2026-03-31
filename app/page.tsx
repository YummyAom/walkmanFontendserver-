"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Play, RotateCcw, Radio, Trash2, Music, RefreshCw, AlertTriangle } from 'lucide-react';

const domain = "http://192.168.1.175:3001";

// --- ฟังก์ชันตัวช่วย (Helper) ---
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Sub-components (ใช้ React.memo เพื่อป้องกันการ Re-render โดยไม่จำเป็น ช่วยลด CPU) ---

const Reel = React.memo(({ spinning, speed }: { spinning: boolean; speed: string }) => (
  <div
    className={`relative w-24 h-24 rounded-full border-[8px] border-zinc-900 bg-zinc-800 flex items-center justify-center shadow-2xl ${spinning ? 'animate-spin' : ''}`}
    style={{ animationDuration: speed, animationTimingFunction: 'linear', animationIterationCount: 'infinite' }}
  >
    <div className="absolute inset-0 border-[6px] border-dashed border-zinc-700/50 rounded-full scale-90"></div>
    <div className="w-10 h-10 bg-zinc-900 rounded-sm rotate-45 border-2 border-zinc-700 shadow-inner flex items-center justify-center">
      <div className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-600"></div>
    </div>
    {[0, 60, 120, 180, 240, 300].map(deg => (
      <div key={deg} className="absolute w-1.5 h-4 bg-zinc-700 rounded-full"
        style={{ transform: `rotate(${deg}deg) translateY(-32px)` }} />
    ))}
  </div>
));
Reel.displayName = "Reel";

interface DeleteModalProps {
  filename: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteModal = React.memo(({ filename, onConfirm, onCancel }: DeleteModalProps) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
    <div className="bg-[#1a1a1a] border-2 border-orange-500/40 rounded-2xl p-6 max-w-xs w-full shadow-[0_0_40px_rgba(249,115,22,0.2)]">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle size={24} className="text-orange-400 shrink-0" />
        <span className="text-white font-bold text-sm font-mono uppercase tracking-wider">Confirm Delete</span>
      </div>
      <p className="text-zinc-400 text-xs font-mono mb-1">Erase from SD card:</p>
      <p className="text-orange-300 text-sm font-mono font-bold truncate mb-6 bg-black/40 px-3 py-2 rounded-lg border border-white/5">
        {filename}
      </p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-black font-mono uppercase tracking-wider hover:bg-zinc-700 transition-all active:translate-y-0.5 border border-white/5">
          Cancel
        </button>
        <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-gradient-to-b from-red-500 to-red-700 text-white text-sm font-black font-mono uppercase tracking-wider shadow-[0_6px_0_#7f1d1d] active:shadow-none active:translate-y-1 transition-all">
          Delete
        </button>
      </div>
    </div>
  </div>
));
DeleteModal.displayName = "DeleteModal";

// --- Main Application ---

export default function App() {
  const [activeTab, setActiveTab] = useState<"download" | "library">("download");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("IDLE"); // IDLE, CONNECTING, DOWNLOADING, FINISHED
  const [percent, setPercent] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  const [songs, setSongs] = useState<string[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmFile, setConfirmFile] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  /**
   * ระบบ Polling เช็คสถานะการดาวน์โหลด (ปรับปรุง Cleanup กัน Memory Leak)
   */
  useEffect(() => {
    if (status !== "CONNECTING" && status !== "DOWNLOADING") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${domain}/esp/status`);
        const data = await res.json();

        setPercent(data.percent || 0);

        if (!data.downloading && data.url) {
          setStatus("FINISHED");
          setIsSpinning(false);
          setPercent(100);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1000);

    // 🔥 เคลียร์ Interval เสมอเมื่อ status เปลี่ยน หรือ Component ถูกทำลาย
    return () => clearInterval(interval);
  }, [status]);

  /**
   * ดึงรายชื่อเพลง (ป้องกัน Re-render ซ้ำซ้อน)
   */
  const fetchSongs = useCallback(async (isMounted = true) => {
    setLibLoading(true);
    setStatusMsg("SCANNING SD...");
    try {
      const res = await fetch(`${domain}/esp/songs`);
      if (!res.ok) throw new Error('Failed to fetch songs');
      const data = await res.json();
      
      if (isMounted) {
        setSongs(data.songs || []);
        setStatusMsg(data.songs?.length > 0 ? `${data.songs.length} TRACKS FOUND` : "NO DATA FOUND");
      }
    } catch {
      if (isMounted) setStatusMsg("CONNECTION ERROR");
    } finally {
      if (isMounted) setLibLoading(false);
    }
  }, []);

  /**
   * เรียก Fetch เมื่อเปลี่ยนมาหน้า Library
   */
  useEffect(() => {
    let isMounted = true;
    if (activeTab === "library") {
      fetchSongs(isMounted);
    }
    return () => { isMounted = false; };
  }, [activeTab, fetchSongs]);

  /**
   * เริ่มการบันทึกลงเทป
   */
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || status !== "IDLE" && status !== "FINISHED") return;

    setStatus("CONNECTING");
    setIsSpinning(true);
    setPercent(0);

    try {
      await fetch(`${domain}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      setStatus("DOWNLOADING");
    } catch (error) {
      console.error("Start error", error);
      setStatus("IDLE");
      setIsSpinning(false);
    }
  };

  /**
   * ลบเพลงออกจาก SD Card
   */
  const handleDelete = async (filename: string) => {
    setConfirmFile(null);
    setDeleting(filename);
    setStatusMsg(`ERASING...`);
    
    try {
      const res = await fetch(`${domain}/esp/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      
      if (data.ok) {
        setStatusMsg("PROCESSING...");
        // 🔥 ใช้ await delay แทน setTimeout ป้องกัน memory leak
        await delay(5000); 
        await fetchSongs();
      }
    } catch {
      setStatusMsg("ERROR");
    } finally {
      setDeleting(null);
    }
  };

  const reset = () => {
    setStatus("IDLE");
    setPercent(0);
    setUrl("");
    setIsSpinning(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6 font-sans">
      <div className="relative group">
        {/* Glow Effect */}
        <div className="absolute -inset-4 bg-blue-600/10 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition duration-1000" />

        {/* Walkman Main Body */}
        <div className="relative w-[380px] bg-[#244182] rounded-[3rem] shadow-[20px_40px_80px_-10px_rgba(0,0,0,0.8),inset_-2px_-2px_10px_rgba(0,0,0,0.4),inset_2px_2px_10px_rgba(255,255,255,0.1)] border-x-[1px] border-t-[1px] border-white/10 overflow-hidden">

          {/* Top Plate (Brushed Metal) */}
          <div className="h-28 bg-gradient-to-b from-[#e2e8f0] via-[#94a3b8] to-[#475569] px-8 flex justify-between items-center border-b-[3px] border-black shadow-lg relative overflow-hidden shrink-0">
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/brushed-alum.png')" }} />
            <div className="relative z-10">
              <h1 className="text-[#0f172a] font-black text-2xl tracking-[-0.05em] leading-none italic">WM-PRO</h1>
              <p className="text-[#0f172a] text-[9px] font-bold tracking-[0.3em] uppercase opacity-80">Mega Bass System</p>
            </div>
            <div className="relative z-10 flex items-center gap-3 bg-black/20 p-2 rounded-lg backdrop-blur-sm border border-black/10 shadow-inner">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full mb-1 transition-all duration-300 ${isSpinning ? 'bg-red-500 shadow-[0_0_12px_#ef4444]' : 'bg-red-950 opacity-40'}`} />
                <span className="text-[#0f172a] text-[7px] font-black uppercase tracking-tighter">Opr</span>
              </div>
              <div className="w-[1px] h-6 bg-black/20" />
              <div className="text-[#0f172a] text-[10px] font-black leading-none uppercase">Stereo<br />Rec</div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="px-6 mt-6 shrink-0">
            <div className="flex bg-black/40 rounded-2xl p-1 border border-white/5 shadow-inner">
              <button
                onClick={() => setActiveTab("download")}
                className={`flex-1 py-3 rounded-xl text-xs font-black font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === "download" ? "bg-orange-500 text-white shadow-[0_4px_0_#9a3412]" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <Play size={12} fill="currentColor" /> Download
              </button>
              <button
                onClick={() => setActiveTab("library")}
                className={`flex-1 py-3 rounded-xl text-xs font-black font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === "library" ? "bg-orange-500 text-white shadow-[0_4px_0_#9a3412]" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <Music size={12} /> Library
              </button>
            </div>
          </div>

          {/* Tab Content - Fixed Height (540px) */}
          <div className="h-[540px] flex flex-col">
            {activeTab === "download" ? (
              <div className="flex flex-col h-full">
                {/* Cassette Area */}
                <div className="p-6 shrink-0">
                  <div className="relative h-44 w-full bg-[#111] rounded-2xl border-[5px] border-[#2d3748] shadow-[inset_0_10px_30px_rgba(0,0,0,0.8)] flex items-center justify-around overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/10 z-20 pointer-events-none" />
                    <div className="relative z-10 flex items-center justify-center gap-6 w-full scale-90">
                      <Reel spinning={isSpinning} speed="20s" />
                      <div className="flex flex-col items-center z-20">
                        <div className="w-14 h-20 bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-md border border-white/5 shadow-2xl flex flex-col items-center justify-center p-2">
                          <div className="w-full h-1 bg-orange-500/80 mb-2" />
                          <span className="text-[9px] text-zinc-400 font-mono font-bold tracking-widest leading-none">C-90</span>
                        </div>
                      </div>
                      <Reel spinning={isSpinning} speed="18s" />
                    </div>
                    <div className="absolute bottom-4 w-3/4 h-6 border-t border-zinc-800 bg-[#2d1b16] rounded-t-lg blur-[0.5px] opacity-60" />
                  </div>
                </div>

                {/* Download Controls */}
                <div className="px-8 pb-8 flex-1 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* VFD Display */}
                    <div className="bg-[#050505] rounded-lg border-[3px] border-[#334155] p-3 shadow-inner relative">
                      <div className="font-mono text-[11px] text-green-500/90 tracking-tighter leading-tight italic">
                        <div className="flex justify-between items-center mb-1 border-b border-green-900/40 pb-1">
                          <span className="flex items-center gap-1"><Radio size={10} /> STATUS_{status}</span>
                          <span className={isSpinning ? 'animate-pulse' : ''}>{isSpinning ? '■ TAPE_RUN' : 'STOP'}</span>
                        </div>
                        <div className="uppercase h-4 truncate">
                          {status === "IDLE" && ">> STANDBY MODE - INSERT URL"}
                          {status === "CONNECTING" && ">> TUNING SIGNAL... OK"}
                          {status === "DOWNLOADING" && `>> REC TRACK: ${percent}% COMPLETE`}
                          {status === "FINISHED" && ">> FINISHED: REMOVE TAPE"}
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleStart} className="space-y-5">
                      <input
                        className="w-full p-4 bg-black/60 border-2 border-[#334155] rounded-xl text-orange-100 placeholder-zinc-700 outline-none focus:border-orange-500/50 transition-all shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] font-mono text-sm"
                        placeholder="YouTube Source URL..."
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        disabled={status !== "IDLE" && status !== "FINISHED"}
                      />
                      <div className="grid grid-cols-4 gap-3">
                        <button
                          type="submit"
                          disabled={status !== "IDLE" && status !== "FINISHED"}
                          className={`col-span-3 p-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:translate-y-1 font-black italic uppercase tracking-wider text-sm ${status === "IDLE" || status === "FINISHED" ? "bg-gradient-to-b from-orange-400 to-orange-600 text-white shadow-[0_8px_0_#9a3412,0_12px_20px_rgba(0,0,0,0.5)] active:shadow-none" : "bg-zinc-800 text-zinc-500 shadow-[0_8px_0_#111] cursor-not-allowed"}`}
                        >
                          <Play size={18} fill="currentColor" /> Play & Record
                        </button>
                        <button
                          type="button"
                          onClick={reset}
                          className="p-5 bg-gradient-to-b from-zinc-700 to-zinc-900 rounded-2xl flex items-center justify-center shadow-[0_8px_0_#111,0_12px_20px_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1 hover:brightness-110 transition-all"
                        >
                          <RotateCcw size={18} className="text-zinc-400" />
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative pt-4">
                    <div className="h-2 w-full bg-black rounded-full shadow-inner overflow-hidden border border-white/5">
                      <div className="h-full bg-gradient-to-r from-orange-600 via-amber-400 to-white rounded-full transition-all duration-500 relative" style={{ width: `${percent}%` }}>
                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                      </div>
                    </div>
                    <div className="flex justify-between mt-2 text-[8px] font-black text-zinc-500 tracking-[0.3em] uppercase">
                      <span>0 min</span>
                      <span>Recording Progress</span>
                      <span>60 min</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full animate-in fade-in duration-300">
                {/* Library VFD */}
                <div className="px-8 pt-6 shrink-0">
                  <div className="bg-[#050505] rounded-lg border-[3px] border-[#334155] p-3 shadow-inner">
                    <div className="font-mono text-[11px] text-green-500/90 tracking-tighter leading-tight italic">
                      <div className="flex justify-between items-center mb-1 border-b border-green-900/40 pb-1">
                        <span className="flex items-center gap-1"><Music size={10} /> LIBRARY_MODE</span>
                        <span className={libLoading ? 'animate-pulse' : ''}>{libLoading ? '■ READING' : 'READY'}</span>
                      </div>
                      <div className="uppercase h-4 truncate">&gt;&gt; {statusMsg}</div>
                    </div>
                  </div>
                </div>

                {/* Library List Area */}
                <div className="px-6 py-4 flex-1 flex flex-col min-h-0">
                  <div className="flex justify-end mb-3 shrink-0">
                    <button
                      onClick={() => fetchSongs(true)}
                      disabled={libLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 rounded-xl text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider border border-white/5 hover:bg-zinc-700 active:translate-y-0.5 transition-all disabled:opacity-40"
                    >
                      <RefreshCw size={12} className={libLoading ? 'animate-spin' : ''} /> Refresh
                    </button>
                  </div>

                  <div className="flex-1 bg-black/50 rounded-2xl border-[3px] border-[#2d3748] overflow-hidden shadow-inner flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {songs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-700">
                          <Music size={40} strokeWidth={1} />
                          <p className="font-mono text-[10px] uppercase tracking-widest">No tracks on SD card</p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-white/5">
                          {songs.map((song, i) => (
                            <li key={song} className={`flex items-center gap-3 px-4 py-3 transition-colors ${deleting === song ? 'bg-red-950/30' : 'hover:bg-white/5'}`}>
                              <span className="text-zinc-600 font-mono text-[10px] w-5 shrink-0 text-right">{String(i + 1).padStart(2, '0')}</span>
                              <span className="flex-1 text-orange-100 font-mono text-[11px] truncate leading-tight">{song.replace('.mp3', '')}</span>
                              {deleting === song ? (
                                <span className="text-red-400 font-mono text-[10px] animate-pulse">ERASING...</span>
                              ) : (
                                <button onClick={() => setConfirmFile(song)} className="shrink-0 p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/40 transition-all">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {songs.length > 0 && (
                    <p className="text-center text-zinc-600 font-mono text-[10px] uppercase tracking-widest mt-4 shrink-0">
                      TOTAL: {songs.length} TRACKS DETECTED
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmFile && (
        <DeleteModal
          filename={confirmFile}
          onConfirm={() => handleDelete(confirmFile)}
          onCancel={() => setConfirmFile(null)}
        />
      )}

      {/* Tailwind & Custom Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}