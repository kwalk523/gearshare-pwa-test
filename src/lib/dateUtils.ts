/**
 * Utility functions for handling date formatting and parsing in the rental system
 */

/**
 * Formats a date string for display, handling timezone issues
 * Assumes the input is a date that should be displayed as-is regardless of timezone
 */
export function formatRentalDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  
  try {
    // If it's already a timestamp with time, extract just the date part
    let dateOnly = dateStr;
    if (dateStr.includes('T')) {
      dateOnly = dateStr.split('T')[0];
    }
    
    // Parse as UTC to avoid timezone shifts
    const date = new Date(dateOnly + 'T00:00:00.000Z');
    
    // Format in local timezone but using the UTC date
    return new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric', 
      year: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  } catch (error) {
    console.error('Date formatting error:', error, dateStr);
    return dateStr;
  }
}

/**
 * Formats a date range for display
 */
export function formatRentalDateRange(startDate: string | null | undefined, endDate: string | null | undefined): string {
  const start = formatRentalDate(startDate);
  const end = formatRentalDate(endDate);
  
  if (!start || !end) return '';
  return `${start} → ${end}`;
}