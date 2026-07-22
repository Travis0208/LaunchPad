import { NavLink } from 'react-router-dom';
import { LogOut, Rocket, Menu, X, Settings, Lock } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks';
import { MODULES, SYSTEM_NAV, type ModuleDefinition } from '../modules/registry';

// ─── Sub-components ────────────────────────────────────────────────────────────

function ActiveNavItems({
  modules,
  onNavigate,
}: {
  modules: ModuleDefinition[];
  onNavigate: () => void;
}) {
  return (
    <>
      {modules.map(mod =>
        mod.navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })
      )}
    </>
  );
}

function ComingSoonItems({ modules }: { modules: ModuleDefinition[] }) {
  if (!modules.length) return null;
  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
        Coming Soon
      </p>
      {modules.map(mod => {
        const Icon = mod.icon;
        return (
          <div
            key={mod.id}
            className="nav-link opacity-50 cursor-not-allowed select-none"
            title={mod.description}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 truncate">{mod.name.replace('LaunchPad ', '')}</span>
            <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setMobileOpen(false);

  const activeModules  = MODULES.filter(m => m.enabled);
  const upcomingModules = MODULES.filter(m => m.comingSoon);
  const SettingsIcon = SYSTEM_NAV.icon;

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 flex-shrink-0">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-dark-800 rounded-xl flex items-center justify-center">
          <Rocket className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">LaunchPad</h1>
          <p className="text-xs text-gray-500">People Platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto scrollbar-thin space-y-0.5">
        <ActiveNavItems modules={activeModules} onNavigate={close} />
        <ComingSoonItems modules={upcomingModules} />
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        <NavLink
          to={SYSTEM_NAV.path}
          onClick={close}
          className={({ isActive }) => `nav-link mb-2 ${isActive ? 'active' : ''}`}
        >
          <SettingsIcon className="w-5 h-5 flex-shrink-0" />
          <span>{SYSTEM_NAV.label}</span>
        </NavLink>

        <div className="flex items-center gap-3 px-3 py-2 mt-1">
          <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-primary-700 font-semibold text-sm">
              {profile?.full_name?.charAt(0) ?? 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name ?? 'User'}</p>
            <p className="text-xs text-gray-500 capitalize">{profile?.role ?? 'Unknown'}</p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="nav-link w-full mt-1 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
        aria-label="Open navigation"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        <NavContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black/50" onClick={close} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white flex flex-col">
            <button onClick={close} className="absolute top-4 right-4 p-2" aria-label="Close navigation">
              <X className="w-6 h-6 text-gray-500" />
            </button>
            <NavContent />
          </aside>
        </div>
      )}
    </>
  );
}
