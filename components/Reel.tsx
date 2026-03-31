"use client";

type Props = {
  spinning: boolean;
  speed: string;
};

export default function Reel({ spinning, speed }: Props) {
  return (
    <div
      className={`relative w-24 h-24 rounded-full border-[8px] border-zinc-900 bg-zinc-800 flex items-center justify-center shadow-2xl ${spinning ? 'animate-spin' : ''}`}
      style={{
        animationDuration: speed,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite'
      }}
    >
      <div className="absolute inset-0 border-[6px] border-dashed border-zinc-700/50 rounded-full scale-90"></div>

      <div className="w-10 h-10 bg-zinc-900 rounded-sm rotate-45 border-2 border-zinc-700 shadow-inner flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-600"></div>
      </div>

      {[0, 60, 120, 180, 240, 300].map(deg => (
        <div
          key={deg}
          className="absolute w-1.5 h-4 bg-zinc-700 rounded-full"
          style={{ transform: `rotate(${deg}deg) translateY(-32px)` }}
        />
      ))}
    </div>
  );
}