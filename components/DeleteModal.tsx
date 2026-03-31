"use client";

import { AlertTriangle } from "lucide-react";

type Props = {
  filename: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DeleteModal({ filename, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-[#1a1a1a] border-2 border-orange-500/40 rounded-2xl p-6 max-w-xs w-full shadow-[0_0_40px_rgba(249,115,22,0.2)]">

        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={24} className="text-orange-400" />
          <span className="text-white font-bold text-sm font-mono uppercase">
            Confirm Delete
          </span>
        </div>

        <p className="text-zinc-400 text-xs font-mono mb-1">
          Erase from SD card:
        </p>

        <p className="text-orange-300 text-sm font-mono font-bold truncate mb-6 bg-black/40 px-3 py-2 rounded-lg">
          {filename}
        </p>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-zinc-800 rounded-xl text-zinc-400">
            Cancel
          </button>

          <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 rounded-xl text-white">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}