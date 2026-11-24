import React, { useEffect, useState } from 'react';
import { Shield, KeyRound, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { INDIAN_STATES } from '../lib/catalogData';

export function AuthPages({ initialMode }: { initialMode: 'login' | 'register' }) {
  const { setView, setSessionAuth, signInWithGoogle, showNotice } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<
    'customer' | 'electrician' | 'plumber' | 'contractor' | 'supplier'
  >('customer');
  const [otpCode, setOtpCode] = useState('');
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [otpStatus, setOtpStatus] = useState<string | null>(null);

  // Supplier registration fields
  const [shopName, setShopName] = useState('');
  const [gstin, setGstin] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [city, setCity] = useState('Chennai');
  const [stateName, setStateName] = useState('Tamil Nadu');
  const [pinCode, setPinCode] = useState('600001');
  const [productCategories, setProductCategories] = useState('electrical,plumbing');

  // Password reset fields
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode]);

  const routeAfterAuth = (activeRole: string) => {
    if (activeRole === 'super_admin') setView('admin-dashboard');
    else if (activeRole === 'supplier') setView('supplier-dashboard');
    else setView('customer-dashboard');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const profile = await signInWithGoogle();
      showNotice('success', `Signed in as ${profile.fullName}`);
      routeAfterAuth(profile.activeRole);
    } catch (e: any) {
      setError(e.message || 'Google Sign-In was cancelled or failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (identifier: string, purpose: 'registration' | 'password_reset') => {
    setError(null);
    setOtpPreview(null);
    if (!identifier.trim()) {
      setError('Enter your email or mobile number first to receive a verification code.');
      return;
    }
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), purpose }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOtpStatus(data.message);
      if (data.previewOtp) {
        setOtpPreview(data.previewOtp);
      }
    } catch (e: any) {
      setError(e.message || 'Unable to request OTP.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginIdentifier,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign in failed');
      setSessionAuth(data.token, data.profile);
      showNotice('success', `Welcome back, ${data.profile.fullName}`);
      routeAfterAuth(data.profile.activeRole);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          mobile,
          password,
          role,
          otpCode,
          shopName,
          gstin,
          businessAddress,
          city,
          state: stateName,
          pinCode,
          productCategories,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setSessionAuth(data.token, data.profile);
      showNotice('success', `Account created for ${data.profile.fullName}`);
      routeAfterAuth(data.profile.activeRole);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: resetIdentifier,
          otpCode: resetOtp,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showNotice('success', 'Password reset complete. Sign in with your new password.');
      setMode('login');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#0F2942]">
              {mode === 'login'
                ? 'Sign In to BuildMate'
                : mode === 'register'
                  ? 'Create BuildMate Account'
                  : 'Reset Password'}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Customers, electricians, plumbers, contractors &amp; verified shop owners.
            </p>
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-md text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`px-3 py-1.5 font-semibold rounded cursor-pointer ${
                mode === 'login' ? 'bg-white text-[#0F2942]' : 'text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`px-3 py-1.5 font-semibold rounded cursor-pointer ${
                mode === 'register' ? 'bg-white text-[#0F2942]' : 'text-slate-600'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Google Sign-In Button */}
        <div className="mt-5">
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 text-xs font-semibold text-[#0F2942] bg-[#F4F6F8] hover:bg-slate-200 border border-slate-300 rounded-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Shield className="w-4 h-4 text-[#EA580C]" />
            Continue with Google Sign-In
          </button>
          <div className="relative my-5 text-center">
            <hr className="border-slate-200" />
            <span className="px-3 bg-white text-[11px] text-slate-500 relative -top-2.5">
              or use Email / Mobile &amp; Password
            </span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md"
          >
            {error}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-id" className="block text-xs font-medium text-slate-700 mb-1">
                Email Address or Mobile Number
              </label>
              <input
                id="login-id"
                type="text"
                required
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="name@company.in or 9840112233"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="login-pw" className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="login-pw"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setMode('reset')}
                className="text-[#EA580C] hover:underline font-medium cursor-pointer"
              >
                Forgot password? Reset via OTP
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#0F2942] hover:bg-[#163A5C] rounded-md cursor-pointer"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="reg-role" className="block text-xs font-medium text-slate-700 mb-1">
                Account Role *
              </label>
              <select
                id="reg-role"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-slate-50 font-medium"
              >
                <option value="customer">Customer / Homeowner</option>
                <option value="electrician">Electrician</option>
                <option value="plumber">Plumber</option>
                <option value="contractor">Civil / Interior / MEP Contractor</option>
                <option value="supplier">Supplier / Shop Owner</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="reg-mobile" className="block text-xs font-medium text-slate-700 mb-1">
                  Mobile Number *
                </label>
                <input
                  id="reg-mobile"
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="reg-pw" className="block text-xs font-medium text-slate-700 mb-1">
                  Password (min 6 chars) *
                </label>
                <input
                  id="reg-pw"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
            </div>

            {/* Optional OTP Verification */}
            <div className="p-3 bg-[#F4F6F8] border border-slate-200 rounded-md space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#0F2942] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#EA580C]" />
                  Account Verification (OTP)
                </span>
                <button
                  type="button"
                  onClick={() => handleRequestOtp(email || mobile, 'registration')}
                  className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
                >
                  Send OTP Code
                </button>
              </div>
              <input
                type="text"
                aria-label="Enter 6-digit OTP code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit OTP (optional if verifying later)"
                className="w-full px-3 py-1.5 text-xs font-mono-num bg-white border border-slate-200 rounded"
              />
              {otpStatus && <p className="text-[11px] text-slate-600">{otpStatus}</p>}
              {otpPreview && (
                <p className="text-xs font-mono-num font-bold text-[#0F2942] bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
                  Preview Verification Code: {otpPreview}
                </p>
              )}
            </div>

            {role === 'supplier' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                <p className="text-xs font-bold text-[#0F2942]">
                  Shop Details (Submitted for Admin Verification)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Shop / Business Name *"
                    className="px-3 py-2 text-xs bg-white border border-slate-200 rounded"
                  />
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="GSTIN (if applicable)"
                    className="px-3 py-2 text-xs font-mono-num bg-white border border-slate-200 rounded"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="Shop Street Address *"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="px-2.5 py-2 text-xs bg-white border border-slate-200 rounded"
                  />
                  <select
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="px-2 py-2 text-xs bg-white border border-slate-200 rounded"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="PIN Code"
                    className="px-2.5 py-2 text-xs font-mono-num bg-white border border-slate-200 rounded"
                  />
                </div>
                <select
                  aria-label="Shop categories"
                  value={productCategories}
                  onChange={(e) => setProductCategories(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded"
                >
                  <option value="electrical,plumbing">Both Electrical &amp; Plumbing</option>
                  <option value="electrical">Electrical Materials Only</option>
                  <option value="plumbing">Plumbing Materials Only</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-md cursor-pointer"
            >
              {loading ? 'Creating Account...' : 'Create BuildMate Account'}
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <KeyRound className="w-4 h-4 text-[#EA580C]" />
              <span>Request a verification OTP to reset your password.</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                placeholder="Registered email or mobile"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
              <button
                type="button"
                onClick={() => handleRequestOtp(resetIdentifier, 'password_reset')}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F2942] rounded-md cursor-pointer"
              >
                Send OTP
              </button>
            </div>
            {otpStatus && <p className="text-xs text-slate-600">{otpStatus}</p>}
            {otpPreview && (
              <p className="text-xs font-mono-num font-bold text-[#0F2942] bg-amber-50 border border-amber-200 px-3 py-1.5 rounded">
                Preview Reset OTP: {otpPreview}
              </p>
            )}
            <input
              type="text"
              required
              value={resetOtp}
              onChange={(e) => setResetOtp(e.target.value)}
              placeholder="6-digit OTP code"
              className="w-full px-3 py-2 text-sm font-mono-num border border-slate-200 rounded-md"
            />
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
            >
              {loading ? 'Updating Password...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
