import React, { ButtonHTMLAttributes } from 'react'
import { LucideIcon } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'outline'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: LucideIcon
  fullWidth?: boolean
  rounded?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  icon: Icon,
  fullWidth = false,
  className = '',
  disabled = false,
  rounded = false,
  ...props
}) => {
  const baseStyles = 'px-4 py-2 font-medium transition-colors flex items-center justify-center'
  const widthStyles = fullWidth ? 'w-full' : ''
  
  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-purple-700 text-white hover:bg-purple-800 disabled:bg-purple-300 transition-colors',
    secondary: 'bg-gray-500 text-white hover:bg-gray-600 disabled:bg-gray-300',
    success: 'bg-green-500 text-white hover:bg-green-600 disabled:bg-green-300',
    danger: 'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300',
    outline: 'bg-transparent text-blue-500 border border-blue-500 hover:bg-blue-50 disabled:bg-transparent disabled:text-blue-300 disabled:border-blue-300',
  }

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${widthStyles} ${className} ${rounded ? 'rounded-full' : 'rounded-md'}`

  return (
    <button className={combinedClassName} disabled={disabled} {...props}>
      {Icon && <Icon className="w-5 h-5 mr-2" />}
      {children}
    </button>
  )
}