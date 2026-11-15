import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle2, Ticket, Home, ArrowRight } from 'lucide-react';

export const PaymentSuccessPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as any;

  const booking = state?.booking;
  const paymentId = state?.paymentId || 'pay_demo_success';

  return (
    <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
      <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto shadow-xl shadow-emerald-950/40">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Booking Confirmed!</h1>
        <p className="text-xs sm:text-sm text-gray-400">
          Your payment has been successfully processed and your cinema tickets are secured.
        </p>
      </div>

      <div className="bg-[#121927] border border-gray-800 p-6 rounded-2xl text-left space-y-4 shadow-xl">
        <div className="flex justify-between items-center text-xs pb-3 border-b border-gray-800">
          <span className="text-gray-500">Booking Reference</span>
          <span className="font-mono font-bold text-white">{booking?.id || 'BK-SUCCESS'}</span>
        </div>

        <div className="flex justify-between items-center text-xs pb-3 border-b border-gray-800">
          <span className="text-gray-500">Razorpay Payment ID</span>
          <span className="font-mono text-emerald-400">{paymentId}</span>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500">Status</span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            CONFIRMED
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <Link
          to="/dashboard"
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition shadow-lg shadow-red-600/30 active:scale-95"
        >
          <Ticket className="w-4 h-4" />
          <span>View in Dashboard</span>
        </Link>
        <Link
          to="/"
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#121927] hover:bg-gray-800 text-gray-300 font-semibold text-sm transition border border-gray-700"
        >
          <Home className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
};
