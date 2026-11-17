import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './store';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';

// Customer Pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MovieDetailPage } from './pages/MovieDetailPage';
import { SeatSelectionPage } from './pages/SeatSelectionPage';
import { BookingSummaryPage } from './pages/BookingSummaryPage';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage';
import { PaymentFailurePage } from './pages/PaymentFailurePage';
import { UserDashboardPage } from './pages/UserDashboardPage';

// Admin Dashboard Pages (Phase 8)
import { AdminOverviewPage } from './pages/AdminOverviewPage';
import { AdminMoviesPage } from './pages/AdminMoviesPage';
import { AdminTheatresPage } from './pages/AdminTheatresPage';
import { AdminShowsPage } from './pages/AdminShowsPage';
import { AdminBookingsPage } from './pages/AdminBookingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

export const App = () => {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-[#0b0f19] text-gray-100 selection:bg-red-600 selection:text-white">
            <Navbar />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
              <Routes>
                {/* Public Customer Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/movies/:id" element={<MovieDetailPage />} />
                <Route path="/shows/:id/seats" element={<SeatSelectionPage />} />

                {/* Protected Customer Routes */}
                <Route
                  path="/bookings/:id/summary"
                  element={
                    <ProtectedRoute>
                      <BookingSummaryPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/payment/success" element={<PaymentSuccessPage />} />
                <Route path="/payment/failure" element={<PaymentFailurePage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <UserDashboardPage />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Management Routes (Protected + Role: ADMIN) */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminOverviewPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/movies"
                  element={
                    <AdminRoute>
                      <AdminMoviesPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/theatres"
                  element={
                    <AdminRoute>
                      <AdminTheatresPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/shows"
                  element={
                    <AdminRoute>
                      <AdminShowsPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/bookings"
                  element={
                    <AdminRoute>
                      <AdminBookingsPage />
                    </AdminRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  );
};

export default App;
