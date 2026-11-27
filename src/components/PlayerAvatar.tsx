import React from 'react';

const JERSEY_PALETTES = [
  'bg-[#1D2432] text-white',
  'bg-[#8B1A1A] text-white',
  'bg-[#1E3A5F] text-white',
  'bg-[#2C3E2D] text-white',
  'bg-[#4A2545] text-white',
  'bg-[#7C3A14] text-white',
  'bg-[#1F4E5F] text-white',
  'bg-[#332E2B] text-white',
];

function getPaletteIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % JERSEY_PALETTES.length;
}

interface PlayerAvatarProps {
  nickname: string;
  jerseyNumber: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  nickname,
  jerseyNumber,
  size = 'md',
}) => {
  const palette = JERSEY_PALETTES[getPaletteIndex(nickname + jerseyNumber)];
  const dims =
    size === 'sm'
      ? 'w-9 h-9 rounded-lg text-sm'
      : size === 'lg'
        ? 'w-14 h-14 rounded-xl text-2xl'
        : 'w-11 h-11 rounded-xl text-lg';

  const initial = nickname.trim().slice(0, 1).toUpperCase();

  return (
    <div
      className={`${dims} ${palette} relative flex flex-col items-center justify-center shrink-0 select-none overflow-hidden shadow-xs`}
      aria-hidden="true"
    >
      <span className="font-score font-extrabold leading-none tracking-tight">
        {jerseyNumber}
      </span>
      {size !== 'sm' && (
        <span className="text-[9px] leading-none opacity-80 mt-0.5 font-medium">
          {initial}
        </span>
      )}
    </div>
  );
};
