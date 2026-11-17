import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { Star, Clock, Globe, MapPin, Calendar, Ticket } from 'lucide-react';
import api from '../services/api';
import { setBookingShow } from '../store/slices/bookingSlice';
import { formatDate, formatTime, formatPrice } from '../utils/formatters';

export const MovieDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [selectedCity, setSelectedCity] = useState('');

  // 1. Fetch Movie details
  const { data: movie, isLoading: movieLoading } = useQuery({
    queryKey: ['movie', id],
    queryFn: async () => {
      const res = await api.get(`/api/movies/${id}`);
      return res.data?.data?.movie;
    },
    enabled: !!id,
  });

  // 2. Fetch Shows for this movie
  const { data: showsData, isLoading: showsLoading } = useQuery({
    queryKey: ['movieShows', id, selectedCity],
    queryFn: async () => {
      const params = {};
      if (selectedCity.trim()) params.city = selectedCity.trim();
      const res = await api.get(`/api/movies/${id}/shows`, { params });
      return res.data?.data?.shows || [];
    },
    enabled: !!id,
  });

  if (movieLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-gray-300">Movie not found</h2>
      </div>
    );
  }

  const shows = showsData || [];

  // Group shows by Theatre
  const theatreMap = new Map();
  shows.forEach((show) => {
    const theatre = show.screen?.theatre;
    if (!theatre) return;
    if (!theatreMap.has(theatre.id)) {
      theatreMap.set(theatre.id, { theatre, shows: [] });
    }
    theatreMap.get(theatre.id).shows.push(show);
  });

  const handleSelectShow = (show) => {
    dispatch(
      setBookingShow({
        movie,
        show,
        theatreName: show.screen?.theatre?.name || 'CineBook Cinema',
        screenName: show.screen?.name || 'Auditorium',
      })
    );
    navigate(`/shows/${show.id}/seats`);
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Movie Hero Banner */}
      <section className="relative rounded-2xl overflow-hidden bg-[#121927] border border-gray-800 shadow-2xl">
        <div className="flex flex-col md:flex-row">
          {/* Poster */}
          <div className="w-full md:w-80 shrink-0 aspect-[2/3] md:aspect-auto overflow-hidden bg-gray-900">
            <img
              src={movie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80'}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details */}
          <div className="p-6 sm:p-10 flex-1 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-red-600 text-white uppercase tracking-wider">
                  {movie.language}
                </span>
                {movie.rating && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Star className="w-3 h-3 fill-amber-400" /> {movie.rating}
                  </span>
                )}
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {movie.durationMin} mins
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {movie.title}
              </h1>

              <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                {Array.isArray(movie.genre) &&
                  movie.genre.map((g) => (
                    <span key={g} className="px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700">
                      {g}
                    </span>
                  ))}
              </div>

              <p className="text-sm text-gray-300 leading-relaxed max-w-3xl">
                {movie.description || 'No overview available for this movie.'}
              </p>
            </div>

            <div className="pt-4 border-t border-gray-800 flex items-center gap-6 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-red-500" />
                <span>Original Audio: {movie.language}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-red-500" />
                <span>Released: {formatDate(movie.releaseDate)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Showtimes & Theatres Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-red-500" />
              <span>Available Theatres & Showtimes</span>
            </h2>
            <p className="text-xs text-gray-400">Select a convenient screening time to book your seats.</p>
          </div>

          {/* City Filter */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by city (e.g. Bangalore)"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-[#121927] border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500 transition"
            />
          </div>
        </div>

        {showsLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-[#121927] animate-pulse rounded-xl border border-gray-800" />
            ))}
          </div>
        ) : theatreMap.size === 0 ? (
          <div className="text-center py-12 bg-[#121927]/40 rounded-xl border border-gray-800">
            <p className="text-sm text-gray-400">No scheduled shows found for this title.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(theatreMap.values()).map(({ theatre, shows: tShows }) => (
              <div
                key={theatre.id}
                className="bg-[#121927] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800/60 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">{theatre.name}</h3>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-red-500" />
                      <span>{theatre.address}, {theatre.city}</span>
                    </p>
                  </div>
                </div>

                {/* Showtimes grid */}
                <div className="flex flex-wrap gap-3">
                  {tShows.map((show) => (
                    <button
                      key={show.id}
                      onClick={() => handleSelectShow(show)}
                      className="group flex flex-col items-center justify-center p-2.5 rounded-lg border border-gray-700/80 bg-[#0b0f19] hover:border-red-500 hover:bg-red-600/10 transition-all text-center min-w-[100px]"
                    >
                      <span className="text-sm font-bold text-white group-hover:text-red-400">
                        {formatTime(show.startsAt)}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5 font-medium">
                        {show.screen?.name}
                      </span>
                      <span className="text-[11px] text-emerald-400 font-semibold mt-1">
                        {formatPrice(show.basePricePaise)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
