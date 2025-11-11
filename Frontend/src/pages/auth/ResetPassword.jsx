import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ResetPassword() {
  const { confirmPasswordReset, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [searchParams] = useSearchParams();      // <-- new
  const token = searchParams.get('token'); // Get token from URL: /reset-password/:token
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (password !== confirmPassword) {
      setMessage('Passwords do not match!');
      return;
    }

    const result = await confirmPasswordReset(token, password);

    if (result.success) {
      setMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setMessage(result.message || 'Password reset failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-md p-8 shadow-md border-0 bg-white">
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-lg">
            <span className="text-2xl font-bold text-white">KE</span>
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-[#333333]">Reset Password</h1>
          <p className="text-sm text-gray-600 font-medium">Enter your new password below</p>
        </div>

        {message && (
          <div className={`mb-4 rounded-lg p-3 text-center text-sm ${
            message.includes('successful') ? 'bg-[rgba(120,190,32,0.1)] text-[#6AAD1C] border border-[rgba(120,190,32,0.3)]' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        <div className="space-y-6">
          <Input
            label="New Password"
            type="password"
            id="password"
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Input
            label="Confirm Password"
            type="password"
            id="confirmPassword"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm font-semibold text-[#F58220] transition-colors hover:text-[#E0741C] hover:underline"
          >
            Back to Login
          </a>
        </div>
      </Card>
    </div>
  );
}