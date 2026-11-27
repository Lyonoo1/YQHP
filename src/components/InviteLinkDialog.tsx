import React, { useMemo, useState } from 'react';
import { Check, Clock, Link2, Swords, UserCheck, Users, X } from 'lucide-react';
import { api, setAuthToken } from '../lib/api';
import {
  getAvailableSlotsForTeam,
  getMemberRoomTeam,
  ROOM_MODE_CONFIGS,
  type ParsedRoomInviteLink,
} from '../shared/scoring';
import type {
  BootstrapResponse,
  MatchRoom,
  PublicPlayer,
  RoomTeamSlot,
} from '../shared/types';
import { PlayerAvatar } from './PlayerAvatar';

interface InviteLinkDialogProps {
  inviteLink: ParsedRoomInviteLink | null;
  rooms: MatchRoom[];
  players: PublicPlayer[];
  currentUser: PublicPlayer | null;
  onClose: () => void;
  onDataUpdate: (next: BootstrapResponse) => void;
  onRequireRegister: () => void;
  onToast: (msg: string) => void;
}

const TEAM_LABELS: Record<RoomTeamSlot, string> = {
  red: '红队',
  blue: '蓝队',
  bench: '替补席',
};

function formatScheduleLabel(iso?: string): string {
  if (!iso) return '即将开打';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '即将开打';
  const date = new Date(ts);
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

export const InviteLinkDialog: React.FC<InviteLinkDialogProps> = ({
  inviteLink,
  rooms,
  players,
  currentUser,
  onClose,
  onDataUpdate,
  onRequireRegister,
  onToast,
}) => {
  const [busy, setBusy] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const room = useMemo(() => {
    if (!inviteLink) return null;
    return rooms.find((r) => r.id === inviteLink.roomId) ?? null;
  }, [inviteLink, rooms]);

  const matchingInvite = useMemo(() => {
    if (!room || !inviteLink?.inviteId) return null;
    return (room.invites ?? []).find((inv) => inv.id === inviteLink.inviteId) ?? null;
  }, [room, inviteLink]);

  const targetInvitee = useMemo(() => {
    if (!inviteLink) return null;
    if (matchingInvite) {
      return players.find((p) => p.id === matchingInvite.inviteeId) ?? null;
    }
    if (inviteLink.inviteeAccount) {
      const upper = inviteLink.inviteeAccount.toUpperCase();
      return players.find((p) => p.account.toUpperCase() === upper) ?? null;
    }
    return null;
  }, [inviteLink, matchingInvite, players]);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.account.localeCompare(b.account)),
    [players],
  );

  if (!inviteLink) return null;

  const teamLabel = TEAM_LABELS[inviteLink.team];

  if (!room) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-label="约球邀请链接已失效"
      >
        <div className="w-full max-w-[440px] bg-white rounded-t-3xl sm:rounded-2xl px-5 pt-4 pb-7 shadow-2xl">
          <div className="w-10 h-1 bg-[#D8DCE2] rounded-full mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[#141518]">
              <Link2 className="w-4 h-4 text-[#C60100]" aria-hidden="true" />
              <h2 className="text-base font-bold">邀请链接已失效</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭提示"
              className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-[#6B7280]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-[#4B5563] leading-relaxed">
            该约球房间已超期自动删除，或已被房主解散。你可以直接查看当前园区里的其他约球房间。
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-5 h-11 rounded-xl bg-[#C60100] hover:bg-[#A00100] text-white text-sm font-semibold"
          >
            查看当前约球房
          </button>
        </div>
      </div>
    );
  }

  const targetTeam: RoomTeamSlot = matchingInvite?.targetTeam ?? inviteLink.team;
  const resolvedTeamLabel = TEAM_LABELS[targetTeam];
  const remainingSlots = getAvailableSlotsForTeam(room, targetTeam);
  const cfg = ROOM_MODE_CONFIGS[room.mode];
  const isTargetSelf = Boolean(currentUser && targetInvitee && currentUser.id === targetInvitee.id);
  const alreadyInTargetTeam = Boolean(
    currentUser && getMemberRoomTeam(room, currentUser.id) === targetTeam,
  );
  const inviteeAlreadyInTarget = Boolean(
    targetInvitee && getMemberRoomTeam(room, targetInvitee.id) === targetTeam,
  );

  const acceptWithCurrentOrAccount = async (accountToLogin?: string) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      let activeUser = currentUser;
      if (accountToLogin) {
        const res = await api.quickLogin(accountToLogin);
        setAuthToken(res.token);
        activeUser = res.user;
      }
      if (!activeUser) {
        setErrorMsg('请先选择你的球手身份');
        setBusy(false);
        return;
      }

      let next: BootstrapResponse;
      if (matchingInvite && matchingInvite.inviteeId === activeUser.id) {
        next = await api.respondToRoomInvite(room.id, matchingInvite.id, 'accept');
      } else {
        next = await api.joinRoom(room.id, targetTeam);
      }
      onDataUpdate(next);
      onToast(`已加入「${room.title}」${resolvedTeamLabel}`);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '加入失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!matchingInvite) {
      onClose();
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      if (targetInvitee && currentUser?.id !== targetInvitee.id) {
        const res = await api.quickLogin(targetInvitee.account);
        setAuthToken(res.token);
      }
      const next = await api.respondToRoomInvite(room.id, matchingInvite.id, 'decline');
      onDataUpdate(next);
      onToast('已婉拒该约球邀请');
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const teamColorClass =
    targetTeam === 'red'
      ? 'text-[#B91C1C]'
      : targetTeam === 'blue'
        ? 'text-[#1D4ED8]'
        : 'text-[#141518]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`收到约球邀请：${room.title}`}
    >
      <div className="w-full max-w-[460px] max-h-[88dvh] bg-white rounded-t-3xl sm:rounded-2xl px-5 pt-3 pb-7 shadow-2xl flex flex-col">
        <div className="w-10 h-1 bg-[#D8DCE2] rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Swords className="w-5 h-5 text-[#C60100] shrink-0" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[#141518] truncate">
              收到约球邀请
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭邀请弹窗"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-[#6B7280] hover:text-[#141518]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Summary Card */}
        <div className="rounded-2xl bg-[#FAFBFD] border border-[#E6E8EC] p-3.5 space-y-2 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-bold text-[#141518] leading-snug">
              {room.title}
            </h3>
            <span className={`text-xs font-bold shrink-0 ${teamColorClass}`}>
              加入{resolvedTeamLabel}
            </span>
          </div>

          <div className="text-xs text-[#6B7280] space-y-1">
            <p className="flex items-center gap-1.5 tabular-nums">
              <Clock className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF]" aria-hidden="true" />
              <span>开打时间：{formatScheduleLabel(room.scheduledAt)}</span>
            </p>
            <p className="flex items-center gap-1.5 tabular-nums">
              <Users className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF]" aria-hidden="true" />
              <span>
                {cfg.label} · {room.courtNote} · {resolvedTeamLabel}余 {remainingSlots} 位
              </span>
            </p>
          </div>

          {matchingInvite && (
            <p className="text-xs text-[#374151] pt-1 border-t border-[#E6E8EC]">
              <span className="font-semibold text-[#141518]">{matchingInvite.inviterNickname}</span>{' '}
              专属邀请{' '}
              <span className="font-semibold text-[#C60100]">{matchingInvite.inviteeNickname}</span>{' '}
              入队
            </p>
          )}
        </div>

        {errorMsg && (
          <p className="mt-3 text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2 shrink-0">
            {errorMsg}
          </p>
        )}

        {/* Action Body */}
        <div className="mt-4 space-y-3 overflow-y-auto flex-1">
          {remainingSlots <= 0 && !alreadyInTargetTeam && !inviteeAlreadyInTarget ? (
            <div className="space-y-3">
              <p className="text-xs text-[#B91C1C] bg-[#FEF2F2] rounded-xl px-3 py-2.5">
                {resolvedTeamLabel}当前已满员，你可以关闭弹窗进入房间查看其他空位或替补席。
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 rounded-xl bg-[#141518] text-white text-sm font-semibold"
              >
                去房间看看其他空位
              </button>
            </div>
          ) : targetInvitee && !showPicker ? (
            <div className="space-y-2.5">
              {inviteeAlreadyInTarget ? (
                <>
                  <p className="text-xs text-[#0F766E] bg-[#F0FDFA] border border-[#99F6E4] rounded-xl px-3 py-2.5">
                    {targetInvitee.nickname} 已经在「{room.title}」{resolvedTeamLabel}中了！
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full h-11 rounded-xl bg-[#C60100] text-white text-sm font-semibold"
                  >
                    进入房间查看
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      acceptWithCurrentOrAccount(
                        isTargetSelf ? undefined : targetInvitee.account,
                      )
                    }
                    className="w-full min-h-[48px] px-4 rounded-xl bg-[#C60100] hover:bg-[#A00100] text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-55"
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span>
                      {busy
                        ? '正在加入...'
                        : isTargetSelf
                          ? `接受邀请并加入${resolvedTeamLabel}`
                          : `以「${targetInvitee.nickname}」身份登录并加入${resolvedTeamLabel}`}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleDecline}
                      className="min-h-[42px] rounded-xl border border-[#DCE0E6] bg-white text-[#4B5563] text-xs font-semibold"
                    >
                      {matchingInvite ? '婉拒邀请' : '暂不加入'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowPicker(true)}
                      className="min-h-[42px] rounded-xl border border-[#DCE0E6] bg-white text-[#141518] text-xs font-semibold"
                    >
                      换其他球手加入
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : currentUser && !showPicker ? (
            <div className="space-y-2.5">
              {alreadyInTargetTeam ? (
                <>
                  <p className="text-xs text-[#0F766E] bg-[#F0FDFA] border border-[#99F6E4] rounded-xl px-3 py-2.5">
                    你当前已在「{room.title}」{resolvedTeamLabel}中。
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full h-11 rounded-xl bg-[#C60100] text-white text-sm font-semibold"
                  >
                    查看房间阵容
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => acceptWithCurrentOrAccount()}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-[#C60100] hover:bg-[#A00100] text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-55"
                  >
                    <UserCheck className="w-4 h-4 shrink-0" />
                    <span>
                      {busy
                        ? '正在入队...'
                        : `以「${currentUser.nickname}」加入${resolvedTeamLabel}`}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onClose}
                    className="w-full min-h-[42px] rounded-xl border border-[#DCE0E6] bg-white text-[#4B5563] text-xs font-semibold"
                  >
                    先看看房间
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#4B5563] font-medium">
                点选你的球手身份，一键登录并加入{teamLabel}：
              </p>

              <div className="grid grid-cols-3 gap-1.5 max-h-[220px] overflow-y-auto pr-0.5">
                {sortedPlayers.map((p) => {
                  const selected = selectedAccount === p.account;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedAccount(p.account)}
                      className={`p-2 rounded-xl border text-left flex items-center gap-1.5 transition-colors ${
                        selected
                          ? 'border-[#C60100] bg-[#FEF2F2]'
                          : 'border-[#E6E8EC] bg-white hover:border-[#141518]'
                      }`}
                    >
                      <PlayerAvatar
                        nickname={p.nickname}
                        jerseyNumber={p.jerseyNumber}
                        avatarBg={p.avatarBg}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#141518] truncate">
                          {p.nickname}
                        </p>
                        <p className="text-[10px] text-[#9CA3AF] font-score">{p.account}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={busy || !selectedAccount}
                onClick={() => acceptWithCurrentOrAccount(selectedAccount)}
                className="w-full min-h-[46px] rounded-xl bg-[#C60100] hover:bg-[#A00100] text-white text-sm font-semibold disabled:opacity-45"
              >
                {busy ? '正在登录并入队...' : `登录并加入${resolvedTeamLabel}`}
              </button>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequireRegister();
                  }}
                  className="text-[#C60100] font-medium hover:underline py-1"
                >
                  新球手？先注册账号
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[#6B7280] py-1"
                >
                  仅浏览房间
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
