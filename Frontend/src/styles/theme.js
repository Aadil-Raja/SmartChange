/**
 * K-Electric Brand Identity Theme Configuration
 * Centralized design tokens for colors, spacing, border radius, and shadows
 */

export const colors = {
  primary: {
    main: '#f7953f',      // K-Electric Orange
    light: '#FF9A4D',
    dark: '#E0741C',
    gradient: 'linear-gradient(135deg, #FDB913 0%, #f7953f 100%)'
  },
  secondary: {
    main: '#FDB913',      // K-Electric Yellow
    light: '#FFCA3A',
    dark: '#E5A50F'
  },
  accent: {
    blue: '#00ADEF',      // K-Electric Blue
    green: '#78BE20',     // K-Electric Green
    blueLight: '#33BFEF',
    greenLight: '#8FD135'
  },
  neutral: {
    text: '#333333',      // Primary text
    textLight: '#666666', // Secondary text
    textLighter: '#999999', // Tertiary text
    bg: '#FFFFFF',        // White background
    bgGray: '#F9FAFB',    // Light gray background (gray-50)
    bgGrayDark: '#F3F4F6', // Darker gray background (gray-100)
    border: '#E5E7EB',    // Border color (gray-200)
    borderDark: '#D1D5DB' // Darker border (gray-300)
  },
  semantic: {
    success: '#78BE20',
    successBg: 'rgba(120, 190, 32, 0.1)',
    successBorder: 'rgba(120, 190, 32, 0.3)',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    errorBorder: '#FCA5A5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    warningBorder: '#FCD34D',
    info: '#00ADEF',
    infoBg: 'rgba(0, 173, 239, 0.1)',
    infoBorder: 'rgba(0, 173, 239, 0.3)'
  }
};

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem'    // 48px
};

export const borderRadius = {
  sm: '0.25rem',   // 4px - rounded-sm
  md: '0.375rem',  // 6px - rounded-md
  lg: '0.5rem',    // 8px - rounded-lg
  xl: '0.75rem',   // 12px - rounded-xl
  '2xl': '1rem',   // 16px - rounded-2xl
  full: '9999px'   // rounded-full
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
};

/**
 * Utility function to generate gradient CSS
 * @param {string} from - Starting color
 * @param {string} to - Ending color
 * @param {number} angle - Gradient angle in degrees (default: 135)
 * @returns {string} CSS gradient string
 */
export const createGradient = (from, to, angle = 135) => {
  return `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`;
};

/**
 * Utility function to create color with opacity
 * @param {string} color - Hex color code
 * @param {number} opacity - Opacity value between 0 and 1
 * @returns {string} RGBA color string
 */
export const withOpacity = (color, opacity) => {
  // Remove # if present
  const hex = color.replace('#', '');
  
  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Pre-defined K-Electric brand gradients
 */
export const gradients = {
  primary: createGradient(colors.secondary.main, colors.primary.main),
  primaryReverse: createGradient(colors.primary.main, colors.secondary.main),
  accent: createGradient(colors.accent.blue, colors.accent.green),
  subtle: createGradient(colors.neutral.bgGray, colors.neutral.bg)
};

/**
 * Export default theme object
 */
const theme = {
  colors,
  spacing,
  borderRadius,
  shadows,
  gradients,
  utils: {
    createGradient,
    withOpacity
  }
};

export default theme;
