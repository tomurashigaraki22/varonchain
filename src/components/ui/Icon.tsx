/**
 * Thin wrapper around HugeiconsIcon that forwards size, color, and strokeWidth
 * with sensible defaults matching the app's design language.
 *
 * Usage:
 *   import { Icon } from "@/components/ui/Icon";
 *   import { FootballIcon } from "@hugeicons/core-free-icons";
 *   <Icon icon={FootballIcon} size={20} />
 */
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";

export interface IconProps {
  icon: IconSvgElement;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean;
}

export function Icon({
  icon,
  size = 16,
  color = "currentColor",
  strokeWidth = 1.5,
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={ariaHidden}
    />
  );
}
