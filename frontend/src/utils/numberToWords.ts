/**
 * Convert a number to Indian Rupees words format.
 * e.g., 12345.67 → "Twelve Thousand Three Hundred Forty Five Rupees and Sixty Seven Paise"
 */

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const convertBelowHundred = (n: number): string => {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
};

const convertBelowThousand = (n: number): string => {
  if (n < 100) return convertBelowHundred(n);
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelowHundred(n % 100) : '');
};

export const numberToWords = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || amount === '') return '';

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num < 0) return '';
  if (num === 0) return 'Zero Rupees';

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  let words = '';
  let remaining = intPart;

  // Indian system: Crore, Lakh, Thousand, Hundred
  if (remaining >= 10000000) {
    words += convertBelowThousand(Math.floor(remaining / 10000000)) + ' Crore ';
    remaining %= 10000000;
  }
  if (remaining >= 100000) {
    words += convertBelowHundred(Math.floor(remaining / 100000)) + ' Lakh ';
    remaining %= 100000;
  }
  if (remaining >= 1000) {
    words += convertBelowHundred(Math.floor(remaining / 1000)) + ' Thousand ';
    remaining %= 1000;
  }
  if (remaining > 0) {
    words += convertBelowThousand(remaining);
  }

  words = words.trim() + ' Rupees';

  if (decPart > 0) {
    words += ' and ' + convertBelowHundred(decPart) + ' Paise';
  } else {
    words += ' Only';
  }

  return words;
};
