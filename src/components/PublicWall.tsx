import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, User, handleFirestoreError, OperationType, updateDoc, doc } from '../firebase';
import { findSimilarStory, suggestKeywords } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, Pencil, X, Check, Share2, Search, UserPlus, UserMinus, AlertCircle, Crown, Image as ImageIcon } from 'lucide-react';
import { setDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { StoryVisualizer } from './StoryVisualizer';

interface Story {
  id: string;
  text: string;
  authorId: string;
  createdAt: any;
  keywords?: string[];
  isPremiumAuthor?: boolean;
}

export function PublicWall({ user, onLogin }: { user: User | null, onLogin: () => void }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [newStory, setNewStory] = useState('');
  const [keywords, setKeywords] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [mood, setMood] = useState('any');
  const [preferredLength, setPreferredLength] = useState<'short' | 'medium' | 'long' | 'any'>('any');
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [followedAuthors, setFollowedAuthors] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<{ 
    displayName?: string | null,
    dailyMatchCount?: number,
    lastResetDate?: string,
    isPremium?: boolean
  } | null>(null);
  const [userConnections, setUserConnections] = useState<string[]>([]);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [visualShareStory, setVisualShareStory] = useState<Story | null>(null);

  useEffect(() => {
    if (!newStory.trim() || newStory.length < 20) {
      setSuggestedKeywords([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const suggestions = await suggestKeywords(newStory);
        // Filter out keywords already in the keywords input
        const currentKeywords = keywords.split(',').map(k => k.trim().toLowerCase());
        const filtered = suggestions.filter(s => !currentKeywords.includes(s));
        setSuggestedKeywords(filtered);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setIsSuggesting(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [newStory, keywords]);

  useEffect(() => {
    if (!user) {
      setFollowedAuthors([]);
      setUserConnections([]);
      return;
    }

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const today = new Date().toISOString().split('T')[0];

        if (userDoc.exists()) {
          const data = userDoc.data();
          let updatedData = { ...data };

          // Reset daily count if it's a new day
          if (data.lastResetDate !== today) {
            updatedData.dailyMatchCount = 0;
            updatedData.lastResetDate = today;
            await updateDoc(doc(db, 'users', user.uid), {
              dailyMatchCount: 0,
              lastResetDate: today
            });
          }

          setFollowedAuthors(data.followedAuthorIds || []);
          setUserProfile(updatedData);
        } else {
          // Initialize profile
          const initialProfile = {
            uid: user.uid,
            displayName: user.displayName,
            followedAuthorIds: [],
            dailyMatchCount: 0,
            lastResetDate: today,
            isPremium: false
          };
          await setDoc(doc(db, 'users', user.uid), initialProfile);
          setFollowedAuthors([]);
          setUserProfile(initialProfile);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    const fetchConnections = () => {
      const q = query(
        collection(db, 'connections'),
        where('userIds', 'array-contains', user.uid)
      );
      return onSnapshot(q, (snapshot) => {
        const connectedUids = snapshot.docs.flatMap(doc => {
          const data = doc.data();
          return data.userIds.filter((id: string) => id !== user.uid);
        });
        setUserConnections(connectedUids);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'connections');
      });
    };

    fetchProfile();
    const unsubscribeConnections = fetchConnections();
    return () => unsubscribeConnections();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
      setStories(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stories');
    });
    return () => unsubscribe();
  }, []);

  const addSuggestion = (suggestion: string) => {
    const current = keywords.split(',').map(k => k.trim()).filter(k => k !== '');
    if (!current.includes(suggestion)) {
      const updated = [...current, suggestion].join(', ');
      setKeywords(updated);
    }
    setSuggestedKeywords(prev => prev.filter(s => s !== suggestion));
  };

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onLogin();
      return;
    }

    // Check usage limit for free users
    if (userProfile && !userProfile.isPremium && (userProfile.dailyMatchCount || 0) >= 2) {
      setIsLimitReached(true);
      return;
    }

    if (!newStory.trim() || isPosting) return;
    setIsConfirming(true);
  };

  const confirmPost = async () => {
    setIsConfirming(false);
    setIsPosting(true);
    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k !== '');
    try {
      // 1. Save the new story
      const storyRef = await addDoc(collection(db, 'stories'), {
        text: newStory.trim(),
        authorId: user.uid,
        createdAt: serverTimestamp(),
        keywords: keywordList,
        isPremiumAuthor: userProfile?.isPremium || false,
      });

      // 2. Find a match
      const match = await findSimilarStory(newStory, stories, user.uid, {
        tone: mood !== 'any' ? mood : undefined,
        preferredLength: preferredLength !== 'any' ? preferredLength : undefined,
        themeKeywords: keywordList.length > 0 ? keywordList : undefined,
        connectedUserIds: userConnections,
        isPremiumUser: userProfile?.isPremium || false,
      });

      if (match) {
        // 3. Create a connection
        await addDoc(collection(db, 'connections'), {
          userIds: [user.uid, match.authorId],
          storyIds: [storyRef.id, match.id],
          createdAt: serverTimestamp(),
        });

        // Increment daily match count
        if (userProfile && !userProfile.isPremium) {
          const newCount = (userProfile.dailyMatchCount || 0) + 1;
          await updateDoc(doc(db, 'users', user.uid), {
            dailyMatchCount: newCount
          });
          setUserProfile(prev => prev ? { ...prev, dailyMatchCount: newCount } : null);
        }
      }

      setNewStory('');
      setKeywords('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stories/connections');
    } finally {
      setIsPosting(false);
    }
  };

  const startEditing = (story: Story) => {
    setEditingStoryId(story.id);
    setEditText(story.text);
  };

  const cancelEditing = () => {
    setEditingStoryId(null);
    setEditText('');
  };

  const handleUpdate = async (storyId: string) => {
    if (!editText.trim() || isUpdating) return;

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'stories', storyId), {
        text: editText.trim()
      });
      setEditingStoryId(null);
      setEditText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stories/${storyId}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShare = async (story: Story) => {
    const shareUrl = `${window.location.origin}/#/story/${story.id}`;
    const shareText = `"${story.text}"\n\nRead more on StorySpot: ${shareUrl}`;
    
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedId(story.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleFollow = async (authorId: string) => {
    if (!user) {
      onLogin();
      return;
    }

    const isFollowing = followedAuthors.includes(authorId);
    const userRef = doc(db, 'users', user.uid);

    try {
      if (isFollowing) {
        await updateDoc(userRef, {
          followedAuthorIds: arrayRemove(authorId)
        });
        setFollowedAuthors(prev => prev.filter(id => id !== authorId));
      } else {
        await updateDoc(userRef, {
          followedAuthorIds: arrayUnion(authorId)
        });
        setFollowedAuthors(prev => [...prev, authorId]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const filteredStories = stories.filter(story => 
    story.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-12">
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-[#5A5A40]/5">
        <h2 className="text-lg font-medium mb-4 text-[#5A5A40]">Share a fragment of your story...</h2>
        <form onSubmit={handlePost} className="space-y-4">
          <textarea
            value={newStory}
            onChange={(e) => setNewStory(e.target.value)}
            placeholder="What's on your mind? (Keep it short and meaningful)"
            className="w-full h-32 p-4 rounded-2xl bg-[#f5f5f0]/50 border-none focus:ring-2 focus:ring-[#5A5A40]/20 resize-none placeholder:italic"
            maxLength={500}
          />
          <div className="space-y-2">
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Themes (e.g., love, loss, adventure)"
              className="w-full p-3 rounded-xl bg-[#f5f5f0]/50 border-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm italic"
            />
            
            <AnimatePresence>
              {suggestedKeywords.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex flex-wrap gap-2 px-2"
                >
                  <span className="text-[10px] uppercase tracking-widest text-[#1a1a1a]/30 self-center mr-1">Suggestions:</span>
                  {suggestedKeywords.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => addSuggestion(suggestion)}
                      className="px-2 py-1 bg-[#5A5A40]/5 hover:bg-[#5A5A40]/10 text-[#5A5A40]/60 text-[10px] rounded-full uppercase tracking-wider transition-colors"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className={`text-xs transition-colors ${newStory.length > 450 ? 'text-red-500 font-medium' : 'text-[#1a1a1a]/30'}`}>
                {newStory.length}/500
              </span>
              <select 
                value={mood} 
                onChange={(e) => setMood(e.target.value)}
                className="text-xs bg-transparent border-none text-[#5A5A40] focus:ring-0 cursor-pointer italic"
              >
                <option value="any">Any mood</option>
                <option value="melancholy">Melancholy</option>
                <option value="hopeful">Hopeful</option>
                <option value="nostalgic">Nostalgic</option>
                <option value="raw">Raw & Honest</option>
                <option value="dreamy">Dreamy</option>
              </select>
              <select 
                value={preferredLength} 
                onChange={(e) => setPreferredLength(e.target.value as any)}
                className="text-xs bg-transparent border-none text-[#5A5A40] focus:ring-0 cursor-pointer italic"
              >
                <option value="any">Any length</option>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={!newStory.trim() || isPosting}
              className="flex items-center gap-2 bg-[#5A5A40] text-white px-6 py-2 rounded-full hover:bg-[#4a4a35] disabled:opacity-50 transition-all"
            >
              {isPosting ? (
                <Sparkles size={18} className="animate-spin" />
              ) : (
                <>
                  <Send size={18} />
                  <span>Post</span>
                </>
              )}
            </button>
          </div>
        </form>
        {!user && (
          <p className="mt-4 text-xs text-[#1a1a1a]/40 italic">
            You'll be matched with a similar story once you post.
          </p>
        )}
      </section>

      <div className="space-y-8">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1a1a1a]/20 group-focus-within:text-[#5A5A40]/40 transition-colors" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search fragments..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white border border-[#5A5A40]/5 shadow-sm focus:ring-2 focus:ring-[#5A5A40]/10 transition-all placeholder:italic text-sm"
          />
        </div>

        {filteredStories.length > 0 ? (
          filteredStories.map((story) => (
            <motion.article
              key={story.id}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="group relative"
            >
            <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-[#5A5A40]/10 group-hover:bg-[#5A5A40]/30 transition-colors" />
            
            {editingStoryId === story.id ? (
              <div className="space-y-4">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-[#f5f5f0]/50 border-none focus:ring-2 focus:ring-[#5A5A40]/20 resize-none italic text-lg leading-relaxed text-[#1a1a1a]/80"
                  maxLength={500}
                  autoFocus
                />
                <div className="flex justify-between items-center">
                  <span className={`text-xs transition-colors ${editText.length > 450 ? 'text-red-500 font-medium' : 'text-[#1a1a1a]/30'}`}>
                    {editText.length}/500
                  </span>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={cancelEditing}
                      className="p-2 rounded-full hover:bg-[#1a1a1a]/5 text-[#1a1a1a]/40 transition-colors"
                    >
                      <X size={18} />
                    </button>
                    <button
                      onClick={() => handleUpdate(story.id)}
                      disabled={!editText.trim() || isUpdating || editText === story.text}
                      className="p-2 rounded-full hover:bg-[#5A5A40]/10 text-[#5A5A40] transition-colors disabled:opacity-50"
                    >
                      {isUpdating ? (
                        <Sparkles size={18} className="animate-spin" />
                      ) : (
                        <Check size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start gap-4">
                  <p className="text-lg leading-relaxed text-[#1a1a1a]/80 italic">
                    "{story.text}"
                  </p>
                  {story.keywords && story.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {story.keywords.map((kw, idx) => (
                        <span key={idx} className="text-[9px] px-2 py-0.5 bg-[#5A5A40]/5 text-[#5A5A40] rounded-full italic">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => handleShare(story)}
                      className="p-2 rounded-full hover:bg-[#5A5A40]/10 text-[#5A5A40] transition-colors relative"
                      title="Share story"
                    >
                      {copiedId === story.id ? (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#5A5A40] text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap">
                          Copied!
                        </span>
                      ) : null}
                      <Share2 size={14} />
                    </button>
                    <button
                      onClick={() => setVisualShareStory(story)}
                      className="p-2 rounded-full hover:bg-[#5A5A40]/10 text-[#5A5A40] transition-colors"
                      title="Create visual card"
                    >
                      <ImageIcon size={14} />
                    </button>
                    {user && story.authorId === user.uid && (
                      <button
                        onClick={() => startEditing(story)}
                        className="p-2 rounded-full hover:bg-[#5A5A40]/10 text-[#5A5A40] transition-colors"
                        title="Edit story"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {user && story.authorId !== user.uid && (
                      <button
                        onClick={() => handleFollow(story.authorId)}
                        className={`p-2 rounded-full transition-colors ${
                          followedAuthors.includes(story.authorId)
                            ? 'bg-[#5A5A40] text-white hover:bg-[#4a4a35]'
                            : 'hover:bg-[#5A5A40]/10 text-[#5A5A40]'
                        }`}
                        title={followedAuthors.includes(story.authorId) ? 'Unfollow author' : 'Follow author'}
                      >
                        {followedAuthors.includes(story.authorId) ? (
                          <UserMinus size={14} />
                        ) : (
                          <UserPlus size={14} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#1a1a1a]/30">
                  <span>
                    {user && story.authorId === user.uid 
                      ? (userProfile?.displayName || user.displayName || 'You') 
                      : 'Anonymous'}
                  </span>
                  <span>•</span>
                  <span>{story.createdAt?.toDate().toLocaleDateString() || 'Just now'}</span>
                  {user && story.authorId === user.uid && (
                    <>
                      <span>•</span>
                      <span className="text-[#5A5A40] font-medium">Your Story</span>
                    </>
                  )}
                </div>
              </>
            )}
          </motion.article>
        ))
      ) : (
        <div className="text-center py-12">
          <p className="text-[#1a1a1a]/40 italic">No fragments found matching your search...</p>
        </div>
      )}
      </div>

      {/* Limit Reached Modal */}
      <AnimatePresence>
        {isLimitReached && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLimitReached(false)}
              className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl border border-[#5A5A40]/10 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-[#5A5A40]/10 rounded-full flex items-center justify-center mx-auto text-[#5A5A40]">
                <Crown size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-medium text-[#5A5A40]">Daily Limit Reached</h3>
                <p className="text-[#1a1a1a]/60 italic leading-relaxed">
                  Free users can create 2 matches per day. You've reached your limit for today.
                </p>
              </div>
              <div className="pt-4 space-y-3">
                <Link
                  to="/settings"
                  onClick={() => setIsLimitReached(false)}
                  className="block w-full py-4 bg-[#5A5A40] text-white rounded-full font-medium hover:bg-[#4a4a35] transition-all shadow-lg shadow-[#5A5A40]/20"
                >
                  Upgrade to Premium
                </Link>
                <button
                  onClick={() => setIsLimitReached(false)}
                  className="block w-full py-4 text-[#1a1a1a]/40 hover:text-[#1a1a1a]/60 transition-colors text-sm"
                >
                  Maybe later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      {isConfirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1a1a1a]/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-md w-full border border-[#5A5A40]/10"
          >
            <h3 className="text-xl font-medium text-[#5A5A40] mb-4">Ready to share?</h3>
            <p className="text-[#1a1a1a]/60 leading-relaxed mb-8 italic">
              "Your story will be shared on the Public Wall. While you'll see your own name, it remains anonymous to everyone else. Once posted, it cannot be un-shared. Are you sure you're ready to release this fragment?"
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsConfirming(false)}
                className="flex-1 px-6 py-3 rounded-full border border-[#5A5A40]/20 text-[#5A5A40] hover:bg-[#5A5A40]/5 transition-colors text-sm font-medium"
              >
                Not yet
              </button>
              <button
                onClick={confirmPost}
                className="flex-1 px-6 py-3 rounded-full bg-[#5A5A40] text-white hover:bg-[#4a4a35] transition-colors text-sm font-medium shadow-lg shadow-[#5A5A40]/20"
              >
                Yes, share it
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Visual Share Modal */}
      <AnimatePresence>
        {visualShareStory && (
          <StoryVisualizer 
            text={visualShareStory.text}
            authorId={visualShareStory.authorId}
            onClose={() => setVisualShareStory(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
