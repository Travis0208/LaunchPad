interface BadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  primary: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-800',
};

export function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
