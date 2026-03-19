import React from 'react';
import { IconProps } from './IconProps';

const PackageIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
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
    <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v2" />
    <path d="M21 14v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M3 10h18" />
    <path d="M12 20v-5" />
  </svg>
);

export default PackageIcon;
