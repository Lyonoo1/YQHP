export type RoomCourtType = 'half' | 'full';
export type RoomMode = 'half_2v2' | 'half_3v3' | 'half_4v4' | 'full_5v5';
export type RoomTeamSlot = 'red' | 'blue' | 'bench';
export type RoomStatus = 'recruiting' | 'playing';
export type LeaderboardSort = 'heat' | 'highest' | 'lowest';

export interface PublicPlayer {
  id: string;
  account: string;
  nickname: string;
  jerseyNumber: string;
  createdAt: string;
}

export interface PlayerRatingRecord {
  id: string;
  playerId: string;
  authorId: string;
  stars: number; // 1 to 5 (Hupu score = stars * 2)
  updatedAt: string;
}

export interface ReplyRecord {
  id: string;
  commentId: string;
  playerId: string;
  authorId: string;
  authorNickname: string;
  replyToUserId?: string;
  replyToNickname?: string;
  content: string;
  likedBy: string[];
  createdAt: string;
}

export interface CommentRecord {
  id: string;
  playerId: string;
  authorId: string;
  authorNickname: string;
  authorStars: number | null;
  content: string;
  likedBy: string[];
  replies: ReplyRecord[];
  createdAt: string;
}

export interface StarBreakdown {
  stars: number;
  count: number;
  percent: number;
}

export interface PlayerSummary extends PublicPlayer {
  averageScore: number | null; // 2.0 - 10.0, null if unrated today
  ratingCount: number;
  commentCount: number;
  totalLikes: number;
  heatScore: number;
  myStars: number | null;
  starDistribution: StarBreakdown[];
  topComment: {
    id: string;
    authorNickname: string;
    content: string;
    likeCount: number;
  } | null;
}

export interface RoomSlotMember {
  userId: string;
  nickname: string;
  jerseyNumber: string;
  joinedAt: string;
}

export interface MatchRoom {
  id: string;
  title: string;
  courtNote: string;
  courtType: RoomCourtType;
  mode: RoomMode;
  teamSize: number;
  benchLimit: number;
  status: RoomStatus;
  creatorId: string;
  creatorNickname: string;
  redTeam: (RoomSlotMember | null)[];
  blueTeam: (RoomSlotMember | null)[];
  bench: RoomSlotMember[];
  createdAt: string;
}

export interface BootstrapResponse {
  currentDate: string;
  msUntilReset: number;
  currentUser: PublicPlayer | null;
  players: PlayerSummary[];
  commentsByPlayer: Record<string, CommentRecord[]>;
  rooms: MatchRoom[];
}
