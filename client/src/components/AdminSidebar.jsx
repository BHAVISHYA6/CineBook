import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Film, Building2, Calendar, Ticket, ChevronRight } from 'lucide-react';

const navItems = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/movies', label: 'Movies', icon: Film },
  { to: '/admin/theatres', label: 'Theatres & Screens', icon: Building2 },
  { to: '/admin/shows', label: 'Showtimes', icon: Calendar },
  { to: '/admin/bookings', label: 'Bookings & Orders', icon: Ticket },
];

export const AdminSidebar = () => {
  return (
    <aside className="w-full md:w-64 bg-[#121927] border border-gray-800 rounded-2xl p-4 shrink-0 h-fit space-y-6 shadow-xl">
      <div className="px-3 pt-2">
        <span className="text-[11px] font-bold tracking-wider uppercase text-red-500">Admin Control</span>
        <h2 className="text-lg font-extrabold text-white">Management</h2>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};
