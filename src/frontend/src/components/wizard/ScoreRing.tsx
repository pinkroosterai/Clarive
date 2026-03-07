import { motion } from 'framer-motion';

import { scoreColor } from './scoreUtils';

interface ScoreRingProps {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
}

export function ScoreRing({ score, maxScore = 10, size = 96, strokeWidth = 6 }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillOffset = circumference - (score / maxScore) * circumference;
  const { text, label, stroke } = scoreColor(score);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={`Quality score: ${score.toFixed(1)} out of ${maxScore}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        {/* Fill arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`hsl(${stroke})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: fillOffset }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${text}`}>{score.toFixed(1)}</span>
        <span className="text-[10px] text-foreground-muted">{label}</span>
      </div>
    </div>
  );
}
