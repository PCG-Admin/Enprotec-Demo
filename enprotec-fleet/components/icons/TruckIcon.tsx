import React from 'react';
import { IconProps } from './IconProps';

const TruckIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
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
    <path d="M10 17h4V5H2v12h3" />
    <path d="M22 17H14" />
    <path d="M2 17H1" />
    <path d="M13 17H10" />
    <path d="M18 5h-3v12h8V9h-3" />
    <circle cx="7.5" cy="17.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

export default TruckIcon;
