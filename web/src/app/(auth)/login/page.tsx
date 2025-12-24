"use client";
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simple hash simulation
    const hash = btoa(password); 
    const res = await login(username, hash);
    if (res.ok) {
      router.push('/channels/me');
    } else {
      setError(res.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dc-bg-primary">
      <div className="bg-dc-bg-secondary p-8 rounded shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Welcome Back!</h2>
        <p className="text-dc-text-muted text-center mb-6">We're so excited to see you again!</p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-dc-text-muted text-xs font-bold uppercase mb-2">Username</label>
            <input 
              type="text" 
              className="w-full bg-dc-bg-dark text-white p-2.5 rounded border border-transparent focus:border-dc-brand outline-none transition-colors"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-dc-text-muted text-xs font-bold uppercase mb-2">Password</label>
            <input 
              type="password" 
              className="w-full bg-dc-bg-dark text-white p-2.5 rounded border border-transparent focus:border-dc-brand outline-none transition-colors"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          
          {error && <p className="text-dc-red text-sm mb-4">{error}</p>}
          
          <button type="submit" className="w-full bg-dc-brand text-white font-bold py-2.5 rounded hover:bg-indigo-500 transition-colors">
            Log In
          </button>
        </form>
        
        <p className="text-dc-text-muted text-sm mt-4">
          Need an account? <Link href="/register" className="text-dc-brand hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
