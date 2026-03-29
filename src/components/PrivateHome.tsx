import { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, User, handleFirestoreError, OperationType, doc, getDoc } from '../firebase';
import { ConnectionWall } from './ConnectionWall';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, ArrowLeft, Sparkles, Lock, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Connection {
  id: string;
  userIds: string[];
  storyIds: string[];
  createdAt: any;
}

export function PrivateHome({ user }: { user: User }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setIsPremium(userDoc.data().isPremium || false);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    fetchProfile();
  }, [user.uid]);

  useEffect(() => {
    const q = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Connection));
      setConnections(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'connections');
    });
    return () => unsubscribe();
  }, [user.uid]);

  if (selectedConnection) {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => setSelectedConnection(null)}
          className="flex items-center gap-2 text-sm text-[#5A5A40] hover:underline underline-offset-4 transition-all"
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </button>
        <ConnectionWall user={user} connection={selectedConnection} isPremium={isPremium} />
      </div>
    );
  }

  const isOld = (createdAt: any) => {
    if (!createdAt) return false;
    const date = createdAt.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days > 7;
  };

  return (
    <div className="space-y-12">
      <header className="text-center space-y-2">
        <h2 className="text-2xl font-medium text-[#5A5A40]">Your Private Home</h2>
        <p className="text-sm text-[#1a1a1a]/40 italic">One-to-one connections from your stories.</p>
      </header>

      <div className="grid gap-6">
        <AnimatePresence mode="popLayout">
          {connections.length > 0 ? (
            connections.map((conn) => {
              const locked = isOld(conn.createdAt) && !isPremium;
              return (
                <motion.button
                  key={conn.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setSelectedConnection(conn)}
                  className={`group relative bg-white p-6 rounded-3xl shadow-sm border transition-all text-left ${
                    locked ? 'border-red-100 opacity-80' : 'border-[#5A5A40]/5 hover:border-[#5A5A40]/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#5A5A40]">
                        {locked ? <Lock size={18} className="text-red-400" /> : <MessageSquare size={18} />}
                        <span className={`text-sm font-medium ${locked ? 'text-red-400' : ''}`}>
                          Private Wall {locked && '(Locked)'}
                        </span>
                      </div>
                      <p className="text-xs text-[#1a1a1a]/40 italic">
                        Matched on {conn.createdAt?.toDate().toLocaleDateString() || 'Just now'}
                      </p>
                    </div>
                    <div className={`p-2 rounded-full transition-colors ${
                      locked 
                        ? 'bg-red-50 text-red-400' 
                        : 'bg-[#f5f5f0] group-hover:bg-[#5A5A40] group-hover:text-white'
                    }`}>
                      {locked ? <Crown size={16} /> : <Sparkles size={16} />}
                    </div>
                  </div>
                  {locked && (
                    <div className="mt-4 pt-4 border-t border-red-50">
                      <p className="text-[10px] text-red-400 italic">
                        This connection is older than 7 days. Upgrade to Premium to reopen.
                      </p>
                    </div>
                  )}
                </motion.button>
              );
            })
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 bg-white/50 rounded-3xl border border-dashed border-[#5A5A40]/20"
            >
              <p className="text-[#1a1a1a]/30 italic">No connections yet. Post a story to find a match.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
