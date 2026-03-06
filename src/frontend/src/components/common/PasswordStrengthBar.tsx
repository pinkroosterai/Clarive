import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { evaluatePassword, type StrengthScore } from '@/lib/passwordStrength'
import { useDebounce } from '@/hooks/useDebounce'

interface PasswordStrengthBarProps {
  password: string
  minLength?: number
  className?: string
}

const SEGMENT_COLORS: Record<StrengthScore, string> = {
  0: 'bg-destructive',
  1: 'bg-warning-text',
  2: 'bg-warning-text',
  3: 'bg-primary',
  4: 'bg-success-text',
}

const LABEL_COLORS: Record<StrengthScore, string> = {
  0: 'text-destructive',
  1: 'text-warning-text',
  2: 'text-warning-text',
  3: 'text-primary',
  4: 'text-success-text',
}

// Number of segments to fill for each score
const FILLED_SEGMENTS: Record<StrengthScore, number> = {
  0: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 4,
}

export function PasswordStrengthBar({
  password,
  minLength = 12,
  className,
}: PasswordStrengthBarProps) {
  const debouncedPassword = useDebounce(password, 150)

  const strength = useMemo(
    () => evaluatePassword(debouncedPassword),
    [debouncedPassword],
  )

  if (!password) return null

  const tooShort = password.length < minLength
  const filled = FILLED_SEGMENTS[strength.score]
  const color = SEGMENT_COLORS[strength.score]

  return (
    <div
      className={cn('mt-2 space-y-1', className)}
      role="meter"
      aria-valuenow={strength.score}
      aria-valuemin={0}
      aria-valuemax={4}
      aria-label={`Password strength: ${strength.label}`}
    >
      {/* 4-segment bar */}
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              i < filled ? color : 'bg-border',
            )}
          />
        ))}
      </div>

      {/* Label + crack time */}
      <div className="flex items-center justify-between text-xs">
        <span className={LABEL_COLORS[strength.score]}>{strength.label}</span>
        {strength.crackTime && (
          <span className="text-foreground-muted">
            Cracked in {strength.crackTime}
          </span>
        )}
      </div>

      {/* Min-length warning */}
      {tooShort && (
        <p className="text-xs text-foreground-muted">
          Must be at least {minLength} characters
        </p>
      )}

      {/* Feedback suggestions */}
      {!tooShort && strength.feedback.length > 0 && (
        <p className="text-xs text-foreground-muted">
          {strength.feedback.join(' · ')}
        </p>
      )}
    </div>
  )
}
