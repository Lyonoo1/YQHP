import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Link2, Search, UserPlus, X } from 'lucide-react';
import { api } from '../lib/api';
import { copyTextToClipboard, getAppShareBaseUrl } from '../lib/clipboard';
import {
  buildRoomInviteLink,
  getAvailableSlotsForTeam,
  getMemberRoomTeam,
} from '../shared/scoring';
import type {
  BootstrapResponse,
  MatchRoom,
  PublicPlayer,
  RoomTeamSlot,
} from '../shared/types';
import { PlayerAvatar } from './PlayerAvatar';

interface RoomInviteModalProps {
  room: MatchRoom | null;
  initialTeam: RoomTeamSlot;
  players: PublicPlayer[];
  currentUser: PublicPlayer | null;
  onClose: () => void;
  onDataUpdate: (next: BootstrapResponse) => void;
  onToast: (msg: string) => void;
}

const TEAM_LABELS: Record<RoomTeamSlot, string> = {
  red: '红队',
  blue: '蓝队',
  bench: '替补席',
};

export const RoomInviteModal: React.FC<RoomInviteModalProps> = ({
  room,
  initialTeam,
  players,
  currentUser,
  onClose,
  onDataUpdate,
  onToast,
}) => {
  const [targetTeam, setTargetTeam] = useState<RoomTeamSlot>(initialTeam);
  const [query, setQuery] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (room) {
      setTargetTeam(initialTeam === 'bench' && room.benchLimit <= 0 ? 'red' : initialTeam);
      setQuery('');
      setCopiedKey(null);
    }
  }, [room?.id, initialTeam, room?.benchLimit]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const markCopied = (key: string) => {
    setCopiedKey(key);
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
  };

  const filteredPlayers = useMemo(() => {
    if (!room) return [];
    const q = query.trim().toLowerCase();
    return [...players]
      .filter((p) => p.id !== currentUser?.id)
      .filter((p) => {
        if (!q) return true;
        return (
          p.nickname.toLowerCase().includes(q) ||
          p.account.toLowerCase().includes(q) ||
          p.jerseyNumber.includes(q)
        );
      })
      .sort((a, b) => a.account.localeCompare(b.account));
  }, [players, currentUser?.id, query, room]);

  if (!room) return null;

  const teamOptions: RoomTeamSlot[] =
    room.benchLimit > 0 ? ['red', 'blue', 'bench'] : ['red', 'blue'];

  const remainingSlots = getAvailableSlotsForTeam(room, targetTeam);
  const invites = room.invites ?? [];

  const handleSendInvite = async (targetPlayer: PublicPlayer) => {
    const key = `${targetPlayer.id}:invite`;
    setBusyKey(key);
    try {
      const next = await api.inviteToRoom(room.id, targetPlayer.id, targetTeam);
      onDataUpdate(next);
      const teamLabel = TEAM_LABELS[targetTeam];
      onToast(`已向 ${targetPlayer.nickname} 发送加入${teamLabel}邀请，等待对方确认`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusyKey(null);
    }
  };

  const handleCopyTeamLink = async () => {
    const url = buildRoomInviteLink(getAppShareBaseUrl(), {
      roomId: room.id,
      team: targetTeam,
    });
    const ok = await copyTextToClipboard(url);
    markCopied('team');
    onToast(
      ok
        ? `已复制${TEAM_LABELS[targetTeam]}邀请链接，发给球友点击即可入队`
        : '链接已生成，请手动复制分享给好友',
    );
  };

  const handleCopyPlayerInviteLink = async (targetPlayer: PublicPlayer) => {
    const key = `${targetPlayer.id}:link`;
    setBusyKey(key);
    try {
      const existing = invites.find(
        (inv) => inv.inviteeId === targetPlayer.id && inv.targetTeam === targetTeam,
      );
      let inviteId = existing?.id;

      if (!inviteId) {
        const next = await api.inviteToRoom(room.id, targetPlayer.id, targetTeam);
        onDataUpdate(next);
        const updatedRoom = next.rooms.find((r) => r.id === room.id);
        const createdInvite = updatedRoom?.invites?.find(
          (inv) => inv.inviteeId === targetPlayer.id && inv.targetTeam === targetTeam,
        );
        inviteId = createdInvite?.id;
      }

      const url = buildRoomInviteLink(getAppShareBaseUrl(), {
        roomId: room.id,
        team: targetTeam,
        inviteId,
        inviteeAccount: targetPlayer.account,
      });

      const ok = await copyTextToClipboard(url);
      markCopied(targetPlayer.id);
      onToast(
        ok
          ? `已复制给 ${targetPlayer.nickname} 的专属邀请链接，发给TA点击即可加入${TEAM_LABELS[targetTeam]}`
          : `已发送邀请给 ${targetPlayer.nickname}`,
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : '生成邀请链接失败');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`邀请球手加入 ${room.title}`}
    >
      <div className="w-full max-w-[460px] max-h-[86dvh] bg-white rounded-t-3xl sm:rounded-2xl px-4 sm:px-5 pt-3 pb-6 shadow-2xl flex flex-col">
        <div className="w-10 h-1 bg-[#D8DCE2] rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#141518] truncate">邀请球手加入</h2>
            <p className="text-xs text-[#6B7280] truncate mt-0.5">{room.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭邀请弹窗"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-[#6B7280] hover:text-[#141518] rounded-full shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Team Selector */}
        <div
          className={`grid gap-1 p-1 bg-[#F2F4F7] rounded-xl mb-2.5 shrink-0 ${
            teamOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
          }`}
          role="tablist"
          aria-label="选择邀请加入的队伍"
        >
          {teamOptions.map((team) => {
            const active = targetTeam === team;
            const free = getAvailableSlotsForTeam(room, team);
            const activeColor =
              team === 'red'
                ? 'text-[#B91C1C]'
                : team === 'blue'
                  ? 'text-[#1D4ED8]'
                  : 'text-[#141518]';
            return (
              <button
                key={team}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTargetTeam(team)}
                className={`min-h-[40px] px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  active ? `bg-white ${activeColor} shadow-xs` : 'text-[#6B7280]'
                }`}
              >
                {TEAM_LABELS[team]}（余{free}）
              </button>
            );
          })}
        </div>

        {/* General Shareable Invite Link Button */}
        <button
          type="button"
          disabled={remainingSlots <= 0}
          onClick={handleCopyTeamLink}
          className="w-full min-h-[42px] px-3 mb-2.5 rounded-xl border border-[#C60100]/30 bg-[#FEF2F2]/60 hover:bg-[#FEF2F2] text-[#C60100] text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-45 shrink-0 transition-colors"
        >
          {copiedKey === 'team' ? (
            <>
              <Check className="w-4 h-4 shrink-0" />
              <span>已复制{TEAM_LABELS[targetTeam]}邀请链接，去微信/群里粘贴吧</span>
            </>
          ) : (
            <>
              <Link2 className="w-4 h-4 shrink-0" />
              <span>复制{TEAM_LABELS[targetTeam]}邀请链接（发给球友点击即入队）</span>
            </>
          )}
        </button>

        {/* Search Input */}
        <div className="relative mb-2.5 shrink-0">
          <Search
            className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="invite-player-search" className="sr-only">
            搜索要邀请的球手
          </label>
          <input
            id="invite-player-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索球手昵称或账号（如 科比 / YY08）"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
          />
        </div>

        {remainingSlots <= 0 && (
          <p className="text-xs text-[#B91C1C] mb-2 px-1 shrink-0">
            {TEAM_LABELS[targetTeam]}当前已满员，可切换上方队伍继续邀请
          </p>
        )}

        {/* Registered Players List */}
        <div
          className="flex-1 overflow-y-auto divide-y divide-[#F0F2F5] min-h-[210px] pr-0.5"
          aria-label="可邀请的球手名单"
        >
          {filteredPlayers.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#9CA3AF]">
              没有找到匹配的球手
            </div>
          ) : (
            filteredPlayers.map((player) => {
              const currentTeam = getMemberRoomTeam(room, player.id);
              const existingInvite = invites.find((inv) => inv.inviteeId === player.id);
              const alreadyInTarget = currentTeam === targetTeam;
              const alreadyInvitedToTarget = existingInvite?.targetTeam === targetTeam;
              const disabledAll = remainingSlots <= 0 || alreadyInTarget || busyKey !== null;
              const isLinkCopied = copiedKey === player.id;

              const statusText = currentTeam
                ? `当前在${TEAM_LABELS[currentTeam]}`
                : existingInvite
                  ? `已邀进${TEAM_LABELS[existingInvite.targetTeam]}（待确认）`
                  : player.account;

              return (
                <div
                  key={player.id}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <PlayerAvatar
                      nickname={player.nickname}
                      jerseyNumber={player.jerseyNumber}
                      avatarBg={player.avatarBg}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#141518] truncate">
                        {player.nickname}
                      </p>
                      <p className="text-[11px] text-[#6B7280] truncate">{statusText}</p>
                    </div>
                  </div>

                  {alreadyInTarget ? (
                    <span className="text-xs font-medium text-[#9CA3AF] px-2 shrink-0">
                      已在{TEAM_LABELS[targetTeam]}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={disabledAll || alreadyInvitedToTarget}
                        onClick={() => handleSendInvite(player)}
                        aria-label={`邀请 ${player.nickname} 加入${TEAM_LABELS[targetTeam]}`}
                        className="min-h-[36px] px-2.5 rounded-lg bg-[#C60100] hover:bg-[#A00100] text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-45 whitespace-nowrap"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{alreadyInvitedToTarget ? '已邀请' : '发邀请'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={disabledAll}
                        onClick={() => handleCopyPlayerInviteLink(player)}
                        aria-label={`复制给 ${player.nickname} 的专属邀请链接`}
                        className="min-h-[36px] px-2.5 rounded-lg border border-[#C60100]/35 bg-[#FEF2F2]/50 hover:bg-[#FEF2F2] text-[#C60100] text-xs font-medium flex items-center gap-1 disabled:opacity-45 whitespace-nowrap"
                      >
                        {isLinkCopied ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        <span>{isLinkCopied ? '已复制' : '复制链接'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <p className="text-[11px] text-[#6B7280] mt-3 text-center shrink-0">
          对方需在消息中确认或打开邀请链接后才会入队，不支持直接拉人
        </p>
      </div>
    </div>
  );
};
