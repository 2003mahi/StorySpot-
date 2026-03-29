import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, doc, getDoc, handleFirestoreError, OperationType } from '../firebase';
import { motion } from 'motion/react';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { StoryVisualizer } from './StoryVisualizer';

interface Story {
  id: string;
  text: string;
  authorId: string;
  createdAt: any;
}

export function StoryView() {
  const { storyId } = useParams<{ storyId: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVisualShareOpen, setIsVisualShareOpen] = useState(false);

  useEffect(() => {
    async function fetchStory() {
      if (!storyId) return;
      try {
        const docRef = doc(db, 'stories', storyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setStory({ id: docSnap.id, ...docSnap.data() } as Story);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `stories/${storyId}`);
      } finally {
        setLoading(false);
      }
    }
    fetchStory();
  }, [storyId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-6 h-6 border-2 border-[#5A5A40] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-[#1a1a1a]/60 italic">This fragment has vanished into the void...</p>
        <Link to="/" className="text-[#5A5A40] underline underline-offset-4 text-sm">Return to the wall</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link to="/" className="inline-flex items-center gap-2 text-xs text-[#1a1a1a]/40 hover:text-[#5A5A40] transition-colors">
        <ArrowLeft size={14} />
        <span>Back to Wall</span>
      </Link>

      <div className="flex justify-end">
        <button
          onClick={() => setIsVisualShareOpen(true)}
          className="flex items-center gap-2 text-xs text-[#5A5A40] hover:underline underline-offset-4 transition-all"
        >
          <ImageIcon size={14} />
          <span>Share as Image</span>
        </button>
      </div>

      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <div className="absolute -left-6 top-0 bottom-0 w-1 bg-[#5A5A40]/20" />
        <p className="text-2xl leading-relaxed text-[#1a1a1a]/90 italic font-medium">
          "{story.text}"
        </p>
        <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#1a1a1a]/30">
          <span>Anonymous</span>
          <span>•</span>
          <span>{story.createdAt?.toDate().toLocaleDateString() || 'Just now'}</span>
        </div>
      </motion.article>

      <div className="pt-12 border-t border-[#5A5A40]/10">
        <p className="text-sm text-[#1a1a1a]/50 italic leading-relaxed">
          Every story shared is a bridge to another soul. 
          This fragment was captured on the public wall, waiting for its match.
        </p>
      </div>

      {/* Visual Share Modal */}
      {isVisualShareOpen && (
        <StoryVisualizer 
          text={story.text}
          authorId={story.authorId}
          onClose={() => setIsVisualShareOpen(false)}
        />
      )}
    </div>
  );
}
