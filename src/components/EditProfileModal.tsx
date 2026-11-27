import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { api } from '../lib/api';
import { AVATAR_BG_PALETTE, formatJerseyNumber } from '../shared/scoring';
import type { BootstrapResponse, PublicPlayer } from '../shared/types';
import { AVATAR_BG_CLASS_MAP, getDefaultAvatarBgHex, PlayerAvatar } from './PlayerAvatar';

interface EditProfileModalProps {
  open: boolean;
  currentUser: PublicPlayer;
  onClose: () => void;
  onDataUpdate: (next: BootstrapResponse) => void;
  onToast: (msg: string) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  open,
  currentUser,
  onClose,
  onDataUpdate,
  onToast,
}) => {
  const [account, setAccount] = useState(currentUser.account);
  const [password, setPassword] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState(currentUser.jerseyNumber);
  const [avatarBg, setAvatarBg] = useState(
    currentUser.avatarBg ?? getDefaultAvatarBgHex(currentUser.nickname, currentUser.jerseyNumber),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAccount(currentUser.account);
      setPassword('');
      setJerseyNumber(currentUser.jerseyNumber);
      setAvatarBg(
        currentUser.avatarBg ??
          getDefaultAvatarBgHex(currentUser.nickname, currentUser.jerseyNumber),
      );
      setError(null);
    }
  }, [open, currentUser]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const next = await api.updateProfile({
        account,
        password: password.trim() ? password : undefined,
        jerseyNumber: formatJerseyNumber(jerseyNumber),
        avatarBg,
      });
      onDataUpdate(next);
      onClose();
      onToast('个人信息与球衣头像已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="修改个人信息"
    >
      <div className="w-full max-w-[460px] max-h-[90dvh] bg-white rounded-t-3xl sm:rounded-2xl px-5 pt-3 pb-7 shadow-2xl flex flex-col">
        <div className="w-10 h-1 bg-[#D8DCE2] rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-lg font-bold text-[#141518]">修改个人信息</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭编辑资料弹窗"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-[#6B7280] hover:text-[#141518]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-0.5 flex-1">
          {/* Live Jersey Avatar Preview */}
          <div className="rounded-2xl bg-[#FAFBFD] border border-[#E6E8EC] p-3.5 flex items-center gap-3.5">
            <PlayerAvatar
              nickname={currentUser.nickname}
              jerseyNumber={jerseyNumber.trim() || currentUser.jerseyNumber}
              avatarBg={avatarBg}
              size="lg"
            />
            <div className="min-w-0">
              <p className="text-base font-bold text-[#141518] truncate">
                {currentUser.nickname}
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5">
                头像数字即球衣号码，支持自由切换球衣配色
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[#FEF2F2] text-[#B91C1C] text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Jersey Number */}
          <div>
            <label
              htmlFor="edit-jersey-number"
              className="block text-xs font-semibold text-[#4B5563] mb-1.5"
            >
              球衣号码（00 - 99，个位数自动补 0）
            </label>
            <input
              id="edit-jersey-number"
              type="text"
              inputMode="numeric"
              pattern="\d{1,2}"
              maxLength={2}
              required
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="如：00、01、08、23"
              className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm font-score font-bold text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
            />
          </div>

          {/* Avatar Background Color Swatches */}
          <div>
            <span className="block text-xs font-semibold text-[#4B5563] mb-2">
              头像背景色
            </span>
            <div className="grid grid-cols-6 gap-2.5" role="radiogroup" aria-label="选择头像背景色">
              {AVATAR_BG_PALETTE.map((option) => {
                const selected = avatarBg.toUpperCase() === option.hex.toUpperCase();
                const bgClass = AVATAR_BG_CLASS_MAP[option.hex] ?? 'bg-[#1D2432] text-white';
                return (
                  <button
                    key={option.hex}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.label}
                    title={option.label}
                    onClick={() => setAvatarBg(option.hex)}
                    className={`h-10 rounded-xl ${bgClass} flex items-center justify-center transition-transform active:scale-95 ${
                      selected
                        ? 'ring-2 ring-offset-2 ring-[#C60100] scale-[1.03]'
                        : 'opacity-90 hover:opacity-100'
                    }`}
                  >
                    {selected && <Check className="w-4 h-4 text-white stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account */}
          <div>
            <label
              htmlFor="edit-account"
              className="block text-xs font-semibold text-[#4B5563] mb-1.5"
            >
              登录账号（不可与他人重复）
            </label>
            <input
              id="edit-account"
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              maxLength={20}
              required
              autoCapitalize="characters"
              placeholder="2-20位字母、数字或下划线"
              className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
            />
          </div>

          {/* Optional Password Change */}
          <div>
            <label
              htmlFor="edit-password"
              className="block text-xs font-semibold text-[#4B5563] mb-1.5"
            >
              修改密码（留空则不修改）
            </label>
            <input
              id="edit-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={32}
              placeholder="输入 4-32 位新密码"
              className="w-full h-11 px-3.5 rounded-xl border border-[#DCE0E6] bg-[#FAFBFD] text-sm text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-xl bg-[#C60100] hover:bg-[#A00100] text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
        </form>
      </div>
    </div>
  );
};
