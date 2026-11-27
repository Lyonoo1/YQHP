import type {
  BootstrapResponse,
  PublicPlayer,
  RoomMode,
  RoomStatus,
  RoomTeamSlot,
} from '../shared/types';

// Keep auth token strictly in JS/React memory (never localStorage/sessionStorage)
let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '');

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const fullUrl = url.startsWith('/') ? `${BASE_PATH}${url}` : url;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

  ratePlayer(playerId: string, stars: number, comment?: string): Promise<BootstrapResponse> {
    return request(`/api/players/${encodeURIComponent(playerId)}/rate`, {
      method: 'POST',
      body: JSON.stringify({ stars, comment }),
    });
  },

  addComment(playerId: string, content: string): Promise<BootstrapResponse> {
    return request(`/api/players/${encodeURIComponent(playerId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
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
  ): Promise<BootstrapResponse> {
    return request(`/api/comments/${encodeURIComponent(commentId)}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content, replyToUserId, replyToNickname }),
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
};
