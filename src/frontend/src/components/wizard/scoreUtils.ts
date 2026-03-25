export function scoreColor(score: number) {
  if (score >= 8)
    return {
      bar: 'bg-success-text',
      text: 'text-success-text',
      bg: 'bg-success-bg',
      label: 'Good',
      stroke: 'var(--success-text)',
    };
  if (score >= 5)
    return {
      bar: 'bg-warning-text',
      text: 'text-warning-text',
      bg: 'bg-warning-bg',
      label: 'Fair',
      stroke: 'var(--warning-text)',
    };
  return {
    bar: 'bg-error-text',
    text: 'text-error-text',
    bg: 'bg-error-bg',
    label: 'Poor',
    stroke: 'var(--error-text)',
  };
}
