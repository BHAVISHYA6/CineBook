import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2, MapPin, Monitor, X, AlertCircle } from 'lucide-react';
import { AdminSidebar } from '../components/AdminSidebar';
import api from '../services/api';

export const AdminTheatresPage = () => {
  const queryClient = useQueryClient();
  const [theatreModalOpen, setTheatreModalOpen] = useState(false);
  const [screenModalOpen, setScreenModalOpen] = useState(false);
  const [selectedTheatre, setSelectedTheatre] = useState(null);
  const [error, setError] = useState('');

  // Theatre Form
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');

  // Screen Form
  const [screenName, setScreenName] = useState('Screen 1 - 4K Dolby Atmos');
  const [standardRows, setStandardRows] = useState(4);
  const [premiumRows, setPremiumRows] = useState(2);
  const [reclinerRows, setReclinerRows] = useState(1);
  const [seatsPerRow, setSeatsPerRow] = useState(10);

  // Fetch Theatres
  const { data: theatres = [], isLoading } = useQuery({
    queryKey: ['adminTheatres'],
    queryFn: async () => {
      const res = await api.get('/api/theatres');
      return res.data?.data?.theatres || [];
    },
  });

  // Create Theatre Mutation
  const createTheatreMutation = useMutation({
    mutationFn: async () => {
      return api.post('/api/theatres', { name, city, address });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminTheatres'] });
      setTheatreModalOpen(false);
      setName('');
      setCity('');
      setAddress('');
    },
    onError: (err) => {
      setError(err.response?.data?.error?.message || 'Failed to create theatre.');
    },
  });

  // Create Screen Mutation
  const createScreenMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/api/theatres/${selectedTheatre.id}/screens`, {
        name: screenName,
        layout: {
          standardRows: parseInt(standardRows, 10),
          premiumRows: parseInt(premiumRows, 10),
          reclinerRows: parseInt(reclinerRows, 10),
          seatsPerRow: parseInt(seatsPerRow, 10),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminTheatres'] });
      setScreenModalOpen(false);
    },
    onError: (err) => {
      setError(err.response?.data?.error?.message || 'Failed to create screen.');
    },
  });

  const openAddScreen = (th) => {
    setSelectedTheatre(th);
    setScreenName(`Screen ${(th.screens?.length || 0) + 1} - Dolby Atmos`);
    setError('');
    setScreenModalOpen(true);
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 pb-20">
      <AdminSidebar />

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Theatres & Screens</h1>
            <p className="text-xs text-gray-400">Manage cinema properties and auditorium seating configurations.</p>
          </div>
          <button
            onClick={() => {
              setError('');
              setTheatreModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Theatre</span>
          </button>
        </div>

        {/* Theatres List */}
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-500">Loading theatres...</div>
        ) : theatres.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No theatres configured.</div>
        ) : (
          <div className="space-y-4">
            {theatres.map((th) => (
              <div
                key={th.id}
                className="bg-[#121927] border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{th.name}</h2>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                      <span>{th.address}, {th.city}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => openAddScreen(th)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-red-500" />
                    <span>Add Screen</span>
                  </button>
                </div>

                {/* Screens */}
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                    Screens ({th.screens?.length || 0})
                  </span>
                  {th.screens?.length === 0 ? (
                    <div className="text-xs text-gray-500 italic">No screens created yet for this theatre.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {th.screens.map((sc) => (
                        <div
                          key={sc.id}
                          className="p-3.5 rounded-xl bg-[#0b0f19] border border-gray-800 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <Monitor className="w-4 h-4 text-red-500" />
                            <div>
                              <div className="text-xs font-bold text-white">{sc.name}</div>
                              <div className="text-[10px] text-gray-500">{sc.totalSeats} Total Seats</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Add Theatre */}
        {theatreModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121927] border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-lg font-bold text-white">Add Theatre</h3>
                <button onClick={() => setTheatreModalOpen(false)} className="p-1 text-gray-400 hover:text-white">
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
                  createTheatreMutation.mutate();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Theatre Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="PVR Cinemas - Orion Mall"
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bangalore"
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Address</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Dr Rajkumar Rd, Malleshwaram"
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setTheatreModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createTheatreMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition disabled:opacity-50"
                  >
                    {createTheatreMutation.isPending ? 'Saving...' : 'Create Theatre'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Screen */}
        {screenModalOpen && selectedTheatre && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121927] border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">Add Screen</h3>
                  <p className="text-xs text-gray-400">{selectedTheatre.name}</p>
                </div>
                <button onClick={() => setScreenModalOpen(false)} className="p-1 text-gray-400 hover:text-white">
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
                  createScreenMutation.mutate();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Screen Name</label>
                  <input
                    type="text"
                    required
                    value={screenName}
                    onChange={(e) => setScreenName(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Standard Rows</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={standardRows}
                      onChange={(e) => setStandardRows(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Premium Rows</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={premiumRows}
                      onChange={(e) => setPremiumRows(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Recliner Rows</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={reclinerRows}
                      onChange={(e) => setReclinerRows(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Seats Per Row</label>
                    <input
                      type="number"
                      min={4}
                      max={30}
                      value={seatsPerRow}
                      onChange={(e) => setSeatsPerRow(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#0b0f19] border border-gray-800 rounded-xl text-xs text-gray-400">
                  Total generated physical seats:{' '}
                  <strong className="text-emerald-400">
                    {(parseInt(standardRows || 0) + parseInt(premiumRows || 0) + parseInt(reclinerRows || 0)) *
                      parseInt(seatsPerRow || 0)}
                  </strong>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setScreenModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createScreenMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition disabled:opacity-50"
                  >
                    {createScreenMutation.isPending ? 'Generating...' : 'Create Screen & Seats'}
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
