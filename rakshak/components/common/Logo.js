/**
 * Centralized Logo Component for Sahaay
 * 
 * USAGE:
 * import Logo from '@/components/common/Logo';
 * 
 * // For light backgrounds (white/light gray)
 * <Logo size={24} theme="light" />
 * 
 * // For dark backgrounds (dark blue/black)
 * <Logo size={24} theme="dark" />
 * 
 * TO REPLACE WITH YOUR PNG LOGOS:
 * 1. Add your logos to /public folder:
 *    - /public/logo-light.png (for light backgrounds - darker logo)
 *    - /public/logo-dark.png (for dark backgrounds - lighter/white logo)
 * 2. Uncomment the PNG section below (lines 30-42)
 * 3. Delete the SVG section (lines 45-60)
 */

export default function Logo({ size = 24, theme = 'light', className = '' }) {
  // OPTION 1: Use your PNG logos (RECOMMENDED)
  // Uncomment this when you add your logo PNGs to /public folder:
  const logoSrc = theme === 'dark' 
    ? '/logo-dark.png'   // Light/white logo for dark backgrounds
    : '/logo-light.png'; // Dark logo for light backgrounds

  return (
    <img 
      src={logoSrc}
      alt="Sahaay Logo" 
      width={size} 
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
