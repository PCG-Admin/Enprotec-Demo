
import React from 'react';
import { IconProps } from './IconProps';

const WorkflowIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
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
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <line x1="10" y1="6.5" x2="14" y2="6.5" />
    <line x1="6.5" y1="10" x2="6.5" y2="14" />
    <line x1="17.5" y1="10" x2="17.5" y2="14" />
    <line x1="10" y1="17.5" x2="14" y2="17.5" />
  </svg>
);

export default WorkflowIcon;
