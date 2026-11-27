import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Eye, EyeOff, Link2, Lock, Swords, UserCheck, Users, X } from 'lucide-react';
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
  const [showSwitchLogin, setShowSwitchLogin] = useState(false);
  const [loginAccount, setLoginAccount] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  useEffect(() => {
    setLoginAccount(targetInvitee?.account ?? '');
    setLoginPassword('');
    setShowPassword(false);
    setShowSwitchLogin(false);
    setErrorMsg(null);
  }, [inviteLink?.roomId, inviteLink?.inviteId, targetInvitee?.account]);

  if (!inviteLink) return null;

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

  const joinWithActiveSession = async () => {
    if (!currentUser) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      let next: BootstrapResponse;
      if (matchingInvite && matchingInvite.inviteeId === currentUser.id) {
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

  const handleDeclineWithActiveSession = async () => {
    if (!matchingInvite) {
      onClose();
      return;
    }
    if (!currentUser || currentUser.id !== matchingInvite.inviteeId) {
      setErrorMsg('请先使用被邀请人本人账号密码登录后再处理邀请');
      setShowSwitchLogin(true);
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
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

  const handlePasswordAuthAndAct = async (action: 'join' | 'decline') => {
    const cleanAccount = loginAccount.trim();
    if (!cleanAccount || !loginPassword) {
      setErrorMsg('请输入本人账号和密码');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await api.login(cleanAccount, loginPassword);
      setAuthToken(res.token);
      setLoginPassword('');

      if (action === 'decline') {
        if (!matchingInvite || matchingInvite.inviteeId !== res.user.id) {
          const refreshed = await api.bootstrap();
          onDataUpdate(refreshed);
          setErrorMsg('已登录本人账号，但只能使用被邀请人本人账号婉拒该专属邀请');
          return;
        }
        const next = await api.respondToRoomInvite(room.id, matchingInvite.id, 'decline');
        onDataUpdate(next);
        onToast('已婉拒该约球邀请');
        onClose();
        return;
      }

      let next: BootstrapResponse;
      if (matchingInvite && matchingInvite.inviteeId === res.user.id) {
        next = await api.respondToRoomInvite(room.id, matchingInvite.id, 'accept');
      } else {
        next = await api.joinRoom(room.id, targetTeam);
      }
      onDataUpdate(next);
      onToast(`已以「${res.user.nickname}」加入「${room.title}」${resolvedTeamLabel}`);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '登录或操作失败，请稍后重试');
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

  const needsPasswordForm = !currentUser || showSwitchLogin;

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
          <p
            role="alert"
            className="mt-3 text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2 shrink-0"
          >
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
          ) : targetInvitee && inviteeAlreadyInTarget && !showSwitchLogin ? (
            <div className="space-y-2.5">
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
            </div>
          ) : !needsPasswordForm && currentUser ? (
            <div className="space-y-2.5">
              {targetInvitee && !isTargetSelf && (
                <p className="text-xs text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-3 py-2.5 leading-relaxed">
                  该专属邀请发给「{targetInvitee.nickname}（{targetInvitee.account}）」，你当前登录的是「{currentUser.nickname}（{currentUser.account}）」。
                </p>
              )}

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
                    onClick={joinWithActiveSession}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-[#C60100] hover:bg-[#A00100] text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-55"
                  >
                    {isTargetSelf ? (
                      <Check className="w-4 h-4 shrink-0" />
                    ) : (
                      <UserCheck className="w-4 h-4 shrink-0" />
                    )}
                    <span>
                      {busy
                        ? '正在加入...'
                        : isTargetSelf
                          ? `接受邀请并加入${resolvedTeamLabel}`
                          : `以当前账号「${currentUser.nickname}」加入${resolvedTeamLabel}`}
                    </span>
                  </button>

                  {isTargetSelf && matchingInvite ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleDeclineWithActiveSession}
                      className="w-full min-h-[42px] rounded-xl border border-[#DCE0E6] bg-white text-[#4B5563] text-xs font-semibold"
                    >
                      婉拒邀请
                    </button>
                  ) : targetInvitee && !isTargetSelf ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setLoginAccount(targetInvitee.account);
                          setLoginPassword('');
                          setErrorMsg(null);
                          setShowSwitchLogin(true);
                        }}
                        className="min-h-[42px] rounded-xl border border-[#DCE0E6] bg-white text-[#141518] text-xs font-semibold"
                      >
                        切换为本人账号登录
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onClose}
                        className="min-h-[42px] rounded-xl border border-[#DCE0E6] bg-white text-[#4B5563] text-xs font-semibold"
                      >
                        先看看房间
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onClose}
                      className="w-full min-h-[42px] rounded-xl border border-[#DCE0E6] bg-white text-[#4B5563] text-xs font-semibold"
                    >
                      先看看房间
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handlePasswordAuthAndAct('join');
              }}
              className="space-y-3"
            >
              <p className="text-xs text-[#4B5563] font-medium">
                {targetInvitee
                  ? `请验证「${targetInvitee.nickname}」本人账号与密码以处理邀请：`
                  : `请使用本人账号与密码登录并加入${resolvedTeamLabel}：`}
              </p>

              <div>
                <label
                  htmlFor="invite-login-account"
                  className="block text-xs font-medium text-[#4B5563] mb-1"
                >
                  球手账号
                </label>
                <input
                  id="invite-login-account"
                  type="text"
                  value={loginAccount}
                  onChange={(e) => setLoginAccount(e.target.value)}
                  placeholder="输入本人账号，如 YY08"
                  maxLength={20}
                  required
                  autoComplete="username"
                  autoCapitalize="characters"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="invite-login-password"
                  className="block text-xs font-medium text-[#4B5563] mb-1"
                >
                  登录密码
                </label>
                <div className="relative">
                  <input
                    id="invite-login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="请输入本人登录密码"
                    maxLength={32}
                    required
                    autoComplete="current-password"
                    className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-[#6B7280] hover:text-[#141518]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[46px] rounded-xl bg-[#C60100] hover:bg-[#A00100] text-white text-sm font-semibold disabled:opacity-55 flex items-center justify-center gap-1.5"
              >
                <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{busy ? '正在验证并入队...' : `登录并加入${resolvedTeamLabel}`}</span>
              </button>

              {matchingInvite && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handlePasswordAuthAndAct('decline')}
                  className="w-full min-h-[42px] rounded-xl border border-[#DCE0E6] bg-white text-[#4B5563] text-xs font-semibold disabled:opacity-55"
                >
                  验证本人密码并婉拒邀请
                </button>
              )}

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
                {currentUser && showSwitchLogin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSwitchLogin(false);
                      setErrorMsg(null);
                    }}
                    className="text-[#6B7280] py-1"
                  >
                    返回当前账号
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-[#6B7280] py-1"
                  >
                    仅浏览房间
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
