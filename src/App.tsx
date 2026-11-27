import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Star, Swords, User } from 'lucide-react';
import { api, setAuthToken } from './lib/api';
import type { BootstrapResponse, PublicPlayer } from './shared/types';
import { AuthModal } from './components/AuthModal';
import { LeaderboardView } from './components/LeaderboardView';
import { PlayerDetailSheet } from './components/PlayerDetailSheet';
import { ProfileView } from './components/ProfileView';
import { RatingFeedView } from './components/RatingFeedView';
import { RoomsView } from './components/RoomsView';

type TabKey = 'ratings' | 'leaderboard' | 'rooms' | 'profile';

const EMBLEM_URL = '/src/assets/images/hupu_basketball_emblem_1795745583644.jpg';

function formatCountdown(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(clamped / 3600)).padStart(2, '0');
  const mins = String(Math.floor((clamped % 3600) / 60)).padStart(2, '0');
  const secs = String(clamped % 60).padStart(2, '0');
  return `${hours}:${mins}:${secs}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('ratings');
  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [toast, setToast] = useState<string | null>(null);
  const [msLeft, setMsLeft] = useState<number>(0);
  const [emblemFailed, setEmblemFailed] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2600);
  }, []);

  const fetchBootstrap = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null);
      const payload = await api.bootstrap();
      setData(payload);
      setMsLeft(payload.msUntilReset);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : '加载园区数据失败');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap(false);
    const poll = window.setInterval(() => {
      fetchBootstrap(true);
    }, 8000);
    return () => window.clearInterval(poll);
  }, [fetchBootstrap]);

  // Live 00:00 countdown ticker
  useEffect(() => {
    const tick = window.setInterval(() => {
      setMsLeft((prev) => {
        if (prev <= 1000) {
          fetchBootstrap(true);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [fetchBootstrap]);

  const openAuth = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthInitialMode(mode);
    setAuthModalOpen(true);
  }, []);

  const handleAuthSuccess = useCallback(
    async (_user: PublicPlayer, message: string) => {
      setAuthModalOpen(false);
      await fetchBootstrap(true);
      showToast(message);
    },
    [fetchBootstrap, showToast],
  );

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network error on logout
    }
    setAuthToken(null);
    await fetchBootstrap(true);
    showToast('已退出登录');
  }, [fetchBootstrap, showToast]);

  const handleDataUpdate = useCallback((next: BootstrapResponse) => {
    setData(next);
    setMsLeft(next.msUntilReset);
  }, []);

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId || !data) return null;
    return data.players.find((p) => p.id === selectedPlayerId) ?? null;
  }, [selectedPlayerId, data]);

  const countdownText = formatCountdown(msLeft);

  return (
    <div className="min-h-dvh w-full bg-[#E9ECEF] flex justify-center">
      {/* Mobile-First App Shell (Edge-to-Edge on all phones, clean centered phone viewport on desktop) */}
      <div className="w-full max-w-[480px] min-h-dvh bg-[#F4F5F7] flex flex-col relative shadow-xl">
        {/* Compact Sticky Top Bar (52px) */}
        <header className="sticky top-0 z-30 h-[52px] bg-[#C60100] text-white px-4 flex items-center justify-between gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('ratings')}
            className="flex items-center gap-2 min-h-[44px] -ml-1 whitespace-nowrap shrink-0"
          >
            {!emblemFailed ? (
              <img
                src={EMBLEM_URL}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setEmblemFailed(true)}
                className="w-7 h-7 rounded-lg object-cover border border-white/20"
              />
            ) : (
              <span className="w-7 h-7 rounded-lg bg-[#141518] font-score text-sm font-extrabold flex items-center justify-center">
                HP
              </span>
            )}
            <span className="text-[17px] font-bold tracking-tight">园区虎扑</span>
          </button>

          <div className="flex items-center shrink-0">
            {data?.currentUser ? (
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold whitespace-nowrap transition-colors"
              >
                {data.currentUser.nickname}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="h-8 px-3 rounded-lg bg-white text-[#C60100] text-xs font-bold whitespace-nowrap active:scale-95 transition-transform"
              >
                登录 / 注册
              </button>
            )}
          </div>
        </header>

        {/* Main Scrollable Viewport */}
        <main className="flex-1 pb-20">
          {loading ? (
            <div className="px-4 py-12 space-y-3">
              <div className="h-32 rounded-2xl bg-[#E5E7EB] animate-pulse" />
              <div className="h-20 rounded-2xl bg-[#E5E7EB] animate-pulse" />
              <div className="h-20 rounded-2xl bg-[#E5E7EB] animate-pulse" />
            </div>
          ) : error || !data ? (
            <div className="px-4 py-16 text-center">
              <p className="text-sm font-semibold text-[#141518]">
                {error ?? '数据加载异常'}
              </p>
              <button
                type="button"
                onClick={() => fetchBootstrap(false)}
                className="mt-4 min-h-[44px] px-5 rounded-xl bg-[#C60100] text-white text-sm font-semibold"
              >
                重新加载
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'ratings' && (
                <RatingFeedView
                  players={data.players}
                  currentDate={data.currentDate}
                  countdownText={countdownText}
                  onSelectPlayer={(id) => setSelectedPlayerId(id)}
                />
              )}

              {activeTab === 'leaderboard' && (
                <LeaderboardView
                  players={data.players}
                  currentDate={data.currentDate}
                  onSelectPlayer={(id) => setSelectedPlayerId(id)}
                />
              )}

              {activeTab === 'rooms' && (
                <RoomsView
                  rooms={data.rooms}
                  currentUser={data.currentUser}
                  onRequireAuth={() => openAuth('login')}
                  onDataUpdate={handleDataUpdate}
                  onToast={showToast}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileView
                  currentUser={data.currentUser}
                  players={data.players}
                  rooms={data.rooms}
                  countdownText={countdownText}
                  onOpenAuth={(m) => openAuth(m)}
                  onLogout={handleLogout}
                  onSelectPlayer={(id) => setSelectedPlayerId(id)}
                />
              )}
            </>
          )}
        </main>

        {/* Fixed Bottom Mobile Tab Bar (56px + safe-area) */}
        <nav
          aria-label="主导航"
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-30 bg-white/95 backdrop-blur-md border-t border-[#E6E8EC] pb-safe"
        >
          <div className="grid grid-cols-4 h-14">
            <button
              type="button"
              onClick={() => setActiveTab('ratings')}
              aria-current={activeTab === 'ratings' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeTab === 'ratings' ? 'text-[#C60100]' : 'text-[#6B7280]'
              }`}
            >
              <Star
                className={`w-5 h-5 ${activeTab === 'ratings' ? 'fill-[#C60100]' : ''}`}
                aria-hidden="true"
              />
              <span className="text-[11px] font-semibold leading-none">评分</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              aria-current={activeTab === 'leaderboard' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeTab === 'leaderboard' ? 'text-[#C60100]' : 'text-[#6B7280]'
              }`}
            >
              <Flame
                className={`w-5 h-5 ${activeTab === 'leaderboard' ? 'fill-[#C60100]' : ''}`}
                aria-hidden="true"
              />
              <span className="text-[11px] font-semibold leading-none">热度榜</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rooms')}
              aria-current={activeTab === 'rooms' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeTab === 'rooms' ? 'text-[#C60100]' : 'text-[#6B7280]'
              }`}
            >
              <Swords className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] font-semibold leading-none">约球房</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              aria-current={activeTab === 'profile' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeTab === 'profile' ? 'text-[#C60100]' : 'text-[#6B7280]'
              }`}
            >
              <User className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] font-semibold leading-none">我的</span>
            </button>
          </div>
        </nav>

        {/* Player Detail Rating & Comments Sheet */}
        {selectedPlayer && data && (
          <PlayerDetailSheet
            player={selectedPlayer}
            comments={data.commentsByPlayer[selectedPlayer.id] ?? []}
            currentUser={data.currentUser}
            onClose={() => setSelectedPlayerId(null)}
            onRequireAuth={() => openAuth('login')}
            onDataUpdate={handleDataUpdate}
            onToast={showToast}
          />
        )}

        {/* Auth Modal */}
        <AuthModal
          open={authModalOpen}
          initialMode={authInitialMode}
          players={data?.players ?? []}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
        />

        {/* Floating Toast Feedback */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[340px] px-4 py-2.5 rounded-xl bg-[#141518]/92 text-white text-xs font-medium shadow-lg text-center"
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
