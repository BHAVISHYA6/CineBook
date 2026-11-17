import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  movie: null,
  show: null,
  theatreName: '',
  screenName: '',
  selectedSeats: [],
  bookingId: null,
  totalAmountPaise: 0,
};

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    setBookingShow: (state, action) => {
      const { movie, show, theatreName, screenName } = action.payload;
      state.movie = movie;
      state.show = show;
      state.theatreName = theatreName;
      state.screenName = screenName;
      state.selectedSeats = [];
      state.bookingId = null;
      state.totalAmountPaise = 0;
    },
    toggleSeatSelection: (state, action) => {
      const seat = action.payload;
      const index = state.selectedSeats.findIndex((s) => s.seatId === seat.seatId);

      if (index >= 0) {
        state.selectedSeats.splice(index, 1);
      } else {
        if (state.selectedSeats.length >= 10) {
          return;
        }
        state.selectedSeats.push(seat);
      }

      state.totalAmountPaise = state.selectedSeats.reduce((acc, curr) => acc + curr.pricePaise, 0);
    },
    setConfirmedReservation: (state, action) => {
      const { bookingId, totalAmountPaise } = action.payload;
      state.bookingId = bookingId;
      if (totalAmountPaise !== undefined) {
        state.totalAmountPaise = totalAmountPaise;
      }
    },
    clearBooking: () => initialState,
  },
});

export const {
  setBookingShow,
  toggleSeatSelection,
  setConfirmedReservation,
  clearBooking,
} = bookingSlice.actions;

export default bookingSlice.reducer;
