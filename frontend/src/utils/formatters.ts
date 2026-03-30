/**
 * Indian Number Formatting Utilities
 * Formats numbers in Indian numbering system (1,00,000 instead of 100,000)
 */

/**
 * Format number in Indian numbering system
 * @param amount - The number to format
 * @param currency - Whether to show currency symbol
 * @returns Formatted string (e.g., ₹1,00,000)
 */
export const formatIndianNumber = (amount: number | string | null | undefined, currency = false): string => {
  if (amount === null || amount === undefined || amount === '') {
    return currency ? '₹0.00' : '0.00';
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) {
    return currency ? '₹0.00' : '0.00';
  }

  // Use Intl.NumberFormat for Indian locale
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...(currency && { style: 'currency', currency: 'INR' })
  }).format(num);

  return formatted;
};

/**
 * Format currency amount with Indian numbering
 * @param amount - The amount to format
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number | string | null | undefined): string => {
  return formatIndianNumber(amount, true);
};

/**
 * Format number without currency symbol
 * @param amount - The number to format
 * @returns Formatted number string
 */
export const formatNumber = (amount: number | string | null | undefined): string => {
  return formatIndianNumber(amount, false);
};

/**
 * Parse Indian formatted number back to number
 * @param formattedNumber - The formatted number string
 * @returns Parsed number
 */
export const parseIndianNumber = (formattedNumber: string): number => {
  if (!formattedNumber) return 0;
  
  // Remove currency symbol and commas
  const cleaned = formattedNumber.replace(/[₹,]/g, '').trim();
  return parseFloat(cleaned) || 0;
};