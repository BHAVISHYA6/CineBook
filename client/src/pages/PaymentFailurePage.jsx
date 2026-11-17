import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { XCircle, RefreshCw, Home } from 'lucide-react';

export const PaymentFailurePage = () => {
  const location = useLocation();
  const state = location.state;

  const errorMessage = state?.message || 'The payment transaction could not be completed.';

  return (
    <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
      <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-500 mx-auto shadow-xl shadow-red-950/40">
        <XCircle className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Payment Failed</h1>
        <p className="text-xs sm:text-sm text-gray-400">
          We were unable to process your payment. If your account was debited, it will be refunded automatically.
        </p>
      </div>

      <div className="bg-[#121927] border border-gray-800 p-5 rounded-2xl text-left space-y-2 text-xs text-red-400 bg-red-950/20 border-red-900/40">
        <span className="font-semibold block text-red-300">Failure Reason:</span>
        <p className="text-gray-300">{errorMessage}</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <Link
          to="/"
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition shadow-lg shadow-red-600/30 active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
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
