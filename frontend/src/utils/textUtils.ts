/**
 * Converts text to title case (first letter of each word capitalized)
 * @param text - The text to convert
 * @returns The text in title case
 */
export const toTitleCase = (text: string): string => {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

/**
 * Formats text input in real-time to title case
 * Useful for form inputs
 * @param value - The input value
 * @returns Formatted title case value
 */
export const formatToTitleCase = (value: string): string => {
  return toTitleCase(value.trim());
};

/**
 * Handles title case formatting for form inputs
 * @param setter - State setter function
 * @returns Event handler function
 */
export const handleTitleCaseInput = (setter: (value: string) => void) => {
  return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const titleCaseValue = formatToTitleCase(e.target.value);
    setter(titleCaseValue);
  };
};