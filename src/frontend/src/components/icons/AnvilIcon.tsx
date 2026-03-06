interface AnvilIconProps {
  className?: string;
}

export function AnvilIcon({ className }: AnvilIconProps) {
  return <img src="/clarive-icon.svg" alt="Clarive" className={className} />;
}
