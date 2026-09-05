import React, { useState } from 'react';
import type { UserDto } from '@familycarehub/shared-types';
import { HeartPulse, LogIn, Home, Users, Loader2 } from 'lucide-react';
import { apiClient, ApiError } from '../services/apiClient';

type Mode = 'login' | 'create' | 'join';

interface LoginProps {
  onAuthenticated: (user: UserDto) => void;
}

const inputClass =
  'w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

export const Login: React.FC<LoginProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let user: UserDto;
      if (mode === 'login') {
        user = await apiClient.login({ username, password });
      } else if (mode === 'create') {
        user = await apiClient.register({ mode: 'create', householdName, username, password, displayName });
      } else {
        user = await apiClient.register({ mode: 'join', inviteCode, username, password, displayName });
      }
      onAuthenticated(user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(`Could not reach the family server at ${apiClient.getServerUrl()}. Is the host computer running?`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary text-mainText p-6">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-4">
          <HeartPulse className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-2xl font-bold mb-1 text-mainText">Family Care Hub</h1>
        <p className="text-mutedText text-sm">Your household's shared health records</p>
      </div>

      <div className="w-full max-w-sm bg-surface border border-borderColor rounded-2xl shadow-2xl p-6">
        {/* Mode Tabs */}
        <div className="flex rounded-lg bg-surface-hover p-1 mb-6 text-sm font-medium">
          {([
            ['login', 'Sign In'],
            ['create', 'New Household'],
            ['join', 'Join'],
          ] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-2 rounded-md transition-colors ${
                mode === m ? 'bg-accent text-white shadow' : 'text-mutedText hover:text-mainText'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' && (
            <div>
              <label className="block text-sm text-mutedText mb-1">Household Name</label>
              <input
                type="text"
                required
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className={inputClass}
                placeholder="e.g. The Smiths"
              />
            </div>
          )}

          {mode === 'join' && (
            <div>
              <label className="block text-sm text-mutedText mb-1">Invite Code</label>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className={`${inputClass} font-mono tracking-widest uppercase`}
                placeholder="e.g. K7MPQ2XW"
              />
              <p className="text-xs text-mutedText mt-1">
                Ask the person who set up your household for this code (shown in their Settings).
              </p>
            </div>
          )}

          {mode !== 'login' && (
            <div>
              <label className="block text-sm text-mutedText mb-1">Your Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Grandma Jo"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-mutedText mb-1">Username</label>
            <input
              type="text"
              required
              autoFocus
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              placeholder="username"
            />
          </div>

          <div>
            <label className="block text-sm text-mutedText mb-1">Password</label>
            <input
              type="password"
              required
              minLength={mode === 'login' ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder={mode === 'login' ? 'password' : 'at least 8 characters'}
            />
          </div>

          {error && <div className="text-danger text-sm font-medium">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white font-bold py-3 rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" /> Sign In
              </>
            ) : mode === 'create' ? (
              <>
                <Home className="w-4 h-4" /> Create Household
              </>
            ) : (
              <>
                <Users className="w-4 h-4" /> Join Household
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
