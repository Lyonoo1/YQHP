import React from 'react';
import { Star } from 'lucide-react';

interface StarDisplayProps {
  score: number | null; // 2.0 - 10.0
  size?: 'xs' | 'sm';
}

export const StarDisplay: React.FC<StarDisplayProps> = ({ score, size = 'xs' }) => {
  const filledCount = score !== null ? Math.round(score / 2) : 0;
  const iconClass = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((idx) => (
        <Star
          key={idx}
          className={`${iconClass} ${
            idx <= filledCount
              ? 'fill-[#E8940C] text-[#E8940C]'
              : 'fill-[#E5E7EB] text-[#E5E7EB]'
          }`}
        />
      ))}
    </div>
  );
};

interface InteractiveStarRatingProps {
  value: number; // 0 to 5
  onChange: (stars: number) => void;
  disabled?: boolean;
}

const STAR_LABELS: Record<number, string> = {
  1: '2分 · 建议下场歇歇',
  2: '4分 · 手感冰凉',
  3: '6分 · 正常发挥',
  4: '8分 · 园区主力',
  5: '10分 · 今日MVP',
};

export const InteractiveStarRating: React.FC<InteractiveStarRatingProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center gap-1" role="radiogroup" aria-label="给球员打分">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= value;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star}星 ${star * 2}分`}
              disabled={disabled}
              onClick={() => onChange(star)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[#C60100]"
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  active
                    ? 'fill-[#E8940C] text-[#E8940C]'
                    : 'fill-[#ECEEF2] text-[#D1D5DB]'
                }`}
              />
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[#6B7280] mt-1 h-4">
        {value > 0 ? STAR_LABELS[value] : '点击星星打分（1星=2分，5星=10分）'}
      </p>
    </div>
  );
};
