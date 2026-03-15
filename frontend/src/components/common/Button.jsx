import React from 'react';

const variants = {
  primary: 'bg-accent hover:bg-accent-hover text-white border-transparent',
  secondary: 'bg-bg-hover hover:bg-[#2d3447] text-text-primary border-border-default',
  danger: 'bg-transparent hover:bg-red-900/20 text-error border-error/30',
  ghost: 'bg-transparent hover:bg-bg-hover text-text-secondary hover:text-text-primary border-transparent',
  success: 'bg-success/10 hover:bg-success/20 text-success border-success/30',
};

const sizes = {
  xs: 'px-2 py-0.5 text-[10px] h-5',
  sm: 'px-2.5 py-1 text-xs h-6',
  md: 'px-3 py-1.5 text-xs h-7',
  lg: 'px-4 py-2 text-sm h-8',
};

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  type = 'button',
  title,
  ...props
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center gap-1.5 rounded
        border font-medium transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer select-none whitespace-nowrap
        ${variants[variant] || variants.secondary}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      {...props}
    >
      {loading && (
        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

export default Button;
