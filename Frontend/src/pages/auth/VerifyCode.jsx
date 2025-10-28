import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function VerifyCode() {
  const { verifySignupCode, resendSignupCode, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setMessage('');

    const result = await verifySignupCode(email, code);

    if (result.success) {
      setMessage('Account verified! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setMessage(result.message || 'Invalid code');
    }
  };

  const handleResend = async () => {
    const result = await resendSignupCode(email);
    setMessage(result.message || (result.success ? 'OTP resent' : 'Failed to resend'));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 via-orange-50 to-white px-4 py-8">
      <Card className="w-full max-w-md p-8 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-xl">
            <span className="text-3xl font-bold text-white">KE</span>
          </div>
        </div>

        {/* Title & Description */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">Verify Your Account</h1>
          <p className="text-sm text-gray-600 font-medium">
            We sent a verification code to
          </p>
          <p className="mt-1 font-semibold text-[#F58220]">{email}</p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-4 rounded-lg p-3 text-center text-sm ${
            message.includes('verified') || message.includes('Redirecting') 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}

        {/* Verification Form */}
        <div className="space-y-5">
          <Input
            label="Verification Code"
            type="text"
            id="code"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />

          <Button onClick={handleVerify} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Account'}
          </Button>

          <Button onClick={handleResend} variant="secondary" disabled={loading}>
            Resend Code
          </Button>
        </div>

        {/* Back to Login Link */}
        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm font-semibold text-[#F58220] transition-colors hover:text-[#FDB913] hover:underline"
          >
            Back to Login
          </a>
        </div>
      </Card>
    </div>
  );
}