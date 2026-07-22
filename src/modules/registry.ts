// ─── LaunchPad Module Registry ─────────────────────────────────────────────────
//
// Each module (current or future) is registered here. The Sidebar and App router
// consume this registry to build navigation and route definitions.
//
// To add a new module:
//  1. Add a ModuleDefinition entry in MODULES below.
//  2. Set `enabled: true` when the module is ready to ship.
//  3. Provide route definitions in `routes` — App.tsx will wire them automatically.

import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Briefcase, Users, Kanban, Brain,
  Calendar, FileText, MailX, BarChart3, Settings,
  UserPlus, GraduationCap, Target, ShieldCheck, Share2,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  enabled: boolean;
  comingSoon?: boolean;
  navGroup: 'core' | 'recruit' | 'people' | 'system';
  navItems: NavItem[];
}

// ─── Module Definitions ───────────────────────────────────────────────────────

export const MODULES: ModuleDefinition[] = [
  // ── Recruit (active) ─────────────────────────────────────────────────────
  {
    id: 'recruit',
    name: 'LaunchPad Recruit',
    description: 'End-to-end applicant tracking: vacancies, pipeline, interviews, offers.',
    icon: Briefcase,
    color: 'blue',
    enabled: true,
    navGroup: 'recruit',
    navItems: [
      { path: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
      { path: '/vacancies',  label: 'Vacancies',  icon: Briefcase },
      { path: '/candidates', label: 'Candidates', icon: Users },
      { path: '/pipeline',   label: 'Pipeline',   icon: Kanban },
      { path: '/ai-review',  label: 'AI Review',  icon: Brain },
      { path: '/interviews', label: 'Interviews', icon: Calendar },
      { path: '/offers',     label: 'Offers',     icon: FileText },
      { path: '/regret',     label: 'Regret',     icon: MailX },
      { path: '/reports',    label: 'Reports',    icon: BarChart3 },
    ],
  },

  // ── Future modules ────────────────────────────────────────────────────────
  {
    id: 'refer',
    name: 'LaunchPad Refer',
    description: 'Employee referral portal — reward your best source of hires.',
    icon: Share2,
    color: 'violet',
    enabled: false,
    comingSoon: true,
    navGroup: 'recruit',
    navItems: [{ path: '/refer', label: 'Refer', icon: Share2 }],
  },
  {
    id: 'onboard',
    name: 'LaunchPad Onboard',
    description: 'Digital onboarding — paperless, tracked, compliant.',
    icon: UserPlus,
    color: 'teal',
    enabled: false,
    comingSoon: true,
    navGroup: 'people',
    navItems: [{ path: '/onboard', label: 'Onboard', icon: UserPlus }],
  },
  {
    id: 'learn',
    name: 'LaunchPad Learn',
    description: 'Learning & development paths for your workforce.',
    icon: GraduationCap,
    color: 'amber',
    enabled: false,
    comingSoon: true,
    navGroup: 'people',
    navItems: [{ path: '/learn', label: 'Learn & Develop', icon: GraduationCap }],
  },
  {
    id: 'perform',
    name: 'LaunchPad Perform',
    description: 'Performance reviews, KPIs, and 360 feedback.',
    icon: Target,
    color: 'orange',
    enabled: false,
    comingSoon: true,
    navGroup: 'people',
    navItems: [{ path: '/perform', label: 'Perform', icon: Target }],
  },
  {
    id: 'compliance',
    name: 'LaunchPad Compliance',
    description: 'Certifications, regulatory tracking, and audit trails.',
    icon: ShieldCheck,
    color: 'red',
    enabled: false,
    comingSoon: true,
    navGroup: 'people',
    navItems: [{ path: '/compliance', label: 'Compliance', icon: ShieldCheck }],
  },
];

// ─── Selectors ────────────────────────────────────────────────────────────────

export const SYSTEM_NAV: NavItem = { path: '/settings', label: 'Settings', icon: Settings };

export function enabledModules(): ModuleDefinition[] {
  return MODULES.filter(m => m.enabled);
}

export function allNavItems(): NavItem[] {
  return MODULES.flatMap(m => (m.enabled ? m.navItems : []));
}

export function getModule(id: string): ModuleDefinition | undefined {
  return MODULES.find(m => m.id === id);
}
