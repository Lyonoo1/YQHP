import React, { useRef } from 'react';
import { Star } from 'lucide-react';

interface StarDisplayProps {
  score: number | null; // 0.0 - 10.0
  size?: 'xs' | 'sm';
}

const HalfStarIcon: React.FC<{
  state: 'full' | 'half' | 'empty';
  className: string;
}> = ({ state, className }) => {
  if (state === 'full') {
    return <Star className={`${className} fill-[#E8940C] text-[#E8940C]`} />;
  }
  if (state === 'empty') {
    return <Star className={`${className} fill-[#E5E7EB] text-[#E5E7EB]`} />;
  }
  return (
    <span className={`relative inline-block ${className}`}>
      <Star className={`${className} fill-[#E5E7EB] text-[#E5E7EB]`} />
      <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
        <Star className={`${className} fill-[#E8940C] text-[#E8940C]`} />
      </span>
    </span>
  );
};

export const StarDisplay: React.FC<StarDisplayProps> = ({ score, size = 'xs' }) => {
  const halfUnits = score !== null ? Math.max(0, Math.min(10, Math.round(score))) : 0;
  const iconClass = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((idx) => {
        const threshold = idx * 2;
        const state: 'full' | 'half' | 'empty' =
          halfUnits >= threshold ? 'full' : halfUnits === threshold - 1 ? 'half' : 'empty';
        return <HalfStarIcon key={idx} state={state} className={iconClass} />;
      })}
    </div>
  );
};

interface InteractiveStarRatingProps {
  value: number | null; // null = unset, 0 to 5 in 0.5 steps (0 to 10 score)
  onChange: (stars: number) => void;
  disabled?: boolean;
}

const SCORE_LABELS: Record<number, string> = {
  0: '0分 · 建议直接没收呼吸权',
  1: '1分 · 卧底实锤，对面第六人',
  2: '2分 · 建议下场歇歇',
  3: '3分 · 手感冻成冰棍',
  4: '4分 · 状态低迷，多传少投',
  5: '5分 · 功过相抵，中规中矩',
  6: '6分 · 及格线，正常发挥',
  7: '7分 · 稳健输出，值得信赖',
  8: '8分 · 园区主力，攻防在线',
  9: '9分 · 准MVP，差点封神',
  10: '10分 · 今日MVP，无解统治',
};

export const InteractiveStarRating: React.FC<InteractiveStarRatingProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const currentScore = value !== null ? Math.round(value * 2) : null;

  const calcStarsFromX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    if (ratio <= 0.03) return 0;
    const clamped = Math.min(1, Math.max(0, ratio));
    return Math.ceil(clamped * 10) / 2;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = calcStarsFromX(e.clientX);
    // 再次点击 0.5 星（1分）时切换为 0 分，方便单手点选 0 分
    if (next === 0.5 && value === 0.5) {
      onChange(0);
    } else {
      onChange(next);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !draggingRef.current) return;
    const next = calcStarsFromX(e.clientX);
    if (next !== value) {
      onChange(next);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center gap-2.5">
        <div
          ref={trackRef}
          role="slider"
          aria-label="滑动或点击星星打分（0 至 10 分）"
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={currentScore ?? 0}
          tabIndex={disabled ? -1 : 0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={(e) => {
            if (disabled) return;
            const base = value ?? 0;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              onChange(Math.min(5, base + 0.5));
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              onChange(Math.max(0, base - 0.5));
            }
          }}
          className={`flex items-center gap-1.5 py-2 px-1 touch-none select-none cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-[#C60100] ${
            disabled ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const threshold = star * 2;
            const state: 'full' | 'half' | 'empty' =
              currentScore === null
                ? 'empty'
                : currentScore >= threshold
                  ? 'full'
                  : currentScore === threshold - 1
                    ? 'half'
                    : 'empty';
            return (
              <span
                key={star}
                className="w-10 h-10 flex items-center justify-center transition-transform active:scale-95"
              >
                <HalfStarIcon state={state} className="w-9 h-9" />
              </span>
            );
          })}
        </div>

        <div className="min-w-[52px] text-right">
          {currentScore !== null ? (
            <span className="font-score text-2xl font-extrabold text-[#C60100] tabular-nums">
              {currentScore}
              <span className="text-xs font-semibold text-[#6B7280] ml-0.5">分</span>
            </span>
          ) : (
            <span className="text-xs text-[#9CA3AF]">--分</span>
          )}
        </div>
      </div>

      <p className="text-xs text-[#6B7280] mt-1 h-4 font-medium">
        {currentScore !== null
          ? SCORE_LABELS[currentScore]
          : '点击或滑动星星打分（半星=1分，最左可打0分）'}
      </p>
    </div>
  );
};

interface HupuInlineStarRaterProps {
  value: number | null; // null = unset, 0 to 5 in 0.5 steps (0 to 10 score)
  onCommit: (stars: number) => void;
  disabled?: boolean;
  onRequireAuth?: () => void;
}

export const HupuInlineStarRater: React.FC<HupuInlineStarRaterProps> = ({
  value,
  onCommit,
  disabled = false,
  onRequireAuth,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const draftStarsRef = useRef<number | null>(null);
  const [previewStars, setPreviewStars] = React.useState<number | null>(null);

  const displayStars = previewStars !== null ? previewStars : value;
  const displayScore = displayStars !== null ? Math.round(displayStars * 2) : null;

  const calcStarsFromX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    if (ratio <= 0.04) return 0;
    const clamped = Math.min(1, Math.max(0, ratio));
    return Math.ceil(clamped * 10) / 2;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (onRequireAuth) {
      onRequireAuth();
      return;
    }
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = calcStarsFromX(e.clientX);
    const resolved = next === 0.5 && value === 0.5 ? 0 : next;
    draftStarsRef.current = resolved;
    setPreviewStars(resolved);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !draggingRef.current) return;
    const next = calcStarsFromX(e.clientX);
    if (next !== draftStarsRef.current) {
      draftStarsRef.current = next;
      setPreviewStars(next);
    }
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const finalStars = draftStarsRef.current;
    draftStarsRef.current = null;
    setPreviewStars(null);
    if (commit && finalStars !== null) {
      onCommit(finalStars);
    }
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => finishDrag(e, true)}
      onPointerCancel={(e) => finishDrag(e, false)}
      className={`inline-flex items-center gap-1.5 py-1 px-0.5 touch-none select-none ${
        disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
      }`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const threshold = star * 2;
        const state: 'full' | 'half' | 'empty' =
          displayScore === null
            ? 'empty'
            : displayScore >= threshold
              ? 'full'
              : displayScore === threshold - 1
                ? 'half'
                : 'empty';
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            aria-label={`给球员打 ${star * 2} 分`}
            onClick={(e) => {
              // Pointer events handle mouse/touch (with half-star precision);
              // handle keyboard activation (detail === 0) cleanly here.
              if (e.detail !== 0) return;
              if (onRequireAuth) {
                onRequireAuth();
                return;
              }
              onCommit(star);
            }}
            className="w-8 h-8 flex items-center justify-center rounded-md transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-[#C60100]"
          >
            <HalfStarIcon state={state} className="w-7 h-7" />
          </button>
        );
      })}
    </div>
  );
};
