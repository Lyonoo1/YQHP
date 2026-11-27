import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_PLAYER_SEEDS,
  ROOM_MODE_CONFIGS,
  computePlayerSummary,
  createEmptyRoomSlots,
  getMsUntilShanghaiMidnight,
  getShanghaiDateKey,
  joinRoomSlot,
  normalizeAccount,
  removeMemberFromRoom,
  shouldResetDailyData,
  validateRegistrationInput,
} from '../src/shared/scoring';
import type {
  BootstrapResponse,
  CommentRecord,
  MatchRoom,
  PlayerRatingRecord,
  PublicPlayer,
  ReplyRecord,
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
  users: StoredUser[];
  ratings: PlayerRatingRecord[];
  comments: CommentRecord[];
  rooms: MatchRoom[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
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
    jerseyNumber: user.jerseyNumber,
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
    jerseyNumber: '08',
    joinedAt: nowIso,
  };
  half3v3Slots.redTeam[1] = {
    userId: uid('YY17'),
    nickname: nick('YY17'),
    jerseyNumber: '17',
    joinedAt: nowIso,
  };
  half3v3Slots.blueTeam[0] = {
    userId: uid('YY15'),
    nickname: nick('YY15'),
    jerseyNumber: '15',
    joinedAt: nowIso,
  };
  half3v3Slots.blueTeam[1] = {
    userId: uid('YY02'),
    nickname: nick('YY02'),
    jerseyNumber: '02',
    joinedAt: nowIso,
  };

  const full5v5Slots = createEmptyRoomSlots('full_5v5');
  full5v5Slots.redTeam[0] = {
    userId: uid('YY07'),
    nickname: nick('YY07'),
    jerseyNumber: '07',
    joinedAt: nowIso,
  };
  full5v5Slots.redTeam[1] = {
    userId: uid('YY01'),
    nickname: nick('YY01'),
    jerseyNumber: '01',
    joinedAt: nowIso,
  };
  full5v5Slots.redTeam[2] = {
    userId: uid('YY05'),
    nickname: nick('YY05'),
    jerseyNumber: '05',
    joinedAt: nowIso,
  };
  full5v5Slots.blueTeam[0] = {
    userId: uid('YY03'),
    nickname: nick('YY03'),
    jerseyNumber: '03',
    joinedAt: nowIso,
  };
  full5v5Slots.blueTeam[1] = {
    userId: uid('YY09'),
    nickname: nick('YY09'),
    jerseyNumber: '09',
    joinedAt: nowIso,
  };

  const rooms: MatchRoom[] = [
    {
      id: 'seed_room_3v3',
      title: '下班半场3v3血战局',
      courtNote: '园区东区1号框 · 19:00',
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
      createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    },
    {
      id: 'seed_room_5v5',
      title: '晚间全场5v5养生带替补',
      courtNote: '园区中心大场 · 20:00',
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
          jerseyNumber: '11',
          joinedAt: nowIso,
        },
      ],
      createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    },
  ];

  return {
    currentDate: today,
    users,
    ratings,
    comments,
    rooms,
  };
}

class ParkHupuStore {
  private db: DatabaseSchema;
  private sessions = new Map<string, string>(); // token -> userId

  constructor() {
    this.db = this.loadFromDisk();
    this.ensureDailyFreshness();
    setInterval(() => {
      this.ensureDailyFreshness();
    }, 30_000).unref();
  }

  private loadFromDisk(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
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
    if (shouldResetDailyData(this.db.currentDate, now)) {
      this.db.currentDate = getShanghaiDateKey(now);
      this.db.ratings = [];
      this.db.comments = [];
      this.db.rooms = [];
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public getUserByToken(token: string | undefined): PublicPlayer | null {
    if (!token) return null;
    const userId = this.sessions.get(token);
    if (!userId) return null;
    const user = this.db.users.find((u) => u.id === userId);
    return user ? toPublicPlayer(user) : null;
  }

  public createSession(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, userId);
    return token;
  }

  public deleteSession(token: string | undefined): void {
    if (token) {
      this.sessions.delete(token);
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

  public getBootstrap(currentUser: PublicPlayer | null): BootstrapResponse {
    this.ensureDailyFreshness();
    const currentUserId = currentUser?.id ?? null;

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
      commentsByPlayer[c.playerId].push(c);
    }

    const players = this.db.users.map((u) =>
      computePlayerSummary(
        toPublicPlayer(u),
        ratingsByPlayer.get(u.id) ?? [],
        commentsByPlayer[u.id] ?? [],
        currentUserId,
      ),
    );

    return {
      currentDate: this.db.currentDate,
      msUntilReset: getMsUntilShanghaiMidnight(),
      currentUser,
      players,
      commentsByPlayer,
      rooms: [...this.db.rooms].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }

  public ratePlayer(
    author: PublicPlayer,
    playerId: string,
    stars: number,
    commentContent?: string,
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
      existing.updatedAt = nowIso;
    } else {
      this.db.ratings.push({
        id: `rat_${crypto.randomUUID().slice(0, 10)}`,
        playerId,
        authorId: author.id,
        stars,
        updatedAt: nowIso,
      });
    }

    // Update authorStars on existing comments by this author for this player today
    for (const c of this.db.comments) {
      if (c.playerId === playerId && c.authorId === author.id) {
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
        authorNickname: author.nickname,
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
      authorNickname: author.nickname,
      authorStars: authorRating ? authorRating.stars : null,
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
      return { ok: false, error: '评论不存在或已于0点重置' };
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
  ): { ok: true; reply: ReplyRecord } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const comment = this.db.comments.find((c) => c.id === commentId);
    if (!comment) {
      return { ok: false, error: '原评论不存在或已于0点重置' };
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
      authorNickname: author.nickname,
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
    return { ok: false, error: '回复不存在或已于0点重置' };
  }

  public createRoom(
    creator: PublicPlayer,
    input: {
      title: string;
      courtNote?: string;
      mode: RoomMode;
      benchLimit?: number;
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
    const cleanCourt = (input.courtNote ?? '').trim().slice(0, 32) || '园区篮球场 · 即刻开打';
    const allowedBench = [0, 2, 4, 6];
    const requestedBench = cfg.allowBench
      ? allowedBench.includes(Number(input.benchLimit))
        ? Number(input.benchLimit)
        : 4
      : 0;

    const slots = createEmptyRoomSlots(input.mode);
    const nowIso = new Date().toISOString();
    slots.redTeam[0] = {
      userId: creator.id,
      nickname: creator.nickname,
      jerseyNumber: creator.jerseyNumber,
      joinedAt: nowIso,
    };

    const room: MatchRoom = {
      id: `room_${crypto.randomUUID().slice(0, 8)}`,
      title: cleanTitle,
      courtNote: cleanCourt,
      courtType: slots.courtType,
      mode: input.mode,
      teamSize: slots.teamSize,
      benchLimit: requestedBench,
      status: 'recruiting',
      creatorId: creator.id,
      creatorNickname: creator.nickname,
      redTeam: slots.redTeam,
      blueTeam: slots.blueTeam,
      bench: [],
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
  ): { ok: true; room: MatchRoom } | { ok: false; error: string } {
    this.ensureDailyFreshness();
    const idx = this.db.rooms.findIndex((r) => r.id === roomId);
    if (idx === -1) {
      return { ok: false, error: '房间不存在或已解散' };
    }

    this.db.rooms[idx] = removeMemberFromRoom(this.db.rooms[idx], user.id);
    this.saveToDisk();
    return { ok: true, room: this.db.rooms[idx] };
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
}

export const store = new ParkHupuStore();
