import React, { useState } from 'react';
import { LogIn, LogOut, ShieldCheck, Clock, UserPlus, Pencil } from 'lucide-react';
import { sortLeaderboard, starsToHupuScore } from '../shared/scoring';
import type {
  BootstrapResponse,
  MatchRoom,
  PlayerSummary,
  PublicPlayer,
} from '../shared/types';
import { EditProfileModal } from './EditProfileModal';
import { PlayerAvatar } from './PlayerAvatar';

interface ProfileViewProps {
  currentUser: PublicPlayer | null;
  players: PlayerSummary[];
  rooms: MatchRoom[];
  countdownText: string;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onSelectPlayer: (playerId: string) => void;
  onDataUpdate: (next: BootstrapResponse) => void;
  onToast: (msg: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  players,
  rooms,
  countdownText,
  onOpenAuth,
  onLogout,
  onSelectPlayer,
  onDataUpdate,
  onToast,
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const myProfile = currentUser
    ? players.find((p) => p.id === currentUser.id) ?? null
    : null;

  const heatOrder = sortLeaderboard(players, 'heat');
  const myRank = currentUser
    ? heatOrder.findIndex((p) => p.id === currentUser.id) + 1
    : null;

  const myRatedPlayers = players.filter((p) => p.myStars !== null);
  const myRooms = currentUser
    ? rooms.filter(
        (r) =>
          r.redTeam.some((s) => s?.userId === currentUser.id) ||
          r.blueTeam.some((s) => s?.userId === currentUser.id) ||
          r.bench.some((b) => b.userId === currentUser.id),
      )
    : [];

  return (
    <div className="px-3 pt-3 pb-6 space-y-3">
      {!currentUser ? (
        <section className="bg-white rounded-2xl border border-[#E6E8EC] p-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#141518] text-white font-score text-2xl font-extrabold flex items-center justify-center mx-auto">
            YY
          </div>
          <h1 className="text-lg font-bold text-[#141518] mt-3">登录园区虎扑</h1>
          <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
            未登录仅可浏览评分、热评与约球房；登录后可参与球员打分、点赞、互相回复及自定义约球报名。
          </p>

          <div className="grid grid-cols-2 gap-2.5 mt-5">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="min-h-[44px] rounded-xl bg-[#C60100] text-white text-sm font-semibold flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>点选登录</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="min-h-[44px] rounded-xl border border-[#DCE0E6] bg-white text-[#141518] text-sm font-semibold flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>注册成球员</span>
            </button>
          </div>

          <p className="text-[11px] text-[#6B7280] mt-4">
            点击已注册球手（YY01 ~ YY18 等）即可一键登录，无需输入密码
          </p>
        </section>
      ) : (
        <>
          {/* Logged-in Player Jersey Card */}
          <section className="bg-white rounded-2xl border border-[#E6E8EC] p-4">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar
                  nickname={currentUser.nickname}
                  jerseyNumber={currentUser.jerseyNumber}
                  avatarBg={currentUser.avatarBg}
                  size="lg"
                />
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-[#141518] truncate">
                    {currentUser.nickname}
                  </h1>
                  <p className="text-xs text-[#6B7280] mt-0.5 truncate tabular-nums">
                    账号 {currentUser.account} · #{currentUser.jerseyNumber}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="min-h-[40px] px-2.5 rounded-xl border border-[#C60100]/35 bg-[#FEF2F2]/60 text-xs font-semibold text-[#C60100] hover:bg-[#FEF2F2] flex items-center gap-1 whitespace-nowrap"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>编辑</span>
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="退出登录"
                  className="min-h-[40px] px-2.5 rounded-xl border border-[#E6E8EC] text-xs font-medium text-[#6B7280] hover:text-[#141518] flex items-center gap-1 whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>退出</span>
                </button>
              </div>
            </div>

            {myProfile && (
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#F0F2F5] text-center">
                <div>
                  <p className="font-score text-2xl font-extrabold text-[#C60100] leading-none">
                    {myProfile.averageScore !== null
                      ? myProfile.averageScore.toFixed(1)
                      : '--'}
                  </p>
                  <p className="text-[11px] text-[#6B7280] mt-1">今日我的均分</p>
                </div>
                <div>
                  <p className="font-score text-2xl font-extrabold text-[#141518] leading-none">
                    #{myRank}
                  </p>
                  <p className="text-[11px] text-[#6B7280] mt-1">实时热度排名</p>
                </div>
                <div>
                  <p className="font-score text-2xl font-extrabold text-[#141518] leading-none">
                    {myProfile.heatScore}
                  </p>
                  <p className="text-[11px] text-[#6B7280] mt-1">今日热度值</p>
                </div>
              </div>
            )}
          </section>

          {/* My Today's Ratings */}
          <section className="bg-white rounded-2xl border border-[#E6E8EC] p-4">
            <h2 className="text-sm font-bold text-[#141518] mb-2.5 tabular-nums">
              我今日打过的分 ({myRatedPlayers.length})
            </h2>
            {myRatedPlayers.length === 0 ? (
              <p className="text-xs text-[#9CA3AF]">今天还没有给队友或对手打分</p>
            ) : (
              <div className="divide-y divide-[#F0F2F5]">
                {myRatedPlayers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPlayer(p.id)}
                    className="w-full min-h-[48px] py-2 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <PlayerAvatar
                        nickname={p.nickname}
                        jerseyNumber={p.jerseyNumber}
                        avatarBg={p.avatarBg}
                        size="sm"
                      />
                      <span className="text-sm font-semibold text-[#141518]">
                        {p.nickname}
                      </span>
                    </div>
                    <span className="font-score text-lg font-bold text-[#C60100]">
                      {starsToHupuScore(p.myStars!)} 分
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* My Joined Rooms */}
          <section className="bg-white rounded-2xl border border-[#E6E8EC] p-4">
            <h2 className="text-sm font-bold text-[#141518] mb-2 tabular-nums">
              我已报名的约球房 ({myRooms.length})
            </h2>
            {myRooms.length === 0 ? (
              <p className="text-xs text-[#9CA3AF]">当前未在任何约球房间占座</p>
            ) : (
              <div className="space-y-2">
                {myRooms.map((r) => (
                  <div
                    key={r.id}
                    className="px-3 py-2.5 rounded-xl bg-[#F7F8FA] flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-[#141518] truncate">
                      {r.title}
                    </span>
                    <span className="text-[#6B7280] shrink-0 ml-2">{r.courtNote}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Rules & Daily 00:00 Reset Card */}
      <section className="bg-white rounded-2xl border border-[#E6E8EC] p-4 space-y-2.5 text-xs text-[#4B5563]">
        <div className="flex items-center gap-2 font-semibold text-[#141518]">
          <Clock className="w-4 h-4 text-[#C60100]" aria-hidden="true" />
          <span className="tabular-nums">每日 00:00 清零评分互动 · 距重置 {countdownText}</span>
        </div>
        <p className="leading-relaxed text-[#6B7280]">
          每天零点仅清空当日的球员评分、热评回复与点赞数据；未开打或进行中的约球房间跨天保留，并在开打时间超期 2 小时后自动删除；已注册球手账号永久保留。
        </p>
        <div className="flex items-center gap-2 pt-1 text-[#6B7280]">
          <ShieldCheck className="w-4 h-4 text-[#6B7280] shrink-0" aria-hidden="true" />
          <span>纯园区虎扑评分与热评互动，不录入得分/篮板等复杂技术统计。</span>
        </div>
      </section>
      {currentUser && (
        <EditProfileModal
          open={editOpen}
          currentUser={currentUser}
          onClose={() => setEditOpen(false)}
          onDataUpdate={onDataUpdate}
          onToast={onToast}
        />
      )}
    </div>
  );
};
