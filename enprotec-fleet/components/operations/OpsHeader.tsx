import React from 'react';
import BellIcon from './icons/BellIcon';
import UserIcon from './icons/UserIcon';
import LogOutIcon from './icons/LogOutIcon';
import { User } from '../../types';

interface Props {
  user: User;
  onLogout: () => void;
  onSwitchToFleet?: () => void;
}

const OpsHeader: React.FC<Props> = ({ user, onLogout, onSwitchToFleet }) => (
  <header className="bg-white border-b border-zinc-200 h-16 px-4 md:px-8 flex justify-between items-center z-10 flex-shrink-0">
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Welcome, {user.name.split(' ')[0]}</h1>
      <p className="text-sm text-zinc-500">Operations</p>
    </div>

    {onSwitchToFleet && (
      <div className="hidden sm:flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
        <button className="text-xs font-medium px-3 py-1.5 rounded-md bg-white text-zinc-900 shadow-sm" disabled>
          Operations
        </button>
        <button
          onClick={onSwitchToFleet}
          className="text-xs font-medium px-3 py-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-white transition-colors"
        >
          Fleet Management
        </button>
      </div>
    )}

    <div className="flex items-center space-x-4">
      <button className="relative text-zinc-500 hover:text-sky-500 transition-colors">
        <BellIcon className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white" />
        </span>
      </button>
      <div className="flex items-center space-x-2">
        <div className="w-9 h-9 rounded-full bg-zinc-200 flex items-center justify-center">
          <UserIcon className="w-5 h-5 text-zinc-500" />
        </div>
        <div className="hidden md:block">
          <div className="font-semibold text-zinc-800 text-sm">{user.name}</div>
          <div className="text-xs text-zinc-500">{user.role}</div>
        </div>
      </div>
      <button onClick={onLogout} className="text-zinc-500 hover:text-sky-500 transition-colors" title="Logout">
        <LogOutIcon className="w-5 h-5" />
      </button>
    </div>
  </header>
);

export default OpsHeader;
