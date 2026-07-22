import { SelectHTMLAttributes, forwardRef } from 'react';
import { FormLabel, FormError, INPUT_BASE, inputBorderStyles } from './FormField';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && <FormLabel htmlFor={inputId}>{label}</FormLabel>}
        <select
          id={inputId}
          ref={ref}
          className={`${INPUT_BASE} px-3 py-2 ${inputBorderStyles(!!error)} ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <FormError message={error} />
      </div>
    );
  }
);

Select.displayName = 'Select';
