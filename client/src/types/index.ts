export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: 'USER' | 'ADMIN';
  createdAt?: string;
  updatedAt?: string;
}

export interface Movie {
  id: string;
  title: string;
  description?: string | null;
  durationMin: number;
  genre: string[];
  language: string;
  rating?: string | null;
  posterUrl?: string | null;
  releaseDate: string;
  isActive: boolean;
}

export interface Theatre {
  id: string;
  name: string;
  city: string;
  address: string;
  isActive: boolean;
  screens?: Screen[];
}

export interface Screen {
  id: string;
  name: string;
  totalSeats: number;
  theatreId: string;
  theatre?: Theatre;
  _count?: {
    seats: number;
  };
}

export interface Seat {
  id: string;
  row: string;
  number: number;
  class: 'STANDARD' | 'PREMIUM' | 'RECLINER';
  screenId: string;
}

export interface Show {
  id: string;
  movieId: string;
  screenId: string;
  startsAt: string;
  endsAt: string;
  basePricePaise: number;
  isActive: boolean;
  movie?: Movie;
  screen?: Screen;
}

export interface ShowSeatItem {
  showSeatId: string;
  seatId: string;
  row: string;
  number: number;
  class: 'STANDARD' | 'PREMIUM' | 'RECLINER';
  pricePaise: number;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
}

export interface ShowSeatsResponse {
  show: {
    id: string;
    movieId: string;
    screenId: string;
    startsAt: string;
    endsAt: string;
    basePricePaise: number;
    isActive: boolean;
  };
  summary: {
    total: number;
    available: number;
    held: number;
    booked: number;
  };
  seats: ShowSeatItem[];
}

export interface Booking {
  id: string;
  userId: string;
  showId: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  totalAmountPaise: number;
  razorpayOrderId?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  remainingSeconds?: number;
  show?: {
    id: string;
    movieTitle: string;
    theatreName: string;
    screenName: string;
    city: string;
    startsAt: string;
  };
  seats?: {
    showSeatId: string;
    seatId: string;
    row: string;
    number: number;
    class: 'STANDARD' | 'PREMIUM' | 'RECLINER';
    pricePaise: number;
    status: string;
  }[];
}
