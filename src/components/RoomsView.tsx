import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Users,
  X,
  LogOut,
  Play,
  Pause,
  UserPlus,
  Check,
  Mail,
  Clock,
  Link2,
} from 'lucide-react';
import { api } from '../lib/api';
import { copyTextToClipboard, getAppShareBaseUrl } from '../lib/clipboard';
import {
  buildRoomInviteLink,
  getRoomDisplayState,
  getRoomMinutesUntilExpiry,
  getRoomStartTimestampMs,
  getShanghaiDateKey,
  ROOM_MODE_CONFIGS,
} from '../shared/scoring';
import type {
  BootstrapResponse,
  MatchRoom,
  PublicPlayer,
  RoomCourtType,
  RoomInviteRecord,
  RoomMode,
  RoomTeamSlot,
} from '../shared/types';
import { PlayerAvatar } from './PlayerAvatar';
import { RoomInviteModal } from './RoomInviteModal';
import { UpcomingRoomsCarousel } from './UpcomingRoomsCarousel';

interface RoomsViewProps {
  rooms: MatchRoom[];
  players: PublicPlayer[];
  currentUser: PublicPlayer | null;
  onRequireAuth: () => void;
  onDataUpdate: (next: BootstrapResponse) => void;
  onToast: (msg: string) => void;
}

const HALF_MODES: RoomMode[] = ['half_2v2', 'half_3v3', 'half_4v4'];
const BENCH_OPTIONS = [0, 2, 4, 6];
const TEAM_LABEL_MAP: Record<RoomTeamSlot, string> = {
  red: '红队',
  blue: '蓝队',
  bench: '替补席',
};

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function getDefaultScheduleInput(): string {
  const base = new Date(Date.now() + 60 * 60 * 1000);
  const mins = Math.ceil(base.getMinutes() / 15) * 15;
  base.setMinutes(mins, 0, 0);
  return toLocalDateTimeInputValue(base);
}

function formatRoomSchedule(iso?: string): string {
  if (!iso) return '即将开打';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '即将开打';
  const target = new Date(ts);
  const now = new Date();
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

  const mdStr = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
  }).format(target);
  return `${mdStr} ${timeStr}`;
}

export const RoomsView: React.FC<RoomsViewProps> = ({
  rooms,
  players,
  currentUser,
  onRequireAuth,
  onDataUpdate,
  onToast,
}) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [courtType, setCourtType] = useState<RoomCourtType>('half');
  const [mode, setMode] = useState<RoomMode>('half_3v3');
  const [benchLimit, setBenchLimit] = useState<number>(4);
  const [title, setTitle] = useState('');
  const [courtNote, setCourtNote] = useState('');
  const [scheduledAtInput, setScheduledAtInput] = useState<string>(() =>
    getDefaultScheduleInput(),
  );
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());
  const [highlightedRoomId, setHighlightedRoomId] = useState<string | null>(null);
  const [inviteModalState, setInviteModalState] = useState<{
    roomId: string;
    team: RoomTeamSlot;
  } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleFocusRoom = (roomId: string) => {
    setHighlightedRoomId(roomId);
    const el = document.getElementById(`room-card-${roomId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    window.setTimeout(() => {
      setHighlightedRoomId((prev) => (prev === roomId ? null : prev));
    }, 2200);
  };

  const inviteTargetRoom = useMemo(() => {
    if (!inviteModalState) return null;
    return rooms.find((r) => r.id === inviteModalState.roomId) ?? null;
  }, [rooms, inviteModalState]);

  const myIncomingInvites = useMemo(() => {
    if (!currentUser) return [];
    const list: { room: MatchRoom; invite: RoomInviteRecord }[] = [];
    for (const room of rooms) {
      for (const invite of room.invites ?? []) {
        if (invite.inviteeId === currentUser.id) {
          list.push({ room, invite });
        }
      }
    }
    return list;
  }, [rooms, currentUser]);

  const openCreateModal = () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setScheduledAtInput(getDefaultScheduleInput());
    setCreateOpen(true);
  };

  const handleCourtTypeSwitch = (nextType: RoomCourtType) => {
    setCourtType(nextType);
    if (nextType === 'half') {
      setMode('half_3v3');
    } else {
      setMode('full_5v5');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setCreating(true);
    try {
      const parsedDate = scheduledAtInput ? new Date(scheduledAtInput) : null;
      const scheduledAt =
        parsedDate && Number.isFinite(parsedDate.getTime())
          ? parsedDate.toISOString()
          : undefined;
      const next = await api.createRoom({
        title,
        courtNote,
        mode,
        benchLimit: mode === 'full_5v5' ? benchLimit : 0,
        scheduledAt,
      });
      onDataUpdate(next);
      setCreateOpen(false);
      setTitle('');
      setCourtNote('');
      onToast('比赛房间已创建，你已自动加入红队 1 号位');
    } catch (err) {
      onToast(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinSlot = async (
    roomId: string,
    team: RoomTeamSlot,
    slotIndex?: number,
  ) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setBusyRoomId(roomId);
    try {
      const next = await api.joinRoom(roomId, team, slotIndex);
      onDataUpdate(next);
      const label =
        team === 'red' ? '红队' : team === 'blue' ? '蓝队' : '替补席';
      onToast(`已报名进入${label}`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : '报名失败');
    } finally {
      setBusyRoomId(null);
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setBusyRoomId(roomId);
    try {
      const next = await api.leaveRoom(roomId);
      onDataUpdate(next);
      onToast('已退出该房间位置');
    } catch (err) {
      onToast(err instanceof Error ? err.message : '退出失败');
    } finally {
      setBusyRoomId(null);
    }
  };

  const handleToggleStatus = async (room: MatchRoom) => {
    if (!currentUser) return;
    setBusyRoomId(room.id);
    try {
      const nextStatus = room.status === 'recruiting' ? 'playing' : 'recruiting';
      const next = await api.updateRoomStatus(room.id, nextStatus);
      onDataUpdate(next);
      onToast(nextStatus === 'playing' ? '比赛状态已切换为开打中' : '已恢复组队报名');
    } catch (err) {
      onToast(err instanceof Error ? err.message : '切换失败');
    } finally {
      setBusyRoomId(null);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!currentUser) return;
    setBusyRoomId(roomId);
    try {
      const next = await api.deleteRoom(roomId);
      onDataUpdate(next);
      onToast('房间已解散');
    } catch (err) {
      onToast(err instanceof Error ? err.message : '解散失败');
    } finally {
      setBusyRoomId(null);
    }
  };

  const openInviteModal = (roomId: string, team: RoomTeamSlot) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setInviteModalState({ roomId, team });
  };

  const handleRespondInvite = async (
    roomId: string,
    invite: RoomInviteRecord,
    action: 'accept' | 'decline',
  ) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setBusyRoomId(roomId);
    try {
      const next = await api.respondToRoomInvite(roomId, invite.id, action);
      onDataUpdate(next);
      onToast(
        action === 'accept'
          ? `已接受邀请并加入${TEAM_LABEL_MAP[invite.targetTeam]}`
          : '已婉拒该约球邀请',
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : '处理邀请失败');
    } finally {
      setBusyRoomId(null);
    }
  };

  const handleCancelInvite = async (roomId: string, inviteId: string, inviteeNickname: string) => {
    if (!currentUser) return;
    setBusyRoomId(roomId);
    try {
      const next = await api.cancelRoomInvite(roomId, inviteId);
      onDataUpdate(next);
      onToast(`已撤回对 ${inviteeNickname} 的邀请`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : '撤回失败');
    } finally {
      setBusyRoomId(null);
    }
  };

  const isMemberInRoom = (room: MatchRoom, userId: string | undefined): boolean => {
    if (!userId) return false;
    return (
      room.redTeam.some((s) => s?.userId === userId) ||
      room.blueTeam.some((s) => s?.userId === userId) ||
      room.bench.some((b) => b.userId === userId)
    );
  };

  const handleCopyPendingInviteLink = async (room: MatchRoom, inv: RoomInviteRecord) => {
    const invitee = players.find((p) => p.id === inv.inviteeId);
    const url = buildRoomInviteLink(getAppShareBaseUrl(), {
      roomId: room.id,
      team: inv.targetTeam,
      inviteId: inv.id,
      inviteeAccount: invitee?.account,
    });
    const ok = await copyTextToClipboard(url);
    onToast(
      ok
        ? `已复制给 ${inv.inviteeNickname} 的专属邀请链接`
        : '链接已生成，请手动复制',
    );
  };

  return (
    <div className="px-3 pt-3 pb-6 space-y-3">
      {/* Top Action Header */}
      <section className="bg-white rounded-2xl border border-[#E6E8EC] p-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[#141518]">园区自定义约球房</h1>
          <p className="text-xs text-[#6B7280] mt-0.5 leading-snug">
            半场 2v2-4v4 / 全场 5v5，点空位报名或邀好友
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="min-h-[44px] px-3.5 rounded-xl bg-[#C60100] hover:bg-[#A00100] active:scale-[0.98] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span>创建房间</span>
        </button>
      </section>

      {/* Incoming Invitations For Current User */}
      {myIncomingInvites.length > 0 && (
        <section
          aria-label="收到的约球邀请"
          className="bg-white rounded-2xl border border-[#C60100]/30 p-3.5 space-y-2.5"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#C60100]">
            <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>收到 {myIncomingInvites.length} 条约球邀请</span>
          </div>
          <div className="space-y-2">
            {myIncomingInvites.map(({ room, invite }) => (
              <div
                key={invite.id}
                className="rounded-xl bg-[#FAFBFD] border border-[#E6E8EC] px-3 py-2.5 flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#141518] leading-snug">
                    {invite.inviterNickname} 邀请你加入「{room.title}」
                    <span
                      className={
                        invite.targetTeam === 'red'
                          ? 'text-[#B91C1C] ml-1'
                          : invite.targetTeam === 'blue'
                            ? 'text-[#1D4ED8] ml-1'
                            : 'text-[#374151] ml-1'
                      }
                    >
                      {TEAM_LABEL_MAP[invite.targetTeam]}
                    </span>
                  </p>
                  <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">
                    {ROOM_MODE_CONFIGS[room.mode].label} · {room.courtNote}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={busyRoomId === room.id}
                    onClick={() => handleRespondInvite(room.id, invite, 'accept')}
                    aria-label={`接受 ${invite.inviterNickname} 的邀请加入${TEAM_LABEL_MAP[invite.targetTeam]}`}
                    className="min-h-[36px] px-2.5 rounded-lg bg-[#C60100] text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>接受</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyRoomId === room.id}
                    onClick={() => handleRespondInvite(room.id, invite, 'decline')}
                    aria-label={`婉拒 ${invite.inviterNickname} 的邀请`}
                    className="min-h-[36px] px-2.5 rounded-lg border border-[#DCE0E6] bg-white text-[#6B7280] text-xs font-medium whitespace-nowrap"
                  >
                    婉拒
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Matches Carousel (within 2 hours) */}
      <UpcomingRoomsCarousel rooms={rooms} now={now} onSelectRoom={handleFocusRoom} />

      {/* Active Rooms List */}
      {rooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E6E8EC] py-14 px-4 text-center">
          <Users className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-semibold text-[#374151]">当前还没有约球房间</p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            点击右上角「创建房间」开启半场或全场自定义对局
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => {
            const cfg = ROOM_MODE_CONFIGS[room.mode];
            const redCount = room.redTeam.filter(Boolean).length;
            const blueCount = room.blueTeam.filter(Boolean).length;
            const totalStarters = room.teamSize * 2;
            const filledStarters = redCount + blueCount;
            const inRoom = isMemberInRoom(room, currentUser?.id);
            const isCreator = currentUser?.id === room.creatorId;
            const isBusy = busyRoomId === room.id;
            const displayState = getRoomDisplayState(room, now);
            const minsUntilExpiry = getRoomMinutesUntilExpiry(room, now);
            const isAutoStarted = now.getTime() >= getRoomStartTimestampMs(room);
            const isHighlighted = highlightedRoomId === room.id;

            const statusBadge =
              displayState === 'playing'
                ? {
                    label: '进行中',
                    className: 'bg-[#0F766E] text-white',
                  }
                : displayState === 'full'
                  ? {
                      label: '已满员',
                      className: 'bg-[#C60100] text-white',
                    }
                  : {
                      label: '等待中',
                      className: 'bg-[#FFF7ED] text-[#C2410C] border border-[#FDBA74]',
                    };

            return (
              <article
                key={room.id}
                id={`room-card-${room.id}`}
                className={`bg-white rounded-2xl border overflow-hidden transition-shadow ${
                  isHighlighted
                    ? 'border-[#C60100] ring-2 ring-[#C60100]/25'
                    : 'border-[#E6E8EC]'
                }`}
              >
                {/* Room Header */}
                <div className="px-3.5 py-3 border-b border-[#F0F2F5] flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[15px] font-bold text-[#141518] truncate">
                        {room.title}
                      </h2>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5 tabular-nums truncate">
                      {cfg.label}
                      {room.benchLimit > 0 ? ` · 替补${room.bench.length}/${room.benchLimit}` : ''} ·{' '}
                      {room.courtNote}
                    </p>
                    <p className="text-[11px] text-[#4B5563] mt-1 flex items-center flex-wrap gap-x-1.5 gap-y-0.5 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#C60100] shrink-0" aria-hidden="true" />
                        <span>{formatRoomSchedule(room.scheduledAt)} 开打</span>
                      </span>
                      {minsUntilExpiry !== null && (
                        <span className="text-[#B91C1C] font-semibold">
                          · 即将超期，约{minsUntilExpiry}分钟后自动删除
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold leading-4 whitespace-nowrap ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>
                    <p className="text-[11px] text-[#6B7280] mt-1 tabular-nums">
                      主力 {filledStarters}/{totalStarters}
                    </p>
                  </div>
                </div>

                {/* LoL-Style Red vs Blue Custom Lobby Grid */}
                <div className="p-3 bg-[#FAFBFD]">
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Red Team Column */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-[#B91C1C]">
                          红队 ({redCount}/{room.teamSize})
                        </span>
                        {redCount < room.teamSize && (
                          <button
                            type="button"
                            onClick={() => openInviteModal(room.id, 'red')}
                            aria-label={`邀请球手加入 ${room.title} 红队`}
                            className="text-[11px] font-semibold text-[#B91C1C] hover:underline px-1 py-0.5 flex items-center gap-0.5"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>邀人</span>
                          </button>
                        )}
                      </div>
                      {room.redTeam.map((member, slotIdx) => {
                        const isMe = member?.userId === currentUser?.id;
                        if (member) {
                          return (
                            <div
                              key={`red-${slotIdx}`}
                              className={`min-h-[46px] px-2.5 py-1.5 rounded-xl bg-white border flex items-center gap-2 ${
                                isMe ? 'border-[#C60100]' : 'border-[#E6E8EC]'
                              }`}
                            >
                              <PlayerAvatar
                                nickname={member.nickname}
                                jerseyNumber={member.jerseyNumber}
                                avatarBg={member.avatarBg}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-[#141518] truncate">
                                  {member.nickname}
                                </p>
                                <p className="text-[10px] text-[#9CA3AF]">
                                  {member.userId === room.creatorId
                                    ? '房主'
                                    : isMe
                                      ? '我'
                                      : `${slotIdx + 1}号位`}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={`red-empty-${slotIdx}`}
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleJoinSlot(room.id, 'red', slotIdx)}
                            aria-label={`加入 ${room.title} 红队 ${slotIdx + 1}号位`}
                            className="w-full min-h-[46px] px-2.5 rounded-xl border border-dashed border-[#FCA5A5] bg-[#FEF2F2]/40 hover:bg-[#FEF2F2] text-xs font-medium text-[#B91C1C] flex items-center justify-center gap-1 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>加入红队 {slotIdx + 1}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Blue Team Column */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-[#1D4ED8]">
                          蓝队 ({blueCount}/{room.teamSize})
                        </span>
                        {blueCount < room.teamSize && (
                          <button
                            type="button"
                            onClick={() => openInviteModal(room.id, 'blue')}
                            aria-label={`邀请球手加入 ${room.title} 蓝队`}
                            className="text-[11px] font-semibold text-[#1D4ED8] hover:underline px-1 py-0.5 flex items-center gap-0.5"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>邀人</span>
                          </button>
                        )}
                      </div>
                      {room.blueTeam.map((member, slotIdx) => {
                        const isMe = member?.userId === currentUser?.id;
                        if (member) {
                          return (
                            <div
                              key={`blue-${slotIdx}`}
                              className={`min-h-[46px] px-2.5 py-1.5 rounded-xl bg-white border flex items-center gap-2 ${
                                isMe ? 'border-[#1D4ED8]' : 'border-[#E6E8EC]'
                              }`}
                            >
                              <PlayerAvatar
                                nickname={member.nickname}
                                jerseyNumber={member.jerseyNumber}
                                avatarBg={member.avatarBg}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-[#141518] truncate">
                                  {member.nickname}
                                </p>
                                <p className="text-[10px] text-[#9CA3AF]">
                                  {member.userId === room.creatorId
                                    ? '房主'
                                    : isMe
                                      ? '我'
                                      : `${slotIdx + 1}号位`}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={`blue-empty-${slotIdx}`}
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleJoinSlot(room.id, 'blue', slotIdx)}
                            aria-label={`加入 ${room.title} 蓝队 ${slotIdx + 1}号位`}
                            className="w-full min-h-[46px] px-2.5 rounded-xl border border-dashed border-[#93C5FD] bg-[#EFF6FF]/45 hover:bg-[#EFF6FF] text-xs font-medium text-[#1D4ED8] flex items-center justify-center gap-1 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>加入蓝队 {slotIdx + 1}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Full-Court 5v5 Bench Section */}
                  {room.benchLimit > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#E6E8EC]">
                      <div className="flex items-center justify-between mb-2 px-0.5">
                        <span className="text-xs font-semibold text-[#4B5563]">
                          替补席 ({room.bench.length}/{room.benchLimit})
                        </span>
                        {room.bench.length < room.benchLimit && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => openInviteModal(room.id, 'bench')}
                              aria-label={`邀请球手加入 ${room.title} 替补席`}
                              className="min-h-[36px] px-2.5 rounded-lg bg-white border border-[#DCE0E6] text-xs font-medium text-[#374151] hover:border-[#141518]"
                            >
                              邀替补
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleJoinSlot(room.id, 'bench')}
                              aria-label={`报名 ${room.title} 替补席`}
                              className="min-h-[36px] px-2.5 rounded-lg bg-white border border-[#DCE0E6] text-xs font-medium text-[#374151] hover:border-[#141518]"
                            >
                              + 报名替补
                            </button>
                          </div>
                        )}
                      </div>

                      {room.bench.length === 0 ? (
                        <p className="text-xs text-[#9CA3AF] px-0.5">
                          暂无替补队员，可点击右侧报名替补席
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          {room.bench.map((sub) => (
                            <div
                              key={sub.userId}
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E6E8EC] flex items-center gap-2"
                            >
                              <PlayerAvatar
                                nickname={sub.nickname}
                                jerseyNumber={sub.jerseyNumber}
                                avatarBg={sub.avatarBg}
                                size="sm"
                              />
                              <span className="text-xs font-medium text-[#141518] truncate">
                                {sub.nickname}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Pending Invites Strip inside Room */}
                  {(room.invites?.length ?? 0) > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#E6E8EC] space-y-1.5">
                      <span className="block text-[11px] font-semibold text-[#6B7280] px-0.5">
                        待确认邀请（{room.invites?.length ?? 0}）
                      </span>
                      <div className="space-y-1.5">
                        {(room.invites ?? []).map((inv) => {
                          const isInvitee = currentUser?.id === inv.inviteeId;
                          const canCancel =
                            currentUser?.id === inv.inviterId || isCreator;
                          return (
                            <div
                              key={inv.id}
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E6E8EC] flex items-center justify-between gap-2 text-xs"
                            >
                              <p className="text-[#374151] truncate">
                                <span className="font-semibold text-[#141518]">
                                  {inv.inviteeNickname}
                                </span>
                                <span className="text-[#9CA3AF] mx-1">受邀加入</span>
                                <span
                                  className={
                                    inv.targetTeam === 'red'
                                      ? 'font-semibold text-[#B91C1C]'
                                      : inv.targetTeam === 'blue'
                                        ? 'font-semibold text-[#1D4ED8]'
                                        : 'font-semibold text-[#374151]'
                                  }
                                >
                                  {TEAM_LABEL_MAP[inv.targetTeam]}
                                </span>
                              </p>

                              {isInvitee ? (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleRespondInvite(room.id, inv, 'accept')}
                                    className="px-2 py-1 rounded-md bg-[#C60100] text-white text-[11px] font-semibold"
                                  >
                                    接受
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleRespondInvite(room.id, inv, 'decline')}
                                    className="px-2 py-1 rounded-md border border-[#E6E8EC] text-[#6B7280] text-[11px]"
                                  >
                                    婉拒
                                  </button>
                                </div>
                              ) : canCancel ? (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleCopyPendingInviteLink(room, inv)}
                                    aria-label={`复制给 ${inv.inviteeNickname} 的邀请链接`}
                                    className="px-2 py-1 rounded-md border border-[#C60100]/30 text-[#C60100] text-[11px] font-medium flex items-center gap-0.5"
                                  >
                                    <Link2 className="w-3 h-3" />
                                    <span>复制链接</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleCancelInvite(room.id, inv.id, inv.inviteeNickname)
                                    }
                                    aria-label={`撤回对 ${inv.inviteeNickname} 的邀请`}
                                    className="px-2 py-1 text-[11px] text-[#6B7280] hover:text-[#B91C1C] shrink-0"
                                  >
                                    撤回
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleCopyPendingInviteLink(room, inv)}
                                  aria-label={`复制给 ${inv.inviteeNickname} 的邀请链接`}
                                  className="px-2 py-1 rounded-md border border-[#E6E8EC] text-[#4B5563] text-[11px] flex items-center gap-0.5 shrink-0"
                                >
                                  <Link2 className="w-3 h-3" />
                                  <span>复制链接</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Room Footer Controls */}
                <div className="px-3.5 py-2.5 bg-white border-t border-[#F0F2F5] flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#6B7280] truncate">
                    房主：{room.creatorNickname}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        openInviteModal(
                          room.id,
                          redCount < room.teamSize
                            ? 'red'
                            : blueCount < room.teamSize
                              ? 'blue'
                              : 'bench',
                        )
                      }
                      aria-label={`邀请球手进入 ${room.title}`}
                      className="min-h-[36px] px-2.5 rounded-lg border border-[#C60100]/35 text-[#C60100] hover:bg-[#FEF2F2] font-medium flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>邀请</span>
                    </button>

                    {inRoom && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleLeaveRoom(room.id)}
                        className="min-h-[36px] px-2.5 rounded-lg border border-[#E6E8EC] text-[#4B5563] hover:text-[#141518] flex items-center gap-1"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>退出</span>
                      </button>
                    )}

                    {isCreator && (
                      <>
                        {!isAutoStarted && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleStatus(room)}
                            className="min-h-[36px] px-2.5 rounded-lg border border-[#E6E8EC] text-[#141518] font-medium flex items-center gap-1"
                          >
                            {room.status === 'recruiting' ? (
                              <>
                                <Play className="w-3.5 h-3.5" />
                                <span>开打</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5" />
                                <span>等待</span>
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteRoom(room.id)}
                          aria-label={`解散房间 ${room.title}`}
                          className="min-h-[36px] px-2 rounded-lg text-[#B91C1C] hover:bg-[#FEF2F2] flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>解散</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create Room Bottom Sheet */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="创建自定义比赛房间"
        >
          <div className="w-full max-w-[460px] bg-white rounded-t-3xl sm:rounded-2xl px-5 pt-3 pb-7 shadow-2xl">
            <div className="w-10 h-1 bg-[#D8DCE2] rounded-full mx-auto mb-3 sm:hidden" />

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#141518]">创建比赛房间</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="关闭创建房间弹窗"
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-[#6B7280]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              {/* Half vs Full Court Switch */}
              <div>
                <span className="block text-xs font-semibold text-[#4B5563] mb-1.5">
                  场地赛制
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCourtTypeSwitch('half')}
                    className={`min-h-[44px] rounded-xl border text-sm font-semibold transition-colors ${
                      courtType === 'half'
                        ? 'border-[#C60100] bg-[#FEF2F2] text-[#C60100]'
                        : 'border-[#DCE0E6] bg-white text-[#4B5563]'
                    }`}
                  >
                    半场（2v2 / 3v3 / 4v4）
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCourtTypeSwitch('full')}
                    className={`min-h-[44px] rounded-xl border text-sm font-semibold transition-colors ${
                      courtType === 'full'
                        ? 'border-[#C60100] bg-[#FEF2F2] text-[#C60100]'
                        : 'border-[#DCE0E6] bg-white text-[#4B5563]'
                    }`}
                  >
                    全场（5v5 可设替补）
                  </button>
                </div>
              </div>

              {/* Sub-mode Selection */}
              {courtType === 'half' ? (
                <div>
                  <span className="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    半场人数
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {HALF_MODES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`min-h-[44px] rounded-xl border text-sm font-semibold transition-colors ${
                          mode === m
                            ? 'border-[#141518] bg-[#141518] text-white'
                            : 'border-[#DCE0E6] bg-white text-[#374151]'
                        }`}
                      >
                        {ROOM_MODE_CONFIGS[m].shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <span className="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    全场 5v5 替补席人数
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {BENCH_OPTIONS.map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setBenchLimit(num)}
                        className={`min-h-[44px] rounded-xl border text-xs font-semibold transition-colors ${
                          benchLimit === num
                            ? 'border-[#141518] bg-[#141518] text-white'
                            : 'border-[#DCE0E6] bg-white text-[#374151]'
                        }`}
                      >
                        {num === 0 ? '无替补' : `${num}替补`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="room-title-input"
                  className="block text-xs font-semibold text-[#4B5563] mb-1.5"
                >
                  房间标题
                </label>
                <input
                  id="room-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`如：今晚园区${ROOM_MODE_CONFIGS[mode].label}养生局`}
                  maxLength={28}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="room-schedule-input"
                  className="block text-xs font-semibold text-[#4B5563] mb-1.5"
                >
                  预计开打时间
                </label>
                <input
                  id="room-schedule-input"
                  type="datetime-local"
                  value={scheduledAtInput}
                  onChange={(e) => setScheduledAtInput(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
                />
                <p className="text-[11px] text-[#6B7280] mt-1">
                  到达预计开打时间后，房间将自动切换为「进行中」
                </p>
              </div>

              <div>
                <label
                  htmlFor="room-court-input"
                  className="block text-xs font-semibold text-[#4B5563] mb-1.5"
                >
                  场地备注
                </label>
                <input
                  id="room-court-input"
                  type="text"
                  value={courtNote}
                  onChange={(e) => setCourtNote(e.target.value)}
                  placeholder="如：东区1号场 / 灯光全开"
                  maxLength={32}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full h-12 rounded-xl bg-[#C60100] hover:bg-[#A00100] text-white text-sm font-semibold disabled:opacity-60"
              >
                {creating ? '创建中...' : '确认创建并占座红队1号位'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Room Invite Bottom Sheet */}
      <RoomInviteModal
        room={inviteTargetRoom}
        initialTeam={inviteModalState?.team ?? 'red'}
        players={players}
        currentUser={currentUser}
        onClose={() => setInviteModalState(null)}
        onDataUpdate={onDataUpdate}
        onToast={onToast}
      />
    </div>
  );
};
