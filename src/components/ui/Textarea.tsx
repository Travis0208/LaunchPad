import { TextareaHTMLAttributes, forwardRef } from 'react';
import { FormLabel, FormError, INPUT_BASE, inputBorderStyles } from './FormField';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && <FormLabel htmlFor={inputId}>{label}</FormLabel>}
        <textarea
          id={inputId}
          ref={ref}
          className={`${INPUT_BASE} px-3 py-2 resize-y ${inputBorderStyles(!!error)} ${className}`}
          {...props}
        />
        <FormError message={error} />
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
