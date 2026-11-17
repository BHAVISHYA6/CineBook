import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  globalLoading: false,
  notification: null, // { type: 'success' | 'error' | 'info', message: string } | null
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setGlobalLoading: (state, action) => {
      state.globalLoading = action.payload;
    },
    showNotification: (state, action) => {
      state.notification = action.payload;
    },
    clearNotification: (state) => {
      state.notification = null;
    },
  },
});

export const { setGlobalLoading, showNotification, clearNotification } = uiSlice.actions;
export default uiSlice.reducer;
