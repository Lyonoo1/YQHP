import React from 'react';
import { formatJerseyNumber } from '../shared/scoring';

export const AVATAR_BG_CLASS_MAP: Record<string, string> = {
  '#1D2432': 'bg-[#1D2432] text-white',
  '#C60100': 'bg-[#C60100] text-white',
  '#8B1A1A': 'bg-[#8B1A1A] text-white',
  '#1E3A5F': 'bg-[#1E3A5F] text-white',
  '#2C3E2D': 'bg-[#2C3E2D] text-white',
  '#4A2545': 'bg-[#4A2545] text-white',
  '#7C3A14': 'bg-[#7C3A14] text-white',
  '#1F4E5F': 'bg-[#1F4E5F] text-white',
  '#332E2B': 'bg-[#332E2B] text-white',
  '#0F766E': 'bg-[#0F766E] text-white',
  '#B45309': 'bg-[#B45309] text-white',
  '#312E81': 'bg-[#312E81] text-white',
};

const DEFAULT_JERSEY_PALETTES = [
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
  return hash % DEFAULT_JERSEY_PALETTES.length;
}

export function getDefaultAvatarBgHex(nickname: string, jerseyNumber: string): string {
  const displayJersey = formatJerseyNumber(jerseyNumber);
  const defaultHexes = [
    '#1D2432',
    '#8B1A1A',
    '#1E3A5F',
    '#2C3E2D',
    '#4A2545',
    '#7C3A14',
    '#1F4E5F',
    '#332E2B',
  ];
  return defaultHexes[getPaletteIndex(nickname + displayJersey)];
}

interface PlayerAvatarProps {
  nickname: string;
  jerseyNumber: string;
  avatarBg?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  nickname,
  jerseyNumber,
  avatarBg,
  size = 'md',
}) => {
  const displayJersey = formatJerseyNumber(jerseyNumber);
  const normalizedBg = avatarBg?.trim().toUpperCase();
  const palette =
    (normalizedBg && AVATAR_BG_CLASS_MAP[normalizedBg]) ||
    DEFAULT_JERSEY_PALETTES[getPaletteIndex(nickname + displayJersey)];
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
        {displayJersey}
      </span>
      {size !== 'sm' && (
        <span className="text-[9px] leading-none opacity-80 mt-0.5 font-medium">
          {initial}
        </span>
      )}
    </div>
  );
};
