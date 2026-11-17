import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Film, Building2, Calendar, Ticket, IndianRupee, ArrowUpRight, Clock } from 'lucide-react';
import { AdminSidebar } from '../components/AdminSidebar';
import api from '../services/api';
import { formatPrice, formatDate, formatTime } from '../utils/formatters';

export const AdminOverviewPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['adminOverview'],
    queryFn: async () => {
      const res = await api.get('/api/admin/overview');
      return res.data?.data;
    },
  });

  const stats = data?.stats || {};
  const recentBookings = data?.recentBookings || [];

  const statCards = [
    { label: 'Total Movies', value: stats.totalMovies || 0, icon: Film, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { label: 'Theatres', value: stats.totalTheatres || 0, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Active Shows', value: stats.totalShows || 0, icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Total Bookings', value: stats.totalBookings || 0, icon: Ticket, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Total Revenue', value: formatPrice(stats.totalRevenuePaise || 0), icon: IndianRupee, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8 pb-20">
      <AdminSidebar />

      <div className="flex-1 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Overview</h1>
          <p className="text-xs text-gray-400">Real-time cinema performance and booking analytics.</p>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-28 bg-[#121927] rounded-2xl animate-pulse border border-gray-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  className="bg-[#121927] border border-gray-800 rounded-2xl p-5 space-y-3 hover:border-gray-700 transition shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">{card.label}</span>
                    <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center ${card.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-white">{card.value}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Activity Table */}
        <div className="bg-[#121927] border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
            <div>
              <h2 className="text-base font-bold text-white">Recent Customer Bookings</h2>
              <p className="text-xs text-gray-400">Latest reservations processed through the system.</p>
            </div>
            <a href="/admin/bookings" className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold">
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {recentBookings.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">No bookings recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-gray-800">
                  <tr>
                    <th className="p-3">Booking ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Movie & Theatre</th>
                    <th className="p-3">Showtime</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-800/30">
                      <td className="p-3 font-mono font-bold text-white">{b.id.slice(-8)}</td>
                      <td className="p-3">
                        <div className="font-medium text-white">{b.user?.name}</div>
                        <div className="text-[10px] text-gray-500">{b.user?.email}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-white font-medium">{b.show?.movie?.title}</div>
                        <div className="text-[10px] text-gray-400">{b.show?.screen?.theatre?.name}</div>
                      </td>
                      <td className="p-3">
                        {b.show?.startsAt ? formatTime(b.show.startsAt) : '-'}
                      </td>
                      <td className="p-3 font-bold text-emerald-400">{formatPrice(b.totalAmountPaise)}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === 'CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
