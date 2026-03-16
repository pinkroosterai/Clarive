/**
 * Reusable stagger animation components for consistent entrance effects.
 *
 * Animation Tiers:
 * 1. Page enter (CSS): `animate-page-enter` via AppShell — applied globally
 * 2. Content stagger (Framer Motion): StaggerContainer/StaggerItem for card grids, list content
 * 3. Form reveal (Framer Motion): Inline motion.div stagger on form fields (see NewEntryPage)
 * 4. No extra animation: Streaming pages (PlaygroundPage), auth callbacks, redirects
 */

import { motion } from 'framer-motion';

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  index: number;
  staggerDelay?: number;
  duration?: number;
}

export function StaggerItem({
  children,
  className,
  index,
  staggerDelay = 0.05,
  duration = 0.3,
}: StaggerItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * staggerDelay, duration }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
