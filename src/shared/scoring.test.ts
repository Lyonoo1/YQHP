import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PLAYER_SEEDS,
  computePlayerSummary,
  createEmptyRoomSlots,
  getShanghaiDateKey,
  joinRoomSlot,
  removeMemberFromRoom,
  shouldResetDailyData,
  sortLeaderboard,
  validateRegistrationInput,
} from './scoring';
import type { CommentRecord, MatchRoom, PlayerRatingRecord, PublicPlayer } from './types';

test('default player seeds contain all 17 specified players YY01-YY17', () => {
  assert.equal(DEFAULT_PLAYER_SEEDS.length, 17);
  assert.equal(DEFAULT_PLAYER_SEEDS[0].nickname, '假多夫');
  assert.equal(DEFAULT_PLAYER_SEEDS[0].account, 'YY01');
  assert.equal(DEFAULT_PLAYER_SEEDS[7].nickname, '科比');
  assert.equal(DEFAULT_PLAYER_SEEDS[7].account, 'YY08');
  assert.equal(DEFAULT_PLAYER_SEEDS[16].nickname, '篮板王');
  assert.equal(DEFAULT_PLAYER_SEEDS[16].account, 'YY17');
});

test('registration validation rejects duplicate nickname or duplicate account case-insensitively', () => {
  const existing = DEFAULT_PLAYER_SEEDS.map((s) => ({
    account: s.account,
    nickname: s.nickname,
  }));

  const dupNick = validateRegistrationInput(
    { nickname: '  PG ONE ', account: 'YY18', password: 'password123' },
    existing,
  );
  assert.equal(dupNick.valid, false);
  assert.match(dupNick.error ?? '', /昵称/);

  const dupAccount = validateRegistrationInput(
    { nickname: '新星阿杰', account: 'yy01', password: 'password123' },
    existing,
  );
  assert.equal(dupAccount.valid, false);
  assert.match(dupAccount.error ?? '', /账号/);

  const valid = validateRegistrationInput(
    { nickname: '新星阿杰', account: 'YY18', password: 'password123' },
    existing,
  );
  assert.equal(valid.valid, true);
});

test('Hupu player scoring calculates 2-10 average, star distribution, and dynamic heat', () => {
  const player: PublicPlayer = {
    id: 'p1',
    account: 'YY08',
    nickname: '科比',
    jerseyNumber: '08',
    createdAt: '2026-11-26T00:00:00.000Z',
  };
  const ratings: PlayerRatingRecord[] = [
    { id: 'r1', playerId: 'p1', authorId: 'u1', stars: 5, updatedAt: '2026-11-26T01:00:00.000Z' },
    { id: 'r2', playerId: 'p1', authorId: 'u2', stars: 4, updatedAt: '2026-11-26T01:05:00.000Z' },
  ];
  const comments: CommentRecord[] = [
    {
      id: 'c1',
      playerId: 'p1',
      authorId: 'u1',
      authorNickname: '假多夫',
      authorStars: 5,
      content: '后仰跳投无解',
      likedBy: ['u2', 'u3'],
      replies: [],
      createdAt: '2026-11-26T01:02:00.000Z',
    },
  ];

  const summary = computePlayerSummary(player, ratings, comments, 'u1');
  assert.equal(summary.averageScore, 9);
  assert.equal(summary.myStars, 5);
  assert.equal(summary.ratingCount, 2);
  assert.equal(summary.totalLikes, 2);
  assert.equal(summary.topComment?.content, '后仰跳投无解');
  assert.equal(summary.starDistribution[0].stars, 5);
  assert.equal(summary.starDistribution[0].percent, 50);
  assert.equal(summary.starDistribution[1].stars, 4);
  assert.equal(summary.starDistribution[1].percent, 50);
});

test('leaderboard sorts dynamically by heat, highest score, and lowest score', () => {
  const base: PublicPlayer = {
    id: 'p1',
    account: 'YY01',
    nickname: '假多夫',
    jerseyNumber: '01',
    createdAt: '2026-11-26T00:00:00.000Z',
  };
  const highHeat = computePlayerSummary(
    { ...base, id: 'p1', account: 'YY01', nickname: '假多夫' },
    [
      { id: 'r1', playerId: 'p1', authorId: 'u1', stars: 4, updatedAt: '2026-11-26T01:00:00Z' },
      { id: 'r2', playerId: 'p1', authorId: 'u2', stars: 5, updatedAt: '2026-11-26T01:00:00Z' },
      { id: 'r3', playerId: 'p1', authorId: 'u3', stars: 4, updatedAt: '2026-11-26T01:00:00Z' },
    ],
    [],
    null,
  );
  const purePerfect = computePlayerSummary(
    { ...base, id: 'p2', account: 'YY02', nickname: '强哥' },
    [{ id: 'r4', playerId: 'p2', authorId: 'u1', stars: 5, updatedAt: '2026-11-26T01:00:00Z' }],
    [],
    null,
  );
  const lowScore = computePlayerSummary(
    { ...base, id: 'p3', account: 'YY03', nickname: 'pg one' },
    [{ id: 'r5', playerId: 'p3', authorId: 'u1', stars: 2, updatedAt: '2026-11-26T01:00:00Z' }],
    [],
    null,
  );

  const byHeat = sortLeaderboard([purePerfect, lowScore, highHeat], 'heat');
  assert.equal(byHeat[0].id, 'p1');

  const byHighest = sortLeaderboard([highHeat, lowScore, purePerfect], 'highest');
  assert.equal(byHighest[0].id, 'p2');

  const byLowest = sortLeaderboard([highHeat, purePerfect, lowScore], 'lowest');
  assert.equal(byLowest[0].id, 'p3');
});

test('daily 00:00 Shanghai timezone reset check triggers exactly at midnight rollover', () => {
  const beforeMidnight = new Date('2026-11-26T15:59:59.000Z'); // 2026-11-26 23:59:59 CST
  const afterMidnight = new Date('2026-11-26T16:00:01.000Z'); // 2026-11-27 00:00:01 CST

  const dayKey = getShanghaiDateKey(beforeMidnight);
  assert.equal(dayKey, '2026-11-26');
  assert.equal(shouldResetDailyData(dayKey, beforeMidnight), false);
  assert.equal(shouldResetDailyData(dayKey, afterMidnight), true);
});

test('LoL custom room supports half-court 3v3 and full-court 5v5 with bench switching', () => {
  const slots5v5 = createEmptyRoomSlots('full_5v5');
  assert.equal(slots5v5.redTeam.length, 5);
  assert.equal(slots5v5.blueTeam.length, 5);

  let room: MatchRoom = {
    id: 'room1',
    title: '园区晚场5v5',
    courtNote: '东区1号场',
    courtType: slots5v5.courtType,
    mode: 'full_5v5',
    teamSize: 5,
    benchLimit: 4,
    status: 'recruiting',
    creatorId: 'u1',
    creatorNickname: '假多夫',
    redTeam: slots5v5.redTeam,
    blueTeam: slots5v5.blueTeam,
    bench: [],
    createdAt: '2026-11-26T10:00:00.000Z',
  };

  const member = {
    userId: 'u1',
    nickname: '假多夫',
    jerseyNumber: '01',
    joinedAt: '2026-11-26T10:00:00.000Z',
  };

  const joinedRed = joinRoomSlot(room, member, 'red', 0);
  assert.equal(joinedRed.ok, true);
  if (!joinedRed.ok) return;
  room = joinedRed.room;
  assert.equal(room.redTeam[0]?.userId, 'u1');

  // Switch from red slot 0 to blue slot 2 automatically clears red slot 0
  const switchedBlue = joinRoomSlot(room, member, 'blue', 2);
  assert.equal(switchedBlue.ok, true);
  if (!switchedBlue.ok) return;
  room = switchedBlue.room;
  assert.equal(room.redTeam[0], null);
  assert.equal(room.blueTeam[2]?.userId, 'u1');

  // Switch to bench
  const switchedBench = joinRoomSlot(room, member, 'bench');
  assert.equal(switchedBench.ok, true);
  if (!switchedBench.ok) return;
  room = switchedBench.room;
  assert.equal(room.blueTeam[2], null);
  assert.equal(room.bench.length, 1);

  // Leave room
  room = removeMemberFromRoom(room, 'u1');
  assert.equal(room.bench.length, 0);
});
