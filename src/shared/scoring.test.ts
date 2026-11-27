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

test('default player seeds contain all 18 players YY01-YY18 with 2-digit zero-padded jersey numbers', () => {
  assert.equal(DEFAULT_PLAYER_SEEDS.length, 18);
  const byNick = new Map(DEFAULT_PLAYER_SEEDS.map((p) => [p.nickname, p]));
  assert.equal(byNick.get('蜘蛛侠')?.jerseyNumber, '45');
  assert.equal(byNick.get('pg one')?.jerseyNumber, '06');
  assert.equal(byNick.get('老詹')?.jerseyNumber, '11');
  assert.equal(byNick.get('科比')?.jerseyNumber, '09');
  assert.equal(byNick.get('法拉利')?.jerseyNumber, '24');
  assert.equal(byNick.get('强哥')?.jerseyNumber, '91');
  assert.equal(byNick.get('科冉')?.jerseyNumber, '02');
  assert.equal(byNick.get('篮板王')?.jerseyNumber, '13');
  assert.equal(byNick.get('王总')?.jerseyNumber, '01');
  assert.equal(byNick.get('小规不叫')?.jerseyNumber, '23');
  assert.equal(byNick.get('篮球之神')?.jerseyNumber, '08');
  assert.equal(byNick.get('YDB')?.jerseyNumber, '00');
  assert.equal(byNick.get('假多夫')?.jerseyNumber, '07');

  for (const seed of DEFAULT_PLAYER_SEEDS) {
    assert.match(seed.jerseyNumber, /^\d{2}$/);
  }
  const uniqueJerseys = new Set(DEFAULT_PLAYER_SEEDS.map((p) => p.jerseyNumber));
  assert.equal(uniqueJerseys.size, 18);
});

test('registration validation rejects duplicate nickname or duplicate account case-insensitively', () => {
  const existing = DEFAULT_PLAYER_SEEDS.map((s) => ({
    account: s.account,
    nickname: s.nickname,
  }));

  const dupNick = validateRegistrationInput(
    { nickname: '  PG ONE ', account: 'YY19', password: 'password123' },
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
    { nickname: '新星阿杰', account: 'YY19', password: 'password123' },
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

test('room invite supports inviting to red/blue/bench, updating team, and accepting into target team', async () => {
  const { addRoomInvite, acceptRoomInvite, removeRoomInvite } = await import('./scoring');
  const slots = createEmptyRoomSlots('half_3v3');
  let room: MatchRoom = {
    id: 'room_inv_1',
    title: '半场约战',
    courtNote: '东场',
    courtType: 'half',
    mode: 'half_3v3',
    teamSize: 3,
    benchLimit: 0,
    status: 'recruiting',
    creatorId: 'u1',
    creatorNickname: '假多夫',
    redTeam: slots.redTeam,
    blueTeam: slots.blueTeam,
    bench: [],
    invites: [],
    createdAt: '2026-11-26T10:00:00.000Z',
  };

  // Self invite rejected
  const selfInvite = addRoomInvite(room, {
    id: 'inv_self',
    inviterId: 'u1',
    inviterNickname: '假多夫',
    inviteeId: 'u1',
    inviteeNickname: '假多夫',
    inviteeJerseyNumber: '01',
    targetTeam: 'red',
    createdAt: '2026-11-26T10:01:00.000Z',
  });
  assert.equal(selfInvite.ok, false);

  // Invite u2 to red team
  const invRed = addRoomInvite(room, {
    id: 'inv_1',
    inviterId: 'u1',
    inviterNickname: '假多夫',
    inviteeId: 'u2',
    inviteeNickname: '强哥',
    inviteeJerseyNumber: '02',
    targetTeam: 'red',
    createdAt: '2026-11-26T10:01:00.000Z',
  });
  assert.equal(invRed.ok, true);
  if (!invRed.ok) return;
  room = invRed.room;
  assert.equal(room.invites?.length, 1);

  // Re-inviting u2 to blue replaces prior red invite cleanly
  const invBlue = addRoomInvite(room, {
    id: 'inv_2',
    inviterId: 'u1',
    inviterNickname: '假多夫',
    inviteeId: 'u2',
    inviteeNickname: '强哥',
    inviteeJerseyNumber: '02',
    targetTeam: 'blue',
    createdAt: '2026-11-26T10:02:00.000Z',
  });
  assert.equal(invBlue.ok, true);
  if (!invBlue.ok) return;
  room = invBlue.room;
  assert.equal(room.invites?.length, 1);
  assert.equal(room.invites?.[0].targetTeam, 'blue');

  // Wrong user cannot accept u2's invite
  const wrongAccept = acceptRoomInvite(room, 'inv_2', {
    userId: 'u3',
    nickname: 'pg one',
    jerseyNumber: '03',
    joinedAt: '2026-11-26T10:03:00.000Z',
  });
  assert.equal(wrongAccept.ok, false);

  // u2 accepts invite -> placed into blue team slot 0 and invite cleared
  const okAccept = acceptRoomInvite(room, 'inv_2', {
    userId: 'u2',
    nickname: '强哥',
    jerseyNumber: '02',
    joinedAt: '2026-11-26T10:03:00.000Z',
  });
  assert.equal(okAccept.ok, true);
  if (!okAccept.ok) return;
  room = okAccept.room;
  assert.equal(room.blueTeam[0]?.userId, 'u2');
  assert.equal(room.invites?.length, 0);

  // Inviting u2 to blue again while already in blue is rejected
  const dupBlue = addRoomInvite(room, {
    id: 'inv_3',
    inviterId: 'u1',
    inviterNickname: '假多夫',
    inviteeId: 'u2',
    inviteeNickname: '强哥',
    inviteeJerseyNumber: '02',
    targetTeam: 'blue',
    createdAt: '2026-11-26T10:04:00.000Z',
  });
  assert.equal(dupBlue.ok, false);

  // Remove invite helper works cleanly
  const invRedAgain = addRoomInvite(room, {
    id: 'inv_4',
    inviterId: 'u1',
    inviterNickname: '假多夫',
    inviteeId: 'u3',
    inviteeNickname: 'pg one',
    inviteeJerseyNumber: '03',
    targetTeam: 'red',
    createdAt: '2026-11-26T10:05:00.000Z',
  });
  assert.equal(invRedAgain.ok, true);
  if (!invRedAgain.ok) return;
  const cleared = removeRoomInvite(invRedAgain.room, 'inv_4');
  assert.equal(cleared.invites?.length, 0);
});

test('rooms persist across midnight and auto-expire exactly 2 hours past scheduledAt', async () => {
  const { isRoomExpired, pruneExpiredRooms } = await import('./scoring');
  const slots = createEmptyRoomSlots('half_3v3');
  const baseRoom: MatchRoom = {
    id: 'r_cross',
    title: '跨夜野球局',
    courtNote: '东场',
    courtType: 'half',
    mode: 'half_3v3',
    teamSize: 3,
    benchLimit: 0,
    status: 'recruiting',
    creatorId: 'u1',
    creatorNickname: '假多夫',
    redTeam: slots.redTeam,
    blueTeam: slots.blueTeam,
    bench: [],
    invites: [],
    // Scheduled at 2026-11-26 23:00 CST (15:00Z)
    scheduledAt: '2026-11-26T15:00:00.000Z',
    createdAt: '2026-11-26T12:00:00.000Z',
  };

  // At 2026-11-27 00:30 CST (16:30Z), past midnight but only 1.5h past scheduledAt -> still kept!
  const afterMidnight15h = new Date('2026-11-26T16:30:00.000Z');
  assert.equal(isRoomExpired(baseRoom, afterMidnight15h), false);

  // At 2026-11-27 01:00 CST (17:00Z), exactly 2 hours past scheduledAt -> expired!
  const twoHoursPast = new Date('2026-11-26T17:00:00.000Z');
  assert.equal(isRoomExpired(baseRoom, twoHoursPast), true);

  const futureRoom: MatchRoom = {
    ...baseRoom,
    id: 'r_tomorrow',
    scheduledAt: '2026-11-27T11:00:00.000Z',
  };
  const { activeRooms, removedCount } = pruneExpiredRooms([baseRoom, futureRoom], twoHoursPast);
  assert.equal(removedCount, 1);
  assert.equal(activeRooms.length, 1);
  assert.equal(activeRooms[0].id, 'r_tomorrow');
});

test('invite link builder and parser handle subpath URLs and reject invalid team params', async () => {
  const { buildRoomInviteLink, parseRoomInviteSearch } = await import('./scoring');
  const url = buildRoomInviteLink('https://example.com/yqhp/', {
    roomId: 'room_123',
    team: 'blue',
    inviteId: 'inv_9',
    inviteeAccount: 'YY04',
  });
  assert.equal(
    url,
    'https://example.com/yqhp/?inviteRoom=room_123&team=blue&inviteId=inv_9&invitee=YY04',
  );

  const parsed = parseRoomInviteSearch(new URL(url).search);
  assert.deepEqual(parsed, {
    roomId: 'room_123',
    team: 'blue',
    inviteId: 'inv_9',
    inviteeAccount: 'YY04',
  });

  assert.equal(parseRoomInviteSearch('?inviteRoom=room_123&team=invalid'), null);
});

test('room display state tracks waiting, full, auto-start playing, and 30-min expiry warning window', async () => {
  const {
    getRoomDisplayState,
    getRoomMinutesUntilExpiry,
    shouldAutoStartRoom,
  } = await import('./scoring');

  const slots = createEmptyRoomSlots('half_2v2');
  const m = (id: string) => ({
    userId: id,
    nickname: id,
    jerseyNumber: '01',
    joinedAt: '2026-11-26T10:00:00.000Z',
  });
  const room: MatchRoom = {
    id: 'r_state',
    title: '2v2测试',
    courtNote: '东场',
    courtType: 'half',
    mode: 'half_2v2',
    teamSize: 2,
    benchLimit: 0,
    status: 'recruiting',
    creatorId: 'u1',
    creatorNickname: 'u1',
    redTeam: [m('u1'), null],
    blueTeam: [m('u2'), null],
    bench: [],
    invites: [],
    scheduledAt: '2026-11-26T12:00:00.000Z',
    createdAt: '2026-11-26T10:00:00.000Z',
  };

  const beforeStart = new Date('2026-11-26T11:30:00.000Z');
  assert.equal(getRoomDisplayState(room, beforeStart), 'waiting');
  assert.equal(shouldAutoStartRoom(room, beforeStart), false);
  assert.equal(getRoomMinutesUntilExpiry(room, beforeStart), null);

  // Fill all starter slots -> full
  const fullRoom: MatchRoom = {
    ...room,
    redTeam: [m('u1'), m('u3')],
    blueTeam: [m('u2'), m('u4')],
  };
  assert.equal(getRoomDisplayState(fullRoom, beforeStart), 'full');

  // At scheduled time -> auto-starts as playing, but still >30m before expiry -> no expiry warning yet
  const atStart = new Date('2026-11-26T12:00:00.000Z');
  assert.equal(shouldAutoStartRoom(room, atStart), true);
  assert.equal(getRoomDisplayState(room, atStart), 'playing');
  assert.equal(getRoomMinutesUntilExpiry(room, atStart), null);

  // 1h40m after scheduled start -> 20 minutes remaining -> warning shown!
  const nearExpiry = new Date('2026-11-26T13:40:00.000Z');
  assert.equal(getRoomMinutesUntilExpiry(room, nearExpiry), 20);
});

test('profile update validation enforces unique account, jersey number 0-99, password length, and curated avatar colors', async () => {
  const { validateProfileUpdateInput } = await import('./scoring');
  const users = [
    { id: 'u1', account: 'YY01' },
    { id: 'u2', account: 'YY02' },
  ];

  // Duplicate account taken by another user rejected
  assert.equal(
    validateProfileUpdateInput({ account: 'yy02' }, users, 'u1').valid,
    false,
  );
  // Keeping own account allowed
  assert.equal(
    validateProfileUpdateInput(
      { account: 'YY01', jerseyNumber: '23', avatarBg: '#C60100', password: 'newpassword' },
      users,
      'u1',
    ).valid,
    true,
  );
  // Invalid jersey number rejected
  assert.equal(
    validateProfileUpdateInput({ jerseyNumber: '123' }, users, 'u1').valid,
    false,
  );
  // Invalid avatar color rejected
  assert.equal(
    validateProfileUpdateInput({ avatarBg: '#123456' }, users, 'u1').valid,
    false,
  );
});

test('anonymous top comment masks authorNickname as 匿名球友', () => {
  const player: PublicPlayer = {
    id: 'p1',
    account: 'YY08',
    nickname: '科比',
    jerseyNumber: '08',
    createdAt: '2026-11-26T00:00:00.000Z',
  };
  const comments: CommentRecord[] = [
    {
      id: 'c_anon',
      playerId: 'p1',
      authorId: 'u2',
      authorNickname: '强哥',
      anonymous: true,
      authorStars: 5,
      content: '今天手感火热！',
      likedBy: ['u3'],
      replies: [],
      createdAt: '2026-11-26T01:02:00.000Z',
    },
  ];
  const summary = computePlayerSummary(player, [], comments, null);
  assert.equal(summary.topComment?.authorNickname, '匿名球友');
  assert.equal(summary.topComment?.anonymous, true);
});

test('formatJerseyNumber pads single digits with leading zero and preserves two-digit numbers', async () => {
  const { formatJerseyNumber } = await import('./scoring');
  assert.equal(formatJerseyNumber('0'), '00');
  assert.equal(formatJerseyNumber('1'), '01');
  assert.equal(formatJerseyNumber('8'), '08');
  assert.equal(formatJerseyNumber('08'), '08');
  assert.equal(formatJerseyNumber('00'), '00');
  assert.equal(formatJerseyNumber('24'), '24');
  assert.equal(formatJerseyNumber(9), '09');
  assert.equal(formatJerseyNumber(''), '00');
});

test('getUpcomingSoonRooms filters rooms starting within 2 hours, excludes started/far rooms, and sorts soonest first', async () => {
  const { getUpcomingSoonRooms, formatUpcomingCountdown } = await import('./scoring');
  const now = new Date('2026-11-26T10:00:00.000Z');
  const slots = createEmptyRoomSlots('half_3v3');
  const makeRoom = (
    id: string,
    offsetMin: number,
    status: 'recruiting' | 'playing' = 'recruiting',
  ): MatchRoom => ({
    id,
    title: `Room ${id}`,
    courtNote: '东场',
    courtType: 'half',
    mode: 'half_3v3',
    teamSize: 3,
    benchLimit: 0,
    status,
    creatorId: 'u1',
    creatorNickname: '科比',
    redTeam: slots.redTeam,
    blueTeam: slots.blueTeam,
    bench: [],
    invites: [],
    scheduledAt: new Date(now.getTime() + offsetMin * 60_000).toISOString(),
    createdAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
  });

  const rooms: MatchRoom[] = [
    makeRoom('past', -10), // already started -> excluded
    makeRoom('playing_early', 30, 'playing'), // already playing -> excluded
    makeRoom('in_90m', 90), // within 2h -> included (2nd)
    makeRoom('in_25m', 25), // within 2h -> included (1st)
    makeRoom('in_120m', 120), // exactly 2h -> included (3rd)
    makeRoom('in_125m', 125), // > 2h -> excluded
  ];

  const upcoming = getUpcomingSoonRooms(rooms, now);
  assert.deepEqual(
    upcoming.map((u) => u.room.id),
    ['in_25m', 'in_90m', 'in_120m'],
  );
  assert.deepEqual(
    upcoming.map((u) => u.urgency),
    ['imminent', 'soon', 'soon'],
  );
  assert.equal(formatUpcomingCountdown(25 * 60_000), '25分钟后开打');
  assert.equal(formatUpcomingCountdown(90 * 60_000), '1小时30分后开打');
  assert.equal(formatUpcomingCountdown(120 * 60_000), '2小时后开打');
  assert.equal(formatUpcomingCountdown(30_000), '1分钟内开打');
});

test('pruneAndCountOnlinePresence drops stale clients past TTL and counts active clients accurately', async () => {
  const { pruneAndCountOnlinePresence } = await import('./scoring');
  const now = 1_000_000;
  const entries = new Map<string, number>([
    ['user:u1', now - 5_000],
    ['client:c1', now - 25_000], // right on boundary -> still online
    ['client:stale', now - 25_001], // expired -> pruned
  ]);
  const count = pruneAndCountOnlinePresence(entries, now, 25_000);
  assert.equal(count, 2);
  assert.equal(entries.has('client:stale'), false);
  assert.equal(entries.has('user:u1'), true);
});



