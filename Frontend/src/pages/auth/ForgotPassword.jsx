import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ForgotPassword() {
  const { requestPasswordReset, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    const result = await requestPasswordReset(email);
    
    if (result.success) {
      setMessage(result.message || 'Reset link sent to your email');
      // Note: In production, backend sends email with token
      // For dev, check backend response for reset link
    } else {
      setMessage(result.message || 'Failed to send reset link');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 via-orange-50 to-white px-4 py-8">
      <Card className="w-full max-w-md p-8 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-xl">
            <span className="text-3xl font-bold text-white">KE</span>
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">Forgot Password?</h1>
          <p className="text-sm text-gray-600 font-medium">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        {message && (
          <div className={`mb-4 rounded-lg p-3 text-center text-sm ${
            message.includes('sent') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}

        <div className="space-y-6">
          <Input
            label="Email"
            type="email"
            id="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </div>

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