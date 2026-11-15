import React, { createContext, useContext, useState } from 'react';
import { Movie, Show, ShowSeatItem } from '../types';

interface BookingState {
  movie: Movie | null;
  show: Show | null;
  theatreName: string;
  screenName: string;
  selectedSeats: ShowSeatItem[];
  bookingId: string | null;
  totalAmountPaise: number;
}

interface BookingContextType {
  state: BookingState;
  setBookingShow: (movie: Movie, show: Show, theatreName: string, screenName: string) => void;
  toggleSeatSelection: (seat: ShowSeatItem) => void;
  setConfirmedReservation: (bookingId: string, totalAmountPaise: number) => void;
  clearBooking: () => void;
}

const initialBookingState: BookingState = {
  movie: null,
  show: null,
  theatreName: '',
  screenName: '',
  selectedSeats: [],
  bookingId: null,
  totalAmountPaise: 0,
};

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BookingState>(initialBookingState);

  const setBookingShow = (movie: Movie, show: Show, theatreName: string, screenName: string) => {
    setState((prev) => ({
      ...prev,
      movie,
      show,
      theatreName,
      screenName,
      selectedSeats: [],
      bookingId: null,
      totalAmountPaise: 0,
    }));
  };

  const toggleSeatSelection = (seat: ShowSeatItem) => {
    setState((prev) => {
      const exists = prev.selectedSeats.some((s) => s.seatId === seat.seatId);
      let updatedSeats: ShowSeatItem[];

      if (exists) {
        updatedSeats = prev.selectedSeats.filter((s) => s.seatId !== seat.seatId);
      } else {
        if (prev.selectedSeats.length >= 10) {
          alert('You can select a maximum of 10 seats at once.');
          return prev;
        }
        updatedSeats = [...prev.selectedSeats, seat];
      }

      const total = updatedSeats.reduce((acc, curr) => acc + curr.pricePaise, 0);

      return {
        ...prev,
        selectedSeats: updatedSeats,
        totalAmountPaise: total,
      };
    });
  };

  const setConfirmedReservation = (bookingId: string, totalAmountPaise: number) => {
    setState((prev) => ({
      ...prev,
      bookingId,
      totalAmountPaise,
    }));
  };

  const clearBooking = () => {
    setState(initialBookingState);
  };

  return (
    <BookingContext.Provider
      value={{
        state,
        setBookingShow,
        toggleSeatSelection,
        setConfirmedReservation,
        clearBooking,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};
