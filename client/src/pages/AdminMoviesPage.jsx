import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Film, AlertCircle, X, Check } from 'lucide-react';
import { AdminSidebar } from '../components/AdminSidebar';
import { ImageUpload } from '../components/ImageUpload';
import api from '../services/api';
import { formatDate } from '../utils/formatters';

export const AdminMoviesPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState(null);
  const [error, setError] = useState('');

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMin, setDurationMin] = useState(120);
  const [genre, setGenre] = useState('Action, Sci-Fi');
  const [language, setLanguage] = useState('English');
  const [rating, setRating] = useState('UA');
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [posterUrl, setPosterUrl] = useState('');

  // Fetch movies
  const { data: movies = [], isLoading } = useQuery({
    queryKey: ['adminMovies'],
    queryFn: async () => {
      const res = await api.get('/api/movies?limit=100');
      return res.data?.data?.movies || [];
    },
  });

  const openCreateModal = () => {
    setEditingMovie(null);
    setTitle('');
    setDescription('');
    setDurationMin(120);
    setGenre('Action, Sci-Fi');
    setLanguage('English');
    setRating('UA');
    setReleaseDate(new Date().toISOString().split('T')[0]);
    setPosterUrl('');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (m) => {
    setEditingMovie(m);
    setTitle(m.title || '');
    setDescription(m.description || '');
    setDurationMin(m.durationMin || 120);
    setGenre(Array.isArray(m.genre) ? m.genre.join(', ') : m.genre || '');
    setLanguage(m.language || 'English');
    setRating(m.rating || 'UA');
    setReleaseDate(m.releaseDate ? new Date(m.releaseDate).toISOString().split('T')[0] : '');
    setPosterUrl(m.posterUrl || '');
    setError('');
    setIsModalOpen(true);
  };

  // Create or Update Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description,
        durationMin: parseInt(durationMin, 10),
        genre: genre.split(',').map((g) => g.trim()).filter(Boolean),
        language,
        rating,
        releaseDate,
        posterUrl,
      };

      if (editingMovie) {
        return api.patch(`/api/movies/${editingMovie.id}`, payload);
      } else {
        return api.post('/api/movies', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminMovies'] });
      queryClient.invalidateQueries({ queryKey: ['movies'] });
      setIsModalOpen(false);
    },
    onError: (err) => {
      setError(err.response?.data?.error?.message || 'Failed to save movie.');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return api.delete(`/api/movies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminMovies'] });
      queryClient.invalidateQueries({ queryKey: ['movies'] });
    },
  });

  const handleDelete = (id, title) => {
    if (window.confirm(`Are you sure you want to deactivate "${title}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 pb-20">
      <AdminSidebar />

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Movie Management</h1>
            <p className="text-xs text-gray-400">Add, update, or deactivate movies and upload posters.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Movie</span>
          </button>
        </div>

        {/* Movies Table */}
        <div className="bg-[#121927] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-gray-500">Loading movies...</div>
          ) : movies.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">No movies found in database.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-gray-800">
                  <tr>
                    <th className="p-3">Poster</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Genre / Lang</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Release Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {movies.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-800/30">
                      <td className="p-3">
                        <img
                          src={m.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=100&q=80'}
                          alt={m.title}
                          className="w-10 h-14 object-cover rounded-md border border-gray-700 bg-gray-900"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-white text-sm">{m.title}</div>
                        <div className="text-[10px] text-gray-500">Rating: {m.rating || 'N/A'}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-gray-300">
                          {Array.isArray(m.genre) ? m.genre.join(', ') : m.genre}
                        </div>
                        <div className="text-[10px] text-gray-500">{m.language}</div>
                      </td>
                      <td className="p-3 font-mono">{m.durationMin} mins</td>
                      <td className="p-3">{formatDate(m.releaseDate)}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(m)}
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition"
                            title="Edit movie"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.title)}
                            className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 transition"
                            title="Deactivate movie"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Create or Edit Movie */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121927] border border-gray-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-lg font-bold text-white">
                  {editingMovie ? 'Edit Movie' : 'Create New Movie'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-gray-400 hover:text-white"
                >
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
                  saveMutation.mutate();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Overview / Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Duration (minutes)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={durationMin}
                      onChange={(e) => setDurationMin(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Rating (e.g. U, UA, A)</label>
                    <input
                      type="text"
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Language</label>
                    <input
                      type="text"
                      required
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Release Date</label>
                    <input
                      type="date"
                      required
                      value={releaseDate}
                      onChange={(e) => setReleaseDate(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Genres (comma separated)</label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Action, Thriller, Sci-Fi"
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                {/* Cloudinary Poster Upload */}
                <ImageUpload
                  label="Movie Poster (Upload to Cloudinary)"
                  value={posterUrl}
                  onChange={setPosterUrl}
                />

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save Movie'}
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
