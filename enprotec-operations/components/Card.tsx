import React from 'react';

interface CardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  padding?: string;
}

const Card: React.FC<CardProps> = ({ title, icon, children, className = '', titleClassName = '', padding = 'p-6' }) => {
  return (
    <div className={`bg-white rounded-lg border border-zinc-200 ${className}`}>
      {(title || icon) && (
        <div className={`flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-200`}>
          <h3 className={`text-lg font-semibold text-zinc-900 ${titleClassName}`}>{title}</h3>
          {icon && <div className="text-zinc-500">{icon}</div>}
        </div>
      )}
      <div className={padding}>{children}</div>
    </div>
  );
};

export default Card;