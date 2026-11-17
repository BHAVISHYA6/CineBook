import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { toggleSeatSelection, setConfirmedReservation } from '../store/slices/bookingSlice';
import { formatPrice, formatTime } from '../utils/formatters';

export const SeatSelectionPage = () => {
  const { id: showId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const user = useSelector((state) => state.auth.user);
  const bookingState = useSelector((state) => state.booking);

  const [isReserving, setIsReserving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Fetch live seat layout and availability from backend
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['showSeats', showId],
    queryFn: async () => {
      const res = await api.get(`/api/shows/${showId}/seats`);
      return res.data?.data;
    },
    enabled: !!showId,
    refetchInterval: 15000, // Poll every 15s as fallback
  });

  // 2. Real-time Socket.IO synchronization for seat updates
  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    if (showId) {
      socket.emit('join:show', showId);
    }

    socket.on('seats:updated', () => {
      refetch();
    });

    return () => {
      if (showId) {
        socket.emit('leave:show', showId);
      }
      socket.off('seats:updated');
    };
  }, [showId, refetch]);

  if (isLoading || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  const { show, seats } = data;

  // Group seats by Row (e.g. 'A', 'B', 'C')
  const rowsMap = new Map();
  seats.forEach((seat) => {
    if (!rowsMap.has(seat.row)) {
      rowsMap.set(seat.row, []);
    }
    rowsMap.get(seat.row).push(seat);
  });

  // Check seat selection state
  const isSelected = (seatId) => bookingState.selectedSeats.some((s) => s.seatId === seatId);

  // Handle proceed to seat reservation
  const handleProceedToReservation = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/shows/${showId}/seats` } });
      return;
    }

    if (bookingState.selectedSeats.length === 0) {
      setErrorMessage('Please select at least one seat to proceed.');
      return;
    }

    setErrorMessage('');
    setIsReserving(true);

    try {
      const seatIds = bookingState.selectedSeats.map((s) => s.seatId);
      const res = await api.post('/api/bookings/reserve', {
        showId,
        seatIds,
      });

      const reservation = res.data?.data?.reservation;
      dispatch(
        setConfirmedReservation({
          reservationId: reservation.id,
          totalAmountPaise: reservation.totalAmountPaise,
        })
      );

      navigate(`/bookings/${reservation.id}/summary`);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error?.message ||
          'Failed to reserve selected seats. They might have been held by another customer.'
      );
      refetch();
    } finally {
      setIsReserving(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header Information */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121927] p-5 rounded-xl border border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Select Your Seats</h1>
          <p className="text-xs text-gray-400 mt-1">
            {bookingState.movie?.title || 'Movie'} • {bookingState.theatreName} ({bookingState.screenName}) •{' '}
            <span className="text-emerald-400">{formatTime(show.startsAt)}</span>
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-[#1e293b] border border-gray-600 block"></span>
            <span className="text-gray-400">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-red-600 border border-red-500 block"></span>
            <span className="text-gray-300 font-medium">Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-amber-600/60 border border-amber-600 block"></span>
            <span className="text-gray-400">Held</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-gray-800/40 border border-gray-800 block opacity-40"></span>
            <span className="text-gray-500">Booked</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3.5 rounded-lg bg-red-950/50 border border-red-500/50 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Cinema Screen Curved Indicator */}
      <div className="w-full flex flex-col items-center py-4">
        <div className="w-3/4 max-w-xl h-2 bg-gradient-to-r from-red-600/20 via-red-500 to-red-600/20 rounded-full shadow-[0_4px_25px_rgba(239,68,68,0.5)]"></div>
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mt-2">
          All eyes this way • Cinema Screen
        </span>
      </div>

      {/* Seat Layout Grid */}
      <div className="overflow-x-auto py-6 px-4 bg-[#0d1322] rounded-2xl border border-gray-800/80 shadow-inner">
        <div className="min-w-[500px] flex flex-col items-center space-y-3">
          {Array.from(rowsMap.entries()).map(([rowLabel, rowSeats]) => (
            <div key={rowLabel} className="flex items-center gap-3">
              {/* Row identifier */}
              <span className="w-6 text-center text-xs font-bold text-gray-500">{rowLabel}</span>

              {/* Seats in this row */}
              <div className="flex items-center gap-2">
                {rowSeats.map((seat) => {
                  const selected = isSelected(seat.seatId);
                  const isAvailable = seat.status === 'AVAILABLE';
                  const isHeld = seat.status === 'HELD';
                  const isBooked = seat.status === 'BOOKED';

                  let seatStyle = 'bg-[#1e293b] border-gray-600 text-gray-300 hover:border-red-500 hover:scale-105';

                  if (selected) {
                    seatStyle = 'bg-red-600 border-red-500 text-white shadow-md shadow-red-600/40 scale-105';
                  } else if (isHeld) {
                    seatStyle = 'bg-amber-900/40 border-amber-700/60 text-amber-500 cursor-not-allowed';
                  } else if (isBooked) {
                    seatStyle = 'bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed opacity-40';
                  }

                  return (
                    <button
                      key={seat.seatId}
                      disabled={!isAvailable && !selected}
                      onClick={() =>
                        dispatch(
                          toggleSeatSelection({
                            seatId: seat.seatId,
                            row: seat.row,
                            number: seat.number,
                            class: seat.class,
                            pricePaise: seat.pricePaise,
                          })
                        )
                      }
                      className={`w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold border transition-all duration-150 ${seatStyle}`}
                      title={`Row ${seat.row} #${seat.number} (${seat.class}) - ${formatPrice(seat.pricePaise)}`}
                    >
                      {seat.number}
                    </button>
                  );
                })}
              </div>

              <span className="w-6 text-center text-xs font-bold text-gray-500">{rowLabel}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Booking Summary Bar */}
      <div className="sticky bottom-4 z-40 bg-[#121927]/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-gray-700/80 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400">Selected Seats:</div>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {bookingState.selectedSeats.length === 0 ? (
              <span className="text-xs text-gray-500 italic">No seats selected yet</span>
            ) : (
              bookingState.selectedSeats.map((s) => (
                <span
                  key={s.seatId}
                  className="px-2 py-0.5 rounded text-xs font-bold bg-red-600/20 text-red-400 border border-red-500/30"
                >
                  {s.row}{s.number}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
          <div>
            <div className="text-xs text-gray-400">Total Price:</div>
            <div className="text-lg font-bold text-emerald-400">
              {formatPrice(bookingState.totalAmountPaise)}
            </div>
          </div>

          <button
            onClick={handleProceedToReservation}
            disabled={isReserving || bookingState.selectedSeats.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition shadow-lg shadow-red-600/30 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>{isReserving ? 'Reserving...' : 'Proceed to Payment'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
