import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Film, Lock, Mail, User as UserIcon, Phone, AlertCircle, KeyRound, CheckCircle2, RotateCw } from 'lucide-react';
import api from '../services/api';
import { setCredentials } from '../store/slices/authSlice';

export const RegisterPage = () => {
  const [step, setStep] = useState(1); // 1 = Registration Form, 2 = OTP Verification
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Countdown timer for resend
  useEffect(() => {
    let timer;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Step 1: Initiate registration and send OTP
  const handleInitiateRegister = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!name || !email || !password) {
      setError('Name, email, and password are required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/api/auth/register-otp', {
        name,
        email,
        password,
        phone: phone || undefined,
      });

      const { expiresIn, otpPreview } = res.data?.data || {};
      setStep(2);
      setOtpCountdown(60);

      if (otpPreview) {
        setInfoMessage(`Development mode OTP: ${otpPreview} (expires in ${Math.round(expiresIn / 60)} mins)`);
      } else {
        setInfoMessage(`We've sent a 6-digit verification code to ${email}`);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed. Email might already exist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP and finalize registration
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/api/auth/verify-otp', {
        email,
        otp: otp.trim(),
      });

      const { user, token, refreshToken } = res.data?.data || {};
      dispatch(setCredentials({ user, token, refreshToken }));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Verification failed. Please check the OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (otpCountdown > 0) return;
    setError('');
    setInfoMessage('');

    try {
      setIsSubmitting(true);
      const res = await api.post('/api/auth/register-otp', {
        name,
        email,
        password,
        phone: phone || undefined,
      });

      const { expiresIn, otpPreview } = res.data?.data || {};
      setOtpCountdown(60);

      if (otpPreview) {
        setInfoMessage(`Development mode new OTP: ${otpPreview}`);
      } else {
        setInfoMessage(`New verification code sent to ${email}`);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to resend verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-[#121927] border border-gray-800 p-8 rounded-2xl shadow-2xl shadow-black/60 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/20 items-center justify-center text-red-500 mb-1">
            {step === 1 ? <Film className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {step === 1 ? 'Create Account' : 'Verify Email OTP'}
          </h2>
          <p className="text-xs text-gray-400">
            {step === 1
              ? 'Join CineBook to reserve movie seats and book tickets instantly.'
              : `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Info Message */}
        {infoMessage && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {step === 1 ? (
          /* Form Step 1: User Details */
          <form onSubmit={handleInitiateRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="w-full bg-[#0b0f19] border border-gray-700/80 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full bg-[#0b0f19] border border-gray-700/80 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Phone Number (Optional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full bg-[#0b0f19] border border-gray-700/80 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-[#0b0f19] border border-gray-700/80 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition shadow-lg shadow-red-600/30 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Sending OTP...' : 'Send Verification OTP'}
            </button>
          </form>
        ) : (
          /* Form Step 2: OTP Verification */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">6-Digit Verification Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  required
                  autoFocus
                  className="w-full bg-[#0b0f19] border border-gray-700/80 rounded-lg pl-9 pr-4 py-2 text-center font-mono text-lg tracking-widest text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="w-full py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition shadow-lg shadow-red-600/30 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Verifying...' : 'Verify & Complete Registration'}
            </button>

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-gray-400 hover:text-white"
              >
                ← Back to details
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpCountdown > 0 || isSubmitting}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 disabled:opacity-50 disabled:hover:text-red-400 font-medium"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                <span>{otpCountdown > 0 ? `Resend in ${otpCountdown}s` : 'Resend Code'}</span>
              </button>
            </div>
          </form>
        )}

        <div className="text-center text-xs text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-red-400 hover:text-red-300 font-semibold underline underline-offset-4">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
