import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FilePlus, Settings as SettingsIcon, FileText, ShieldCheck } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore.js';
import { useDocumentsStore } from '../../store/useDocumentsStore.js';
import Toast from './Toast.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

const navItems = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/new', label: 'Nouveau document', icon: FilePlus },
  { to: '/settings', label: 'Paramètres', icon: SettingsIcon },
];

export default function Shell() {
  const company = useSettingsStore((s) => s.company);
  const documents = useDocumentsStore((s) => s.documents);
  const location = useLocation();
  const recent = [...documents].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 6);

  return (
    <div className="h-full flex flex-col bg-unitep-gray">
      {/* ─── Header global ─── */}
      <header className="h-14 bg-white border-b border-unitep-border flex items-center px-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-unitep-navy flex items-center justify-center text-white font-bold text-sm shadow-sm">
            Q3
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-unitep-navy">Qualidoc V3</div>
            <div className="text-[11px] text-slate-500">Gabarit UNITEP — IA Mistral</div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-unitep-navy" />
          <span className="font-medium">{company?.name || 'EDF — UNITEP'}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ─── Sidebar ─── */}
        <aside className="w-60 bg-white border-r border-unitep-border flex flex-col shrink-0">
          <nav className="p-3 space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-unitep-navy text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-2 px-3 flex-1 overflow-auto">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 mb-2 mt-2">
              Documents récents
            </div>
            {recent.length === 0 ? (
              <div className="px-3 text-xs text-slate-400 italic">Aucun document</div>
            ) : (
              <div className="space-y-0.5">
                {recent.map((d) => {
                  const active = location.pathname.includes(d.id);
                  return (
                    <NavLink
                      key={d.id}
                      to={`/editor/${d.id}`}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors ${
                        active ? 'bg-unitep-navy/10 text-unitep-navy font-medium' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                      title={d.title}
                    >
                      <FileText className="w-3 h-3 shrink-0" />
                      <span className="truncate">{d.title}</span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-unitep-border">
            <div className="text-[10px] text-slate-400">Version 3.0.0 — UNITEP</div>
          </div>
        </aside>

        {/* ─── Contenu ─── */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <Toast />
      <ConfirmDialog />
    </div>
  );
}
