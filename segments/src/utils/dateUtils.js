/**
 * Utility functions for handling date operations
 */

/**
 * Calculate date range from a preset
 * @param {string} preset - The date preset (e.g., 'last_7_days', 'last_30_days', etc.)
 * @returns {Object} Object with startDate and endDate as Date objects
 */
const calculateDateRangeFromPreset = (preset) => {
  const now = new Date();
  let startDate, endDate;
  
  switch(preset) {
    case 'last_1_day':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 1);
      endDate = new Date(now);
      break;
    case 'last_7_days':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6); // -6 to include today
      endDate = new Date(now);
      break;
    case 'last_30_days':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 29); // -29 to include today
      endDate = new Date(now);
      break;
    case 'last_90_days':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 89); // -89 to include today
      endDate = new Date(now);
      break;
    case 'last_6_months':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 6);
      endDate = new Date(now);
      break;
    case 'last_12_months':
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      endDate = new Date(now);
      break;
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, 0, 1); // First day of last year
      endDate = new Date(now.getFullYear() - 1, 11, 31); // Last day of last year
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First day of last month
      endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month
      break;
    case 'this_quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
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
  
  return { 
    startDate, 
    endDate 
  };
};

/**
 * Generate SQL interval expression for a given date preset
 * @param {string} preset - The date preset
 * @param {string} columnName - The column name to use in the expression
 * @returns {string} SQL interval expression
 */
const generateSqlIntervalForPreset = (preset, columnName) => {
  switch(preset) {
    case 'last_1_day':
      return `${columnName} BETWEEN CURRENT_DATE - INTERVAL '1 day' AND CURRENT_DATE`;
    case 'last_7_days':
      return `${columnName} BETWEEN CURRENT_DATE - INTERVAL '6 days' AND CURRENT_DATE`;
    case 'last_30_days':
      return `${columnName} BETWEEN CURRENT_DATE - INTERVAL '29 days' AND CURRENT_DATE`;
    case 'last_90_days':
      return `${columnName} BETWEEN CURRENT_DATE - INTERVAL '89 days' AND CURRENT_DATE`;
    case 'last_6_months':
      return `${columnName} BETWEEN CURRENT_DATE - INTERVAL '6 months' AND CURRENT_DATE`;
    case 'last_12_months':
      return `${columnName} BETWEEN CURRENT_DATE - INTERVAL '12 months' AND CURRENT_DATE`;
    case 'last_year':
      return `${columnName} BETWEEN DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year') AND DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 day'`;
    case 'this_month':
      return `${columnName} BETWEEN DATE_TRUNC('month', CURRENT_DATE) AND LAST_DAY(CURRENT_DATE)`;
    case 'last_month':
      return `${columnName} BETWEEN DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND LAST_DAY(CURRENT_DATE - INTERVAL '1 month')`;
    case 'this_quarter':
      return `${columnName} BETWEEN DATE_TRUNC('quarter', CURRENT_DATE) AND DATE_TRUNC('quarter', CURRENT_DATE) + INTERVAL '3 months' - INTERVAL '1 day'`;
    case 'this_year':
      return `${columnName} BETWEEN DATE_TRUNC('year', CURRENT_DATE) AND DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day'`;
    case 'yesterday':
      return `${columnName} = CURRENT_DATE - INTERVAL '1 day'`;
    case 'today':
      return `${columnName} = CURRENT_DATE`;
    default:
      return null;
  }
};

/**
 * Format date for SQL queries (YYYY-MM-DD)
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
const formatDateForSQL = (date) => {
  if (!date) return null;
  return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
};

/**
 * Format date and time for SQL queries (YYYY-MM-DD HH:MM:SS)
 * @param {Date} date - The date to format
 * @returns {string} Formatted date and time string
 */
const formatDateTimeForSQL = (date) => {
  if (!date) return null;
  return date.toISOString().slice(0, 19).replace('T', ' '); // Format as YYYY-MM-DD HH:MM:SS
};

/**
 * Get human-readable description of a date preset
 * @param {string} preset - The date preset
 * @returns {string} Human-readable description
 */
const getPresetDescription = (preset) => {
  const presetDescriptions = {
    'last_1_day': 'Last 1 Day',
    'last_7_days': 'Last 7 Days',
    'last_30_days': 'Last 30 Days',
    'last_90_days': 'Last 90 Days',
    'last_6_months': 'Last 6 Months',
    'last_12_months': 'Last 12 Months',
    'last_month': 'Last Month',
    'this_month': 'This Month',
    'this_quarter': 'This Quarter',
    'this_year': 'This Year',
    'last_year': 'Last Year',
    'yesterday': 'Yesterday',
    'today': 'Today'
  };
  
  return presetDescriptions[preset] || preset;
};

/**
 * Normalize date preset names (map legacy formats to standardized ones)
 * @param {string} preset - The date preset name (possibly in legacy format)
 * @returns {string} Standardized date preset name
 */
const normalizeDatePreset = (preset) => {
  if (!preset) return null;
  
  console.log(`Normalizing date preset: ${preset}`);
  
  // Map legacy preset names to standardized format
  const legacyMapping = {
    // Frontend operator names to backend preset names
    'last1Day': 'last_1_day',
    'last7Days': 'last_7_days',
    'last30Days': 'last_30_days',
    'last3Months': 'last_90_days',
    'last6Months': 'last_6_months',
    'last12Months': 'last_12_months',
    'lastYear': 'last_year',
    'thisMonth': 'this_month',
    'lastMonth': 'last_month',
    'thisYear': 'this_year',
    'thisQuarter': 'this_quarter',
    
    // Legacy mappings
    'lastDay': 'last_1_day',
    'lastWeek': 'last_7_days',
    'last90Days': 'last_90_days',
    'yesterday': 'yesterday',
    'today': 'today',
    
    // Standardized format mappings (for consistency)
    'last_1_day': 'last_1_day',
    'last_7_days': 'last_7_days',
    'last_30_days': 'last_30_days',
    'last_90_days': 'last_90_days',
    'last_6_months': 'last_6_months',
    'last_12_months': 'last_12_months',
    'last_year': 'last_year',
    'last_month': 'last_month',
    'this_month': 'this_month',
    'this_year': 'this_year',
    'this_quarter': 'this_quarter'
  };
  
  const normalizedPreset = legacyMapping[preset] || preset;
  console.log(`Normalized to: ${normalizedPreset}`);
  
  return normalizedPreset;
};

// Export the functions
module.exports = {
  calculateDateRangeFromPreset,
  formatDateForSQL,
  formatDateTimeForSQL,
  getPresetDescription,
  normalizeDatePreset,
  generateSqlIntervalForPreset
}; 