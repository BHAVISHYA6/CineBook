import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Film, Calendar, TrendingUp } from 'lucide-react';
import api from '../services/api';
import { MovieCard } from '../components/MovieCard';

export const HomePage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['movies', searchTerm, selectedGenre],
    queryFn: async () => {
      const params = { limit: '20' };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedGenre.trim()) params.genre = selectedGenre.trim();

      const res = await api.get('/api/movies', { params });
      return res.data?.data?.movies || [];
    },
  });

  const movies = data || [];
  const genres = ['Action', 'Drama', 'Sci-Fi', 'Comedy', 'Thriller', 'Romance', 'Adventure'];

  // Hero featured movie
  const featuredMovie = movies[0];

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Banner Section */}
      {featuredMovie && (
        <section className="relative h-[480px] w-full rounded-2xl overflow-hidden border border-gray-800/80 shadow-2xl">
          <img
            src={featuredMovie.posterUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1600&q=80'}
            alt={featuredMovie.title}
            className="w-full h-full object-cover filter brightness-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/60 to-transparent" />

          <div className="absolute bottom-10 left-8 sm:left-12 max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-600/90 text-white tracking-wide uppercase shadow-lg shadow-red-600/30">
              <TrendingUp className="w-3.5 h-3.5" /> Featured Screening
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              {featuredMovie.title}
            </h1>
            <p className="text-gray-300 text-sm sm:text-base line-clamp-2 leading-relaxed">
              {featuredMovie.description || 'Experience this cinematic journey in Dolby Atmos with premium cinema viewing.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href={`/movies/${featuredMovie.id}`}
                className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-lg shadow-red-600/30 transition-transform active:scale-95"
              >
                Book Now
              </a>
              <span className="text-xs text-gray-400">
                {featuredMovie.durationMin} mins • {featuredMovie.language} • {Array.isArray(featuredMovie.genre) ? featuredMovie.genre.join(', ') : featuredMovie.genre}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Search & Filter Controls */}
      <section className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#121927]/60 p-4 rounded-xl border border-gray-800">
        {/* Search Bar */}
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by movie title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0b0f19] border border-gray-700/80 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500 transition"
          />
        </div>

        {/* Genre Pill Filters */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedGenre('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              selectedGenre === ''
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All Genres
          </button>
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(selectedGenre === g ? '' : g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                selectedGenre === g
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </section>

      {/* Now Showing Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-red-500" />
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Now Showing</h2>
          </div>
          <span className="text-xs text-gray-400 font-medium">{movies.length} Movies Available</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-[#121927] rounded-xl aspect-[2/3] border border-gray-800" />
            ))}
          </div>
        ) : movies.length === 0 ? (
          <div className="text-center py-16 bg-[#121927]/40 rounded-xl border border-gray-800">
            <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-300 mb-1">No movies found</h3>
            <p className="text-xs text-gray-500">Try adjusting your search criteria or genre filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
