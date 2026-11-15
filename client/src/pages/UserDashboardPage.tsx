import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Ticket, Calendar, Clock, Film, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Booking } from '../types';
import { formatPrice, formatDate, formatTime } from '../utils/formatters';

export const UserDashboardPage: React.FC = () => {
  const { user } = useAuth();

  // Fetch user profile and booking history
  const { data: bookingsData, isLoading } = useQuery<Booking[]>({
    queryKey: ['userBookings'],
    queryFn: async () => {
      // Fetch bookings for the authenticated user
      const res = await api.get('/api/auth/me');
      const currentUser = res.data?.data?.user;
      return (currentUser?.bookings || []) as Booking[];
    },
  });

  const bookings = bookingsData || [];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Profile Card */}
      <div className="bg-[#121927] border border-gray-800 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 shadow-xl">
        <div className="w-20 h-20 rounded-full bg-red-600/10 border-2 border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
          <User className="w-10 h-10" />
        </div>
        <div className="text-center sm:text-left space-y-1">
          <h1 className="text-2xl font-bold text-white">{user?.name}</h1>
          <p className="text-xs text-gray-400">{user?.email}</p>
          {user?.phone && <p className="text-xs text-gray-500">{user?.phone}</p>}
          <div className="pt-2">
            <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-gray-800 text-gray-300 uppercase tracking-wider border border-gray-700">
              Role: {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Bookings Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
          <Ticket className="w-5 h-5 text-red-500" />
          <h2 className="text-xl font-bold text-white">Your Bookings & Tickets</h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-32 bg-[#121927] animate-pulse rounded-2xl border border-gray-800" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 bg-[#121927]/40 rounded-2xl border border-gray-800 space-y-3">
            <Ticket className="w-10 h-10 text-gray-600 mx-auto" />
            <h3 className="text-base font-semibold text-gray-300">No bookings yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Ready for a movie? Browse our latest screenings and book your favorite seats!
            </p>
            <div className="pt-2">
              <a
                href="/"
                className="inline-flex px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg shadow-red-600/30 transition"
              >
                Explore Movies
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="bg-[#121927] border border-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-gray-700 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">Ref: {b.id.slice(-8)}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        b.status === 'CONFIRMED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">Movie Booking</h3>
                  <div className="text-xs text-gray-400 flex flex-wrap gap-4">
                    <span>Amount: <strong className="text-emerald-400">{formatPrice(b.totalAmountPaise)}</strong></span>
                    {b.createdAt && <span>Booked On: {formatDate(b.createdAt)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
