import React, { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, User, handleFirestoreError, OperationType, updateDoc, doc, deleteDoc } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, X, Check, Trash2, ArrowLeft, Loader2, MessageSquare, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StoryVisualizer } from './StoryVisualizer';

interface Story {
  id: string;
  text: string;
  authorId: string;
  createdAt: any;
  keywords?: string[];
}

interface MyStoriesProps {
  user: User;
}

export function MyStories({ user }: MyStoriesProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [visualShareStory, setVisualShareStory] = useState<Story | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'stories'),
      where('authorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
      setStories(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stories');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

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

  const handleDelete = async (storyId: string) => {
    if (isDeleting) return;
    setIsDeleting(storyId);
    try {
      await deleteDoc(doc(db, 'stories', storyId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stories/${storyId}`);
    } finally {
      setIsDeleting(null);
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
        <h2 className="text-xl font-medium text-[#5A5A40]">My Stories</h2>
      </div>

      {stories.length === 0 ? (
        <div className="text-center py-20 space-y-4 bg-white rounded-[2rem] border border-[#5A5A40]/10">
          <MessageSquare className="w-12 h-12 mx-auto text-[#5A5A40]/20" />
          <p className="text-[#1a1a1a]/60 italic">You haven't shared any fragments yet.</p>
          <Link to="/" className="inline-block px-6 py-2 bg-[#5A5A40] text-white rounded-full text-sm hover:bg-[#4a4a35] transition-colors">
            Share your first story
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {stories.map((story) => (
              <motion.div
                key={story.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#5A5A40]/10 relative group"
              >
                {editingStoryId === story.id ? (
                  <div className="space-y-4">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full p-4 rounded-xl bg-[#f5f5f0]/50 border-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm italic min-h-[100px]"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEditing}
                        className="p-2 text-[#1a1a1a]/40 hover:text-red-600 transition-colors"
                      >
                        <X size={18} />
                      </button>
                      <button
                        onClick={() => handleUpdate(story.id)}
                        disabled={isUpdating || !editText.trim() || editText === story.text}
                        className="p-2 text-[#5A5A40] hover:text-[#4a4a35] disabled:opacity-50 transition-colors"
                      >
                        {isUpdating ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-lg leading-relaxed text-[#1a1a1a]/80 italic">
                      "{story.text}"
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {story.keywords?.map((keyword, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-[#5A5A40]/5 text-[#5A5A40]/60 text-[10px] rounded-full uppercase tracking-wider">
                          #{keyword}
                        </span>
                      ))}
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-widest text-[#1a1a1a]/30">
                        {story.createdAt?.toDate().toLocaleDateString() || 'Just now'}
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setVisualShareStory(story)}
                          className="p-2 text-[#1a1a1a]/40 hover:text-[#5A5A40] transition-colors"
                          title="Create visual card"
                        >
                          <ImageIcon size={14} />
                        </button>
                        <button
                          onClick={() => startEditing(story)}
                          className="p-2 text-[#1a1a1a]/40 hover:text-[#5A5A40] transition-colors"
                          title="Edit story"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(story.id)}
                          className="p-2 text-[#1a1a1a]/40 hover:text-red-600 transition-colors"
                          title="Delete story"
                        >
                          {isDeleting === story.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
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
