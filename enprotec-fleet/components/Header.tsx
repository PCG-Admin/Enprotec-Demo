import * as React from 'react';
import BellIcon from './icons/BellIcon';
import UserIcon from './icons/UserIcon';
import LogOutIcon from './icons/LogOutIcon';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onMobileMenuToggle: () => void;
  onSwitchModule?: (m: 'fleet' | 'operations') => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onMobileMenuToggle, onSwitchModule }) => {
  return (
    <header className="bg-white border-b border-zinc-200 h-16 md:h-20 px-4 md:px-8 flex justify-between items-center z-10 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 -ml-1 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          aria-label="Open menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <h1 className="text-base md:text-xl font-bold text-zinc-900 leading-tight">Fleet Management</h1>
          <p className="text-xs md:text-sm text-zinc-500 hidden sm:block">Monitor and manage your fleet operations.</p>
        </div>
      </div>

      {/* Module switcher — only shown when user has access to both */}
      {onSwitchModule && (
        <div className="hidden sm:flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          <button
            onClick={() => onSwitchModule('operations')}
            className="text-xs font-medium px-3 py-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-white transition-colors"
          >
            Operations
          </button>
          <button
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-white text-zinc-900 shadow-sm"
            disabled
          >
            Fleet Management
          </button>
        </div>
      )}

      <div className="flex items-center space-x-3 md:space-x-6">
        <button className="relative text-zinc-500 hover:text-sky-500 transition-colors">
          <BellIcon className="w-5 h-5 md:w-6 md:h-6" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white"></span>
          </span>
        </button>

        <div className="flex items-center space-x-2 md:space-x-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-zinc-200 border-2 border-zinc-300 flex items-center justify-center flex-shrink-0">
            <UserIcon className="w-5 h-5 md:w-6 md:h-6 text-zinc-500" />
          </div>
          <div className="hidden sm:block">
            <div className="font-semibold text-zinc-800 text-sm">{user?.name}</div>
            <div className="text-xs text-zinc-500">{user?.role}</div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center text-zinc-500 hover:text-sky-500 transition-colors"
          title="Logout"
        >
          <LogOutIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default Header;
