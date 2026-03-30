/**
 * Comprehensive Indian Number Formatting Utility
 * Supports Indian numbering system: 1,00,000 (1 Lakh) format
 */

/**
 * Format number in Indian numbering system
 * @param amount - The number to format
 * @param showDecimals - Whether to show decimal places (default: false)
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @returns Formatted string in Indian format
 */
export const formatIndianNumber = (
  amount: number | string | null | undefined, 
  showDecimals: boolean = false, 
  decimalPlaces: number = 2
): string => {
  // Handle null, undefined, or invalid inputs
  if (amount === null || amount === undefined || amount === '') {
    return '0';
  }
  
  // Convert to number if string
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle NaN or invalid numbers
  if (isNaN(num)) {
    return '0';
  }
  
  // Handle negative numbers
  const isNegative = num < 0;
  const absoluteNum = Math.abs(num);
  
  // If showDecimals is false, round to nearest integer
  const finalNum = showDecimals ? absoluteNum : Math.round(absoluteNum);
  
  // Convert to string and split into integer and decimal parts
  const numStr = showDecimals ? finalNum.toFixed(decimalPlaces) : finalNum.toString();
  const [integerPart, decimalPart] = numStr.split('.');
  
  // Apply Indian numbering system formatting
  const formattedInteger = formatIntegerPartIndian(integerPart);
  
  // Combine parts
  let result = formattedInteger;
  if (showDecimals && decimalPart) {
    result += '.' + decimalPart;
  }
  
  // Add negative sign if needed
  return isNegative ? '-' + result : result;
};

/**
 * Format the integer part according to Indian numbering system
 * @param integerStr - String representation of integer part
 * @returns Formatted integer string
 */
const formatIntegerPartIndian = (integerStr: string): string => {
  // Reverse the string for easier processing
  const reversed = integerStr.split('').reverse();
  const formatted: string[] = [];
  
  for (let i = 0; i < reversed.length; i++) {
    // Add comma after 3rd digit (thousands), then every 2 digits (lakhs, crores)
    if (i === 3 || (i > 3 && (i - 3) % 2 === 0)) {
      formatted.push(',');
    }
    formatted.push(reversed[i]);
  }
  
  // Reverse back and join
  return formatted.reverse().join('');
};

/**
 * Format currency amount in Indian Rupees format
 * @param amount - The amount to format
 * @param showDecimals - Whether to show decimal places (default: false)
 * @param symbol - Currency symbol (default: ₹)
 * @returns Formatted currency string
 */
export const formatIndianCurrency = (
  amount: number | string | null | undefined, 
  showDecimals: boolean = false, 
  symbol: string = '₹'
): string => {
  const formattedNumber = formatIndianNumber(amount, showDecimals);
  return `${symbol}${formattedNumber}`;
};

/**
 * Format amount for display in tables and lists (without decimals by default)
 * @param amount - The amount to format
 * @param showCurrency - Whether to show currency symbol (default: true)
 * @returns Formatted amount string
 */
export const formatDisplayAmount = (
  amount: number | string | null | undefined,
  showCurrency: boolean = true
): string => {
  if (showCurrency) {
    return formatIndianCurrency(amount, false);
  }
  return formatIndianNumber(amount, false);
};

/**
 * Format amount for exports (PDF, Excel) - no decimals
 * @param amount - The amount to format
 * @param includeCurrency - Whether to include currency symbol
 * @returns Formatted amount string for exports
 */
export const formatExportAmount = (
  amount: number | string | null | undefined,
  includeCurrency: boolean = false
): string => {
  const formatted = formatIndianNumber(amount, false);
  return includeCurrency ? `₹${formatted}` : formatted;
};

/**
 * Format amount for input fields (with decimals for precision)
 * @param amount - The amount to format
 * @returns Formatted amount string for inputs
 */
export const formatInputAmount = (
  amount: number | string | null | undefined
): string => {
  return formatIndianNumber(amount, true, 2);
};

/**
 * Parse Indian formatted number back to number
 * @param formattedAmount - Indian formatted string
 * @returns Parsed number
 */
export const parseIndianNumber = (formattedAmount: string): number => {
  // Remove currency symbols and commas
  const cleanedAmount = formattedAmount
    .replace(/[₹$,]/g, '')
    .trim();
  
  const parsed = parseFloat(cleanedAmount);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Format balance with proper sign indication
 * @param balance - Balance amount
 * @param showDecimals - Whether to show decimals
 * @returns Formatted balance with proper indication
 */
export const formatBalance = (
  balance: number | string | null | undefined,
  showDecimals: boolean = false
): string => {
  const num = typeof balance === 'string' ? parseFloat(balance) : (balance || 0);
  const formatted = formatIndianCurrency(Math.abs(num), showDecimals);
  
  if (num < 0) {
    return `${formatted} (Dr)`;
  } else if (num > 0) {
    return `${formatted} (Cr)`;
  } else {
    return formatted;
  }
};

// Export commonly used formatters with specific names
export const formatAmount = formatDisplayAmount;
export const formatCurrency = formatIndianCurrency;
export const formatNumber = formatIndianNumber;

// Legacy support - these will use Indian formatting
export const toIndianCurrency = (amount: number | string | null | undefined): string => {
  return formatIndianCurrency(amount, false);
};

export const toIndianNumber = (amount: number | string | null | undefined): string => {
  return formatIndianNumber(amount, false);
};