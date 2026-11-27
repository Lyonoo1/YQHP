import type {
  CommentRecord,
  LeaderboardSort,
  MatchRoom,
  PlayerRatingRecord,
  PlayerSummary,
  PublicPlayer,
  RoomCourtType,
  RoomMode,
  RoomSlotMember,
  RoomTeamSlot,
  StarBreakdown,
} from './types';

export interface DefaultPlayerSeed {
  nickname: string;
  account: string;
  jerseyNumber: string;
}

export const DEFAULT_PLAYER_SEEDS: DefaultPlayerSeed[] = [
  { nickname: '假多夫', account: 'YY01', jerseyNumber: '01' },
  { nickname: '强哥', account: 'YY02', jerseyNumber: '02' },
  { nickname: 'pg one', account: 'YY03', jerseyNumber: '03' },
  { nickname: '刀郎', account: 'YY04', jerseyNumber: '04' },
  { nickname: '王总', account: 'YY05', jerseyNumber: '05' },
  { nickname: '秋天', account: 'YY06', jerseyNumber: '06' },
  { nickname: '篮球之神', account: 'YY07', jerseyNumber: '07' },
  { nickname: '科比', account: 'YY08', jerseyNumber: '08' },
  { nickname: 'YDB', account: 'YY09', jerseyNumber: '09' },
  { nickname: '科冉', account: 'YY10', jerseyNumber: '10' },
  { nickname: '小杰喵', account: 'YY11', jerseyNumber: '11' },
  { nickname: '启龙', account: 'YY12', jerseyNumber: '12' },
  { nickname: '小规不叫', account: 'YY13', jerseyNumber: '13' },
  { nickname: '蜘蛛侠', account: 'YY14', jerseyNumber: '14' },
  { nickname: '老詹', account: 'YY15', jerseyNumber: '15' },
  { nickname: '樊振东', account: 'YY16', jerseyNumber: '16' },
  { nickname: '篮板王', account: 'YY17', jerseyNumber: '17' },
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
          authorNickname: bestComment.authorNickname,
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

export function joinRoomSlot(
  room: MatchRoom,
  member: RoomSlotMember,
  targetTeam: RoomTeamSlot,
  slotIndex?: number,
): { ok: true; room: MatchRoom } | { ok: false; error: string } {
  const cleaned = removeMemberFromRoom(room, member.userId);

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
        ? { ...cleaned, redTeam: teamSlots }
        : { ...cleaned, blueTeam: teamSlots },
  };
}
