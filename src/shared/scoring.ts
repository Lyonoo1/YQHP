import type {
  CommentRecord,
  LeaderboardSort,
  MatchRoom,
  PlayerRatingRecord,
  PlayerSummary,
  PublicPlayer,
  RoomCourtType,
  RoomDisplayState,
  RoomInviteRecord,
  RoomMode,
  RoomSlotMember,
  RoomTeamSlot,
  StarBreakdown,
} from './types';

export const ANONYMOUS_DISPLAY_NAME = '匿名球友';

export interface AvatarBgOption {
  hex: string;
  label: string;
}

export const AVATAR_BG_PALETTE: AvatarBgOption[] = [
  { hex: '#1D2432', label: '深夜藏青' },
  { hex: '#C60100', label: '虎扑红' },
  { hex: '#8B1A1A', label: '公牛暗红' },
  { hex: '#1E3A5F', label: '快船深蓝' },
  { hex: '#2C3E2D', label: '凯尔特绿' },
  { hex: '#4A2545', label: '湖人暗紫' },
  { hex: '#7C3A14', label: '尼克斯橙' },
  { hex: '#1F4E5F', label: '雷霆海青' },
  { hex: '#332E2B', label: '黑曼巴炭' },
  { hex: '#0F766E', label: '翡翠青' },
  { hex: '#B45309', label: '总决赛金' },
  { hex: '#312E81', label: '皇家靛蓝' },
];

export function isValidAvatarBg(color: string): boolean {
  return AVATAR_BG_PALETTE.some((c) => c.hex.toUpperCase() === color.trim().toUpperCase());
}

export function normalizeAvatarBg(color?: string): string | undefined {
  if (!color) return undefined;
  const upper = color.trim().toUpperCase();
  const match = AVATAR_BG_PALETTE.find((c) => c.hex.toUpperCase() === upper);
  return match?.hex;
}

export function validateProfileUpdateInput(
  input: {
    account?: string;
    password?: string;
    jerseyNumber?: string;
    avatarBg?: string;
  },
  existingUsers: Pick<PublicPlayer, 'id' | 'account'>[],
  currentUserId: string,
): { valid: boolean; error?: string } {
  if (input.account !== undefined) {
    const cleanAccount = input.account.trim();
    if (!/^[A-Za-z0-9_]{2,20}$/.test(cleanAccount)) {
      return { valid: false, error: '账号需为 2-20 位字母、数字或下划线（如 YY18）' };
    }
    const normalizedAcc = normalizeAccount(cleanAccount);
    if (
      existingUsers.some(
        (u) => u.id !== currentUserId && normalizeAccount(u.account) === normalizedAcc,
      )
    ) {
      return { valid: false, error: '该账号已被其他球手占用，请更换账号' };
    }
  }

  if (input.password !== undefined && input.password.length > 0) {
    if (input.password.length < 4 || input.password.length > 32) {
      return { valid: false, error: '新密码长度需为 4-32 位' };
    }
  }

  if (input.jerseyNumber !== undefined) {
    const cleanNum = input.jerseyNumber.trim();
    if (!/^\d{1,2}$/.test(cleanNum)) {
      return { valid: false, error: '球衣号码需为 0-99 的 1-2 位数字' };
    }
  }

  if (input.avatarBg !== undefined && input.avatarBg.trim() !== '') {
    if (!isValidAvatarBg(input.avatarBg)) {
      return { valid: false, error: '请选择有效的头像背景色' };
    }
  }

  return { valid: true };
}

export function formatJerseyNumber(raw: string | number): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '00';
  const two = digits.slice(0, 2);
  return two.length === 1 ? `0${two}` : two;
}

export interface DefaultPlayerSeed {
  nickname: string;
  account: string;
  jerseyNumber: string;
}

export const DEFAULT_PLAYER_SEEDS: DefaultPlayerSeed[] = [
  { nickname: '假多夫', account: 'YY01', jerseyNumber: '07' },
  { nickname: '强哥', account: 'YY02', jerseyNumber: '91' },
  { nickname: 'pg one', account: 'YY03', jerseyNumber: '06' },
  { nickname: '刀郎', account: 'YY04', jerseyNumber: '30' },
  { nickname: '王总', account: 'YY05', jerseyNumber: '01' },
  { nickname: '秋天', account: 'YY06', jerseyNumber: '35' },
  { nickname: '篮球之神', account: 'YY07', jerseyNumber: '08' },
  { nickname: '科比', account: 'YY08', jerseyNumber: '09' },
  { nickname: 'YDB', account: 'YY09', jerseyNumber: '00' },
  { nickname: '科冉', account: 'YY10', jerseyNumber: '02' },
  { nickname: '小杰喵', account: 'YY11', jerseyNumber: '15' },
  { nickname: '启龙', account: 'YY12', jerseyNumber: '77' },
  { nickname: '小规不叫', account: 'YY13', jerseyNumber: '23' },
  { nickname: '蜘蛛侠', account: 'YY14', jerseyNumber: '45' },
  { nickname: '老詹', account: 'YY15', jerseyNumber: '11' },
  { nickname: '樊振东', account: 'YY16', jerseyNumber: '10' },
  { nickname: '篮板王', account: 'YY17', jerseyNumber: '13' },
  { nickname: '法拉利', account: 'YY18', jerseyNumber: '24' },
];

export interface RoomModeConfig {
  mode: RoomMode;
  courtType: RoomCourtType;
  label: string;
  shortLabel: string;
  teamSize: number;
  allowBench: boolean;
}

export const ROOM_MODE_CONFIGS: Record<RoomMode, RoomModeConfig> = {
  half_2v2: {
    mode: 'half_2v2',
    courtType: 'half',
    label: '半场 2v2',
    shortLabel: '2v2',
    teamSize: 2,
    allowBench: false,
  },
  half_3v3: {
    mode: 'half_3v3',
    courtType: 'half',
    label: '半场 3v3',
    shortLabel: '3v3',
    teamSize: 3,
    allowBench: false,
  },
  half_4v4: {
    mode: 'half_4v4',
    courtType: 'half',
    label: '半场 4v4',
    shortLabel: '4v4',
    teamSize: 4,
    allowBench: false,
  },
  full_5v5: {
    mode: 'full_5v5',
    courtType: 'full',
    label: '全场 5v5',
    shortLabel: '5v5',
    teamSize: 5,
    allowBench: true,
  },
};

export function normalizeAccount(account: string): string {
  return account.trim().toUpperCase();
}

export function normalizeNickname(nickname: string): string {
  return nickname.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface RegistrationValidationResult {
  valid: boolean;
  error?: string;
}

export function validateRegistrationInput(
  input: { nickname: string; account: string; password: string },
  existingUsers: Pick<PublicPlayer, 'account' | 'nickname'>[],
): RegistrationValidationResult {
  const cleanNickname = input.nickname.trim();
  const cleanAccount = input.account.trim();
  const cleanPassword = input.password;

  if (cleanNickname.length < 1 || cleanNickname.length > 16) {
    return { valid: false, error: '昵称需为 1-16 个字符' };
  }
  if (!/^[A-Za-z0-9_]{2,20}$/.test(cleanAccount)) {
    return { valid: false, error: '账号需为 2-20 位字母、数字或下划线（如 YY18）' };
  }
  if (cleanPassword.length < 4 || cleanPassword.length > 32) {
    return { valid: false, error: '密码长度需为 4-32 位' };
  }

  const normalizedNick = normalizeNickname(cleanNickname);
  const normalizedAcc = normalizeAccount(cleanAccount);

  if (existingUsers.some((u) => normalizeNickname(u.nickname) === normalizedNick)) {
    return { valid: false, error: '该昵称已被占用，请换一个球场外号' };
  }
  if (existingUsers.some((u) => normalizeAccount(u.account) === normalizedAcc)) {
    return { valid: false, error: '该账号已被注册，请更换账号' };
  }

  return { valid: true };
}

export function getShanghaiDateKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function getMsUntilShanghaiMidnight(date: Date = new Date()): number {
  const shanghaiOffsetMs = 8 * 60 * 60 * 1000;
  const shiftedMs = date.getTime() + shanghaiOffsetMs;
  const msInDay = 24 * 60 * 60 * 1000;
  const elapsedToday = ((shiftedMs % msInDay) + msInDay) % msInDay;
  return msInDay - elapsedToday;
}

export function shouldResetDailyData(storedDateKey: string, now: Date = new Date()): boolean {
  return storedDateKey !== getShanghaiDateKey(now);
}

export function normalizeStars(stars: number): number {
  if (!Number.isFinite(stars)) return 0;
  return Math.max(0, Math.min(5, Math.round(stars * 2) / 2));
}

export function starsToHupuScore(stars: number): number {
  return Math.round(normalizeStars(stars) * 2);
}

function getStarDistributionBucket(stars: number): number {
  if (stars >= 4.5) return 5; // 9-10 分
  if (stars >= 3.5) return 4; // 7-8 分
  if (stars >= 2.5) return 3; // 5-6 分
  if (stars >= 1.5) return 2; // 3-4 分
  return 1; // 0-2 分
}

export function computePlayerSummary(
  player: PublicPlayer,
  ratings: PlayerRatingRecord[],
  comments: CommentRecord[],
  currentUserId: string | null,
): PlayerSummary {
  const ratingCount = ratings.length;
  let averageScore: number | null = null;

  const countsByStar: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalScoreSum = 0;
  let myStars: number | null = null;

  for (const r of ratings) {
    const s = normalizeStars(r.stars);
    countsByStar[getStarDistributionBucket(s)] += 1;
    totalScoreSum += starsToHupuScore(s);
    if (currentUserId && r.authorId === currentUserId) {
      myStars = s;
    }
  }

  if (ratingCount > 0) {
    averageScore = Math.round((totalScoreSum / ratingCount) * 10) / 10;
  }

  const starDistribution: StarBreakdown[] = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: countsByStar[stars],
    percent: ratingCount > 0 ? Math.round((countsByStar[stars] / ratingCount) * 100) : 0,
  }));

  let totalLikes = 0;
  let replyCount = 0;
  let bestComment: CommentRecord | null = null;

  for (const c of comments) {
    totalLikes += c.likedBy.length;
    replyCount += c.replies.length;
    for (const rep of c.replies) {
      totalLikes += rep.likedBy.length;
    }
    if (
      !bestComment ||
      c.likedBy.length > bestComment.likedBy.length ||
      (c.likedBy.length === bestComment.likedBy.length && c.createdAt > bestComment.createdAt)
    ) {
      bestComment = c;
    }
  }

  const commentCount = comments.length + replyCount;
  const baseScoreHeat = averageScore !== null ? averageScore * 12 : 0;
  const engagementHeat = ratingCount * 15 + commentCount * 8 + totalLikes * 4;
  const heatScore = Math.round(baseScoreHeat + engagementHeat);

  return {
    ...player,
    averageScore,
    ratingCount,
    commentCount,
    totalLikes,
    heatScore,
    myStars,
    starDistribution,
    topComment: bestComment
      ? {
          id: bestComment.id,
          authorNickname: bestComment.anonymous
            ? ANONYMOUS_DISPLAY_NAME
            : bestComment.authorNickname,
          anonymous: Boolean(bestComment.anonymous),
          content: bestComment.content,
          likeCount: bestComment.likedBy.length,
        }
      : null,
  };
}

export function sortLeaderboard(
  players: PlayerSummary[],
  sortMode: LeaderboardSort,
): PlayerSummary[] {
  const list = [...players];
  if (sortMode === 'heat') {
    return list.sort((a, b) => {
      if (b.heatScore !== a.heatScore) return b.heatScore - a.heatScore;
      const scoreA = a.averageScore ?? -1;
      const scoreB = b.averageScore ?? -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.account.localeCompare(b.account);
    });
  }

  if (sortMode === 'highest') {
    return list.sort((a, b) => {
      const scoreA = a.averageScore ?? -1;
      const scoreB = b.averageScore ?? -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
      return b.heatScore - a.heatScore;
    });
  }

  // 'lowest': Rated players from lowest average score upwards, unrated players last
  return list.sort((a, b) => {
    if (a.averageScore === null && b.averageScore === null) {
      return a.account.localeCompare(b.account);
    }
    if (a.averageScore === null) return 1;
    if (b.averageScore === null) return -1;
    if (a.averageScore !== b.averageScore) return a.averageScore - b.averageScore;
    return b.ratingCount - a.ratingCount;
  });
}

export function createEmptyRoomSlots(mode: RoomMode): {
  teamSize: number;
  courtType: RoomCourtType;
  redTeam: (RoomSlotMember | null)[];
  blueTeam: (RoomSlotMember | null)[];
} {
  const cfg = ROOM_MODE_CONFIGS[mode];
  return {
    teamSize: cfg.teamSize,
    courtType: cfg.courtType,
    redTeam: Array.from({ length: cfg.teamSize }, () => null),
    blueTeam: Array.from({ length: cfg.teamSize }, () => null),
  };
}

export function removeMemberFromRoom(room: MatchRoom, userId: string): MatchRoom {
  return {
    ...room,
    redTeam: room.redTeam.map((slot) => (slot?.userId === userId ? null : slot)),
    blueTeam: room.blueTeam.map((slot) => (slot?.userId === userId ? null : slot)),
    bench: room.bench.filter((m) => m.userId !== userId),
  };
}

export function getMemberRoomTeam(room: MatchRoom, userId: string): RoomTeamSlot | null {
  if (room.redTeam.some((s) => s?.userId === userId)) return 'red';
  if (room.blueTeam.some((s) => s?.userId === userId)) return 'blue';
  if (room.bench.some((b) => b.userId === userId)) return 'bench';
  return null;
}

export function getAvailableSlotsForTeam(room: MatchRoom, targetTeam: RoomTeamSlot): number {
  if (targetTeam === 'red') return room.redTeam.filter((s) => s === null).length;
  if (targetTeam === 'blue') return room.blueTeam.filter((s) => s === null).length;
  return Math.max(0, room.benchLimit - room.bench.length);
}

export function joinRoomSlot(
  room: MatchRoom,
  member: RoomSlotMember,
  targetTeam: RoomTeamSlot,
  slotIndex?: number,
): { ok: true; room: MatchRoom } | { ok: false; error: string } {
  const cleaned = removeMemberFromRoom(room, member.userId);
  const nextInvites = (cleaned.invites ?? []).filter((inv) => inv.inviteeId !== member.userId);

  if (targetTeam === 'bench') {
    if (cleaned.benchLimit <= 0) {
      return { ok: false, error: '当前房间未开启替补席' };
    }
    if (cleaned.bench.length >= cleaned.benchLimit) {
      return { ok: false, error: '替补席已满' };
    }
    return {
      ok: true,
      room: {
        ...cleaned,
        bench: [...cleaned.bench, member],
        invites: nextInvites,
      },
    };
  }

  const teamSlots = targetTeam === 'red' ? [...cleaned.redTeam] : [...cleaned.blueTeam];
  let chosenIndex = -1;

  if (typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex < teamSlots.length) {
    if (teamSlots[slotIndex] !== null) {
      return { ok: false, error: '该位置已被其他球手占座' };
    }
    chosenIndex = slotIndex;
  } else {
    chosenIndex = teamSlots.findIndex((s) => s === null);
    if (chosenIndex === -1) {
      return { ok: false, error: targetTeam === 'red' ? '红队已满员' : '蓝队已满员' };
    }
  }

  teamSlots[chosenIndex] = member;
  return {
    ok: true,
    room:
      targetTeam === 'red'
        ? { ...cleaned, redTeam: teamSlots, invites: nextInvites }
        : { ...cleaned, blueTeam: teamSlots, invites: nextInvites },
  };
}

export function addRoomInvite(
  room: MatchRoom,
  invite: RoomInviteRecord,
): { ok: true; room: MatchRoom } | { ok: false; error: string } {
  if (invite.inviterId === invite.inviteeId) {
    return { ok: false, error: '不能邀请自己，直接点击空位即可入座' };
  }
  const currentTeam = getMemberRoomTeam(room, invite.inviteeId);
  if (currentTeam === invite.targetTeam) {
    const label =
      invite.targetTeam === 'red' ? '红队' : invite.targetTeam === 'blue' ? '蓝队' : '替补席';
    return { ok: false, error: `${invite.inviteeNickname} 已经在${label}中` };
  }
  if (invite.targetTeam === 'bench' && room.benchLimit <= 0) {
    return { ok: false, error: '当前房间未开启替补席' };
  }
  if (getAvailableSlotsForTeam(room, invite.targetTeam) <= 0) {
    const label =
      invite.targetTeam === 'red' ? '红队' : invite.targetTeam === 'blue' ? '蓝队' : '替补席';
    return { ok: false, error: `${label}已满员，无法发送邀请` };
  }

  const remaining = (room.invites ?? []).filter((inv) => inv.inviteeId !== invite.inviteeId);
  return {
    ok: true,
    room: {
      ...room,
      invites: [invite, ...remaining],
    },
  };
}

export function removeRoomInvite(room: MatchRoom, inviteId: string): MatchRoom {
  return {
    ...room,
    invites: (room.invites ?? []).filter((inv) => inv.id !== inviteId),
  };
}

export function acceptRoomInvite(
  room: MatchRoom,
  inviteId: string,
  member: RoomSlotMember,
): { ok: true; room: MatchRoom; targetTeam: RoomTeamSlot } | { ok: false; error: string } {
  const invite = (room.invites ?? []).find((inv) => inv.id === inviteId);
  if (!invite) {
    return { ok: false, error: '邀请已失效或被撤回' };
  }
  if (invite.inviteeId !== member.userId) {
    return { ok: false, error: '只能回应发给自己的邀请' };
  }

  const joined = joinRoomSlot(room, member, invite.targetTeam);
  if (!joined.ok) {
    return joined;
  }

  return {
    ok: true,
    room: removeRoomInvite(joined.room, inviteId),
    targetTeam: invite.targetTeam,
  };
}

export const ROOM_EXPIRE_AFTER_MS = 2 * 60 * 60 * 1000;
export const ROOM_EXPIRY_WARNING_WINDOW_MS = 30 * 60 * 1000;
export const UPCOMING_MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;
export const UPCOMING_IMMINENT_WINDOW_MS = 60 * 60 * 1000;

export type UpcomingUrgencyLevel = 'imminent' | 'soon';

export function getUpcomingMatchUrgency(msUntilStart: number): UpcomingUrgencyLevel {
  return msUntilStart <= UPCOMING_IMMINENT_WINDOW_MS ? 'imminent' : 'soon';
}

export function getRoomStartTimestampMs(room: Pick<MatchRoom, 'scheduledAt' | 'createdAt'>): number {
  const scheduled = room.scheduledAt ? Date.parse(room.scheduledAt) : Number.NaN;
  if (Number.isFinite(scheduled)) {
    return scheduled;
  }
  const created = Date.parse(room.createdAt);
  return Number.isFinite(created) ? created : Date.now();
}

export function shouldAutoStartRoom(
  room: Pick<MatchRoom, 'status' | 'scheduledAt' | 'createdAt'>,
  now: Date = new Date(),
): boolean {
  if (room.status === 'playing') return false;
  return now.getTime() >= getRoomStartTimestampMs(room);
}

export function getRoomDisplayState(
  room: Pick<MatchRoom, 'status' | 'scheduledAt' | 'createdAt' | 'redTeam' | 'blueTeam' | 'teamSize'>,
  now: Date = new Date(),
): RoomDisplayState {
  if (room.status === 'playing' || now.getTime() >= getRoomStartTimestampMs(room)) {
    return 'playing';
  }
  const redCount = room.redTeam.filter(Boolean).length;
  const blueCount = room.blueTeam.filter(Boolean).length;
  if (redCount >= room.teamSize && blueCount >= room.teamSize) {
    return 'full';
  }
  return 'waiting';
}

export interface UpcomingRoomItem {
  room: MatchRoom;
  msUntilStart: number;
  startTimestampMs: number;
  displayState: RoomDisplayState;
  urgency: UpcomingUrgencyLevel;
}

export function getUpcomingSoonRooms(
  rooms: MatchRoom[],
  now: Date = new Date(),
  windowMs: number = UPCOMING_MATCH_WINDOW_MS,
): UpcomingRoomItem[] {
  const nowMs = now.getTime();
  const list: UpcomingRoomItem[] = [];

  for (const room of rooms) {
    if (room.status === 'playing') continue;
    const startTimestampMs = getRoomStartTimestampMs(room);
    const msUntilStart = startTimestampMs - nowMs;
    if (msUntilStart > 0 && msUntilStart <= windowMs) {
      list.push({
        room,
        msUntilStart,
        startTimestampMs,
        displayState: getRoomDisplayState(room, now),
        urgency: getUpcomingMatchUrgency(msUntilStart),
      });
    }
  }

  return list.sort((a, b) => a.startTimestampMs - b.startTimestampMs);
}

export function formatUpcomingCountdown(msUntilStart: number): string {
  if (!Number.isFinite(msUntilStart) || msUntilStart <= 0) {
    return '即将开打';
  }
  const totalMins = Math.ceil(msUntilStart / 60_000);
  if (totalMins <= 1) {
    return '1分钟内开打';
  }
  if (totalMins < 60) {
    return `${totalMins}分钟后开打`;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) {
    return `${hours}小时后开打`;
  }
  return `${hours}小时${mins}分后开打`;
}

export function getRoomMinutesUntilExpiry(
  room: Pick<MatchRoom, 'scheduledAt' | 'createdAt'>,
  now: Date = new Date(),
): number | null {
  const startMs = getRoomStartTimestampMs(room);
  const expireAtMs = startMs + ROOM_EXPIRE_AFTER_MS;
  const remainingMs = expireAtMs - now.getTime();
  if (remainingMs <= 0 || remainingMs > ROOM_EXPIRY_WARNING_WINDOW_MS) {
    return null;
  }
  return Math.max(1, Math.ceil(remainingMs / 60_000));
}

export function isRoomExpired(
  room: Pick<MatchRoom, 'scheduledAt' | 'createdAt'>,
  now: Date = new Date(),
): boolean {
  const startMs = getRoomStartTimestampMs(room);
  return now.getTime() >= startMs + ROOM_EXPIRE_AFTER_MS;
}

export function pruneExpiredRooms(
  rooms: MatchRoom[],
  now: Date = new Date(),
): { activeRooms: MatchRoom[]; removedCount: number } {
  const activeRooms = rooms.filter((room) => !isRoomExpired(room, now));
  return {
    activeRooms,
    removedCount: rooms.length - activeRooms.length,
  };
}

export interface ParsedRoomInviteLink {
  roomId: string;
  team: RoomTeamSlot;
  inviteId?: string;
  inviteeAccount?: string;
}

export function buildRoomInviteLink(
  baseUrl: string,
  params: {
    roomId: string;
    team: RoomTeamSlot;
    inviteId?: string;
    inviteeAccount?: string;
  },
): string {
  const cleanBase = baseUrl.split('?')[0].split('#')[0];
  const search = new URLSearchParams();
  search.set('inviteRoom', params.roomId);
  search.set('team', params.team);
  if (params.inviteId) {
    search.set('inviteId', params.inviteId);
  }
  if (params.inviteeAccount) {
    search.set('invitee', params.inviteeAccount);
  }
  return `${cleanBase}?${search.toString()}`;
}

export function parseRoomInviteSearch(search: string): ParsedRoomInviteLink | null {
  const query = new URLSearchParams(search);
  const roomId = (query.get('inviteRoom') ?? '').trim();
  const teamRaw = (query.get('team') ?? '').trim();
  if (!roomId || (teamRaw !== 'red' && teamRaw !== 'blue' && teamRaw !== 'bench')) {
    return null;
  }
  const inviteId = (query.get('inviteId') ?? '').trim() || undefined;
  const inviteeAccount = (query.get('invitee') ?? '').trim() || undefined;
  return {
    roomId,
    team: teamRaw,
    inviteId,
    inviteeAccount,
  };
}

export const ONLINE_PRESENCE_TTL_MS = 25_000;

export function pruneAndCountOnlinePresence(
  activeEntries: Map<string, number>,
  nowMs: number = Date.now(),
  ttlMs: number = ONLINE_PRESENCE_TTL_MS,
): number {
  for (const [key, lastSeenMs] of activeEntries.entries()) {
    if (nowMs - lastSeenMs > ttlMs) {
      activeEntries.delete(key);
    }
  }
  return activeEntries.size;
}
