/**
 * Date utility functions for handling date presets and formatting
 */

export type DatePreset = 
  | 'last_1_day'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_6_months'
  | 'last_12_months'
  | 'last_month'   // Added missing preset
  | 'last_year'    // Added missing preset
  | 'this_month'
  | 'this_quarter'
  | 'this_year'
  | 'yesterday'
  | 'today'
  | 'custom'
  | null;

export const DATE_PRESET_OPTIONS = [
  { value: 'last_1_day', label: 'Last 1 Day' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'last_12_months', label: 'Last 12 Months' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'today', label: 'Today' },
  { value: 'custom', label: 'Custom Range' },
];

/**
 * Calculate date range from a preset
 * @param preset - The date preset
 * @returns Object with startDate and endDate
 */
export const calculateDateRangeFromPreset = (preset: DatePreset): { startDate: Date | null, endDate: Date | null } => {
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  
  switch(preset) {
    case 'last_1_day':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 1);
      endDate = new Date(now);
      break;
    case 'last_7_days':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      endDate = new Date(now);
      break;
    case 'last_30_days':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 29);
      endDate = new Date(now);
      break;
    case 'last_90_days':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 89);
      endDate = new Date(now);
      break;
      case 'last_month':
        // From 1st to last day of previous month
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
    case 'last_6_months':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 6);
      endDate = new Date(now);
      break;
    case 'last_12_months':
      console.log("last_12_months");
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      endDate = new Date(now);
      break;
    case 'this_month':
      // From 1st of current month to today
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now);
      break;
    case 'this_quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      break;
    case 'this_year':
      // From January 1st to today
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now);
      break;
    case 'last_year':
      // From January 1st to December 31st of previous year
      const lastYear = now.getFullYear() - 1;
      startDate = new Date(lastYear, 0, 1); // January 1st of last year
      endDate = new Date(lastYear, 11, 31); // December 31st of last year
      break;
    case 'yesterday':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      return { startDate: null, endDate: null };
  }
  
  return { startDate, endDate };
};

/**
 * Format date for SQL queries (YYYY-MM-DD)
 * @param date - The date to format
 * @returns Formatted date string
 */
export const formatDate = (date: Date | null): string => {
  if (!date) return '';
  // Use ISO string and extract the date part to avoid timezone issues
  return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
};

/**
 * Format date for display (e.g., "Jan 1, 2023")
 * @param date - The date to format
 * @returns Formatted date string for display
 */
export const formatDateForDisplay = (date: Date | null): string => {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format date for SQL queries (YYYY-MM-DD HH:MM:SS)
 * @param date - The date to format
 * @returns Formatted date and time string
 */
export const formatDateTimeForSQL = (date: Date | null): string => {
  if (!date) return '';
  return date.toISOString().slice(0, 19).replace('T', ' '); // Format as YYYY-MM-DD HH:MM:SS
};

/**
 * Get preset display text
 * @param preset - The date preset
 * @returns Human-readable preset name
 */
export const getPresetDisplayText = (preset: DatePreset): string => {
  if (!preset) return 'Custom Range';
  
  const option = DATE_PRESET_OPTIONS.find(opt => opt.value === preset);
  if (option) return option.label;
  
  return 'Custom Range';
};

/**
 * Get date range display text
 * @param preset - The date preset
 * @returns Human-readable date range description
 */
export const getDateRangeDisplayText = (preset: DatePreset): string => {
  if (!preset || preset === 'custom') return 'Custom Date Range';
  
  const { startDate, endDate } = calculateDateRangeFromPreset(preset);
  if (!startDate || !endDate) return getPresetDisplayText(preset);
  
  return `${formatDateForDisplay(startDate)} to ${formatDateForDisplay(endDate)}`;
};

/**
 * Format date for SQL
 * @param date - The date to format
 * @returns Formatted date string for SQL
 */
export const formatDateForSQL = (date: Date | null): string => {
  if (!date) return '';
  return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
}; 

/**
 * Map legacy date preset names to standardized format
 * @param preset - The date preset name (possibly in legacy format)
 * @returns Standardized date preset name
 */
export const normalizeDatePreset = (preset: string | null | undefined): DatePreset => {
  if (!preset) return null;
  
  console.log(`Normalizing date preset: ${preset}`);
  
  // Map legacy preset names to standardized format
  const legacyMapping: Record<string, DatePreset> = {
    // Frontend operator names to backend preset names
    'LAST_1_DAY': 'last_1_day',
    'LAST_7_DAYS': 'last_7_days',
    'LAST_30_DAYS': 'last_30_days',
    'THIS_MONTH': 'this_month',
    'LAST_MONTH': 'last_month',
    'LAST_3_MONTHS': 'last_90_days',
    'LAST_6_MONTHS': 'last_6_months',
    'LAST_12_MONTHS': 'last_12_months',
    'THIS_YEAR': 'this_year',
    'LAST_YEAR': 'last_year',
    
    // Legacy mappings
    'lastYear': 'last_year',
    'last6Months': 'last_6_months',
    'last3Months': 'last_90_days',
    'lastMonth': 'last_month',
    'lastWeek': 'last_7_days',
    'lastDay': 'last_1_day',
    'thisYear': 'this_year',
    'thisMonth': 'this_month',
    'thisQuarter': 'this_quarter',
    'yesterday': 'yesterday',
    'today': 'today',
    
    // Standardized format mappings (for consistency)
    'last_year': 'last_year',
    'last_6_months': 'last_6_months',
    'last_3_months': 'last_90_days',
    'last_month': 'last_month',
    'last_7_days': 'last_7_days',
    'last_1_day': 'last_1_day',
    'this_year': 'this_year',
    'this_month': 'this_month',
    'this_quarter': 'this_quarter',
    'last12months': 'last_12_months',
    'last1day': 'last_1_day'
  };
  
  const normalizedPreset = legacyMapping[preset] || preset as DatePreset;
  console.log(`Normalized to: ${normalizedPreset}`);
  
  return normalizedPreset;
}; 