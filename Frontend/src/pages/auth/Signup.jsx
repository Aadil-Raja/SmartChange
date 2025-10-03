import React, { useState } from 'react';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

// Signup Page Component
const Signup = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = () => {
    if (password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    console.log('Signup attempt:', { fullName, email, password });
    // Add your signup logic here
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
      <Card className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-lg">
            <span className="text-3xl font-bold text-white">KE</span>
          </div>
        </div>

        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#333333]">Create your account</h1>
        </div>

        {/* Signup Form */}
        <div className="space-y-5">
          <Input
            label="Full Name"
            type="text"
            id="fullName"
            placeholder="Enter your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <Input
            label="Email"
            type="email"
            id="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            id="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Input
            label="Confirm Password"
            type="password"
            id="confirmPassword"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button onClick={handleSubmit}>
            Sign Up
          </Button>
        </div>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <span className="text-sm text-gray-600">Already have an account? </span>
          <a
            href="/login"
            className="text-sm font-medium text-[#F58220] transition-colors hover:text-[#FDB913] hover:underline"
          >
            Login
          </a>
        </div>
      </Card>
    </div>
  );
};

export default Signup;