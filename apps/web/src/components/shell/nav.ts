import {
  ClipboardCheckIcon,
  LayoutDashboardIcon,
  ReceiptTextIcon,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/api/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: readonly UserRole[];
}

/**
 * Only destinations that exist right now. Later phases append their
 * routes here as they ship — never link ahead to unbuilt pages.
 */
const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboardIcon,
    roles: ['EMPLOYEE', 'DIRECTOR', 'ACCOUNTS'],
  },
  {
    to: '/vouchers',
    label: 'My Vouchers',
    icon: ReceiptTextIcon,
    roles: ['EMPLOYEE'],
  },
  {
    to: '/approvals',
    label: 'Pending Approvals',
    icon: ClipboardCheckIcon,
    roles: ['DIRECTOR'],
  },
  {
    to: '/vouchers',
    label: 'All Vouchers',
    icon: ReceiptTextIcon,
    roles: ['DIRECTOR', 'ACCOUNTS'],
  },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
