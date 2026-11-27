import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Heart, MessageCircle, Send } from 'lucide-react';
import { api } from '../lib/api';
import { starsToHupuScore } from '../shared/scoring';
import type {
  BootstrapResponse,
  CommentRecord,
  PlayerSummary,
  PublicPlayer,
} from '../shared/types';
import { PlayerAvatar } from './PlayerAvatar';
import { InteractiveStarRating, StarDisplay } from './StarRating';

interface PlayerDetailSheetProps {
  player: PlayerSummary;
  comments: CommentRecord[];
  currentUser: PublicPlayer | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onDataUpdate: (next: BootstrapResponse) => void;
  onToast: (msg: string) => void;
}

function formatShortTime(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export const PlayerDetailSheet: React.FC<PlayerDetailSheetProps> = ({
  player,
  comments,
  currentUser,
  onClose,
  onRequireAuth,
  onDataUpdate,
  onToast,
}) => {
  const [selectedStars, setSelectedStars] = useState<number>(player.myStars ?? 0);
  const [commentInput, setCommentInput] = useState('');
  const [sortBy, setSortBy] = useState<'hot' | 'latest'>('hot');
  const [submittingRate, setSubmittingRate] = useState(false);

  useEffect(() => {
    setSelectedStars(player.myStars ?? 0);
  }, [player.id, player.myStars]);

  // Reply target state for mutual replying (reply to comment or to a specific reply)
  const [replyTarget, setReplyTarget] = useState<{
    commentId: string;
    replyToUserId: string;
    replyToNickname: string;
  } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const sortedComments = useMemo(() => {
    const copy = [...comments];
    if (sortBy === 'hot') {
      return copy.sort((a, b) => {
        if (b.likedBy.length !== a.likedBy.length) {
          return b.likedBy.length - a.likedBy.length;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
    }
    return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [comments, sortBy]);

  const handleStarChange = (stars: number) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSelectedStars(stars);
  };

  const handleSubmitRatingOrComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }

    const trimmed = commentInput.trim();
    if (selectedStars === 0 && trimmed.length === 0) {
      onToast('请先选择星级打分或输入锐评内容');
      return;
    }

    setSubmittingRate(true);
    try {
      let nextData: BootstrapResponse;
      if (selectedStars > 0) {
        nextData = await api.ratePlayer(player.id, selectedStars, trimmed || undefined);
        onToast(
          trimmed
            ? `已给 ${player.nickname} 打出 ${starsToHupuScore(selectedStars)} 分并发布锐评`
            : `已给 ${player.nickname} 打出 ${starsToHupuScore(selectedStars)} 分`,
        );
      } else {
        nextData = await api.addComment(player.id, trimmed);
        onToast('锐评已发布');
      }
      setCommentInput('');
      onDataUpdate(nextData);
    } catch (err) {
      onToast(err instanceof Error ? err.message : '提交失败');
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
      onToast(err instanceof Error ? err.message : '点赞失败');
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
      onToast(err instanceof Error ? err.message : '点赞失败');
    }
  };

  const openReplyBox = (commentId: string, toUserId: string, toNickname: string) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setReplyTarget({
      commentId,
      replyToUserId: toUserId,
      replyToNickname: toNickname,
    });
    setReplyText('');
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !replyTarget) {
      onRequireAuth();
      return;
    }
    const clean = replyText.trim();
    if (!clean) return;

    setSubmittingReply(true);
    try {
      const next = await api.addReply(
        replyTarget.commentId,
        clean,
        replyTarget.replyToUserId,
        replyTarget.replyToNickname,
      );
      onDataUpdate(next);
      setReplyText('');
      setReplyTarget(null);
      onToast(`已回复 ${replyTarget.replyToNickname}`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : '回复失败');
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-center bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label={`${player.nickname} 虎扑评分详情`}
    >
      <div className="w-full max-w-[480px] h-dvh bg-[#F4F5F7] flex flex-col overflow-hidden">
        {/* Sticky Detail Header (48px) */}
        <header className="h-12 shrink-0 bg-white border-b border-[#E6E8EC] px-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="返回球员列表"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#141518]"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base font-bold text-[#141518] truncate">
              {player.nickname}
            </span>
            <span className="text-xs text-[#6B7280] font-score">
              #{player.jerseyNumber}
            </span>
          </div>
          <div className="w-11" />
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-8">
          {/* Hupu Scoreboard Summary Card */}
          <section className="bg-white px-4 py-5 border-b border-[#E6E8EC]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar
                  nickname={player.nickname}
                  jerseyNumber={player.jerseyNumber}
                  size="lg"
                />
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-[#141518] truncate">
                    {player.nickname}
                  </h1>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    账号 {player.account} · 热度 {player.heatScore}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="flex items-baseline justify-end gap-0.5">
                  <span
                    className={`font-score text-4xl font-extrabold leading-none ${
                      player.averageScore !== null ? 'text-[#C60100]' : 'text-[#9CA3AF]'
                    }`}
                  >
                    {player.averageScore !== null ? player.averageScore.toFixed(1) : '--'}
                  </span>
                  {player.averageScore !== null && (
                    <span className="text-xs font-medium text-[#6B7280]">分</span>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-end gap-1.5">
                  <StarDisplay score={player.averageScore} size="sm" />
                </div>
                <p className="text-[11px] text-[#6B7280] mt-1 tabular-nums">
                  {player.ratingCount} 人评分
                </p>
              </div>
            </div>

            {/* 5-Star Distribution Histogram (Classic Hupu style) */}
            <div className="mt-5 pt-4 border-t border-[#F0F2F5] space-y-1.5">
              {player.starDistribution.map((row) => (
                <div key={row.stars} className="flex items-center gap-2.5 text-[11px]">
                  <span className="w-8 text-right text-[#6B7280] shrink-0 tabular-nums">
                    {row.stars}星
                  </span>
                  <div className="flex-1 h-2 bg-[#F0F2F5] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E8940C] rounded-full transition-all duration-300"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-[#6B7280] shrink-0 tabular-nums">
                    {row.percent}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Interactive Rating + Comment Composer */}
          <section className="bg-white mt-2.5 px-4 py-4 border-y border-[#E6E8EC]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-[#141518]">
                {player.myStars ? `我今日已打 ${starsToHupuScore(player.myStars)} 分` : '今日锐评打分'}
              </h2>
              {!currentUser && (
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="text-xs font-semibold text-[#C60100] min-h-[36px] px-2"
                >
                  登录后打分评论
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitRatingOrComment} className="space-y-3">
              <InteractiveStarRating
                value={selectedStars}
                onChange={handleStarChange}
              />

              <div className="flex items-end gap-2">
                <label htmlFor="player-comment-input" className="sr-only">
                  写下对 {player.nickname} 的评价
                </label>
                <textarea
                  id="player-comment-input"
                  rows={2}
                  value={commentInput}
                  onFocus={() => {
                    if (!currentUser) onRequireAuth();
                  }}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={
                    currentUser
                      ? `锐评一下 ${player.nickname} 今天的球场表现...`
                      : '仅登录后可打分、点赞与锐评（点击登录）'
                  }
                  maxLength={240}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[#F4F5F7] border border-transparent focus:border-[#C60100] focus:bg-white text-sm text-[#141518] resize-none focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingRate}
                className="w-full h-11 rounded-xl bg-[#C60100] hover:bg-[#A00100] active:scale-[0.99] text-white text-sm font-semibold transition-all disabled:opacity-60"
              >
                {submittingRate
                  ? '提交中...'
                  : selectedStars > 0 && commentInput.trim()
                    ? `打出 ${starsToHupuScore(selectedStars)} 分并发布评论`
                    : selectedStars > 0
                      ? `提交 ${starsToHupuScore(selectedStars)} 分`
                      : '发布评论'}
              </button>
            </form>
          </section>

          {/* Comments & Mutual Replies Section */}
          <section className="bg-white mt-2.5 px-4 pt-4 pb-6 border-t border-[#E6E8EC]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#141518] tabular-nums">
                亮评区 · {comments.length} 条评论
              </h2>
              <div className="flex items-center gap-1 p-0.5 bg-[#F2F4F7] rounded-lg">
                <button
                  type="button"
                  onClick={() => setSortBy('hot')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortBy === 'hot'
                      ? 'bg-white text-[#141518] shadow-xs'
                      : 'text-[#6B7280]'
                  }`}
                >
                  最热
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('latest')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortBy === 'latest'
                      ? 'bg-white text-[#141518] shadow-xs'
                      : 'text-[#6B7280]'
                  }`}
                >
                  最新
                </button>
              </div>
            </div>

            {sortedComments.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#6B7280]">
                今日还没有锐评，快来抢占沙发！
              </div>
            ) : (
              <div className="divide-y divide-[#F0F2F5]">
                {sortedComments.map((c) => {
                  const isLiked = Boolean(currentUser && c.likedBy.includes(currentUser.id));
                  return (
                    <article key={c.id} className="py-3.5 first:pt-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 text-xs">
                          <span className="font-semibold text-[#141518] truncate">
                            {c.authorNickname}
                          </span>
                          {c.authorStars !== null && (
                            <span className="text-[#C60100] font-medium shrink-0 tabular-nums">
                              打了 {starsToHupuScore(c.authorStars)} 分
                            </span>
                          )}
                          <span className="text-[#9CA3AF] shrink-0">
                            · {formatShortTime(c.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              openReplyBox(c.id, c.authorId, c.authorNickname)
                            }
                            aria-label={`回复 ${c.authorNickname}`}
                            className="min-h-[36px] px-2 flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#141518]"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>回复</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleLikeComment(c.id)}
                            aria-label={`点赞 ${c.authorNickname} 的评论`}
                            aria-pressed={isLiked}
                            className={`min-h-[36px] px-2 flex items-center gap-1 text-xs tabular-nums transition-colors ${
                              isLiked
                                ? 'text-[#C60100] font-semibold'
                                : 'text-[#6B7280] hover:text-[#141518]'
                            }`}
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${isLiked ? 'fill-[#C60100]' : ''}`}
                            />
                            <span>{c.likedBy.length}</span>
                          </button>
                        </div>
                      </div>

                      <p className="text-[14px] leading-relaxed text-[#1F2937] mt-1.5 break-words">
                        {c.content}
                      </p>

                      {/* Mutual Replies Thread */}
                      {c.replies.length > 0 && (
                        <div className="mt-2.5 bg-[#F7F8FA] rounded-xl px-3 py-2 space-y-2">
                          {c.replies.map((rep) => {
                            const repLiked = Boolean(
                              currentUser && rep.likedBy.includes(currentUser.id),
                            );
                            return (
                              <div key={rep.id} className="text-xs leading-relaxed">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[#374151] break-words flex-1">
                                    <span className="font-semibold text-[#141518]">
                                      {rep.authorNickname}
                                    </span>
                                    {rep.replyToNickname && (
                                      <>
                                        <span className="text-[#9CA3AF] mx-1">回复</span>
                                        <span className="font-semibold text-[#141518]">
                                          {rep.replyToNickname}
                                        </span>
                                      </>
                                    )}
                                    <span className="text-[#9CA3AF] mr-1">：</span>
                                    {rep.content}
                                  </p>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openReplyBox(c.id, rep.authorId, rep.authorNickname)
                                      }
                                      aria-label={`回复 ${rep.authorNickname}`}
                                      className="px-1.5 py-1 text-[11px] text-[#6B7280] hover:text-[#141518]"
                                    >
                                      回复
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleLikeReply(rep.id)}
                                      aria-label={`点赞 ${rep.authorNickname} 的回复`}
                                      aria-pressed={repLiked}
                                      className={`px-1.5 py-1 flex items-center gap-0.5 text-[11px] tabular-nums ${
                                        repLiked ? 'text-[#C60100] font-semibold' : 'text-[#6B7280]'
                                      }`}
                                    >
                                      <Heart
                                        className={`w-3 h-3 ${repLiked ? 'fill-[#C60100]' : ''}`}
                                      />
                                      <span>{rep.likedBy.length}</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Inline Reply Input when replying to this comment/thread */}
                      {replyTarget?.commentId === c.id && (
                        <form
                          onSubmit={handleSubmitReply}
                          className="mt-2.5 flex items-center gap-2"
                        >
                          <label htmlFor={`reply-input-${c.id}`} className="sr-only">
                            回复 {replyTarget.replyToNickname}
                          </label>
                          <input
                            id={`reply-input-${c.id}`}
                            type="text"
                            autoFocus
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`回复 @${replyTarget.replyToNickname}...`}
                            maxLength={200}
                            className="flex-1 h-10 px-3 rounded-xl bg-[#F4F5F7] border border-[#DCE0E6] text-xs text-[#141518] focus:outline-none focus:border-[#C60100] focus:bg-white"
                          />
                          <button
                            type="submit"
                            disabled={submittingReply || !replyText.trim()}
                            aria-label="发送回复"
                            className="min-w-[44px] h-10 px-3 rounded-xl bg-[#C60100] text-white text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>发送</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyTarget(null)}
                            className="h-10 px-2 text-xs text-[#6B7280]"
                          >
                            取消
                          </button>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
