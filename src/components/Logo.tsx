import React from 'react';
import iconUrl from '../assets/carehub_Update_Icon.png';

interface LogoProps {
  /** Tailwind sizing classes, e.g. "w-10 h-10". */
  className?: string;
}

/**
 * The app mark. Imported from src/assets rather than referenced out of public/
 * so Vite content-hashes the URL -- the service worker is cache-first for
 * non-navigation requests, so an unhashed path would keep serving the old
 * artwork after the icon changes.
 *
 * The source image already carries its own blue background, so it is clipped to
 * a rounded square instead of being dropped onto a themed tile.
 */
export const Logo: React.FC<LogoProps> = ({ className = 'w-10 h-10' }) => (
  <img
    src={iconUrl}
    alt="Family Care Hub"
    className={`${className} rounded-xl object-contain shrink-0`}
  />
);
