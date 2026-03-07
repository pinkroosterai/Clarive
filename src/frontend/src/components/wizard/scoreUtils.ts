export function scoreColor(score: number) {
  if (score >= 8)
    return {
      bar: 'bg-success-text',
      text: 'text-success-text',
      label: 'Good',
      stroke: 'var(--success-text)',
    };
  if (score >= 5)
    return {
      bar: 'bg-warning-text',
      text: 'text-warning-text',
      label: 'Fair',
      stroke: 'var(--warning-text)',
    };
  return {
    bar: 'bg-error-text',
    text: 'text-error-text',
    label: 'Poor',
    stroke: 'var(--error-text)',
  };
}
