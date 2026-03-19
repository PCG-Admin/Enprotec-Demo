import React from 'react';
import { IconProps } from './IconProps';

const MINDRIFT_LOGO_SRC =
  'https://ndjaufwwbtekysvrmhwm.supabase.co/storage/v1/object/public/pcg-images/Mindrift_Logo-06.png';

const EnprotecLogo: React.FC<IconProps> = ({ className = 'h-8' }) => (
  <img
    src={MINDRIFT_LOGO_SRC}
    alt="MindRift Logo"
    className={className}
    loading="lazy"
  />
);

export default EnprotecLogo;
