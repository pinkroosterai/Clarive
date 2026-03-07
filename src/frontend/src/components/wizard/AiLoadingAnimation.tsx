import { motion } from 'framer-motion';

const NUM_DOTS = 8;
const RADIUS = 32;
const DOT_SIZE = 6;

/**
 * Animated loading indicator with orbiting dots in the brand's indigo palette.
 * Pure SVG + framer-motion — no external assets needed.
 */
export function AiLoadingAnimation() {
  return (
    <div className="relative size-28" aria-hidden="true">
      <svg viewBox="0 0 96 96" className="size-full">
        {/* Central glow */}
        <defs>
          <radialGradient id="center-glow">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="48" cy="48" r="20" fill="url(#center-glow)" />

        {/* Orbiting dots */}
        {Array.from({ length: NUM_DOTS }, (_, i) => {
          const angle = (i / NUM_DOTS) * Math.PI * 2;
          const cx = 48 + Math.cos(angle) * RADIUS;
          const cy = 48 + Math.sin(angle) * RADIUS;
          const delay = i * 0.15;

          return (
            <motion.circle
              key={i}
              cx={cx}
              cy={cy}
              r={DOT_SIZE / 2}
              fill="hsl(var(--primary))"
              initial={{ opacity: 0.2, scale: 0.6 }}
              animate={{
                opacity: [0.2, 1, 0.2],
                scale: [0.6, 1.2, 0.6],
              }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                delay,
                ease: 'easeInOut',
              }}
            />
          );
        })}

        {/* Inner rotating ring */}
        <motion.circle
          cx="48"
          cy="48"
          r="18"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeDasharray="28 85"
          strokeLinecap="round"
          opacity="0.4"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '48px 48px' }}
        />

        {/* Outer rotating ring (opposite direction) */}
        <motion.circle
          cx="48"
          cy="48"
          r="40"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1"
          strokeDasharray="20 232"
          strokeLinecap="round"
          opacity="0.2"
          animate={{ rotate: -360 }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '48px 48px' }}
        />
      </svg>

      {/* Central pulsing core */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-4 rounded-full bg-primary/60"
        animate={{
          scale: [1, 1.4, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
