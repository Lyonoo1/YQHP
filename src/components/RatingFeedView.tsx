import React, { useMemo, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { starsToHupuScore } from '../shared/scoring';
import type { PlayerSummary } from '../shared/types';
import { PlayerAvatar } from './PlayerAvatar';
import { StarDisplay } from './StarRating';

const COURT_BANNER_URL = `${import.meta.env.BASE_URL}src/assets/images/park_court_banner_1795745585101.jpg`;

interface RatingFeedViewProps {
  players: PlayerSummary[];
  currentDate: string;
  countdownText: string;
  onSelectPlayer: (playerId: string) => void;
}

export const RatingFeedView: React.FC<RatingFeedViewProps> = ({
  players,
  currentDate,
  countdownText,
  onSelectPlayer,
}) => {
  const [query, setQuery] = useState('');
  const [bannerFailed, setBannerFailed] = useState(false);

  const totalRatingsToday = useMemo(
    () => players.reduce((acc, p) => acc + p.ratingCount, 0),
    [players],
  );
  const totalCommentsToday = useMemo(
    () => players.reduce((acc, p) => acc + p.commentCount, 0),
    [players],
  );

  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? players.filter(
          (p) =>
            p.nickname.toLowerCase().includes(q) ||
            p.account.toLowerCase().includes(q) ||
            p.jerseyNumber.includes(q),
        )
      : players;

    // Sort rated / hotter players near top while preserving roster feel
    return [...list].sort((a, b) => {
      if (b.heatScore !== a.heatScore) return b.heatScore - a.heatScore;
      return a.account.localeCompare(b.account);
    });
  }, [players, query]);

  return (
    <div className="pb-4">
      {/* Compact Dusk Park Court Hero Strip */}
      <section className="relative h-36 bg-[#181B20] overflow-hidden">
        {!bannerFailed && (
          <img
            src={COURT_BANNER_URL}
            alt="园区露天篮球场夜景"
            referrerPolicy="no-referrer"
            onError={() => setBannerFailed(true)}
            className="w-full h-full object-cover object-center opacity-85"
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#111317]/75 via-[#111317]/40 to-[#111317]/95"
          aria-hidden="true"
        />
        <div className="absolute inset-0 px-4 py-3.5 flex flex-col justify-between text-white">
          <div className="flex items-center justify-between text-[11px] text-white/80">
            <span className="tabular-nums">{currentDate} 园区球场评分</span>
            <span className="tabular-nums">0点清零倒计时 {countdownText}</span>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-tight">
                今日球手赛后打分
              </h1>
              <p className="text-xs text-white/80 mt-1 tabular-nums">
                {players.length} 位注册球手 · {totalRatingsToday} 次打分 · {totalCommentsToday} 条互动
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative flex items-center">
          <Search
            className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="player-search" className="sr-only">
            搜索球员昵称或账号
          </label>
          <input
            id="player-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索球手昵称或账号（如 科比 / YY08）"
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-white border border-[#E6E8EC] text-sm text-[#141518] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#C60100]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="清空搜索"
              className="absolute right-1 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#9CA3AF] hover:text-[#141518]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hupu-Style Player List */}
      <section aria-label="园区球员打分列表" className="px-3 space-y-2">
        {filteredPlayers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E6E8EC] py-12 text-center">
            <p className="text-sm font-medium text-[#4B5563]">没有找到匹配的球手</p>
            <p className="text-xs text-[#9CA3AF] mt-1">
              可尝试搜索其他昵称或注册新账号加入名单
            </p>
          </div>
        ) : (
          filteredPlayers.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onSelectPlayer(player.id)}
              aria-label={`查看并评价 ${player.nickname}，当前评分 ${
                player.averageScore !== null ? `${player.averageScore.toFixed(1)}分` : '暂无评分'
              }`}
              className="w-full text-left bg-white rounded-2xl border border-[#E6E8EC] px-3.5 py-3 active:scale-[0.99] transition-transform hover:border-[#D1D5DB] focus-visible:outline-2 focus-visible:outline-[#C60100]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <PlayerAvatar
                    nickname={player.nickname}
                    jerseyNumber={player.jerseyNumber}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-[#141518] truncate">
                        {player.nickname}
                      </span>
                      <span className="text-[11px] text-[#9CA3AF] font-score shrink-0">
                        {player.account}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5 tabular-nums truncate">
                      {player.ratingCount}人评分 · {player.commentCount}条热评 · 热度 {player.heatScore}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-0.5">
                      <span
                        className={`font-score text-2xl font-extrabold leading-none ${
                          player.averageScore !== null
                            ? player.averageScore >= 8
                              ? 'text-[#C60100]'
                              : player.averageScore >= 6
                                ? 'text-[#E8940C]'
                                : 'text-[#4B5563]'
                            : 'text-[#9CA3AF]'
                        }`}
                      >
                        {player.averageScore !== null
                          ? player.averageScore.toFixed(1)
                          : '--'}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-end">
                      <StarDisplay score={player.averageScore} size="xs" />
                    </div>
                    <p className="text-[11px] mt-0.5 font-medium text-[#C60100]">
                      {player.myStars !== null
                        ? `我打${starsToHupuScore(player.myStars)}分`
                        : '去打分'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#C4C9D2]" aria-hidden="true" />
                </div>
              </div>

              {player.topComment && (
                <div className="mt-2.5 px-3 py-2 rounded-xl bg-[#F7F8FA] text-xs text-[#374151] leading-snug line-clamp-2">
                  <span className="font-semibold text-[#C60100] mr-1.5">神评</span>
                  <span className="text-[#6B7280] mr-1">
                    {player.topComment.authorNickname}：
                  </span>
                  {player.topComment.content}
                </div>
              )}
            </button>
          ))
        )}
      </section>
    </div>
  );
};
