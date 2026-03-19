import React from 'react';
import { IconProps } from './IconProps';

const ENPROTEC_LOGO_SRC =
  '/BR002-Full%20colour%20w%20slogan%20Landscape-2500px-Rev03%20(1).jpg';

const EnprotecLogo: React.FC<IconProps> = ({ className = 'h-8' }) => (
  <img
    src={ENPROTEC_LOGO_SRC}
    alt="Enprotec Logo"
    className={className}
    loading="lazy"
  />
);

export default EnprotecLogo;
