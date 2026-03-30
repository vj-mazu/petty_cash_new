import React, { useState, useEffect } from 'react';
import { formatIndianNumber, parseIndianNumber } from '../utils/indianNumberFormat';

interface IndianNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number | string;
  onChange?: (value: number, formattedValue: string) => void;
  showDecimals?: boolean;
  maxValue?: number;
  minValue?: number;
}

const IndianNumberInput: React.FC<IndianNumberInputProps> = ({
  value = '',
  onChange,
  showDecimals = false,
  maxValue = 9999999999.99,
  minValue = 0,
  className = '',
  placeholder = '0',
  disabled = false,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);

  // Update display value when value prop changes
  useEffect(() => {
    if (value === '' || value === null || value === undefined) {
      setDisplayValue('');
    } else {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(numValue) && numValue !== 0) {
        setDisplayValue(formatIndianNumber(numValue, showDecimals, 2));
      } else {
        setDisplayValue('');
      }
    }
  }, [value, showDecimals]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    
    // Allow empty input
    if (inputValue === '') {
      setDisplayValue('');
      onChange?.(0, '');
      return;
    }

    // Remove existing formatting but keep decimal point
    const cleanValue = inputValue.replace(/[^0-9.]/g, '');
    
    // Handle decimal places
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      // More than one decimal point, ignore
      return;
    }
    
    // Limit decimal places
    if (parts[1] && parts[1].length > 2) {
      parts[1] = parts[1].substring(0, 2);
    }
    
    const numericValue = parseFloat(parts.join('.'));
    
    // Validate range
    if (numericValue < minValue || numericValue > maxValue) {
      return;
    }
    
    if (!isNaN(numericValue)) {
      // Format only if not focused (to allow typing)
      if (!isFocused) {
        const formatted = formatIndianNumber(numericValue, showDecimals, 2);
        setDisplayValue(formatted);
      } else {
        setDisplayValue(parts.join('.'));
      }
      onChange?.(numericValue, formatIndianNumber(numericValue, showDecimals, 2));
    }
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Convert to raw number format for editing
    const numValue = parseIndianNumber(displayValue);
    if (numValue > 0) {
      setDisplayValue(numValue.toString());
    }
    props.onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    // Format the number when leaving focus
    const numValue = parseIndianNumber(event.target.value);
    if (numValue > 0) {
      const formatted = formatIndianNumber(numValue, showDecimals, 2);
      setDisplayValue(formatted);
    } else {
      setDisplayValue('');
    }
    props.onBlur?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, home, end, left, right, decimal point
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'Home', 'End', 
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'
    ];
    
    const isNumberKey = (event.key >= '0' && event.key <= '9');
    const isDecimalKey = event.key === '.' && showDecimals;
    const isModifierKey = event.ctrlKey || event.altKey || event.metaKey;
    
    if (!allowedKeys.includes(event.key) && !isNumberKey && !isDecimalKey && !isModifierKey) {
      event.preventDefault();
    }
    
    props.onKeyDown?.(event);
  };

  return (
    <input
      {...props}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`${className} text-right`}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
    />
  );
};

export default IndianNumberInput;