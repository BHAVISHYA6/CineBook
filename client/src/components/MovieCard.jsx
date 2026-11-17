import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Clock, Ticket } from 'lucide-react';

export const MovieCard = ({ movie }) => {
  const poster = movie?.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80';

  return (
    <div className="group relative bg-[#121927] rounded-xl overflow-hidden border border-gray-800/80 hover:border-red-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-red-950/20 flex flex-col">
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-900">
        <img
          src={poster}
          alt={movie?.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Rating Badge */}
        {movie?.rating && (
          <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-md px-2 py-1 rounded-md text-xs font-semibold text-amber-400 flex items-center gap-1 border border-white/10 shadow-lg">
            <Star className="w-3 h-3 fill-amber-400" />
            <span>{movie.rating}</span>
          </div>
        )}

        {/* Quick Language Tag */}
        <div className="absolute bottom-2.5 left-2.5 bg-red-600/90 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-medium text-white uppercase tracking-wider">
          {movie?.language}
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-base font-bold text-white group-hover:text-red-400 transition-colors line-clamp-1 mb-1">
            {movie?.title}
          </h3>

          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {movie?.durationMin}m
            </span>
            <span>•</span>
            <span className="line-clamp-1">
              {Array.isArray(movie?.genre) ? movie.genre.join(', ') : movie?.genre}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <Link
          to={`/movies/${movie?.id}`}
          className="w-full mt-2 py-2 px-3 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border border-red-500/20 hover:border-red-600"
        >
          <Ticket className="w-3.5 h-3.5" />
          <span>Book Tickets</span>
        </Link>
      </div>
    </div>
  );
};

export default MovieCard;
