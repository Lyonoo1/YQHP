import React, { useEffect, useState } from 'react';
import { X, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { api, setAuthToken } from '../lib/api';
import type { PublicPlayer } from '../shared/types';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register';
  defaultAccount?: string;
  onClose: () => void;
  onSuccess: (user: PublicPlayer, message: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  initialMode = 'login',
  defaultAccount = '',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loginAccount, setLoginAccount] = useState(defaultAccount);
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [nickname, setNickname] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setLoginAccount(defaultAccount);
      setLoginPassword('');
      setShowLoginPassword(false);
      setPassword('');
      setConfirmPassword('');
      setShowRegisterPassword(false);
      setError(null);
    }
  }, [open, initialMode, defaultAccount]);

  if (!open) return null;

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanAccount = loginAccount.trim();
    if (!cleanAccount || !loginPassword) {
      setError('请输入本人账号和密码');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.login(cleanAccount, loginPassword);
      setAuthToken(res.token);
      setLoginPassword('');
      onSuccess(res.user, `欢迎回来，${res.user.nickname}（${res.user.account}）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号或密码');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致，请重新确认');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.register(nickname, account, password);
      setAuthToken(res.token);
      onSuccess(res.user, `注册成功，${res.user.nickname} 已加入球员大名单`);
      setNickname('');
      setAccount('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'login' ? '球手账号密码登录' : '注册并加入球员榜'}
    >
      <div className="w-full max-w-[460px] max-h-[86dvh] bg-white rounded-t-3xl sm:rounded-2xl px-5 pt-3 pb-6 shadow-2xl flex flex-col">
        <div className="w-10 h-1 bg-[#D8DCE2] rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-lg font-bold text-[#141518]">
            {mode === 'login' ? '球手登录' : '新球手注册'}
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
            账号登录
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
          <form onSubmit={handleLogin} className="space-y-3.5 overflow-y-auto pr-0.5">
            <div>
              <label
                htmlFor="auth-login-account"
                className="block text-xs font-medium text-[#4B5563] mb-1.5"
              >
                球手账号
              </label>
              <input
                id="auth-login-account"
                type="text"
                value={loginAccount}
                onChange={(e) => setLoginAccount(e.target.value)}
                placeholder="输入本人账号，如 YY08"
                maxLength={20}
                required
                autoComplete="username"
                autoCapitalize="characters"
                className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="auth-login-password"
                className="block text-xs font-medium text-[#4B5563] mb-1.5"
              >
                登录密码
              </label>
              <div className="relative">
                <input
                  id="auth-login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="请输入本人登录密码"
                  maxLength={32}
                  required
                  autoComplete="current-password"
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((v) => !v)}
                  aria-label={showLoginPassword ? '隐藏密码' : '显示密码'}
                  className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-[#6B7280] hover:text-[#141518]"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-[#C60100] hover:bg-[#A00100] active:scale-[0.99] text-white font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? '验证中...' : '登录'}</span>
            </button>

            <p className="text-[11px] text-[#6B7280] pt-1 leading-relaxed text-center">
              请使用本人账号和密码登录；登录后可在「我的 → 编辑」修改个人密码
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5 overflow-y-auto pr-0.5">
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
                placeholder="字母、数字或下划线，如 YY19"
                maxLength={20}
                required
                autoComplete="username"
                autoCapitalize="characters"
                className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-[#4B5563] mb-1.5">
                登录密码
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showRegisterPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="设置 4-32 位个人专属密码"
                  maxLength={32}
                  required
                  autoComplete="new-password"
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword((v) => !v)}
                  aria-label={showRegisterPassword ? '隐藏密码' : '显示密码'}
                  className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-[#6B7280] hover:text-[#141518]"
                >
                  {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-xs font-medium text-[#4B5563] mb-1.5"
              >
                确认密码
              </label>
              <input
                id="auth-confirm-password"
                type={showRegisterPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入登录密码"
                maxLength={32}
                required
                autoComplete="new-password"
                className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-[#C60100] hover:bg-[#A00100] active:scale-[0.99] text-white font-semibold text-sm transition-all disabled:opacity-60"
            >
              {submitting ? '提交中...' : '注册并加入园区球员'}
            </button>

            <p className="text-[11px] text-[#6B7280] pt-1 leading-relaxed text-center">
              注册成功后将自动录入球员评分名单，以后请使用本人账号密码登录
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
