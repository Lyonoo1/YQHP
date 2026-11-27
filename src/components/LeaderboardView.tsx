import React, { useMemo, useState } from 'react';
import { ChevronRight, Flame } from 'lucide-react';
import { sortLeaderboard } from '../shared/scoring';
import type { LeaderboardSort, PlayerSummary } from '../shared/types';
import { PlayerAvatar } from './PlayerAvatar';
import { StarDisplay } from './StarRating';

interface LeaderboardViewProps {
  players: PlayerSummary[];
  currentDate: string;
  onSelectPlayer: (playerId: string) => void;
}

const SORT_TABS: { key: LeaderboardSort; label: string }[] = [
  { key: 'heat', label: '综合热度榜' },
  { key: 'highest', label: '今日高分榜' },
  { key: 'lowest', label: '呼吸权榜' },
];

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  players,
  currentDate,
  onSelectPlayer,
}) => {
  const [sortMode, setSortMode] = useState<LeaderboardSort>('heat');

  const ranked = useMemo(
    () => sortLeaderboard(players, sortMode),
    [players, sortMode],
  );

  const topThree = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  // Arrange podium order: #2 left, #1 center, #3 right
  const podiumOrder =
    topThree.length === 3
      ? [
          { rank: 2, player: topThree[1], tone: 'text-[#64748B]', ring: 'border-[#CBD5E1]' },
          { rank: 1, player: topThree[0], tone: 'text-[#D97706]', ring: 'border-[#F59E0B]' },
          { rank: 3, player: topThree[2], tone: 'text-[#B45309]', ring: 'border-[#D97706]/50' },
        ]
      : topThree.map((p, idx) => ({
          rank: idx + 1,
          player: p,
          tone: 'text-[#C60100]',
          ring: 'border-[#E6E8EC]',
        }));

  return (
    <div className="px-3 pt-3 pb-6 space-y-3">
      {/* Header & Sort Segmented Control */}
      <section className="bg-white rounded-2xl border border-[#E6E8EC] p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-bold text-[#141518]">园区实时热度榜</h1>
            <p className="text-[11px] text-[#6B7280] mt-0.5 tabular-nums">
              {currentDate} · 依据评分、热评与点赞实时更新
            </p>
          </div>
          <Flame className="w-5 h-5 text-[#C60100] shrink-0" aria-hidden="true" />
        </div>

        <div
          className="grid grid-cols-3 gap-1 p-1 bg-[#F2F4F7] rounded-xl"
          role="tablist"
          aria-label="排行榜排序方式"
        >
          {SORT_TABS.map((tab) => {
            const active = sortMode === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSortMode(tab.key)}
                className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-[#C60100] shadow-xs'
                    : 'text-[#6B7280] hover:text-[#141518]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Top 3 Podium */}
      {podiumOrder.length > 0 && (
        <section
          aria-label="前三名球手"
          className="grid grid-cols-3 gap-2 items-end pt-1"
        >
          {podiumOrder.map(({ rank, player, tone, ring }) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onSelectPlayer(player.id)}
              aria-label={`第${rank}名 ${player.nickname}，评分 ${
                player.averageScore !== null ? player.averageScore.toFixed(1) : '暂无'
              }`}
              className={`bg-white rounded-2xl border ${ring} px-2.5 flex flex-col items-center text-center active:scale-[0.98] transition-transform ${
                rank === 1 ? 'py-4 shadow-sm' : 'py-3'
              }`}
            >
              <span className={`font-score text-lg font-extrabold leading-none mb-2 ${tone}`}>
                NO.{rank}
              </span>
              <PlayerAvatar
                nickname={player.nickname}
                jerseyNumber={player.jerseyNumber}
                size={rank === 1 ? 'lg' : 'md'}
              />
              <span className="text-xs font-bold text-[#141518] mt-2 truncate w-full">
                {player.nickname}
              </span>
              <span className="font-score text-2xl font-extrabold text-[#C60100] leading-none mt-1">
                {player.averageScore !== null ? player.averageScore.toFixed(1) : '--'}
              </span>
              <span className="text-[11px] text-[#6B7280] mt-1 tabular-nums">
                热度 {player.heatScore}
              </span>
            </button>
          ))}
        </section>
      )}

      {/* Ranked List #4+ */}
      <section
        aria-label="完整排行榜"
        className="bg-white rounded-2xl border border-[#E6E8EC] divide-y divide-[#F0F2F5] overflow-hidden"
      >
        {rest.map((player, idx) => {
          const rank = idx + 4;
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => onSelectPlayer(player.id)}
              aria-label={`第${rank}名 ${player.nickname}，热度 ${player.heatScore}`}
              className="w-full min-h-[64px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[#FAFBFD] active:bg-[#F4F5F7] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="w-6 text-center font-score text-lg font-bold text-[#6B7280] shrink-0">
                  {rank}
                </span>
                <PlayerAvatar
                  nickname={player.nickname}
                  jerseyNumber={player.jerseyNumber}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#141518] truncate">
                      {player.nickname}
                    </span>
                    <span className="text-[11px] text-[#9CA3AF] font-score">
                      {player.account}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] tabular-nums mt-0.5 truncate whitespace-nowrap">
                    热度 {player.heatScore} · {player.ratingCount}人评分 · {player.commentCount}互动
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <span
                    className={`font-score text-xl font-extrabold leading-none ${
                      player.averageScore !== null ? 'text-[#C60100]' : 'text-[#9CA3AF]'
                    }`}
                  >
                    {player.averageScore !== null ? player.averageScore.toFixed(1) : '--'}
                  </span>
                  <div className="mt-0.5 flex justify-end">
                    <StarDisplay score={player.averageScore} size="xs" />
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#C4C9D2]" aria-hidden="true" />
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
};
