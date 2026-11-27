import React, { useEffect, useMemo, useState } from 'react';
import { X, AlertCircle, Search } from 'lucide-react';
import { api, setAuthToken } from '../lib/api';
import type { PublicPlayer } from '../shared/types';
import { PlayerAvatar } from './PlayerAvatar';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register';
  players: PublicPlayer[];
  onClose: () => void;
  onSuccess: (user: PublicPlayer, message: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  initialMode = 'login',
  players,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [nickname, setNickname] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submittingRegister, setSubmittingRegister] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setSearchQuery('');
      setError(null);
    }
  }, [open, initialMode]);

  const sortedPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const ordered = [...players].sort((a, b) => a.account.localeCompare(b.account));
    if (!q) return ordered;
    return ordered.filter(
      (p) =>
        p.nickname.toLowerCase().includes(q) ||
        p.account.toLowerCase().includes(q) ||
        p.jerseyNumber.includes(q),
    );
  }, [players, searchQuery]);

  if (!open) return null;

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError(null);
  };

  const handleQuickLogin = async (player: PublicPlayer) => {
    setError(null);
    setSubmittingId(player.id);
    try {
      const res = await api.quickLogin(player.id);
      setAuthToken(res.token);
      onSuccess(res.user, `已切换为 ${res.user.nickname}（${res.user.account}）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmittingRegister(true);

    try {
      const res = await api.register(nickname, account, password);
      setAuthToken(res.token);
      onSuccess(res.user, `注册成功，${res.user.nickname} 已加入球员大名单`);
      setNickname('');
      setAccount('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请重试');
    } finally {
      setSubmittingRegister(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'login' ? '球手登录' : '注册并加入球员榜'}
    >
      <div className="w-full max-w-[460px] max-h-[86dvh] bg-white rounded-t-3xl sm:rounded-2xl px-5 pt-3 pb-6 shadow-2xl flex flex-col">
        <div className="w-10 h-1 bg-[#D8DCE2] rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-lg font-bold text-[#141518]">
            {mode === 'login' ? '选择你的球手身份' : '新球手注册'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭登录弹窗"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-[#6B7280] hover:text-[#141518] rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-[#F2F4F7] rounded-xl mb-4 shrink-0">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`min-h-[40px] text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              mode === 'login'
                ? 'bg-white text-[#C60100] shadow-xs'
                : 'text-[#6B7280]'
            }`}
          >
            点选登录
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`min-h-[40px] text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              mode === 'register'
                ? 'bg-white text-[#C60100] shadow-xs'
                : 'text-[#6B7280]'
            }`}
          >
            注册成球员
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 px-3 py-2.5 mb-3 rounded-xl bg-[#FEF2F2] text-[#B91C1C] text-xs shrink-0"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'login' ? (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="relative mb-3 shrink-0">
              <Search
                className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <label htmlFor="quick-login-search" className="sr-only">
                搜索已注册球手
              </label>
              <input
                id="quick-login-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="快速筛选昵称或账号（如 科比 / YY08）"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
              />
            </div>

            <div
              className="grid grid-cols-2 gap-2 overflow-y-auto pr-0.5 flex-1 min-h-[200px]"
              aria-label="已注册球手快捷登录列表"
            >
              {sortedPlayers.length === 0 ? (
                <div className="col-span-2 py-10 text-center text-xs text-[#9CA3AF]">
                  未找到匹配的球手，可切换到「注册成球员」新建账号
                </div>
              ) : (
                sortedPlayers.map((player) => {
                  const busy = submittingId === player.id;
                  return (
                    <button
                      key={player.id}
                      type="button"
                      disabled={submittingId !== null}
                      onClick={() => handleQuickLogin(player)}
                      aria-label={`一键登录 ${player.nickname} ${player.account}`}
                      className="min-h-[54px] px-2.5 py-2 rounded-xl border border-[#E6E8EC] bg-[#FAFBFD] hover:border-[#C60100] hover:bg-[#FEF2F2]/40 active:scale-[0.98] transition-all flex items-center gap-2.5 text-left disabled:opacity-60"
                    >
                      <PlayerAvatar
                        nickname={player.nickname}
                        jerseyNumber={player.jerseyNumber}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#141518] truncate">
                          {player.nickname}
                        </p>
                        <p className="text-[11px] text-[#6B7280] font-score">
                          {busy ? '登录中...' : player.account}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <p className="text-[11px] text-[#6B7280] mt-3 text-center shrink-0">
              点击自己的球手卡片即可直接登录，无需输入密码
            </p>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label htmlFor="auth-nickname" className="block text-xs font-medium text-[#4B5563] mb-1.5">
                球场昵称（不可重复）
              </label>
              <input
                id="auth-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="例如：园区库里"
                maxLength={16}
                required
                className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="auth-account" className="block text-xs font-medium text-[#4B5563] mb-1.5">
                球手账号（不可重复）
              </label>
              <input
                id="auth-account"
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="字母或数字，如 YY18"
                maxLength={20}
                required
                autoCapitalize="characters"
                className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-[#4B5563] mb-1.5">
                登录密码
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="设置 4-32 位密码（如 123456）"
                maxLength={32}
                required
                className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submittingRegister}
              className="w-full h-12 rounded-xl bg-[#C60100] hover:bg-[#A00100] active:scale-[0.99] text-white font-semibold text-sm transition-all disabled:opacity-60"
            >
              {submittingRegister ? '提交中...' : '注册并加入园区球员'}
            </button>

            <p className="text-[11px] text-[#6B7280] pt-1 leading-relaxed text-center">
              注册成功后将自动录入球员评分名单，以后可直接点选登录
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
