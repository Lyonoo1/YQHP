import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from './session';
import {
  ANONYMOUS_DISPLAY_NAME,
  DEFAULT_PLAYER_SEEDS,
  ROOM_MODE_CONFIGS,
  acceptRoomInvite,
  addRoomInvite,
  computePlayerSummary,
  createEmptyRoomSlots,
  formatJerseyNumber,
  getDefaultRoomScheduledAt,
  getMsUntilShanghaiMondayMidnight,
  getShanghaiDateKey,
  joinRoomSlot,
  leaveRoomWithHostTransfer,
  normalizeAccount,
  normalizeAvatarBg,
  pruneAndCountOnlinePresence,
  pruneExpiredRooms,
  removeRoomInvite,
  shouldAutoStartRoom,
  shouldResetWeeklyData,
  validateProfileUpdateInput,
  validateRegistrationInput,
} from '../src/shared/scoring';
import type {
  BootstrapResponse,
  CommentRecord,
  MatchRoom,
  PlayerRatingRecord,
  PublicPlayer,
  ReplyRecord,
  RoomInviteRecord,
  RoomMode,
  RoomStatus,
  RoomTeamSlot,
} from '../src/shared/types';

interface StoredUser extends PublicPlayer {
  passwordSalt: string;
  passwordHash: string;
}

interface DatabaseSchema {
  currentDate: string;
  jerseySeedVersion?: number;
  users: StoredUser[];
  ratings: PlayerRatingRecord[];
  comments: CommentRecord[];
  rooms: MatchRoom[];
}

const CURRENT_JERSEY_SEED_VERSION = 3;

const DATA_DIR = process.env.DATA_DIR?.trim()
  ? path.resolve(process.env.DATA_DIR.trim())
  : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'park-hupu-db.json');

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function toPublicPlayer(user: StoredUser): PublicPlayer {
  return {
    id: user.id,
    account: user.account,
    nickname: user.nickname,
    jerseyNumber: formatJerseyNumber(user.jerseyNumber),
    avatarBg: user.avatarBg,
    createdAt: user.createdAt,
  };
}

function createInitialDatabase(): DatabaseSchema {
  const today = getShanghaiDateKey();
  const nowIso = new Date().toISOString();

  const users: StoredUser[] = DEFAULT_PLAYER_SEEDS.map((seed, index) => {
    const { salt, hash } = hashPassword('123456');
    return {
      id: `player_${seed.account.toLowerCase()}`,
      account: seed.account,
      nickname: seed.nickname,
      jerseyNumber: seed.jerseyNumber,
      createdAt: new Date(Date.now() - (20 - index) * 60_000).toISOString(),
      passwordSalt: salt,
      passwordHash: hash,
    };
  });

  const byAcc = new Map(users.map((u) => [u.account, u]));
  const uid = (acc: string) => byAcc.get(acc)!.id;
  const nick = (acc: string) => byAcc.get(acc)!.nickname;
  const jersey = (acc: string) => byAcc.get(acc)!.jerseyNumber;

  const ratings: PlayerRatingRecord[] = [
    // 科比 YY08
    { id: 'seed_r1', playerId: uid('YY08'), authorId: uid('YY01'), stars: 5, updatedAt: nowIso },
    { id: 'seed_r2', playerId: uid('YY08'), authorId: uid('YY02'), stars: 5, updatedAt: nowIso },
    { id: 'seed_r3', playerId: uid('YY08'), authorId: uid('YY15'), stars: 4, updatedAt: nowIso },
    { id: 'seed_r4', playerId: uid('YY08'), authorId: uid('YY07'), stars: 5, updatedAt: nowIso },
    // 篮球之神 YY07
    { id: 'seed_r5', playerId: uid('YY07'), authorId: uid('YY08'), stars: 5, updatedAt: nowIso },
    { id: 'seed_r6', playerId: uid('YY07'), authorId: uid('YY05'), stars: 5, updatedAt: nowIso },
    { id: 'seed_r7', playerId: uid('YY07'), authorId: uid('YY09'), stars: 4, updatedAt: nowIso },
    // 老詹 YY15
    { id: 'seed_r8', playerId: uid('YY15'), authorId: uid('YY08'), stars: 5, updatedAt: nowIso },
    { id: 'seed_r9', playerId: uid('YY15'), authorId: uid('YY17'), stars: 4, updatedAt: nowIso },
    { id: 'seed_r10', playerId: uid('YY15'), authorId: uid('YY10'), stars: 5, updatedAt: nowIso },
    // 强哥 YY02
    { id: 'seed_r11', playerId: uid('YY02'), authorId: uid('YY01'), stars: 4, updatedAt: nowIso },
    { id: 'seed_r12', playerId: uid('YY02'), authorId: uid('YY04'), stars: 5, updatedAt: nowIso },
    // 篮板王 YY17
    { id: 'seed_r13', playerId: uid('YY17'), authorId: uid('YY02'), stars: 5, updatedAt: nowIso },
    { id: 'seed_r14', playerId: uid('YY17'), authorId: uid('YY15'), stars: 4, updatedAt: nowIso },
    // 假多夫 YY01
    { id: 'seed_r15', playerId: uid('YY01'), authorId: uid('YY02'), stars: 4, updatedAt: nowIso },
    { id: 'seed_r16', playerId: uid('YY01'), authorId: uid('YY06'), stars: 3, updatedAt: nowIso },
    // pg one YY03
    { id: 'seed_r17', playerId: uid('YY03'), authorId: uid('YY01'), stars: 3, updatedAt: nowIso },
    { id: 'seed_r18', playerId: uid('YY03'), authorId: uid('YY09'), stars: 2, updatedAt: nowIso },
    // 王总 YY05
    { id: 'seed_r19', playerId: uid('YY05'), authorId: uid('YY02'), stars: 5, updatedAt: nowIso },
    // 樊振东 YY16
    { id: 'seed_r20', playerId: uid('YY16'), authorId: uid('YY11'), stars: 4, updatedAt: nowIso },
  ];

  const comments: CommentRecord[] = [
    {
      id: 'seed_c1',
      playerId: uid('YY08'),
      authorId: uid('YY01'),
      authorNickname: nick('YY01'),
      authorStars: 5,
      content: '底角翻身跳投今天真没法防，园区曼巴名不虚传，关键球连进三个直接打卡。',
      likedBy: [uid('YY02'), uid('YY07'), uid('YY15'), uid('YY17')],
      replies: [
        {
          id: 'seed_rep1',
          commentId: 'seed_c1',
          playerId: uid('YY08'),
          authorId: uid('YY15'),
          authorNickname: nick('YY15'),
          replyToUserId: uid('YY01'),
          replyToNickname: nick('YY01'),
          content: '确实，我手都封到脸上了还能打板进，服了。',
          likedBy: [uid('YY01'), uid('YY08')],
          createdAt: new Date(Date.now() - 25 * 60_000).toISOString(),
        },
        {
          id: 'seed_rep2',
          commentId: 'seed_c1',
          playerId: uid('YY08'),
          authorId: uid('YY08'),
          authorNickname: nick('YY08'),
          replyToUserId: uid('YY15'),
          replyToNickname: nick('YY15'),
          content: '哈哈哈哈今晚手感好，明天继续切磋！',
          likedBy: [uid('YY15')],
          createdAt: new Date(Date.now() - 18 * 60_000).toISOString(),
        },
      ],
      createdAt: new Date(Date.now() - 40 * 60_000).toISOString(),
    },
    {
      id: 'seed_c2',
      playerId: uid('YY07'),
      authorId: uid('YY08'),
      authorNickname: nick('YY08'),
      authorStars: 5,
      content: '中距离稳得像机器，只要给他半步空间就是两分，唯一缺点是太早下场买水了。',
      likedBy: [uid('YY05'), uid('YY09'), uid('YY12')],
      replies: [],
      createdAt: new Date(Date.now() - 32 * 60_000).toISOString(),
    },
    {
      id: 'seed_c3',
      playerId: uid('YY15'),
      authorId: uid('YY17'),
      authorNickname: nick('YY17'),
      authorStars: 4,
      content: '推反击坦克一样根本拉不住，给外线分球视野也是园区顶级。',
      likedBy: [uid('YY08'), uid('YY10')],
      replies: [],
      createdAt: new Date(Date.now() - 28 * 60_000).toISOString(),
    },
    {
      id: 'seed_c4',
      playerId: uid('YY17'),
      authorId: uid('YY02'),
      authorNickname: nick('YY02'),
      authorStars: 5,
      content: '前场板一抢一个准，跟他一队随便投，投不进还有二次进攻兜底。',
      likedBy: [uid('YY15'), uid('YY01')],
      replies: [],
      createdAt: new Date(Date.now() - 22 * 60_000).toISOString(),
    },
    {
      id: 'seed_c5',
      playerId: uid('YY03'),
      authorId: uid('YY09'),
      authorNickname: nick('YY09'),
      authorStars: 2,
      content: '运球一顿操作猛如虎，最后上篮涮框而出，呼吸权先扣一半哈哈。',
      likedBy: [uid('YY01'), uid('YY06'), uid('YY13')],
      replies: [
        {
          id: 'seed_rep3',
          commentId: 'seed_c5',
          playerId: uid('YY03'),
          authorId: uid('YY03'),
          authorNickname: nick('YY03'),
          replyToUserId: uid('YY09'),
          replyToNickname: nick('YY09'),
          content: '风太大了！今晚灯下约个3v3让你见识下真水平！',
          likedBy: [uid('YY09')],
          createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        },
      ],
      createdAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    },
    {
      id: 'seed_c6',
      playerId: uid('YY05'),
      authorId: uid('YY02'),
      authorNickname: nick('YY02'),
      authorStars: 5,
      content: '王总今天不仅带脉动，底角三分还三连中，必须满分致敬！',
      likedBy: [uid('YY01'), uid('YY04'), uid('YY16')],
      replies: [],
      createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    },
  ];

  const half3v3Slots = createEmptyRoomSlots('half_3v3');
  half3v3Slots.redTeam[0] = {
    userId: uid('YY08'),
    nickname: nick('YY08'),
    jerseyNumber: jersey('YY08'),
    joinedAt: nowIso,
  };
  half3v3Slots.redTeam[1] = {
    userId: uid('YY17'),
    nickname: nick('YY17'),
    jerseyNumber: jersey('YY17'),
    joinedAt: nowIso,
  };
  half3v3Slots.blueTeam[0] = {
    userId: uid('YY15'),
    nickname: nick('YY15'),
    jerseyNumber: jersey('YY15'),
    joinedAt: nowIso,
  };
  half3v3Slots.blueTeam[1] = {
    userId: uid('YY02'),
    nickname: nick('YY02'),
    jerseyNumber: jersey('YY02'),
    joinedAt: nowIso,
  };

  const full5v5Slots = createEmptyRoomSlots('full_5v5');
  full5v5Slots.redTeam[0] = {
    userId: uid('YY07'),
    nickname: nick('YY07'),
    jerseyNumber: jersey('YY07'),
    joinedAt: nowIso,
  };
  full5v5Slots.redTeam[1] = {
    userId: uid('YY01'),
    nickname: nick('YY01'),
    jerseyNumber: jersey('YY01'),
    joinedAt: nowIso,
  };
  full5v5Slots.redTeam[2] = {
    userId: uid('YY05'),
    nickname: nick('YY05'),
    jerseyNumber: jersey('YY05'),
    joinedAt: nowIso,
  };
  full5v5Slots.blueTeam[0] = {
    userId: uid('YY03'),
    nickname: nick('YY03'),
    jerseyNumber: jersey('YY03'),
    joinedAt: nowIso,
  };
  full5v5Slots.blueTeam[1] = {
    userId: uid('YY09'),
    nickname: nick('YY09'),
    jerseyNumber: jersey('YY09'),
    joinedAt: nowIso,
  };

  const nowMs = Date.now();
  const rooms: MatchRoom[] = [
    {
      id: 'seed_room_3v3',
      title: '下班半场3v3血战局',
      courtNote: '园区东区1号框',
      courtType: 'half',
      mode: 'half_3v3',
      teamSize: 3,
      benchLimit: 0,
      status: 'recruiting',
      creatorId: uid('YY08'),
      creatorNickname: nick('YY08'),
      redTeam: half3v3Slots.redTeam,
      blueTeam: half3v3Slots.blueTeam,
      bench: [],
      invites: [],
      scheduledAt: new Date(nowMs + 60 * 60_000).toISOString(),
      createdAt: new Date(nowMs - 20 * 60_000).toISOString(),
    },
    {
      id: 'seed_room_5v5',
      title: '晚间全场5v5养生带替补',
      courtNote: '园区中心大场',
      courtType: 'full',
      mode: 'full_5v5',
      teamSize: 5,
      benchLimit: 4,
      status: 'recruiting',
      creatorId: uid('YY07'),
      creatorNickname: nick('YY07'),
      redTeam: full5v5Slots.redTeam,
      blueTeam: full5v5Slots.blueTeam,
      bench: [
        {
          userId: uid('YY11'),
          nickname: nick('YY11'),
          jerseyNumber: jersey('YY11'),
          joinedAt: nowIso,
        },
      ],
      invites: [],
      scheduledAt: new Date(nowMs + 95 * 60_000).toISOString(),
      createdAt: new Date(nowMs - 10 * 60_000).toISOString(),
    },
  ];

  return {
    currentDate: today,
    jerseySeedVersion: CURRENT_JERSEY_SEED_VERSION,
    users,
    ratings,
    comments,
    rooms,
  };
}

class ParkHupuStore {
  private db: DatabaseSchema;
  private revokedSessions = new Map<string, number>(); // jti -> expMs
  private onlinePresence = new Map<string, number>(); // presenceKey -> lastSeenMs

  constructor() {
    this.db = this.loadFromDisk();
    this.ensureDailyFreshness();
    setInterval(() => {
      this.ensureDailyFreshness();
      const nowMs = Date.now();
      pruneAndCountOnlinePresence(this.onlinePresence, nowMs);
      this.pruneRevokedSessions(nowMs);
    }, 30_000).unref();
  }

  private pruneRevokedSessions(nowMs: number = Date.now()): void {
    for (const [jti, expMs] of this.revokedSessions.entries()) {
      if (nowMs >= expMs) {
        this.revokedSessions.delete(jti);
      }
    }
  }

  public touchPresence(
    userId: string | null | undefined,
    clientId: string | null | undefined,
    nowMs: number = Date.now(),
  ): number {
    const cleanClient = clientId ? clientId.trim().slice(0, 64) : '';
    if (userId) {
      if (cleanClient) {
        this.onlinePresence.delete(`client:${cleanClient}`);
      }
      this.onlinePresence.set(`user:${userId}`, nowMs);
    } else if (cleanClient) {
      this.onlinePresence.set(`client:${cleanClient}`, nowMs);
    }
    return pruneAndCountOnlinePresence(this.onlinePresence, nowMs);
  }

  public leavePresence(
    userId: string | null | undefined,
    clientId: string | null | undefined,
    nowMs: number = Date.now(),
  ): number {
    const cleanClient = clientId ? clientId.trim().slice(0, 64) : '';
    if (userId) {
      this.onlinePresence.delete(`user:${userId}`);
    }
    if (cleanClient) {
      this.onlinePresence.delete(`client:${cleanClient}`);
    }
    return pruneAndCountOnlinePresence(this.onlinePresence, nowMs);
  }

  public getOnlineCount(nowMs: number = Date.now()): number {
    return pruneAndCountOnlinePresence(this.onlinePresence, nowMs);
  }

  private migrateJerseySeeds(data: DatabaseSchema): boolean {
    if (data.jerseySeedVersion === CURRENT_JERSEY_SEED_VERSION) {
      return false;
    }

    for (const seed of DEFAULT_PLAYER_SEEDS) {
      const existing = data.users.find(
        (u) =>
          u.nickname.trim().toLowerCase() === seed.nickname.trim().toLowerCase() ||
          normalizeAccount(u.account) === normalizeAccount(seed.account),
      );
      if (existing) {
        existing.jerseyNumber = formatJerseyNumber(seed.jerseyNumber);
      } else {
        const { salt, hash } = hashPassword('123456');
        data.users.push({
          id: `player_${seed.account.toLowerCase()}`,
          account: seed.account,
          nickname: seed.nickname,
          jerseyNumber: formatJerseyNumber(seed.jerseyNumber),
          createdAt: new Date().toISOString(),
          passwordSalt: salt,
          passwordHash: hash,
        });
      }
    }

    for (const user of data.users) {
      user.jerseyNumber = formatJerseyNumber(user.jerseyNumber);
    }

    const byId = new Map(data.users.map((u) => [u.id, u]));
    for (const room of data.rooms) {
      for (const slot of room.redTeam) {
        if (slot && byId.has(slot.userId)) {
          slot.jerseyNumber = byId.get(slot.userId)!.jerseyNumber;
        }
      }
      for (const slot of room.blueTeam) {
        if (slot && byId.has(slot.userId)) {
          slot.jerseyNumber = byId.get(slot.userId)!.jerseyNumber;
        }
      }
      for (const sub of room.bench) {
        if (byId.has(sub.userId)) {
          sub.jerseyNumber = byId.get(sub.userId)!.jerseyNumber;
        }
      }
      for (const inv of room.invites ?? []) {
        if (byId.has(inv.inviteeId)) {
          inv.inviteeJerseyNumber = byId.get(inv.inviteeId)!.jerseyNumber;
        }
      }
    }

    data.jerseySeedVersion = CURRENT_JERSEY_SEED_VERSION;
    return true;
  }

  private loadFromDisk(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
          if (this.migrateJerseySeeds(parsed)) {
            this.saveToDisk(parsed);
          }
          return parsed;
        }
      }
    } catch (err) {
      console.error('[Store] Failed to load DB file, recreating initial seed:', err);
    }

    const fresh = createInitialDatabase();
    this.saveToDisk(fresh);
    return fresh;
  }

  private saveToDisk(data: DatabaseSchema = this.db): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  public ensureDailyFreshness(now: Date = new Date()): boolean {
    let changed = false;

    // 每周一 0 点仅清空评分、评论、回复与点赞，不清空约球房间
    if (shouldResetWeeklyData(this.db.currentDate, now)) {
      this.db.currentDate = getShanghaiDateKey(now);
      this.db.ratings = [];
      this.db.comments = [];
      changed = true;
    }

    // 跨天未开打/进行中的房间保留，仅当开打时间超期 2 小时后自动删除
    const { activeRooms, removedCount } = pruneExpiredRooms(this.db.rooms, now);
    if (removedCount > 0) {
      this.db.rooms = activeRooms;
      changed = true;
    }

    // 到达预计开打时间后自动切换为进行中
    for (const room of this.db.rooms) {
      if (shouldAutoStartRoom(room, now)) {
        room.status = 'playing';
        changed = true;
      }
    }

    if (changed) {
      this.saveToDisk();
    }
    return changed;
  }

  public getUserByToken(token: string | undefined): PublicPlayer | null {
    if (!token) return null;
    const payload = verifySignedSessionToken(token);
    if (!payload) return null;
    if (this.revokedSessions.has(payload.jti)) return null;
    const user = this.db.users.find((u) => u.id === payload.uid);
    return user ? toPublicPlayer(user) : null;
  }

  public createSession(userId: string): string {
    const { token } = createSignedSessionToken(userId);
    return token;
  }

  public deleteSession(token: string | undefined): void {
    if (!token) return;
    const payload = verifySignedSessionToken(token);
    if (payload) {
      this.revokedSessions.set(payload.jti, payload.exp);
    }
  }

  public login(
    accountInput: string,
    passwordInput: string,
  ): { ok: true; token: string; user: PublicPlayer } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const cleanAccount = normalizeAccount(accountInput ?? '');
    const password = String(passwordInput ?? '');
    if (!cleanAccount || !password) {
      return { ok: false, error: '请输入账号和密码' };
    }

    const user = this.db.users.find((u) => normalizeAccount(u.account) === cleanAccount);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return { ok: false, error: '账号或密码不正确' };
    }

    const token = this.createSession(user.id);
    return { ok: true, token, user: toPublicPlayer(user) };
  }

  public quickLogin(
    identifier: string,
  ): { ok: true; token: string; user: PublicPlayer } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const raw = (identifier ?? '').trim();
    if (!raw) {
      return { ok: false, error: '请选择要登录的球手账号' };
    }
    const normalizedAcc = normalizeAccount(raw);
    const user = this.db.users.find(
      (u) => u.id === raw || normalizeAccount(u.account) === normalizedAcc,
    );
    if (!user) {
      return { ok: false, error: '未找到该注册球手' };
    }
    const token = this.createSession(user.id);
    return { ok: true, token, user: toPublicPlayer(user) };
  }

  public register(input: {
    nickname: string;
    account: string;
    password: string;
  }): { ok: true; token: string; user: PublicPlayer } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const check = validateRegistrationInput(input, this.db.users);
    if (!check.valid) {
      return { ok: false, error: check.error ?? '注册信息有误' };
    }

    const cleanNickname = input.nickname.trim().replace(/\s+/g, ' ');
    const cleanAccount = normalizeAccount(input.account);
    const { salt, hash } = hashPassword(input.password);
    const nextNumber = String(this.db.users.length + 1).padStart(2, '0');

    const newUser: StoredUser = {
      id: `player_${crypto.randomUUID().slice(0, 8)}`,
      account: cleanAccount,
      nickname: cleanNickname,
      jerseyNumber: nextNumber,
      createdAt: new Date().toISOString(),
      passwordSalt: salt,
      passwordHash: hash,
    };

    this.db.users.push(newUser);
    this.saveToDisk();

    const token = this.createSession(newUser.id);
    return { ok: true, token, user: toPublicPlayer(newUser) };
  }

  public updateProfile(
    user: PublicPlayer,
    input: {
      nickname?: string;
      account?: string;
      password?: string;
      jerseyNumber?: string;
      avatarBg?: string;
    },
  ): { ok: true; user: PublicPlayer } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const stored = this.db.users.find((u) => u.id === user.id);
    if (!stored) {
      return { ok: false, error: '用户不存在' };
    }

    const check = validateProfileUpdateInput(input, this.db.users, stored.id);
    if (!check.valid) {
      return { ok: false, error: check.error ?? '资料格式有误' };
    }

    if (input.nickname !== undefined) {
      stored.nickname = input.nickname.trim().replace(/\s+/g, ' ');
    }
    if (input.account !== undefined) {
      stored.account = normalizeAccount(input.account);
    }
    if (input.password !== undefined && input.password.length > 0) {
      const { salt, hash } = hashPassword(input.password);
      stored.passwordSalt = salt;
      stored.passwordHash = hash;
    }
    if (input.jerseyNumber !== undefined) {
      stored.jerseyNumber = formatJerseyNumber(input.jerseyNumber);
    }
    if (input.avatarBg !== undefined) {
      stored.avatarBg = input.avatarBg.trim() === '' ? undefined : normalizeAvatarBg(input.avatarBg);
    }

    // Sync nickname inside comments and replies
    for (const comment of this.db.comments) {
      if (comment.authorId === stored.id) {
        comment.authorNickname = stored.nickname;
      }
      for (const reply of comment.replies) {
        if (reply.authorId === stored.id) {
          reply.authorNickname = stored.nickname;
        }
        if (reply.replyToUserId === stored.id) {
          reply.replyToNickname = stored.nickname;
        }
      }
    }

    // Sync nickname, jerseyNumber, and avatarBg inside active rooms
    for (const room of this.db.rooms) {
      if (room.creatorId === stored.id) {
        room.creatorNickname = stored.nickname;
      }
      for (const slot of room.redTeam) {
        if (slot && slot.userId === stored.id) {
          slot.nickname = stored.nickname;
          slot.jerseyNumber = stored.jerseyNumber;
          slot.avatarBg = stored.avatarBg;
        }
      }
      for (const slot of room.blueTeam) {
        if (slot && slot.userId === stored.id) {
          slot.nickname = stored.nickname;
          slot.jerseyNumber = stored.jerseyNumber;
          slot.avatarBg = stored.avatarBg;
        }
      }
      for (const sub of room.bench) {
        if (sub.userId === stored.id) {
          sub.nickname = stored.nickname;
          sub.jerseyNumber = stored.jerseyNumber;
          sub.avatarBg = stored.avatarBg;
        }
      }
      for (const inv of room.invites ?? []) {
        if (inv.inviterId === stored.id) {
          inv.inviterNickname = stored.nickname;
        }
        if (inv.inviteeId === stored.id) {
          inv.inviteeNickname = stored.nickname;
          inv.inviteeJerseyNumber = stored.jerseyNumber;
        }
      }
    }

    this.saveToDisk();
    return { ok: true, user: toPublicPlayer(stored) };
  }

  public getBootstrap(currentUser: PublicPlayer | null): BootstrapResponse {
    this.ensureDailyFreshness();
    const currentUserId = currentUser?.id ?? null;
    const latestCurrentUser = currentUserId
      ? this.db.users.find((u) => u.id === currentUserId) ?? null
      : null;
    const usersById = new Map(this.db.users.map((u) => [u.id, u]));

    const ratingsByPlayer = new Map<string, PlayerRatingRecord[]>();
    for (const r of this.db.ratings) {
      const list = ratingsByPlayer.get(r.playerId) ?? [];
      list.push(r);
      ratingsByPlayer.set(r.playerId, list);
    }

    const commentsByPlayer: Record<string, CommentRecord[]> = {};
    for (const u of this.db.users) {
      commentsByPlayer[u.id] = [];
    }
    for (const c of this.db.comments) {
      if (!commentsByPlayer[c.playerId]) {
        commentsByPlayer[c.playerId] = [];
      }
      const sanitizedComment: CommentRecord = {
        ...c,
        authorId: c.anonymous && c.authorId !== currentUserId ? 'anonymous' : c.authorId,
        authorNickname: c.anonymous ? ANONYMOUS_DISPLAY_NAME : c.authorNickname,
        authorStars: c.anonymous ? null : c.authorStars,
        replies: c.replies.map((rep) => ({
          ...rep,
          authorId: rep.anonymous && rep.authorId !== currentUserId ? 'anonymous' : rep.authorId,
          authorNickname: rep.anonymous ? ANONYMOUS_DISPLAY_NAME : rep.authorNickname,
        })),
      };
      commentsByPlayer[c.playerId].push(sanitizedComment);
    }

    const players = this.db.users.map((u) =>
      computePlayerSummary(
        toPublicPlayer(u),
        ratingsByPlayer.get(u.id) ?? [],
        commentsByPlayer[u.id] ?? [],
        currentUserId,
      ),
    );

    const enrichSlot = (slot: MatchRoom['redTeam'][number]) => {
      if (!slot) return null;
      const latest = usersById.get(slot.userId);
      return {
        ...slot,
        jerseyNumber: formatJerseyNumber(latest?.jerseyNumber ?? slot.jerseyNumber),
        avatarBg: latest?.avatarBg ?? slot.avatarBg,
      };
    };

    return {
      currentDate: this.db.currentDate,
      msUntilReset: getMsUntilShanghaiMondayMidnight(),
      onlineCount: this.getOnlineCount(),
      currentUser: latestCurrentUser ? toPublicPlayer(latestCurrentUser) : null,
      players,
      commentsByPlayer,
      rooms: [...this.db.rooms]
        .map((r) => ({
          ...r,
          redTeam: r.redTeam.map(enrichSlot),
          blueTeam: r.blueTeam.map(enrichSlot),
          bench: r.bench.map((sub) => {
            const latest = usersById.get(sub.userId);
            return {
              ...sub,
              jerseyNumber: formatJerseyNumber(latest?.jerseyNumber ?? sub.jerseyNumber),
              avatarBg: latest?.avatarBg ?? sub.avatarBg,
            };
          }),
          invites: (r.invites ?? []).map((inv) => {
            const latest = usersById.get(inv.inviteeId);
            return {
              ...inv,
              inviteeJerseyNumber: formatJerseyNumber(
                latest?.jerseyNumber ?? inv.inviteeJerseyNumber,
              ),
            };
          }),
          scheduledAt: r.scheduledAt ?? r.createdAt,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }

  public ratePlayer(
    author: PublicPlayer,
    playerId: string,
    stars: number,
    commentContent?: string,
    anonymous = false,
  ): { ok: true } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const target = this.db.users.find((u) => u.id === playerId);
    if (!target) {
      return { ok: false, error: '球员不存在' };
    }
    if (!Number.isFinite(stars) || stars < 0 || stars > 5 || !Number.isInteger(stars * 2)) {
      return { ok: false, error: '请选择 0 至 10 分评分' };
    }

    const nowIso = new Date().toISOString();
    const existing = this.db.ratings.find(
      (r) => r.playerId === playerId && r.authorId === author.id,
    );
    if (existing) {
      existing.stars = stars;
      existing.anonymous = false;
      existing.updatedAt = nowIso;
    } else {
      this.db.ratings.push({
        id: `rat_${crypto.randomUUID().slice(0, 10)}`,
        playerId,
        authorId: author.id,
        stars,
        anonymous: false,
        updatedAt: nowIso,
      });
    }

    // Update authorStars on existing non-anonymous comments by this author for this player today
    for (const c of this.db.comments) {
      if (c.playerId === playerId && c.authorId === author.id && !c.anonymous) {
        c.authorStars = stars;
      }
    }

    const trimmedComment = (commentContent ?? '').trim();
    if (trimmedComment.length > 0) {
      if (trimmedComment.length > 240) {
        return { ok: false, error: '评论不能超过 240 字' };
      }
      this.db.comments.unshift({
        id: `cmt_${crypto.randomUUID().slice(0, 10)}`,
        playerId,
        authorId: author.id,
        authorNickname: anonymous ? ANONYMOUS_DISPLAY_NAME : author.nickname,
        anonymous: Boolean(anonymous),
        authorStars: stars,
        content: trimmedComment,
        likedBy: [],
        replies: [],
        createdAt: nowIso,
      });
    }

    this.saveToDisk();
    return { ok: true };
  }

  public addComment(
    author: PublicPlayer,
    playerId: string,
    contentInput: string,
    anonymous = false,
  ): { ok: true; comment: CommentRecord } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const target = this.db.users.find((u) => u.id === playerId);
    if (!target) {
      return { ok: false, error: '球员不存在' };
    }
    const content = contentInput.trim();
    if (content.length < 1 || content.length > 240) {
      return { ok: false, error: '评论需为 1-240 字' };
    }

    const authorRating = this.db.ratings.find(
      (r) => r.playerId === playerId && r.authorId === author.id,
    );

    const comment: CommentRecord = {
      id: `cmt_${crypto.randomUUID().slice(0, 10)}`,
      playerId,
      authorId: author.id,
      authorNickname: anonymous ? ANONYMOUS_DISPLAY_NAME : author.nickname,
      anonymous: Boolean(anonymous),
      authorStars: anonymous ? null : authorRating ? authorRating.stars : null,
      content,
      likedBy: [],
      replies: [],
      createdAt: new Date().toISOString(),
    };

    this.db.comments.unshift(comment);
    this.saveToDisk();
    return { ok: true, comment };
  }

  public toggleCommentLike(
    author: PublicPlayer,
    commentId: string,
  ): { ok: true; liked: boolean; count: number } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const comment = this.db.comments.find((c) => c.id === commentId);
    if (!comment) {
      return { ok: false, error: '评论不存在或已于周一0点重置' };
    }

    const idx = comment.likedBy.indexOf(author.id);
    let liked = false;
    if (idx >= 0) {
      comment.likedBy.splice(idx, 1);
      liked = false;
    } else {
      comment.likedBy.push(author.id);
      liked = true;
    }

    this.saveToDisk();
    return { ok: true, liked, count: comment.likedBy.length };
  }

  public addReply(
    author: PublicPlayer,
    commentId: string,
    contentInput: string,
    replyToUserId?: string,
    replyToNickname?: string,
    anonymous = false,
  ): { ok: true; reply: ReplyRecord } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const comment = this.db.comments.find((c) => c.id === commentId);
    if (!comment) {
      return { ok: false, error: '原评论不存在或已于周一0点重置' };
    }
    const content = contentInput.trim();
    if (content.length < 1 || content.length > 200) {
      return { ok: false, error: '回复需为 1-200 字' };
    }

    const reply: ReplyRecord = {
      id: `rep_${crypto.randomUUID().slice(0, 10)}`,
      commentId: comment.id,
      playerId: comment.playerId,
      authorId: author.id,
      authorNickname: anonymous ? ANONYMOUS_DISPLAY_NAME : author.nickname,
      anonymous: Boolean(anonymous),
      replyToUserId: replyToUserId?.trim() || undefined,
      replyToNickname: replyToNickname?.trim() || undefined,
      content,
      likedBy: [],
      createdAt: new Date().toISOString(),
    };

    comment.replies.push(reply);
    this.saveToDisk();
    return { ok: true, reply };
  }

  public toggleReplyLike(
    author: PublicPlayer,
    replyId: string,
  ): { ok: true; liked: boolean; count: number } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    for (const comment of this.db.comments) {
      const reply = comment.replies.find((r) => r.id === replyId);
      if (reply) {
        const idx = reply.likedBy.indexOf(author.id);
        let liked = false;
        if (idx >= 0) {
          reply.likedBy.splice(idx, 1);
          liked = false;
        } else {
          reply.likedBy.push(author.id);
          liked = true;
        }
        this.saveToDisk();
        return { ok: true, liked, count: reply.likedBy.length };
      }
    }
    return { ok: false, error: '回复不存在或已于周一0点重置' };
  }

  public createRoom(
    creator: PublicPlayer,
    input: {
      title: string;
      courtNote?: string;
      mode: RoomMode;
      benchLimit?: number;
      scheduledAt?: string;
    },
  ): { ok: true; room: MatchRoom } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const cfg = ROOM_MODE_CONFIGS[input.mode];
    if (!cfg) {
      return { ok: false, error: '不支持的比赛模式' };
    }

    const cleanTitle = (input.title ?? '').trim() || `${creator.nickname}的${cfg.label}房间`;
    if (cleanTitle.length > 28) {
      return { ok: false, error: '房间名称不能超过 28 字' };
    }
    const cleanCourt = (input.courtNote ?? '').trim().slice(0, 32) || '园区篮球场';
    const allowedBench = [0, 2, 4, 6];
    const requestedBench = cfg.allowBench
      ? allowedBench.includes(Number(input.benchLimit))
        ? Number(input.benchLimit)
        : 4
      : 0;

    let scheduledIso = getDefaultRoomScheduledAt().toISOString();
    if (input.scheduledAt && input.scheduledAt.trim()) {
      const parsedMs = Date.parse(input.scheduledAt);
      if (!Number.isFinite(parsedMs)) {
        return { ok: false, error: '开打时间格式无效' };
      }
      if (parsedMs < Date.now() - 90 * 60_000) {
        return { ok: false, error: '开打时间不能早于当前太多，请重新选择' };
      }
      if (parsedMs > Date.now() + 7 * 24 * 60 * 60_000) {
        return { ok: false, error: '最多仅支持预约未来 7 天内的约球房间' };
      }
      scheduledIso = new Date(parsedMs).toISOString();
    }

    const slots = createEmptyRoomSlots(input.mode);
    const nowIso = new Date().toISOString();
    slots.redTeam[0] = {
      userId: creator.id,
      nickname: creator.nickname,
      jerseyNumber: creator.jerseyNumber,
      avatarBg: creator.avatarBg,
      joinedAt: nowIso,
    };

    const initialStatus: RoomStatus =
      Date.parse(scheduledIso) <= Date.now() ? 'playing' : 'recruiting';

    const room: MatchRoom = {
      id: `room_${crypto.randomUUID().slice(0, 8)}`,
      title: cleanTitle,
      courtNote: cleanCourt,
      courtType: slots.courtType,
      mode: input.mode,
      teamSize: slots.teamSize,
      benchLimit: requestedBench,
      status: initialStatus,
      creatorId: creator.id,
      creatorNickname: creator.nickname,
      redTeam: slots.redTeam,
      blueTeam: slots.blueTeam,
      bench: [],
      invites: [],
      scheduledAt: scheduledIso,
      createdAt: nowIso,
    };

    this.db.rooms.unshift(room);
    this.saveToDisk();
    return { ok: true, room };
  }

  public joinRoom(
    user: PublicPlayer,
    roomId: string,
    team: RoomTeamSlot,
    slotIndex?: number,
  ): { ok: true; room: MatchRoom } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const idx = this.db.rooms.findIndex((r) => r.id === roomId);
    if (idx === -1) {
      return { ok: false, error: '房间不存在或已解散' };
    }
    if (!['red', 'blue', 'bench'].includes(team)) {
      return { ok: false, error: '无效的报名位置' };
    }

    const result = joinRoomSlot(
      this.db.rooms[idx],
      {
        userId: user.id,
        nickname: user.nickname,
        jerseyNumber: user.jerseyNumber,
        avatarBg: user.avatarBg,
        joinedAt: new Date().toISOString(),
      },
      team,
      slotIndex,
    );

    if (!result.ok) {
      return result;
    }

    this.db.rooms[idx] = result.room;
    this.saveToDisk();
    return { ok: true, room: result.room };
  }

  public leaveRoom(
    user: PublicPlayer,
    roomId: string,
  ):
    | {
        ok: true;
        dissolved: boolean;
        room?: MatchRoom;
        newCreator?: { userId: string; nickname: string };
      }
    | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const idx = this.db.rooms.findIndex((r) => r.id === roomId);
    if (idx === -1) {
      return { ok: false, error: '房间不存在或已解散' };
    }

    const result = leaveRoomWithHostTransfer(this.db.rooms[idx], user.id);
    if (result.dissolved || !result.room) {
      this.db.rooms.splice(idx, 1);
      this.saveToDisk();
      return { ok: true, dissolved: true };
    }

    this.db.rooms[idx] = result.room;
    this.saveToDisk();
    return {
      ok: true,
      dissolved: false,
      room: result.room,
      newCreator: result.newCreator,
    };
  }

  public updateRoom(
    user: PublicPlayer,
    roomId: string,
    input: {
      title?: string;
      courtNote?: string;
      scheduledAt?: string;
      benchLimit?: number;
    },
  ): { ok: true; room: MatchRoom } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const room = this.db.rooms.find((r) => r.id === roomId);
    if (!room) {
      return { ok: false, error: '房间不存在或已解散' };
    }
    if (room.creatorId !== user.id) {
      return { ok: false, error: '仅房主可编辑房间信息' };
    }

    if (input.title !== undefined) {
      const cleanTitle = input.title.trim();
      if (cleanTitle.length < 1 || cleanTitle.length > 28) {
        return { ok: false, error: '房间标题需为 1-28 字' };
      }
      room.title = cleanTitle;
    }

    if (input.courtNote !== undefined) {
      room.courtNote = input.courtNote.trim().slice(0, 32) || '园区篮球场';
    }

    if (input.scheduledAt !== undefined && input.scheduledAt.trim()) {
      const parsedMs = Date.parse(input.scheduledAt);
      if (!Number.isFinite(parsedMs)) {
        return { ok: false, error: '开打时间格式无效' };
      }
      if (parsedMs < Date.now() - 90 * 60_000) {
        return { ok: false, error: '开打时间不能早于当前太多，请重新选择' };
      }
      if (parsedMs > Date.now() + 7 * 24 * 60 * 60_000) {
        return { ok: false, error: '最多仅支持预约未来 7 天内的约球房间' };
      }
      room.scheduledAt = new Date(parsedMs).toISOString();
      room.status = parsedMs <= Date.now() ? 'playing' : 'recruiting';
    }

    const cfg = ROOM_MODE_CONFIGS[room.mode];
    if (cfg?.allowBench && input.benchLimit !== undefined) {
      const allowedBench = [0, 2, 4, 6];
      const nextBench = Number(input.benchLimit);
      if (!allowedBench.includes(nextBench)) {
        return { ok: false, error: '替补席人数上限无效' };
      }
      if (nextBench < room.bench.length) {
        return {
          ok: false,
          error: `当前已有 ${room.bench.length} 名替补，上限不能低于当前人数`,
        };
      }
      room.benchLimit = nextBench;
    }

    this.saveToDisk();
    return { ok: true, room };
  }

  public updateRoomStatus(
    user: PublicPlayer,
    roomId: string,
    status: RoomStatus,
  ): { ok: true; room: MatchRoom } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const room = this.db.rooms.find((r) => r.id === roomId);
    if (!room) {
      return { ok: false, error: '房间不存在' };
    }
    if (room.creatorId !== user.id) {
      return { ok: false, error: '仅房主可切换房间状态' };
    }
    if (status !== 'recruiting' && status !== 'playing') {
      return { ok: false, error: '状态参数无效' };
    }
    room.status = status;
    this.saveToDisk();
    return { ok: true, room };
  }

  public deleteRoom(
    user: PublicPlayer,
    roomId: string,
  ): { ok: true } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const idx = this.db.rooms.findIndex((r) => r.id === roomId);
    if (idx === -1) {
      return { ok: false, error: '房间不存在' };
    }
    if (this.db.rooms[idx].creatorId !== user.id) {
      return { ok: false, error: '仅房主可解散房间' };
    }
    this.db.rooms.splice(idx, 1);
    this.saveToDisk();
    return { ok: true };
  }

  public inviteToRoom(
    inviter: PublicPlayer,
    roomId: string,
    targetPlayerId: string,
    team: RoomTeamSlot,
  ): { ok: true; room: MatchRoom } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const idx = this.db.rooms.findIndex((r) => r.id === roomId);
    if (idx === -1) {
      return { ok: false, error: '房间不存在或已解散' };
    }
    if (!['red', 'blue', 'bench'].includes(team)) {
      return { ok: false, error: '无效的目标队伍' };
    }

    const targetUser = this.db.users.find((u) => u.id === targetPlayerId);
    if (!targetUser) {
      return { ok: false, error: '目标球手不存在' };
    }

    const nowIso = new Date().toISOString();

    const invite: RoomInviteRecord = {
      id: `inv_${crypto.randomUUID().slice(0, 10)}`,
      inviterId: inviter.id,
      inviterNickname: inviter.nickname,
      inviteeId: targetUser.id,
      inviteeNickname: targetUser.nickname,
      inviteeJerseyNumber: targetUser.jerseyNumber,
      targetTeam: team,
      createdAt: nowIso,
    };

    const result = addRoomInvite(this.db.rooms[idx], invite);
    if (!result.ok) {
      return result;
    }

    this.db.rooms[idx] = result.room;
    this.saveToDisk();
    return { ok: true, room: result.room };
  }

  public respondToRoomInvite(
    user: PublicPlayer,
    roomId: string,
    inviteId: string,
    action: 'accept' | 'decline',
  ): { ok: true; room: MatchRoom } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const idx = this.db.rooms.findIndex((r) => r.id === roomId);
    if (idx === -1) {
      return { ok: false, error: '房间不存在或已解散' };
    }

    const room = this.db.rooms[idx];
    const invite = (room.invites ?? []).find((inv) => inv.id === inviteId);
    if (!invite) {
      return { ok: false, error: '邀请已失效或被撤回' };
    }
    if (invite.inviteeId !== user.id) {
      return { ok: false, error: '只能回应发给自己的邀请' };
    }

    if (action === 'decline') {
      this.db.rooms[idx] = removeRoomInvite(room, inviteId);
      this.saveToDisk();
      return { ok: true, room: this.db.rooms[idx] };
    }

    const accepted = acceptRoomInvite(room, inviteId, {
      userId: user.id,
      nickname: user.nickname,
      jerseyNumber: user.jerseyNumber,
      avatarBg: user.avatarBg,
      joinedAt: new Date().toISOString(),
    });
    if (!accepted.ok) {
      return accepted;
    }

    this.db.rooms[idx] = accepted.room;
    this.saveToDisk();
    return { ok: true, room: accepted.room };
  }

  public cancelRoomInvite(
    user: PublicPlayer,
    roomId: string,
    inviteId: string,
  ): { ok: true; room: MatchRoom } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const idx = this.db.rooms.findIndex((r) => r.id === roomId);
    if (idx === -1) {
      return { ok: false, error: '房间不存在或已解散' };
    }

    const room = this.db.rooms[idx];
    const invite = (room.invites ?? []).find((inv) => inv.id === inviteId);
    if (!invite) {
      return { ok: false, error: '邀请不存在或已处理' };
    }
    if (invite.inviterId !== user.id && room.creatorId !== user.id && invite.inviteeId !== user.id) {
      return { ok: false, error: '无权撤回该邀请' };
    }

    this.db.rooms[idx] = removeRoomInvite(room, inviteId);
    this.saveToDisk();
    return { ok: true, room: this.db.rooms[idx] };
  }
}

export const store = new ParkHupuStore();
