import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Ticket, User, Film, Calendar, IndianRupee } from 'lucide-react';
import { AdminSidebar } from '../components/AdminSidebar';
import api from '../services/api';
import { formatPrice, formatDate, formatTime } from '../utils/formatters';

export const AdminBookingsPage = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['adminBookings', search, status, page],
    queryFn: async () => {
      const params = { page: String(page), limit: '15' };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;

      const res = await api.get('/api/admin/bookings', { params });
      return res.data?.data;
    },
  });

  const bookings = data?.bookings || [];
  const pagination = data?.pagination || { total: 0, totalPages: 1 };

  return (
    <div className="flex flex-col md:flex-row gap-8 pb-20">
      <AdminSidebar />

      <div className="flex-1 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Bookings & Orders</h1>
          <p className="text-xs text-gray-400">Search customer reservations, audit payment attempts, and verify tickets.</p>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#121927] p-4 rounded-xl border border-gray-800">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by customer, email, movie or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-red-500"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="PENDING">PENDING</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="EXPIRED">EXPIRED</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#121927] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-gray-500">Loading bookings...</div>
          ) : bookings.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">No booking records match the criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-gray-800">
                  <tr>
                    <th className="p-3">Ref ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Movie & Theatre</th>
                    <th className="p-3">Showtime</th>
                    <th className="p-3">Seats</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-800/30">
                      <td className="p-3 font-mono font-bold text-white">{b.id.slice(-8)}</td>
                      <td className="p-3">
                        <div className="font-semibold text-white">{b.user?.name}</div>
                        <div className="text-[10px] text-gray-500">{b.user?.email}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-white font-medium">{b.show?.movie?.title}</div>
                        <div className="text-[10px] text-gray-400">{b.show?.screen?.theatre?.name}</div>
                      </td>
                      <td className="p-3">
                        <div>{formatDate(b.show?.startsAt)}</div>
                        <div className="text-[10px] text-gray-500">{formatTime(b.show?.startsAt)}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-[120px]">
                          {b.showSeats?.map((ss) => (
                            <span
                              key={ss.id}
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-800 text-gray-300 border border-gray-700"
                            >
                              {ss.seat?.row}{ss.seat?.number}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 font-bold text-emerald-400 font-mono">
                        {formatPrice(b.totalAmountPaise)}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-gray-400">
                        {b.paymentAttempts?.[0]?.providerPaymentId || (b.razorpayOrderId ? 'Order Created' : '-')}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === 'CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : b.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
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

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
              <span>Total {pagination.total} bookings</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded bg-gray-800 text-white disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-2 py-1">Page {page} of {pagination.totalPages}</span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded bg-gray-800 text-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
