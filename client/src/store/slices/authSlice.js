import { createSlice } from '@reduxjs/toolkit';

const initialToken = localStorage.getItem('cinebook_token') || null;
const initialRefreshToken = localStorage.getItem('cinebook_refresh_token') || null;
let initialUser = null;
try {
  const savedUser = localStorage.getItem('cinebook_user');
  if (savedUser) initialUser = JSON.parse(savedUser);
} catch (_) {
  localStorage.removeItem('cinebook_user');
}

const initialState = {
  user: initialUser,
  token: initialToken,
  refreshToken: initialRefreshToken,
  isAuthenticated: !!initialToken,
  isLoading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token, refreshToken } = action.payload;
      state.user = user;
      state.token = token;
      if (refreshToken) state.refreshToken = refreshToken;
      state.isAuthenticated = !!token;

      localStorage.setItem('cinebook_token', token);
      if (refreshToken) {
        localStorage.setItem('cinebook_refresh_token', refreshToken);
      }
      localStorage.setItem('cinebook_user', JSON.stringify(user));
    },
    updateTokens: (state, action) => {
      const { token, refreshToken } = action.payload;
      state.token = token;
      localStorage.setItem('cinebook_token', token);
      if (refreshToken) {
        state.refreshToken = refreshToken;
        localStorage.setItem('cinebook_refresh_token', refreshToken);
      }
    },
    updateUser: (state, action) => {
      state.user = action.payload;
      localStorage.setItem('cinebook_user', JSON.stringify(action.payload));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('cinebook_token');
      localStorage.removeItem('cinebook_refresh_token');
      localStorage.removeItem('cinebook_user');
    },
    setAuthLoading: (state, action) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setCredentials, updateTokens, updateUser, logout, setAuthLoading } = authSlice.actions;
export default authSlice.reducer;
