import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Calendar, Clock, Film, AlertCircle, X } from 'lucide-react';
import { AdminSidebar } from '../components/AdminSidebar';
import api from '../services/api';
import { formatPrice, formatDate, formatTime } from '../utils/formatters';

export const AdminShowsPage = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [movieId, setMovieId] = useState('');
  const [theatreId, setTheatreId] = useState('');
  const [screenId, setScreenId] = useState('');
  const [showDate, setShowDate] = useState(new Date().toISOString().split('T')[0]);
  const [showTime, setShowTime] = useState('18:30');
  const [basePricePaise, setBasePricePaise] = useState(25000); // ₹250

  // 1. Fetch Movies
  const { data: movies = [] } = useQuery({
    queryKey: ['adminMovies'],
    queryFn: async () => {
      const res = await api.get('/api/movies?limit=100');
      return res.data?.data?.movies || [];
    },
  });

  // 2. Fetch Theatres
  const { data: theatres = [] } = useQuery({
    queryKey: ['adminTheatres'],
    queryFn: async () => {
      const res = await api.get('/api/theatres');
      return res.data?.data?.theatres || [];
    },
  });

  // 3. Fetch Shows
  const { data: shows = [], isLoading } = useQuery({
    queryKey: ['adminShows'],
    queryFn: async () => {
      const res = await api.get('/api/shows');
      return res.data?.data?.shows || [];
    },
  });

  // Filter screens for selected theatre
  const currentTheatre = theatres.find((t) => t.id === theatreId);
  const availableScreens = currentTheatre?.screens || [];

  // Create Show Mutation
  const createShowMutation = useMutation({
    mutationFn: async () => {
      const startsAt = new Date(`${showDate}T${showTime}:00`).toISOString();
      return api.post('/api/shows', {
        movieId,
        screenId,
        startsAt,
        basePricePaise: parseInt(basePricePaise, 10),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminShows'] });
      setModalOpen(false);
    },
    onError: (err) => {
      setError(
        err.response?.data?.error?.message ||
          'Failed to schedule show. There might be a schedule conflict.'
      );
    },
  });

  // Delete / Deactivate Show Mutation
  const deleteShowMutation = useMutation({
    mutationFn: async (id) => {
      return api.delete(`/api/shows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminShows'] });
    },
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to deactivate this show screening?')) {
      deleteShowMutation.mutate(id);
    }
  };

  const openModal = () => {
    setError('');
    if (movies.length > 0) setMovieId(movies[0].id);
    if (theatres.length > 0) {
      setTheatreId(theatres[0].id);
      if (theatres[0].screens?.length > 0) setScreenId(theatres[0].screens[0].id);
    }
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 pb-20">
      <AdminSidebar />

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Showtime Scheduling</h1>
            <p className="text-xs text-gray-400">Schedule movie screenings, define ticket tiers, and prevent timing conflicts.</p>
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule New Show</span>
          </button>
        </div>

        {/* Shows Table */}
        <div className="bg-[#121927] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-gray-500">Loading shows...</div>
          ) : shows.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">No scheduled shows found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-gray-800">
                  <tr>
                    <th className="p-3">Movie</th>
                    <th className="p-3">Theatre & Screen</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Base Price</th>
                    <th className="p-3">Inventory</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {shows.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-800/30">
                      <td className="p-3 font-bold text-white">
                        {s.movie?.title}
                      </td>
                      <td className="p-3">
                        <div className="text-white font-medium">{s.screen?.theatre?.name}</div>
                        <div className="text-[10px] text-gray-500">{s.screen?.name} ({s.screen?.theatre?.city})</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-white">{formatDate(s.startsAt)}</div>
                        <div className="text-[10px] text-emerald-400 font-medium">
                          {formatTime(s.startsAt)} - {formatTime(s.endsAt)}
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        {formatPrice(s.basePricePaise)}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-800 text-gray-300 border border-gray-700">
                          {s._count?.showSeats || 0} seats generated
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 transition"
                          title="Deactivate show"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Schedule Show */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121927] border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-lg font-bold text-white">Schedule Show</h3>
                <button onClick={() => setModalOpen(false)} className="p-1 text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/50 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createShowMutation.mutate();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Select Movie</label>
                  <select
                    value={movieId}
                    onChange={(e) => setMovieId(e.target.value)}
                    required
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {movies.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({m.durationMin} mins)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Select Theatre</label>
                  <select
                    value={theatreId}
                    onChange={(e) => {
                      setTheatreId(e.target.value);
                      const t = theatres.find((th) => th.id === e.target.value);
                      if (t?.screens?.length) setScreenId(t.screens[0].id);
                    }}
                    required
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {theatres.map((th) => (
                      <option key={th.id} value={th.id}>
                        {th.name} ({th.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Select Screen</label>
                  <select
                    value={screenId}
                    onChange={(e) => setScreenId(e.target.value)}
                    required
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {availableScreens.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name} ({sc.totalSeats} seats)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={showDate}
                      onChange={(e) => setShowDate(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      value={showTime}
                      onChange={(e) => setShowTime(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Base Ticket Price (in Paise, ₹250 = 25000)</label>
                  <input
                    type="number"
                    required
                    step={100}
                    value={basePricePaise}
                    onChange={(e) => setBasePricePaise(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <span className="text-[11px] text-emerald-400 mt-1 block">
                    Display: {formatPrice(basePricePaise || 0)}
                  </span>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createShowMutation.isPending || !screenId}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition disabled:opacity-50"
                  >
                    {createShowMutation.isPending ? 'Validating Schedule...' : 'Confirm Showtime'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
