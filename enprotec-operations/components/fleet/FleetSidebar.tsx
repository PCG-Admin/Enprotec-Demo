import * as React from 'react';
import HomeIcon           from '../icons/HomeIcon';
import TruckIcon          from '../icons/TruckIcon';
import ClipboardCheckIcon from '../icons/ClipboardCheckIcon';
import DollarSignIcon     from '../icons/DollarSignIcon';
import FileTextIcon       from '../icons/FileTextIcon';
import ReportsIcon        from '../icons/ReportsIcon';
import WrenchIcon         from '../icons/WrenchIcon';
import CalendarIcon       from '../icons/CalendarIcon';
import ShieldIcon         from '../icons/ShieldIcon';
import EnprotecLogo       from '../icons/EnprotecLogo';
import ChevronRightIcon   from '../icons/ChevronRightIcon';
import { FleetView, User, UserRole } from '../../types';

interface SidebarProps {
  user: User;
  currentView: FleetView;
  setCurrentView: (view: FleetView) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const ALL_FLEET_VIEWS: FleetView[] = [
  'FleetDashboard', 'Vehicles', 'Inspections', 'Compliance',
  'Costs', 'Licenses', 'FleetReports', 'Templates', 'Administration',
];

const MANAGER_FLEET_VIEWS: FleetView[] = [
  'FleetDashboard', 'Vehicles', 'Inspections', 'Compliance',
  'Costs', 'Licenses', 'FleetReports',
];

const DRIVER_FLEET_VIEWS: FleetView[] = [
  'FleetDashboard', 'Inspections',
];

function getAllowedViews(user: User): FleetView[] {
  if (user.role === UserRole.Admin || user.fleet_role != null) return ALL_FLEET_VIEWS;
  return DRIVER_FLEET_VIEWS;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  collapsed: boolean;
}> = ({ icon, label, isActive, onClick, collapsed }) => (
  <li>
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`group relative flex items-center ${
        collapsed ? 'justify-center px-3' : 'px-4'
      } py-3 rounded-md text-sm font-medium transition-colors duration-200 ${
        isActive
          ? 'bg-zinc-100 text-zinc-900'
          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500 rounded-r-full"></div>
      )}
      {icon}
      {collapsed ? (
        <span className="pointer-events-none absolute left-full ml-3 rounded-md bg-zinc-900 px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {label}
        </span>
      ) : (
        <span className="ml-3">{label}</span>
      )}
    </a>
  </li>
);

const FleetSidebar: React.FC<SidebarProps> = ({
  user,
  currentView,
  setCurrentView,
  collapsed,
  onToggle,
  mobileOpen,
}) => {
  const navItems: { label: string; view: FleetView; icon: React.ReactNode }[] = [
    { label: 'Fleet Dashboard', view: 'FleetDashboard', icon: <HomeIcon           className="w-5 h-5" /> },
    { label: 'Vehicles',        view: 'Vehicles',        icon: <TruckIcon          className="w-5 h-5" /> },
    { label: 'Inspections',     view: 'Inspections',     icon: <ClipboardCheckIcon className="w-5 h-5" /> },
    { label: 'Compliance',      view: 'Compliance',      icon: <CalendarIcon       className="w-5 h-5" /> },
    { label: 'Costs',           view: 'Costs',           icon: <DollarSignIcon     className="w-5 h-5" /> },
    { label: 'Licenses',        view: 'Licenses',        icon: <FileTextIcon       className="w-5 h-5" /> },
    { label: 'Fleet Reports',   view: 'FleetReports',    icon: <ReportsIcon        className="w-5 h-5" /> },
    { label: 'Templates',       view: 'Templates',       icon: <WrenchIcon         className="w-5 h-5" /> },
    { label: 'Administration',  view: 'Administration',  icon: <ShieldIcon         className="w-5 h-5" /> },
  ];

  const allowedViews = getAllowedViews(user);
  const visibleNavItems = navItems.filter((item) => allowedViews.includes(item.view));

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-40',
        'flex flex-col flex-shrink-0 bg-white border-r border-zinc-200',
        'w-72 transition-transform duration-300 ease-in-out',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        'md:relative md:inset-auto md:z-auto md:translate-x-0 md:shadow-none',
        collapsed ? 'md:w-20' : 'md:w-72',
      ].join(' ')}
    >
      <div
        className={`relative border-b border-zinc-200 ${
          collapsed ? 'px-3 py-4' : 'px-6 py-6'
        } overflow-visible`}
      >
        <div
          className={`flex flex-col items-center ${
            collapsed ? 'space-y-2' : 'space-y-4'
          }`}
        >
          <EnprotecLogo
            className={`${collapsed ? 'h-8' : 'h-12'} w-auto object-contain`}
          />
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition hover:border-sky-200 hover:text-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronRightIcon
            className={`h-5 w-5 transform transition-transform ${
              collapsed ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>
      <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-4'} py-2`}>
        <ul className="space-y-1">
          {visibleNavItems.map((item) => (
            <NavItem
              key={item.view}
              icon={item.icon}
              label={item.label}
              isActive={currentView === item.view}
              onClick={() => setCurrentView(item.view)}
              collapsed={collapsed}
            />
          ))}
        </ul>
      </nav>
      <div className={`${collapsed ? 'px-2' : 'px-4'} py-4 mt-auto`}>
        {!collapsed && (
          <p className="text-xs text-zinc-400 text-center">&copy; 2026 MindRift</p>
        )}
      </div>
    </aside>
  );
};

export default FleetSidebar;
