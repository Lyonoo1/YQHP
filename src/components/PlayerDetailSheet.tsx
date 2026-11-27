import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Lightbulb,
  Star,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  sortPlayerComments,
  starsToHupuScore,
  type CommentSortMode,
} from '../shared/scoring';
import type {
  BootstrapResponse,
  CommentRecord,
  PlayerSummary,
  PublicPlayer,
} from '../shared/types';
import { PlayerAvatar } from './PlayerAvatar';
import { HupuInlineStarRater, StarDisplay } from './StarRating';

interface PlayerDetailSheetProps {
  player: PlayerSummary;
  players: PlayerSummary[];
  comments: CommentRecord[];
  currentUser: PublicPlayer | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onDataUpdate: (next: BootstrapResponse) => void;
  onToast: (msg: string) => void;
}

function formatHupuTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hh}:${mm}`;
}

export const PlayerDetailSheet: React.FC<PlayerDetailSheetProps> = ({
  player,
  players,
  comments,
  currentUser,
  onClose,
  onRequireAuth,
  onDataUpdate,
  onToast,
}) => {
  const [sortBy, setSortBy] = useState<CommentSortMode>('bright');
  const [submittingRate, setSubmittingRate] = useState(false);

  // Sticky bottom composer state (handles both top-level comments & nested replies)
  const [composerText, setComposerText] = useState('');
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    commentId: string;
    replyToUserId?: string;
    replyToNickname: string;
  } | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setReplyTarget(null);
    setComposerText('');
    setExpandedThreads({});
  }, [player.id]);

  const playersById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );

  const sortedComments = useMemo(
    () => sortPlayerComments(comments, sortBy),
    [comments, sortBy],
  );

  const handleInstantRate = async (stars: number) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSubmittingRate(true);
    try {
      // Ratings are strictly non-anonymous
      const nextData = await api.ratePlayer(player.id, stars, undefined, false);
      onDataUpdate(nextData);
      onToast(`已给 ${player.nickname} 打出 ${starsToHupuScore(stars)} 分`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : '打分失败');
    } finally {
      setSubmittingRate(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      const next = await api.toggleCommentLike(commentId);
      onDataUpdate(next);
    } catch (err) {
      onToast(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleLikeReply = async (replyId: string) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      const next = await api.toggleReplyLike(replyId);
      onDataUpdate(next);
    } catch (err) {
      onToast(err instanceof Error ? err.message : '操作失败');
    }
  };

  const startReply = (commentId: string, toUserId: string | undefined, toNickname: string) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setReplyTarget({
      commentId,
      replyToUserId: toUserId,
      replyToNickname: toNickname,
    });
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
  };

  const toggleThreadExpanded = (commentId: string) => {
    setExpandedThreads((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const handleSubmitComposer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    const clean = composerText.trim();
    if (!clean) {
      onToast(replyTarget ? '请输入回复内容' : '请输入评论内容');
      return;
    }

    setSubmittingComment(true);
    try {
      if (replyTarget) {
        const next = await api.addReply(
          replyTarget.commentId,
          clean,
          replyTarget.replyToUserId,
          replyTarget.replyToNickname,
          commentAnonymous,
        );
        onDataUpdate(next);
        setExpandedThreads((prev) => ({ ...prev, [replyTarget.commentId]: true }));
        onToast(
          commentAnonymous
            ? `已匿名回复 ${replyTarget.replyToNickname}`
            : `已回复 ${replyTarget.replyToNickname}`,
        );
        setReplyTarget(null);
      } else {
        const next = await api.addComment(player.id, clean, commentAnonymous);
        onDataUpdate(next);
        onToast(commentAnonymous ? '匿名评论已发布' : '评论已发布');
      }
      setComposerText('');
    } catch (err) {
      onToast(err instanceof Error ? err.message : '发布失败');
    } finally {
      setSubmittingComment(false);
    }
  };

  const renderCommentAvatar = (
    authorId: string,
    authorNickname: string,
    anonymous: boolean | undefined,
    size: 'xs' | 'sm',
  ) => {
    if (anonymous) {
      const boxClass = size === 'xs' ? 'w-6 h-6' : 'w-9 h-9';
      const iconClass = size === 'xs' ? 'w-3 h-3' : 'w-4 h-4';
      return (
        <div
          aria-hidden="true"
          className={`${boxClass} rounded-full bg-[#332E2B] text-white/90 flex items-center justify-center shrink-0`}
        >
          <EyeOff className={iconClass} />
        </div>
      );
    }
    const authorPlayer = playersById.get(authorId);
    return (
      <PlayerAvatar
        nickname={authorPlayer?.nickname ?? authorNickname}
        jerseyNumber={authorPlayer?.jerseyNumber ?? '00'}
        avatarBg={authorPlayer?.avatarBg}
        size={size}
        shape="circle"
      />
    );
  };

  const sortOptions: { key: CommentSortMode; label: string }[] = [
    { key: 'bright', label: '最亮' },
    { key: 'latest', label: '最晚' },
    { key: 'earliest', label: '最早' },
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex justify-center bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label={`${player.nickname} 虎扑评分详情`}
    >
      <div className="w-full max-w-[480px] h-dvh bg-white flex flex-col overflow-hidden">
        {/* Compact Sticky Detail Header (48px) */}
        <header className="h-12 shrink-0 bg-white border-b border-[#F0F2F5] px-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="返回球员列表"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#141518]"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <PlayerAvatar
              nickname={player.nickname}
              jerseyNumber={player.jerseyNumber}
              avatarBg={player.avatarBg}
              size="xs"
              shape="circle"
            />
            <span className="text-[15px] font-bold text-[#141518] truncate">
              {player.nickname}
            </span>
            <span className="text-xs text-[#6B7280] font-score shrink-0">
              #{player.jerseyNumber}
            </span>
          </div>

          <div className="min-w-[56px] pr-2 text-right text-[11px] text-[#9CA3AF] tabular-nums shrink-0">
            热度 {player.heatScore}
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-white">
          {/* Hupu-Style Unified Scoreboard + Instant Rating Card */}
          <section className="px-4 pt-3 pb-4 bg-white">
            <div className="rounded-2xl bg-[#F8F9FB] border border-[#ECEEF2] px-4 py-3.5">
              {/* Top Row inside Rating Card */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-[15px] font-extrabold tracking-tight text-[#C60100] italic">
                    园区评分
                  </span>
                  <span className="text-xs text-[#6B7280] truncate">
                    · {player.nickname}
                  </span>
                </div>
                <span className="text-xs font-semibold text-[#141518] shrink-0">
                  分布
                </span>
              </div>

              {/* Middle Row: Big Score (Left) + Compact 5-Star Histogram (Right) */}
              <div className="flex items-center gap-4">
                <div className="w-[82px] shrink-0 flex flex-col justify-center">
                  <div
                    className={`font-score text-[38px] font-extrabold leading-none tracking-tight tabular-nums ${
                      player.averageScore !== null ? 'text-[#C60100]' : 'text-[#9CA3AF]'
                    }`}
                  >
                    {player.averageScore !== null ? player.averageScore.toFixed(1) : '--'}
                  </div>
                  <p className="text-[11px] text-[#6B7280] mt-1.5 tabular-nums whitespace-nowrap">
                    {player.ratingCount} 人评分
                  </p>
                </div>

                {/* 5-Row Mini Star Distribution */}
                <div className="flex-1 min-w-0 space-y-1">
                  {player.starDistribution.map((row) => (
                    <div key={row.stars} className="flex items-center gap-2">
                      <div
                        className="w-[46px] flex items-center justify-end gap-[1px] shrink-0"
                        aria-hidden="true"
                      >
                        {Array.from({ length: row.stars }).map((_, idx) => (
                          <Star
                            key={idx}
                            className="w-2 h-2 fill-[#B8BEC8] text-[#B8BEC8]"
                          />
                        ))}
                      </div>
                      <div className="flex-1 h-[5px] bg-[#E8EBEF] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#E8940C] rounded-full transition-all duration-300"
                          style={{ width: `${row.percent}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[11px] text-[#6B7280] tabular-nums shrink-0">
                        {row.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Instant Rating Strip (Strictly Non-Anonymous) */}
              <div className="mt-3 pt-2.5 border-t border-[#E6E8EC]/80 flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  {player.myStars !== null ? (
                    <>
                      <span className="text-[13px] font-medium text-[#4B5563]">
                        已评分
                      </span>
                      <span className="font-score text-sm font-extrabold text-[#C60100] tabular-nums">
                        {starsToHupuScore(player.myStars)}分
                      </span>
                    </>
                  ) : (
                    <span className="text-[13px] font-medium text-[#6B7280]">
                      {currentUser ? '点击星星打分' : '登录后点击打分'}
                    </span>
                  )}
                </div>

                <HupuInlineStarRater
                  value={player.myStars}
                  onCommit={handleInstantRate}
                  disabled={submittingRate}
                  onRequireAuth={!currentUser ? onRequireAuth : undefined}
                />
              </div>
            </div>
          </section>

          {/* Clean Section Divider */}
          <div className="h-2 bg-[#F4F5F7]" aria-hidden="true" />

          {/* Hupu-Style Bright Replies Section */}
          <section className="px-4 pt-4 pb-6 bg-white">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-[17px] font-bold text-[#141518] tabular-nums">
                亮回复
                <span className="text-sm font-medium text-[#6B7280] ml-1">
                  /{comments.length}
                </span>
              </h2>

              <div
                role="tablist"
                aria-label="评论排序方式"
                className="inline-flex items-center bg-[#F4F5F7] p-0.5 rounded-md border border-[#ECEEF2]"
              >
                {sortOptions.map((opt) => {
                  const active = sortBy === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSortBy(opt.key)}
                      className={`px-2.5 py-1 text-xs rounded-[4px] transition-colors ${
                        active
                          ? 'bg-white text-[#141518] font-semibold shadow-2xs'
                          : 'text-[#6B7280] font-medium hover:text-[#141518]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {sortedComments.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#9CA3AF]">
                今日还没有锐评，快来发出第一条亮回复吧！
              </div>
            ) : (
              <div className="divide-y divide-[#F2F4F7]">
                {sortedComments.map((c) => {
                  const isLiked = Boolean(currentUser && c.likedBy.includes(currentUser.id));
                  const isExpanded = Boolean(expandedThreads[c.id]);
                  const visibleReplies = isExpanded ? c.replies : c.replies.slice(0, 1);

                  return (
                    <article key={c.id} className="py-4 first:pt-1">
                      <div className="flex items-start gap-2.5">
                        {renderCommentAvatar(c.authorId, c.authorNickname, c.anonymous, 'sm')}

                        <div className="flex-1 min-w-0">
                          {/* Author Nickname */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[13px] font-medium text-[#6B7280] truncate">
                              {c.authorNickname}
                            </span>
                          </div>

                          {/* Author Star Rating Row (Hidden for anonymous comments) */}
                          {!c.anonymous && c.authorStars !== null && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <StarDisplay score={starsToHupuScore(c.authorStars)} size="xs" />
                              <span className="text-[11px] font-score font-bold text-[#E8940C] tabular-nums">
                                {starsToHupuScore(c.authorStars)}分
                              </span>
                            </div>
                          )}

                          {/* Comment Content */}
                          <p className="mt-2 text-[15px] leading-[1.6] text-[#141518] break-words">
                            {c.content}
                          </p>

                          {/* Meta & Lightbulb Action Row */}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 text-xs">
                              <span className="text-[#9CA3AF] tabular-nums">
                                {formatHupuTime(c.createdAt)}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  startReply(
                                    c.id,
                                    c.anonymous ? undefined : c.authorId,
                                    c.authorNickname,
                                  )
                                }
                                aria-label={`回复 ${c.authorNickname}`}
                                className="py-1 px-1 text-xs font-medium text-[#4B5563] hover:text-[#141518]"
                              >
                                回复
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleLikeComment(c.id)}
                              aria-label={`点亮 ${c.authorNickname} 的评论`}
                              aria-pressed={isLiked}
                              className={`min-h-[32px] px-1.5 inline-flex items-center gap-1 text-xs tabular-nums transition-colors ${
                                isLiked
                                  ? 'text-[#C60100] font-semibold'
                                  : 'text-[#6B7280] hover:text-[#141518]'
                              }`}
                            >
                              <Lightbulb
                                className={`w-4 h-4 ${
                                  isLiked ? 'fill-[#C60100]/15 text-[#C60100]' : ''
                                }`}
                              />
                              <span>{c.likedBy.length}</span>
                            </button>
                          </div>

                          {/* Indented Nested Replies (Hupu Style) */}
                          {c.replies.length > 0 && (
                            <div className="mt-2.5 space-y-3">
                              {visibleReplies.map((rep) => {
                                const repLiked = Boolean(
                                  currentUser && rep.likedBy.includes(currentUser.id),
                                );
                                return (
                                  <div key={rep.id} className="flex items-start gap-2">
                                    {renderCommentAvatar(
                                      rep.authorId,
                                      rep.authorNickname,
                                      rep.anonymous,
                                      'xs',
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1 text-xs min-w-0">
                                        <span className="font-medium text-[#6B7280] truncate">
                                          {rep.authorNickname}
                                        </span>
                                        {rep.replyToNickname && (
                                          <span className="text-[#9CA3AF] truncate">
                                            回复 {rep.replyToNickname}
                                          </span>
                                        )}
                                      </div>

                                      <p className="mt-1 text-[14px] leading-[1.55] text-[#1F2937] break-words">
                                        {rep.content}
                                      </p>

                                      <div className="mt-1.5 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5 text-xs">
                                          <span className="text-[#9CA3AF] tabular-nums">
                                            {formatHupuTime(rep.createdAt)}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              startReply(
                                                c.id,
                                                rep.anonymous ? undefined : rep.authorId,
                                                rep.authorNickname,
                                              )
                                            }
                                            aria-label={`回复 ${rep.authorNickname}`}
                                            className="py-0.5 px-1 text-xs font-medium text-[#4B5563] hover:text-[#141518]"
                                          >
                                            回复
                                          </button>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleLikeReply(rep.id)}
                                          aria-label={`点亮 ${rep.authorNickname} 的回复`}
                                          aria-pressed={repLiked}
                                          className={`min-h-[28px] px-1.5 inline-flex items-center gap-1 text-xs tabular-nums transition-colors ${
                                            repLiked
                                              ? 'text-[#C60100] font-semibold'
                                              : 'text-[#6B7280] hover:text-[#141518]'
                                          }`}
                                        >
                                          <Lightbulb
                                            className={`w-3.5 h-3.5 ${
                                              repLiked ? 'fill-[#C60100]/15 text-[#C60100]' : ''
                                            }`}
                                          />
                                          <span>{rep.likedBy.length}</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {c.replies.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => toggleThreadExpanded(c.id)}
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5563] hover:text-[#141518] py-1"
                                >
                                  <span
                                    className="w-5 h-[1px] bg-[#D1D5DB]"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {isExpanded
                                      ? '收起回复'
                                      : `查看全部 ${c.replies.length} 条回复`}
                                  </span>
                                  <ChevronRight
                                    className={`w-3.5 h-3.5 text-[#9CA3AF] transition-transform ${
                                      isExpanded ? '-rotate-90' : ''
                                    }`}
                                  />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Sticky Bottom Comment / Reply Composer Bar (Hupu Style) */}
        <footer className="shrink-0 bg-white border-t border-[#E6E8EC] px-3 py-2 pb-safe">
          {replyTarget && (
            <div className="mb-1.5 px-2 py-1 rounded-lg bg-[#F4F5F7] flex items-center justify-between gap-2 text-xs">
              <span className="text-[#4B5563] truncate">
                正在回复 <strong className="text-[#141518]">@{replyTarget.replyToNickname}</strong>
              </span>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                aria-label="取消回复"
                className="p-0.5 text-[#6B7280] hover:text-[#141518] shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmitComposer} className="flex items-center gap-2">
            <label htmlFor="hupu-comment-composer" className="sr-only">
              {replyTarget
                ? `回复 ${replyTarget.replyToNickname}`
                : `评论 ${player.nickname}`}
            </label>
            <input
              ref={inputRef}
              id="hupu-comment-composer"
              type="text"
              value={composerText}
              onFocus={() => {
                if (!currentUser) onRequireAuth();
              }}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder={
                replyTarget
                  ? `回复 @${replyTarget.replyToNickname}...`
                  : '用评分表达态度，用评论诠释观点'
              }
              maxLength={240}
              className="flex-1 min-w-0 h-10 px-3.5 rounded-xl bg-[#F4F5F7] border border-transparent focus:border-[#C60100] focus:bg-white text-[13px] text-[#141518] placeholder:text-[#9CA3AF] focus:outline-none"
            />

            <button
              type="button"
              role="switch"
              aria-checked={commentAnonymous}
              aria-label={commentAnonymous ? '已开启匿名评论' : '开启匿名评论'}
              onClick={() => setCommentAnonymous((v) => !v)}
              className={`h-10 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 shrink-0 transition-colors ${
                commentAnonymous
                  ? 'border-[#141518] bg-[#141518] text-white'
                  : 'border-[#E2E5EB] bg-[#F8F9FB] text-[#6B7280] hover:text-[#141518]'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              <span>匿名</span>
            </button>

            <button
              type="submit"
              disabled={submittingComment || !composerText.trim()}
              className="h-10 px-3.5 rounded-xl bg-[#C60100] hover:bg-[#A00100] active:scale-95 text-white text-xs font-semibold shrink-0 transition-all disabled:opacity-45"
            >
              {submittingComment ? '发送中' : '发送'}
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
};
