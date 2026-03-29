import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, User, signInWithPopup, googleProvider, signOut } from './firebase';
import { PublicWall } from './components/PublicWall';
import { PrivateHome } from './components/PrivateHome';
import { StoryView } from './components/StoryView';
import { ProfileSettings } from './components/ProfileSettings';
import { MyStories } from './components/MyStories';
import { LogIn, LogOut, Home, Globe, Settings, User as UserIcon, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center font-serif">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl italic text-[#5A5A40]"
        >
          StorySpot...
        </motion.div>
      </div>
    );
  }

  const isPublic = location.pathname === '/';
  const isPrivate = location.pathname === '/private';
  const isSettings = location.pathname === '/settings';
  const isMyStories = location.pathname === '/my-stories';

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#1a1a1a] font-serif selection:bg-[#5A5A40] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-[#f5f5f0]/80 backdrop-blur-md z-50 border-b border-[#5A5A40]/10">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-medium tracking-tight text-[#5A5A40]">StorySpot</Link>
          
          <div className="flex items-center gap-6">
            <Link 
              to="/"
              className={`flex items-center gap-2 text-sm transition-colors ${isPublic ? 'text-[#5A5A40] font-semibold underline underline-offset-8' : 'text-[#1a1a1a]/60 hover:text-[#5A5A40]'}`}
            >
              <Globe size={18} />
              <span className="hidden sm:inline">Public Wall</span>
            </Link>
            
            {user && (
              <Link 
                to="/private"
                className={`flex items-center gap-2 text-sm transition-colors ${isPrivate ? 'text-[#5A5A40] font-semibold underline underline-offset-8' : 'text-[#1a1a1a]/60 hover:text-[#5A5A40]'}`}
              >
                <Home size={18} />
                <span className="hidden sm:inline">Private Home</span>
              </Link>
            )}

            {user && (
              <Link 
                to="/my-stories"
                className={`flex items-center gap-2 text-sm transition-colors ${isMyStories ? 'text-[#5A5A40] font-semibold underline underline-offset-8' : 'text-[#1a1a1a]/60 hover:text-[#5A5A40]'}`}
                title="My Stories"
              >
                <BookOpen size={18} />
                <span className="hidden sm:inline">My Stories</span>
              </Link>
            )}

            {user && (
              <Link 
                to="/settings"
                className={`flex items-center gap-2 text-sm transition-colors ${isSettings ? 'text-[#5A5A40] font-semibold underline underline-offset-8' : 'text-[#1a1a1a]/60 hover:text-[#5A5A40]'}`}
                title="Profile Settings"
              >
                <Settings size={18} />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            )}

            {user ? (
              <button 
                onClick={handleLogout}
                className="text-[#1a1a1a]/40 hover:text-red-800 transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 bg-[#5A5A40] text-white px-4 py-1.5 rounded-full text-sm hover:bg-[#4a4a35] transition-colors"
              >
                <LogIn size={16} />
                <span>Join</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-6 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <div key={location.pathname}>
            <Routes location={location}>
              <Route path="/" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <PublicWall user={user} onLogin={handleLogin} />
                </motion.div>
              } />
              <Route path="/private" element={
                user ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <PrivateHome user={user} />
                  </motion.div>
                ) : (
                  <Link to="/" />
                )
              } />
              <Route path="/settings" element={
                user ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ProfileSettings user={user} />
                  </motion.div>
                ) : (
                  <Link to="/" />
                )
              } />
              <Route path="/my-stories" element={
                user ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MyStories user={user} />
                  </motion.div>
                ) : (
                  <Link to="/" />
                )
              } />
              <Route path="/story/:storyId" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <StoryView />
                </motion.div>
              } />
            </Routes>
          </div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-[#5A5A40]/10 text-center">
        <p className="text-xs text-[#1a1a1a]/30 italic">
          Anonymous stories. One-to-one connections.
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
