import type {
  BootstrapResponse,
  PublicPlayer,
  RoomMode,
  RoomStatus,
  RoomTeamSlot,
} from '../shared/types';

// Keep auth token and tab clientId strictly in JS/React memory (never localStorage/sessionStorage)
let inMemoryToken: string | null = null;
const CLIENT_ID = `cli_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '');

export function sendPresenceLeave(): void {
  const url = `${BASE_PATH}/api/presence/leave?clientId=${encodeURIComponent(CLIENT_ID)}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Id': CLIENT_ID,
  };
  if (inMemoryToken) {
    headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  try {
    void fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ clientId: CLIENT_ID }),
      keepalive: true,
    });
  } catch {
    // Ignore errors during page unload
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const fullUrl = url.startsWith('/') ? `${BASE_PATH}${url}` : url;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Id': CLIENT_ID,
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (inMemoryToken) {
    headers.Authorization = `Bearer ${inMemoryToken}`;
  }

  const res = await fetch(fullUrl, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '请求失败，请稍后重试');
  }
  return data as T;
}

export const api = {
  bootstrap(): Promise<BootstrapResponse> {
    return request<BootstrapResponse>('/api/bootstrap');
  },

  login(account: string, password: string): Promise<{ token: string; user: PublicPlayer }> {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password }),
    });
  },

  quickLogin(playerIdOrAccount: string): Promise<{ token: string; user: PublicPlayer }> {
    return request('/api/auth/quick-login', {
      method: 'POST',
      body: JSON.stringify({ playerId: playerIdOrAccount }),
    });
  },

  register(
    nickname: string,
    account: string,
    password: string,
  ): Promise<{ token: string; user: PublicPlayer }> {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nickname, account, password }),
    });
  },

  logout(): Promise<{ ok: boolean }> {
    return request('/api/auth/logout', { method: 'POST' });
  },

  updateProfile(payload: {
    account?: string;
    password?: string;
    jerseyNumber?: string;
    avatarBg?: string;
  }): Promise<BootstrapResponse> {
    return request('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  ratePlayer(
    playerId: string,
    stars: number,
    comment?: string,
    anonymous = false,
  ): Promise<BootstrapResponse> {
    return request(`/api/players/${encodeURIComponent(playerId)}/rate`, {
      method: 'POST',
      body: JSON.stringify({ stars, comment, anonymous }),
    });
  },

  addComment(
    playerId: string,
    content: string,
    anonymous = false,
  ): Promise<BootstrapResponse> {
    return request(`/api/players/${encodeURIComponent(playerId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, anonymous }),
    });
  },

  toggleCommentLike(commentId: string): Promise<BootstrapResponse> {
    return request(`/api/comments/${encodeURIComponent(commentId)}/like`, {
      method: 'POST',
    });
  },

  addReply(
    commentId: string,
    content: string,
    replyToUserId?: string,
    replyToNickname?: string,
    anonymous = false,
  ): Promise<BootstrapResponse> {
    return request(`/api/comments/${encodeURIComponent(commentId)}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content, replyToUserId, replyToNickname, anonymous }),
    });
  },

  toggleReplyLike(replyId: string): Promise<BootstrapResponse> {
    return request(`/api/replies/${encodeURIComponent(replyId)}/like`, {
      method: 'POST',
    });
  },

  createRoom(payload: {
    title: string;
    courtNote: string;
    mode: RoomMode;
    benchLimit: number;
    scheduledAt?: string;
  }): Promise<BootstrapResponse> {
    return request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  joinRoom(roomId: string, team: RoomTeamSlot, slotIndex?: number): Promise<BootstrapResponse> {
    return request(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      body: JSON.stringify({ team, slotIndex }),
    });
  },

  leaveRoom(roomId: string): Promise<BootstrapResponse> {
    return request(`/api/rooms/${encodeURIComponent(roomId)}/leave`, {
      method: 'POST',
    });
  },

  updateRoomStatus(roomId: string, status: RoomStatus): Promise<BootstrapResponse> {
    return request(`/api/rooms/${encodeURIComponent(roomId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  deleteRoom(roomId: string): Promise<BootstrapResponse> {
    return request(`/api/rooms/${encodeURIComponent(roomId)}`, {
      method: 'DELETE',
    });
  },

  inviteToRoom(
    roomId: string,
    targetPlayerId: string,
    team: RoomTeamSlot,
  ): Promise<BootstrapResponse> {
    return request(`/api/rooms/${encodeURIComponent(roomId)}/invite`, {
      method: 'POST',
      body: JSON.stringify({ targetPlayerId, team }),
    });
  },

  respondToRoomInvite(
    roomId: string,
    inviteId: string,
    action: 'accept' | 'decline',
  ): Promise<BootstrapResponse> {
    return request(
      `/api/rooms/${encodeURIComponent(roomId)}/invites/${encodeURIComponent(inviteId)}/respond`,
      {
        method: 'POST',
        body: JSON.stringify({ action }),
      },
    );
  },

  cancelRoomInvite(roomId: string, inviteId: string): Promise<BootstrapResponse> {
    return request(
      `/api/rooms/${encodeURIComponent(roomId)}/invites/${encodeURIComponent(inviteId)}`,
      {
        method: 'DELETE',
      },
    );
  },
};
