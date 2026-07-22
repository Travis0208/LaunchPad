// Shared building blocks used by Input, Select, and Textarea to eliminate
// the repeated label + error pattern across those components.

export const INPUT_BASE   = 'block w-full rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed';
export const INPUT_NORMAL = 'border-gray-300 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900 placeholder-gray-400';
export const INPUT_ERROR  = 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-white text-gray-900';

export function inputBorderStyles(hasError: boolean): string {
  return hasError ? INPUT_ERROR : INPUT_NORMAL;
}

export function FormLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}
