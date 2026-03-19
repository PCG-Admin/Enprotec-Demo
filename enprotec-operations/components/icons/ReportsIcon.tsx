
import React from 'react';
import { IconProps } from './IconProps';

const ReportsIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
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
    <path d="M3 3v18h18" />
    <path d="M18.7 8a2.3 2.3 0 0 0-3.4 0l-4.6 4.6a2.3 2.3 0 0 0 0 3.4l3.4 3.4a2.3 2.3 0 0 0 3.4 0l4.6-4.6a2.3 2.3 0 0 0 0-3.4Z" />
  </svg>
);

export default ReportsIcon;
