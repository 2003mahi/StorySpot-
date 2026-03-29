import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, User, doc, getDoc, handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User as UserIcon, Lock, Crown, Sparkles, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDeepPrompts } from '../services/geminiService';

interface Message {
  id: string;
  connectionId: string;
  text: string;
  senderId: string;
  createdAt: any;
}

interface Connection {
  id: string;
  userIds: string[];
  storyIds: string[];
  createdAt: any;
}

export function ConnectionWall({ user, connection, isPremium }: { user: User, connection: Connection, isPremium: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [matchedStory, setMatchedStory] = useState<string | null>(null);
  const [isDeepMode, setIsDeepMode] = useState(false);
  const [deepPrompts, setDeepPrompts] = useState<string[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOld = (createdAt: any) => {
    if (!createdAt) return false;
    const date = createdAt.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days > 7;
  };

  const isLocked = isOld(connection.createdAt) && !isPremium;

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('connectionId', '==', connection.id),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });
    return () => unsubscribe();
  }, [connection.id]);

  useEffect(() => {
    const fetchMatchedStory = async () => {
      const otherStoryId = connection.storyIds.find(id => {
        // Find the story ID that isn't the one this user posted
        // This is tricky because we don't know which story ID belongs to which user easily
        // Let's just fetch both and see which one isn't by the current user
        return true; // We'll fetch both and filter
      });
      
      try {
        const s1 = await getDoc(doc(db, 'stories', connection.storyIds[0]));
        const s2 = await getDoc(doc(db, 'stories', connection.storyIds[1]));
        
        const stories = [s1.data(), s2.data()];
        const otherStory = stories.find(s => s?.authorId !== user.uid);
        if (otherStory) setMatchedStory(otherStory.text);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'stories');
      }
    };
    fetchMatchedStory();
  }, [connection.storyIds, user.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!isDeepMode || !isPremium || messages.length === 0) {
      setDeepPrompts([]);
      return;
    }

    const fetchPrompts = async () => {
      setIsLoadingPrompts(true);
      try {
        // Use last 5 messages for context
        const context = messages.slice(-5).map(m => `${m.senderId === user.uid ? 'Me' : 'Them'}: ${m.text}`).join('\n');
        const prompts = await getDeepPrompts(context || matchedStory || '');
        setDeepPrompts(prompts);
      } catch (error) {
        console.error("Error fetching deep prompts:", error);
      } finally {
        setIsLoadingPrompts(false);
      }
    };

    const timer = setTimeout(fetchPrompts, 1000);
    return () => clearTimeout(timer);
  }, [isDeepMode, isPremium, messages, matchedStory, user.uid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending || isLocked) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        connectionId: connection.id,
        text: newMessage.trim(),
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[70vh] bg-white rounded-3xl shadow-sm border border-[#5A5A40]/5 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#5A5A40]/5 bg-[#f5f5f0]/30">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#5A5A40] p-2 rounded-full text-white">
              <UserIcon size={16} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-[#5A5A40]">Private Connection</h3>
              <p className="text-[10px] uppercase tracking-widest text-[#1a1a1a]/40 italic">Anonymous</p>
            </div>
          </div>
          
          {isPremium && (
            <button
              onClick={() => setIsDeepMode(!isDeepMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                isDeepMode 
                  ? 'bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20' 
                  : 'bg-white text-[#5A5A40] border border-[#5A5A40]/20 hover:bg-[#5A5A40]/5'
              }`}
            >
              <BrainCircuit size={12} />
              <span>{isDeepMode ? 'Deep Mode On' : 'Deep Mode'}</span>
            </button>
          )}
        </div>
        
        {matchedStory && (
          <div className="p-3 rounded-xl bg-white/50 border border-[#5A5A40]/10 italic text-xs text-[#1a1a1a]/60">
            " {matchedStory} "
          </div>
        )}
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.senderId === user.uid 
                    ? 'bg-[#5A5A40] text-white rounded-tr-none' 
                    : 'bg-[#f5f5f0] text-[#1a1a1a]/80 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="relative">
        <AnimatePresence>
          {isDeepMode && deepPrompts.length > 0 && !isLocked && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 p-4 flex flex-wrap gap-2 bg-gradient-to-t from-[#f5f5f0] to-transparent"
            >
              {deepPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => setNewMessage(prompt)}
                  className="px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-[#5A5A40]/10 rounded-full text-[10px] text-[#5A5A40] hover:bg-[#5A5A40] hover:text-white transition-all italic shadow-sm"
                >
                  {prompt}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className={`p-6 border-t border-[#5A5A40]/5 bg-[#f5f5f0]/30 ${isLocked ? 'blur-[2px] pointer-events-none' : ''}`}>
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isLocked ? "Connection locked..." : "Write a note..."}
              className="flex-1 bg-white p-3 rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm italic"
              maxLength={300}
              disabled={isLocked}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending || isLocked}
              className="bg-[#5A5A40] text-white p-3 rounded-2xl hover:bg-[#4a4a35] disabled:opacity-50 transition-all"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <span className={`text-[10px] transition-colors ${newMessage.length > 280 ? 'text-red-500 font-medium' : 'text-[#1a1a1a]/20'}`}>
              {newMessage.length}/300
            </span>
          </div>
        </form>

        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] p-6">
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-red-100 text-center space-y-4 max-w-xs">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-400">
                <Lock size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-[#1a1a1a]">Connection Inactive</h4>
                <p className="text-[10px] text-[#1a1a1a]/40 italic leading-relaxed">
                  This wall has become inactive after 7 days. Upgrade to Premium to continue messaging.
                </p>
              </div>
              <Link
                to="/settings"
                className="block w-full py-2.5 bg-[#5A5A40] text-white rounded-full text-xs font-medium hover:bg-[#4a4a35] transition-all flex items-center justify-center gap-2"
              >
                <Crown size={14} />
                <span>Unlock Connection</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
