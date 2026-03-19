import React from 'react';
import { IconProps } from './IconProps';

const MindriftLogo: React.FC<IconProps> = ({ className = 'h-8' }) => (
  <img
    src="https://ndjaufwwbtekysvrmhwm.supabase.co/storage/v1/object/public/pcg-images/Mindrift_Logo-06.png"
    alt="Mindrift Logo"
    className={className}
  />
);

export default MindriftLogo;