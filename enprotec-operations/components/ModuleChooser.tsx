import * as React from 'react';
import EnprotecLogo from './icons/EnprotecLogo';
import type { User } from '../types';

interface Props {
  user: User;
  onSelect: (module: 'fleet' | 'operations') => void;
  onLogout: () => void;
}

const ModuleChooser: React.FC<Props> = ({ user, onSelect, onLogout }) => (
  <div className="min-h-screen bg-zinc-100 flex items-center justify-center px-4">
    <div className="max-w-md w-full">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex justify-center mb-6">
          <EnprotecLogo className="h-14 w-auto" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 text-center mb-1">
          Welcome, {user.name.split(' ')[0]}
        </h2>
        <p className="text-gray-500 text-sm text-center mb-7">Select the system you want to access</p>

        <div className="space-y-3">
          {/* Operations card */}
          <button
            onClick={() => onSelect('operations')}
            className="w-full flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-sky-400 hover:bg-sky-50 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0 group-hover:bg-sky-200 transition-colors">
              <svg className="w-5 h-5 text-sky-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Operations</p>
              <p className="text-gray-400 text-xs mt-0.5">Workflows, deliveries, stock management &amp; more</p>
            </div>
          </button>

          {/* Fleet Management card */}
          <button
            onClick={() => onSelect('fleet')}
            className="w-full flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
              <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Fleet Management</p>
              <p className="text-gray-400 text-xs mt-0.5">Vehicle inspections, compliance, costs &amp; fleet tracking</p>
            </div>
          </button>
        </div>

        <button
          onClick={onLogout}
          className="mt-6 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Sign out
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 mt-4">© 2026 MindRift. All rights reserved.</p>
    </div>
  </div>
);

export default ModuleChooser;
