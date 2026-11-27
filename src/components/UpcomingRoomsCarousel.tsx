import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Flame, MapPin } from 'lucide-react';
import {
  formatUpcomingCountdown,
  getShanghaiDateKey,
  getUpcomingSoonRooms,
  ROOM_MODE_CONFIGS,
} from '../shared/scoring';
import type { MatchRoom } from '../shared/types';
import { PlayerAvatar } from './PlayerAvatar';

interface UpcomingRoomsCarouselProps {
  rooms: MatchRoom[];
  now: Date;
  onSelectRoom: (roomId: string) => void;
}

function formatShortClock(iso?: string, now: Date = new Date()): string {
  if (!iso) return '即将开打';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '即将开打';
  const target = new Date(ts);
  const todayKey = getShanghaiDateKey(now);
  const tomorrowKey = getShanghaiDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const targetKey = getShanghaiDateKey(target);

  const timeStr = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(target);

  if (targetKey === todayKey) return `今天 ${timeStr}`;
  if (targetKey === tomorrowKey) return `明天 ${timeStr}`;
  return timeStr;
}

export const UpcomingRoomsCarousel: React.FC<UpcomingRoomsCarouselProps> = ({
  rooms,
  now,
  onSelectRoom,
}) => {
  const upcoming = useMemo(() => getUpcomingSoonRooms(rooms, now), [rooms, now]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const safeIndex = upcoming.length > 0 ? activeIndex % upcoming.length : 0;

  useEffect(() => {
    if (upcoming.length <= 1 || paused) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % upcoming.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [upcoming.length, paused]);

  const handlePrev = () => {
    if (upcoming.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + upcoming.length) % upcoming.length);
  };

  const handleNext = () => {
    if (upcoming.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % upcoming.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setPaused(true);
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX !== null && upcoming.length > 1) {
      const endX = e.changedTouches[0]?.clientX ?? startX;
      const delta = endX - startX;
      if (delta <= -36) {
        handleNext();
      } else if (delta >= 36) {
        handlePrev();
      }
    }
    window.setTimeout(() => setPaused(false), 2500);
  };

  if (upcoming.length === 0) {
    return (
      <section
        aria-label="近期比赛预告"
        className="bg-white rounded-2xl border border-[#E6E8EC] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[#6B7280]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-4 h-4 text-[#9CA3AF] shrink-0" aria-hidden="true" />
          <span className="font-semibold text-[#374151] shrink-0">近期比赛预告</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">未来 2 小时内暂无即将开打房间</span>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="近期比赛预告"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="bg-[#141518] text-white rounded-2xl overflow-hidden shadow-xs border border-[#23262F]"
    >
      {/* Broadcast Top Strip */}
      <div className="px-3.5 py-2 bg-gradient-to-r from-[#C60100] via-[#A30100] to-[#1C1F26] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Flame className="w-3.5 h-3.5 text-[#FDE047] shrink-0" aria-hidden="true" />
          <h2 className="text-xs font-bold tracking-wide text-white shrink-0">
            近期比赛预告
          </h2>
          <span className="text-[11px] text-white/80 tabular-nums truncate">
            · 2小时内 {upcoming.length} 场即将开打
          </span>
        </div>

        {upcoming.length > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-white/75 tabular-nums mr-0.5">
              {safeIndex + 1}/{upcoming.length}
            </span>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="上一场预告"
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="下一场预告"
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Sliding Track */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${safeIndex * 100}%)` }}
        >
          {upcoming.map((item) => {
            const { room, msUntilStart, displayState, urgency } = item;
            const isImminent = urgency === 'imminent';
            const cfg = ROOM_MODE_CONFIGS[room.mode];
            const redCount = room.redTeam.filter(Boolean).length;
            const blueCount = room.blueTeam.filter(Boolean).length;
            const filledStarters = redCount + blueCount;
            const totalStarters = room.teamSize * 2;
            const missingCount = Math.max(0, totalStarters - filledStarters);
            const sampleMembers = [
              ...room.redTeam.filter((m): m is NonNullable<typeof m> => m !== null),
              ...room.blueTeam.filter((m): m is NonNullable<typeof m> => m !== null),
            ].slice(0, 4);

            return (
              <div key={room.id} className="w-full shrink-0 px-3 py-3">
                <button
                  type="button"
                  data-urgency={urgency}
                  onClick={() => onSelectRoom(room.id)}
                  aria-label={`定位到即将开打的房间：${room.title}，${formatUpcomingCountdown(msUntilStart)}`}
                  className={`w-full text-left rounded-xl border-[1.5px] bg-[#1B1E26] px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-[#FDE047] ${
                    isImminent ? 'upcoming-breath-gold' : 'upcoming-breath-red'
                  }`}
                >
                  {/* Countdown + Time Row */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0 tabular-nums">
                      <Clock
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isImminent ? 'text-[#FDE047]' : 'text-[#FCA5A5]'
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={`font-bold shrink-0 ${
                          isImminent ? 'text-[#FDE047]' : 'text-[#FCA5A5]'
                        }`}
                      >
                        {formatUpcomingCountdown(msUntilStart)}
                      </span>
                      <span className="text-white/45" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-white/80 truncate">
                        {formatShortClock(room.scheduledAt, now)}
                      </span>
                    </div>

                    <span
                      className={`text-[11px] font-semibold shrink-0 tabular-nums ${
                        displayState === 'full'
                          ? 'text-[#34D399]'
                          : isImminent
                            ? 'text-[#FDE68A]'
                            : 'text-[#FCA5A5]'
                      }`}
                    >
                      {displayState === 'full' ? '已满员待开打' : `还差 ${missingCount} 人`}
                    </span>
                  </div>

                  {/* Title + Jump Arrow */}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <h3 className="text-[16px] font-bold text-white leading-snug truncate">
                      {room.title}
                    </h3>
                    <span className="text-[11px] font-medium text-white/75 flex items-center gap-0.5 shrink-0">
                      <span>定位房间</span>
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </div>

                  {/* Court + Teams + Jersey Preview */}
                  <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-[11px] text-white/80 tabular-nums truncate">
                        {cfg.label} · 红 {redCount}/{room.teamSize} vs 蓝 {blueCount}/{room.teamSize}
                        {room.benchLimit > 0 ? ` · 替补 ${room.bench.length}/${room.benchLimit}` : ''}
                      </p>
                      <p className="text-[11px] text-white/60 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0 text-white/50" aria-hidden="true" />
                        <span className="truncate">{room.courtNote}</span>
                      </p>
                    </div>

                    {sampleMembers.length > 0 && (
                      <div className="flex items-center -space-x-1.5 shrink-0">
                        {sampleMembers.map((member) => (
                          <div
                            key={member.userId}
                            className="rounded-lg ring-2 ring-[#1B1E26]"
                          >
                            <PlayerAvatar
                              nickname={member.nickname}
                              jerseyNumber={member.jerseyNumber}
                              avatarBg={member.avatarBg}
                              size="sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination Dots */}
      {upcoming.length > 1 && (
        <div
          className="pb-2.5 flex items-center justify-center gap-1.5"
          role="tablist"
          aria-label="切换近期比赛预告"
        >
          {upcoming.map((item, idx) => {
            const active = idx === safeIndex;
            const activeColor = item.urgency === 'imminent' ? 'bg-[#FBBF24]' : 'bg-[#F87171]';
            return (
              <button
                key={item.room.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`查看第 ${idx + 1} 场预告：${item.room.title}`}
                onClick={() => setActiveIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  active ? `w-5 ${activeColor}` : 'w-1.5 bg-white/30 hover:bg-white/50'
                }`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};
