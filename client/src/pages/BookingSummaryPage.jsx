import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Film, Calendar, CreditCard, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { formatPrice, formatDate, formatTime } from '../utils/formatters';

export const BookingSummaryPage = () => {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();

  const [timeLeft, setTimeLeft] = useState(600);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Fetch Reservation Details
  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const res = await api.get(`/api/bookings/${bookingId}`);
      return res.data?.data;
    },
    enabled: !!bookingId,
  });

  // Countdown timer for seat hold expiry
  useEffect(() => {
    if (!booking?.remainingSeconds) return;
    setTimeLeft(booking.remainingSeconds);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [booking?.remainingSeconds]);

  // Handle release / cancel reservation
  const handleRelease = async () => {
    if (!window.confirm('Are you sure you want to cancel this reservation and release your seats?')) {
      return;
    }

    try {
      await api.post(`/api/bookings/${bookingId}/release`);
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to release reservation.');
    }
  };

  // Dynamically load Razorpay SDK script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Handle payment initiation with Razorpay Checkout Modal
  const handlePayment = async () => {
    if (timeLeft <= 0) {
      setErrorMessage('Your reservation hold has expired. Please reserve seats again.');
      return;
    }

    setErrorMessage('');
    setIsProcessing(true);

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // 1. Create Razorpay order from backend
      const orderRes = await api.post('/api/payments/create-order', {
        bookingId,
      });

      const { orderId, amountPaise, keyId } = orderRes.data?.data || {};

      // 2. Configure Razorpay modal options
      const options = {
        key: keyId,
        amount: amountPaise,
        currency: 'INR',
        name: 'CineBook Entertainment',
        description: `Booking for ${booking?.show?.movieTitle}`,
        order_id: orderId,
        theme: {
          color: '#e50914',
        },
        handler: async function (response) {
          try {
            // 3. Verify payment signature on backend
            const verifyRes = await api.post('/api/payments/verify', {
              bookingId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            if (verifyRes.data?.success) {
              navigate('/payment/success', {
                state: {
                  booking: verifyRes.data?.data?.booking || booking,
                  paymentId: response.razorpay_payment_id,
                },
              });
            }
          } catch (verifyErr) {
            navigate('/payment/failure', {
              state: {
                message: verifyErr.response?.data?.error?.message || 'Signature verification failed',
              },
            });
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || err.message || 'Payment initiation failed.');
      setIsProcessing(false);
    }
  };

  if (isLoading || !booking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isExpired = timeLeft <= 0 || booking.status === 'EXPIRED';

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* Expiry Countdown Header */}
      <div
        className={`p-4 rounded-xl border flex items-center justify-between ${
          isExpired
            ? 'bg-red-950/40 border-red-500/50 text-red-400'
            : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
        }`}
      >
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
          <Clock className="w-4 h-4" />
          <span>
            {isExpired ? 'Reservation Expired' : 'Seats Locked! Complete payment within:'}
          </span>
        </div>
        <div className="text-sm sm:text-base font-extrabold font-mono tracking-wider">
          {isExpired ? '00:00' : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3.5 rounded-lg bg-red-950/50 border border-red-500/50 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Booking Summary Card */}
      <div className="bg-[#121927] rounded-2xl border border-gray-800 p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-5">
          <div>
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">Order Summary</span>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">
              {booking.show?.movieTitle}
            </h1>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            {booking.status}
          </span>
        </div>

        {/* Screening Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-300">
          <div className="flex items-start gap-2.5">
            <Film className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-gray-500 block">Cinema & Screen</span>
              <span className="font-semibold text-white">
                {booking.show?.theatreName} - {booking.show?.screenName}
              </span>
              <span className="text-gray-400 block">{booking.show?.city}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Calendar className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-gray-500 block">Date & Time</span>
              <span className="font-semibold text-white">
                {booking.show?.startsAt ? `${formatDate(booking.show.startsAt)} at ${formatTime(booking.show.startsAt)}` : 'Scheduled Show'}
              </span>
            </div>
          </div>
        </div>

        {/* Selected Seats Table */}
        <div className="border border-gray-800 rounded-xl overflow-hidden bg-[#0b0f19]">
          <div className="px-4 py-3 bg-gray-900/60 border-b border-gray-800 flex justify-between text-xs font-semibold text-gray-400">
            <span>Seat ({booking.seats?.length} items)</span>
            <span>Category</span>
            <span>Price</span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {booking.seats?.map((seat) => (
              <div key={seat.seatId} className="px-4 py-3 flex justify-between items-center text-xs text-gray-300">
                <span className="font-bold text-white">Row {seat.row} - #{seat.number}</span>
                <span className="text-gray-400 uppercase text-[11px]">{seat.class}</span>
                <span className="font-semibold text-emerald-400">{formatPrice(seat.pricePaise)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Total Price Section */}
        <div className="pt-4 border-t border-gray-800 flex justify-between items-center">
          <div>
            <span className="text-xs text-gray-400 block">Total Amount Payable</span>
            <span className="text-2xl font-black text-white">{formatPrice(booking.totalAmountPaise)}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRelease}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition"
            >
              Cancel Hold
            </button>
            <button
              onClick={handlePayment}
              disabled={isProcessing || isExpired}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition shadow-lg shadow-red-600/30 active:scale-95 disabled:opacity-40"
            >
              <CreditCard className="w-4 h-4" />
              <span>{isProcessing ? 'Processing...' : 'Pay with Razorpay'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
