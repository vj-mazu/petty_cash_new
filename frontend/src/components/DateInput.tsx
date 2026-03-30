import React, { useRef, useState } from 'react';

interface DateInputProps {
  value: string; // yyyy-MM-dd
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  min?: string;
  max?: string;
  title?: string;
}

const DateInput: React.FC<DateInputProps> = ({ value, onChange, className = '', id, name, ...rest }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Convert yyyy-MM-dd → DD/MM/YYYY for display
  const displayDate = value
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
    : '';

  return (
    <div
      className={`relative cursor-pointer ${focused ? 'ring-2 ring-indigo-500 rounded-md' : ''}`}
      onClick={() => {
        try { inputRef.current?.showPicker(); } catch { inputRef.current?.focus(); }
      }}
    >
      {/* Display div showing DD/MM/YYYY */}
      <div className={`flex items-center justify-between pointer-events-none ${className}`}>
        <span className={displayDate ? '' : 'text-gray-400 dark:text-gray-500'}>
          {displayDate || 'DD/MM/YYYY'}
        </span>
        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      {/* Hidden native date input for picker */}
      <input
        ref={inputRef}
        type="date"
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        tabIndex={0}
        {...rest}
      />
    </div>
  );
};

export default DateInput;
