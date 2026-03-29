import React, { useState, useEffect } from 'react';
import { db, doc, getDoc, updateDoc, handleFirestoreError, OperationType, User } from '../firebase';
import { motion } from 'motion/react';
import { User as UserIcon, Save, Trash2, ArrowLeft, Loader2, Crown, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { arrayRemove } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  displayName?: string | null;
  followedAuthorIds: string[];
  dailyMatchCount?: number;
  lastResetDate?: string;
  isPremium?: boolean;
}

interface ProfileSettingsProps {
  user: User;
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setProfile(data);
          setNewDisplayName(data.displayName || user.displayName || '');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSaveName = async () => {
    if (!profile || saving) return;
    setSaving(true);
    setMessage(null);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: newDisplayName.trim()
      });
      setProfile({ ...profile, displayName: newDisplayName.trim() });
      setMessage({ type: 'success', text: 'Display name updated successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update display name.' });
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUnfollow = async (authorId: string) => {
    if (!profile || saving) return;
    setSaving(true);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        followedAuthorIds: arrayRemove(authorId)
      });
      setProfile({
        ...profile,
        followedAuthorIds: profile.followedAuthorIds.filter(id => id !== authorId)
      });
      setMessage({ type: 'success', text: 'Author unfollowed.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to unfollow author.' });
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePremium = async () => {
    if (!profile || saving) return;
    setSaving(true);
    setMessage(null);

    const newStatus = !profile.isPremium;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isPremium: newStatus
      });
      setProfile({ ...profile, isPremium: newStatus });
      setMessage({ 
        type: 'success', 
        text: newStatus ? 'Welcome to Premium! Enjoy unlimited stories.' : 'Premium subscription cancelled.' 
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update subscription status.' });
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#5A5A40]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link to="/private" className="inline-flex items-center gap-2 text-xs text-[#1a1a1a]/40 hover:text-[#5A5A40] transition-colors">
          <ArrowLeft size={14} />
          <span>Back to Home</span>
        </Link>
        <h2 className="text-xl font-medium text-[#5A5A40]">Profile Settings</h2>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Display Name Section */}
      <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#5A5A40]/10 space-y-4">
        <div className="flex items-center gap-3 text-[#5A5A40]">
          <UserIcon size={20} />
          <h3 className="font-medium">Display Name</h3>
        </div>
        <p className="text-xs text-[#1a1a1a]/40 italic">
          This name will be shown on your stories instead of "Anonymous".
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            placeholder="Your display name"
            className="flex-1 p-3 rounded-xl bg-[#f5f5f0]/50 border-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm"
            maxLength={50}
          />
          <button
            onClick={handleSaveName}
            disabled={saving || !newDisplayName.trim() || newDisplayName === profile?.displayName}
            className="px-6 py-2 bg-[#5A5A40] text-white rounded-full hover:bg-[#4a4a35] disabled:opacity-50 transition-all flex items-center gap-2 text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Save</span>
          </button>
        </div>
      </section>

      {/* Premium Status Section */}
      <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#5A5A40]/10 space-y-4">
        <div className="flex items-center gap-3 text-[#5A5A40]">
          <Crown size={20} />
          <h3 className="font-medium">Premium Status</h3>
        </div>
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#f5f5f0]/30">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#1a1a1a]">
              {profile?.isPremium ? 'Premium Member' : 'Free Plan'}
            </p>
            <p className="text-xs text-[#1a1a1a]/40 italic">
              {profile?.isPremium 
                ? 'Unlimited matches and stories.' 
                : `Matches today: ${profile?.dailyMatchCount || 0} / 2`}
            </p>
          </div>
          <button
            onClick={handleTogglePremium}
            disabled={saving}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
              profile?.isPremium 
                ? 'bg-[#1a1a1a]/5 text-[#1a1a1a]/40 hover:bg-red-50 hover:text-red-600' 
                : 'bg-[#5A5A40] text-white hover:bg-[#4a4a35]'
            }`}
          >
            {profile?.isPremium ? 'Cancel Premium' : 'Upgrade Now'}
          </button>
        </div>
      </section>

      {/* Followed Authors Section */}
      <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#5A5A40]/10 space-y-4">
        <div className="flex items-center gap-3 text-[#5A5A40]">
          <UserIcon size={20} />
          <h3 className="font-medium">Followed Authors</h3>
        </div>
        
        {profile?.followedAuthorIds.length === 0 ? (
          <p className="text-sm text-[#1a1a1a]/40 italic py-4">
            You haven't followed any authors yet.
          </p>
        ) : (
          <div className="space-y-2">
            {profile?.followedAuthorIds.map((authorId) => (
              <div key={authorId} className="flex items-center justify-between p-3 rounded-xl bg-[#f5f5f0]/30 group">
                <span className="text-xs font-mono text-[#1a1a1a]/60">{authorId}</span>
                <button
                  onClick={() => handleUnfollow(authorId)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                  title="Unfollow"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
