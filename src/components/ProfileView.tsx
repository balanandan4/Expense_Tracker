import React, { useState } from 'react';
import { User as UserIcon, Lock, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { User } from '../types.ts';
import { apiFetch } from '../utils/format.ts';

interface ProfileViewProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUserUpdated,
  onLogout,
}) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    setProfileLoading(true);
    try {
      const res = await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          action: 'update_details',
          name: name.trim(),
          email: email.trim(),
        }),
      });
      if (res.user) {
        onUserUpdated(res.user);
      }
      setProfileMsg(res.message || 'Profile updated.');
    } catch (err: any) {
      setProfileErr(err.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    setPwdErr(null);
    setPwdLoading(true);
    try {
      const res = await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          action: 'change_password',
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      setPwdMsg(res.message || 'Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdErr(err.message || 'Password change failed.');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-[#1e2624] flex items-center justify-between">
        <div>
          <div className="text-xs font-mono text-[#4ff0b7]">
            ACCOUNT &amp; SECURITY · PROFILE MANAGEMENT
          </div>
          <h1 className="font-display text-2xl font-semibold text-[#e9efec] mt-0.5">
            Personal Profile &amp; Credentials
          </h1>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 text-xs font-mono text-[#ff6b6b] border border-[#ff6b6b]/40 hover:bg-[#ff6b6b]/10 transition-colors flex items-center gap-2 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out of Session
        </button>
      </div>

      {/* Account Metadata Summary */}
      <div className="border border-[#1e2624] bg-[#101513] p-5 text-xs font-mono grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <div className="text-[#5a6b65]">USER ID &amp; ROLE</div>
          <div className="text-[#e9efec] mt-1">
            #{user.id} · {user.role === 'admin' ? 'Administrator' : 'Registered User'}
          </div>
        </div>
        <div>
          <div className="text-[#5a6b65]">ACCOUNT STATUS</div>
          <div className="text-[#4ff0b7] mt-1 uppercase">{user.status}</div>
        </div>
        <div>
          <div className="text-[#5a6b65]">REGISTERED AT</div>
          <div className="text-[#e9efec] mt-1">{user.created_at}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Details Form */}
        <div className="border border-[#1e2624] bg-[#101513] p-6">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#1e2624]">
            <UserIcon className="w-4 h-4 text-[#4ff0b7]" />
            <h2 className="font-display text-base font-semibold text-[#e9efec]">
              Update Profile Details
            </h2>
          </div>

          {profileErr && (
            <div className="mb-4 p-3 border border-[#ff6b6b]/50 bg-[#ff6b6b]/10 text-[#ff6b6b] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{profileErr}</span>
            </div>
          )}

          {profileMsg && (
            <div className="mb-4 p-3 border border-[#2c8a68] bg-[#4ff0b7]/10 text-[#4ff0b7] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{profileMsg}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label htmlFor="prof-name" className="block text-xs font-mono text-[#8ba39a] mb-1">
                Full Name
              </label>
              <input
                id="prof-name"
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
              />
            </div>

            <div>
              <label htmlFor="prof-email" className="block text-xs font-mono text-[#8ba39a] mb-1">
                Email Address
              </label>
              <input
                id="prof-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
              />
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="px-4 py-2 text-xs font-mono font-semibold bg-[#4ff0b7] text-[#06120d] border border-[#4ff0b7] hover:bg-transparent hover:text-[#4ff0b7] transition-colors cursor-pointer disabled:opacity-50"
            >
              {profileLoading ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="border border-[#1e2624] bg-[#101513] p-6">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#1e2624]">
            <Lock className="w-4 h-4 text-[#4ff0b7]" />
            <h2 className="font-display text-base font-semibold text-[#e9efec]">
              Change Account Password
            </h2>
          </div>

          {pwdErr && (
            <div className="mb-4 p-3 border border-[#ff6b6b]/50 bg-[#ff6b6b]/10 text-[#ff6b6b] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pwdErr}</span>
            </div>
          )}

          {pwdMsg && (
            <div className="mb-4 p-3 border border-[#2c8a68] bg-[#4ff0b7]/10 text-[#4ff0b7] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{pwdMsg}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="pwd-current" className="block text-xs font-mono text-[#8ba39a] mb-1">
                Current Password *
              </label>
              <input
                id="pwd-current"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
              />
            </div>

            <div>
              <label htmlFor="pwd-new" className="block text-xs font-mono text-[#8ba39a] mb-1">
                New Password (8+ chars, 1 uppercase, 1 digit) *
              </label>
              <input
                id="pwd-new"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
              />
            </div>

            <div>
              <label htmlFor="pwd-confirm" className="block text-xs font-mono text-[#8ba39a] mb-1">
                Confirm New Password *
              </label>
              <input
                id="pwd-confirm"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
              />
            </div>

            <button
              type="submit"
              disabled={pwdLoading}
              className="px-4 py-2 text-xs font-mono font-semibold bg-[#4ff0b7] text-[#06120d] border border-[#4ff0b7] hover:bg-transparent hover:text-[#4ff0b7] transition-colors cursor-pointer disabled:opacity-50"
            >
              {pwdLoading ? 'Verifying...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
