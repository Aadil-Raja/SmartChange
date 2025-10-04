import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ResetPassword() {
  const { confirmPasswordReset, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const { token } = useParams(); // Get token from URL: /reset-password/:token
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-lg">
            <span className="text-3xl font-bold text-white">KE</span>
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-[#333333]">Reset Password</h1>
          <p className="text-sm text-gray-600">Enter your new password below</p>
        </div>

        {message && (
          <div className={`mb-4 rounded-lg p-3 text-center text-sm ${
            message.includes('successful') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}

        <div className="space-y-5">
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
            className="text-sm font-medium text-[#F58220] transition-colors hover:text-[#FDB913] hover:underline"
          >
            Back to Login
          </a>
        </div>
      </Card>
    </div>
  );
}