import React from 'react';
import { IconProps } from './IconProps';

const StoreIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3 6.5l8-4.5a2 2 0 0 1 2 0l8 4.5a2 2 0 0 1 1 1.85Z"/>
    <path d="M12 22V12"/>
    <path d="M22 20V8"/>
    <path d="M2 20V8"/>
    <path d="M20 12H4"/>
  </svg>
);

export default StoreIcon;