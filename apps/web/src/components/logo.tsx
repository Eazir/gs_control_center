import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: number;
}

/**
 * Emblema hexagonal distintivo de GrowthSell en oro corporativo (#F59E0B).
 */
export function GrowthSellHexagon({ className, size = 36 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
    >
      {/* Hexágono exterior */}
      <polygon
        points="18,2 32,10 32,26 18,34 4,26 4,10"
        stroke="#F59E0B"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="rgba(245, 158, 11, 0.08)"
      />
      {/* Detalle interno geométrico */}
      <polygon
        points="18,7 28,13 28,23 18,29 8,23 8,13"
        stroke="#FBBF24"
        strokeWidth="1.2"
        strokeDasharray="2 2"
        fill="transparent"
      />
      <circle cx="18" cy="18" r="3" fill="#F59E0B" />
    </svg>
  );
}

interface BrandHeaderProps {
  className?: string;
  showText?: boolean;
}

/**
 * Cabecera de marca con el logotipo y el texto "GrowthSell Centro de Mando".
 */
export function GrowthSellBrand({ className, showText = true }: BrandHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <GrowthSellHexagon size={34} />
      {showText && (
        <div className="flex flex-col">
          <span className="text-base font-extrabold tracking-tight text-foreground leading-none">
            GrowthSell
          </span>
          <span className="text-[10px] font-semibold tracking-widest text-primary uppercase mt-1">
            Centro de Mando
          </span>
        </div>
      )}
    </div>
  );
}
