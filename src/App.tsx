/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  where,
  getDocs
} from 'firebase/firestore';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { db, auth, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  LogOut, 
  LogIn, 
  Share2, 
  Volume2, 
  Clock,
  X,
  ShieldCheck,
  LayoutDashboard,
  Sparkles,
  Link as LinkIcon,
  Check,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  audio?: string;
  imageUrl?: string;
  time?: any;
}

// Ad Placement Component
const AdSection = ({ label, id, className = "" }: { label: string; id?: string; className?: string }) => (
  <div className={`w-full my-8 ${className}`}>
    <div className="flex items-center justify-center gap-2 mb-2">
      <div className="h-[1px] flex-1 bg-slate-200"></div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">বিজ্ঞাপন</span>
      <div className="h-[1px] flex-1 bg-slate-200"></div>
    </div>
    <div 
      id={id || `ad-${label.replace(/\s+/g, '-').toLowerCase()}`}
      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-8 flex items-center justify-center text-slate-300 text-[10px] font-mono uppercase tracking-[0.2em] shadow-inner italic"
    >
      {/* ADSTERRA SCRIPT CODES GO HERE */}
      - {label} -
    </div>
  </div>
);

export default function App() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', audio: '', imageUrl: '' });
  const [activeNewsId, setActiveNewsId] = useState<string | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [password, setPassword] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [speechSynthesis, setSpeechSynthesis] = useState<SpeechSynthesisUtterance | null>(null);

  // Sync activeNewsId with URL params on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) setActiveNewsId(id);
  }, []);

  // Target Admin Email from Environment Variable
  const ADMIN_EMAIL = process.env.VITE_ADMIN_EMAIL || 'shampa912akter@gmail.com';
  const ADMIN_PASSWORD = 'Shahil5445';

  useEffect(() => {
    // Auth Listener
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    // News Listener
    const q = query(collection(db, 'news'), orderBy('time', 'desc'));
    const newsUnsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsItem[];
      setNews(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'news');
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      newsUnsubscribe();
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      alert(`লগইন ব্যর্থ হয়েছে: ${error.message}\n\nপরামর্শ: Firebase Console-এ আপনার ডোমেইনটি (github.io) Authorized Domains-এ যুক্ত করেছেন কি?`);
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAdminMode(true);
      setShowAdminPanel(true);
      setShowPasswordModal(false);
      setPassword('');
      alert("অ্যাডমিন ড্যাশবোর্ডে স্বাগতম!");
    } else {
      alert("ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdminMode(false);
    setShowAdminPanel(false);
    setEditingId(null);
  };

  // Stealth Access: Long press or Quick clicks detect
  const [clickCount, setClickCount] = useState(0);
  let pressTimer: any;
  
  const startPress = () => {
    pressTimer = setTimeout(() => {
      if (currentUser?.email === ADMIN_EMAIL) {
        setShowPasswordModal(true);
      } else {
        handleGoogleLogin();
      }
    }, 2000); // Reduced to 2 seconds
  };
  
  const endPress = () => clearTimeout(pressTimer);

  const handleLogoClick = () => {
    if (activeNewsId) {
      setActiveNewsId(null);
      window.history.pushState({}, '', window.location.pathname);
      return;
    }
    
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    if (newCount === 10) {
      if (currentUser?.email === ADMIN_EMAIL) {
        setShowPasswordModal(true);
      } else {
        handleGoogleLogin();
      }
      setClickCount(0);
    }

    // Reset counter if not clicked again within 1s
    setTimeout(() => setClickCount(0), 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;

    setIsPosting(true);
    try {
      const data = {
        title: formData.title,
        content: formData.content,
        audio: formData.audio,
        imageUrl: formData.imageUrl,
        time: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'news', editingId), data);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'news'), data);
      }

      setFormData({ title: '', content: '', audio: '', imageUrl: '' });
      setShowAdminPanel(false);
      alert("সফলভাবে পাবলিশ করা হয়েছে!");
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'news');
    } finally {
      setIsPosting(false);
    }
  };

  const handleAutoGenerateNews = async () => {
    // Note: confirm() is removed to ensure compatibility with all environments
    setIsGenerating(true);
    try {
      let apiKey = process.env.GEMINI_API_KEY;
      
      // Safety check for empty or "undefined" strings from build-time injection
      if (!apiKey || apiKey === "undefined" || apiKey === "") {
        apiKey = 'AIzaSyC_fvK1iiN-3VGWeZR06rmKHb8HXUjI2as';
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      // prompt for news generation
      const prompt = `You are a chief editor of a major Bangladeshi news portal. 
      Generate 2 high-quality, professional, and detailed trending news articles in Bengali.
      Topic inspiration: Current political situation in Bangladesh, Global events affecting Bangladesh, major sports updates, or technological breakthroughs.
      Language: Bengali.
      Strict Length Requirement: Each article's main content MUST be long and detailed, approximately 20 to 50 sentences or around 400-800 words. Split content into 5-8 descriptive paragraphs.
      
      Return the data strictly in this JSON format:
      [
        {
          "title": "A catchy and professional news title in Bengali",
          "content": "Detailed and long article content in Bengali with <p> tags for each paragraph. Ensure it reads like professional journalism."
        },
        ...
      ]`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      let text = response.text;
      if (!text) throw new Error("AI returned an empty response.");
      
      // Remove potential markdown code blocks
      if (text.includes('```')) {
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      }
      
      const generatedNews = JSON.parse(text);

      for (const item of generatedNews) {
        await addDoc(collection(db, 'news'), {
          title: item.title,
          content: item.content,
          imageUrl: 'https://images.unsplash.com/photo-1585829365234-a169b614059d?q=80&w=1000', // Default placeholder
          time: serverTimestamp()
        });
      }

      alert("২ টি খবর সফলভাবে জেনারেট এবং পাবলিশ করা হয়েছে!");
    } catch (error: any) {
      console.error("News generation failed:", error);
      const errorMessage = error?.message || String(error);
      alert(`AI খবর জেনারেট করতে ব্যর্থ হয়েছে।\n\nত্রুটি: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyForThumbnail = (title: string, content: string) => {
    const summary = content.replace(/<[^>]*>/g, '').slice(0, 100) + '...';
    const text = `শিরোনাম: ${title}\n\nমূল অংশ: ${summary}`;
    navigator.clipboard.writeText(text).then(() => {
      alert("থাম্বনেল বানানোর জন্য শিরোনাম ও সারসংক্ষেপ কপি হয়েছে!");
    });
  };

  const handleEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setFormData({ 
      title: item.title, 
      content: item.content, 
      audio: item.audio || '',
      imageUrl: item.imageUrl || ''
    });
    setShowAdminPanel(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (confirm("ডিলিট করতে চান?")) {
      try {
        await deleteDoc(doc(db, 'news', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `news/${id}`);
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) {
      const q = query(collection(db, 'news'), orderBy('time', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsItem[];
      setNews(items);
      return;
    }

    setLoading(true);
    try {
      // For more complex searches (like content search), client-side filtering after fetching is better 
      // since Firestore doesn't support substring/contains search across multiple fields well.
      const q = query(collection(db, 'news'), orderBy('time', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsItem[];
      
      const filtered = items.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      setNews(filtered);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'news');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleOpenNews = (id: string) => {
    setActiveNewsId(id);
    window.history.pushState({}, '', `/?id=${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoBack = () => {
    setActiveNewsId(null);
    window.history.pushState({}, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSpeech = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert("দুঃখিত, আপনার ব্রাউজার এই সুবিধাটি সমর্থন করে না।");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Strip HTML tags and normalize text
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Find Bengali voice
    let voices = window.speechSynthesis.getVoices();
    
    const speak = (vcs: SpeechSynthesisVoice[]) => {
      const bnVoice = vcs.find(v => v.lang.includes('bn') || v.lang.includes('BN'));
      if (bnVoice) utterance.voice = bnVoice;
      
      utterance.lang = 'bn-BD';
      utterance.rate = 0.9; 
      utterance.pitch = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    };

    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        speak(voices);
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      speak(voices);
    }
  };

  const filteredNews = activeNewsId ? news.filter(n => n.id === activeNewsId) : news;
  const relatedNews = activeNewsId ? news.filter(n => n.id !== activeNewsId).slice(0, 5) : [];

  const isEligibleForAdmin = currentUser?.email === ADMIN_EMAIL;

  // Split content by paragraphs and inject ads
  const renderSegmentedContent = (content: string) => {
    const segments = content.split(/\n+/).filter(s => s.trim().length > 0);
    
    return segments.map((segment, idx) => (
      <div key={idx}>
        <p className="mb-6 leading-[1.8] text-[19px] sm:text-[21px] font-normal prose prose-slate max-w-none text-slate-800">
          {segment}
        </p>
        {(idx + 1) % 3 === 0 && <AdSection label="কন্টেন্ট বিজ্ঞাপন" />}
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-12">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b-2 border-red-600" role="banner">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onMouseDown={startPress}
            onMouseUp={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            onClick={handleLogoClick}
            className="text-2xl font-black text-red-600 tracking-tighter flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform focus-visible:outline-red-600 outline-offset-4"
            role="button"
            tabIndex={0}
            aria-label="বার্তানিউজ হোমপেজ"
            onKeyDown={e => e.key === 'Enter' && handleLogoClick()}
          >
            Barta<span className="text-slate-800">News</span>
          </motion.div>
          
          <div className="flex items-center gap-4" role="navigation" aria-label="ইউজার মেনু">
            {isAdminMode && (
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full border border-slate-200 shadow-inner">
                <button 
                  onClick={() => setShowAdminPanel(!showAdminPanel)}
                  className="p-2 text-red-600 bg-white rounded-full shadow-sm hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 outline-none transition-colors"
                  title="অ্যাডমিন প্যানেল"
                  aria-label="অ্যাডমিন ড্যাশবোর্ড টগল করুন"
                >
                  <LayoutDashboard size={18} aria-hidden="true" />
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-500 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400 outline-none transition-colors"
                  title="লগআউট"
                  aria-label="সেশন লগআউট করুন"
                >
                  <LogOut size={18} aria-hidden="true" />
                </button>
              </div>
            )}
            
            {/* User Login/Profile - Stealth */}
            {currentUser && !isAdminMode && (
              <img 
                src={currentUser.photoURL || ''} 
                alt={`${currentUser.displayName} প্রোফাইল ছবি`} 
                className="w-8 h-8 rounded-full border border-slate-200 shadow-sm" 
              />
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Top Ad */}
        <AdSection label="Header Ad" />

        {/* Admin Panel */}
        <AnimatePresence>
          {isAdminMode && showAdminPanel && (
            <motion.div 
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 32 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white border-2 border-red-100 rounded-2xl p-6 shadow-xl shadow-red-100/50">
                <h3 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
                  {editingId ? <Edit2 size={20} className="text-blue-500" /> : <Plus size={20} className="text-red-500" />}
                  {editingId ? 'খবর এডিট করুন' : 'নতুন খবর পাবলিশ করুন'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label htmlFor="title" className="text-xs font-bold text-slate-500 ml-2">শিরোনাম</label>
                    <input 
                      id="title"
                      type="text" 
                      placeholder="শিরোনাম লিখুন" 
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="content" className="text-xs font-bold text-slate-500 ml-2">খবর</label>
                    <textarea 
                      id="content"
                      placeholder="খবর... (HTML ট্যাগ ব্যবহার করা যাবে)" 
                      rows={5}
                      value={formData.content}
                      onChange={e => setFormData({ ...formData, content: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all resize-none"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="imageUrl" className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-wide">ছবির লিঙ্ক (URL)</label>
                      <input 
                        id="imageUrl"
                        type="text" 
                        placeholder="https://example.com/image.jpg" 
                        value={formData.imageUrl}
                        onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="audioUrl" className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-wide">অডিও লিঙ্ক (URL)</label>
                      <input 
                        id="audioUrl"
                        type="text" 
                        placeholder="https://example.com/audio.mp3" 
                        value={formData.audio}
                        onChange={e => setFormData({ ...formData, audio: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      disabled={isPosting}
                      className={`flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 focus-visible:ring-4 focus-visible:ring-red-200 transition-colors shadow-lg shadow-red-200 flex items-center justify-center gap-2 ${isPosting ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {isPosting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>}
                      {editingId ? 'আপডেট করুন' : 'পাবলিশ করুন'}
                    </button>
                    {!editingId && (
                      <button 
                        type="button"
                        onClick={handleAutoGenerateNews}
                        disabled={isGenerating}
                        className={`px-4 bg-amber-500 text-white font-bold py-3 rounded-xl hover:bg-amber-600 focus-visible:ring-4 focus-visible:ring-amber-200 transition-colors shadow-lg shadow-amber-200 flex items-center justify-center gap-2 ${isGenerating ? 'opacity-70 cursor-not-allowed' : ''}`}
                        aria-label="AI দিয়ে অটো খবর জেনারেট করুন"
                      >
                        {isGenerating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true"></div> : <Sparkles size={18} aria-hidden="true" />}
                        AI অটো জেনারেট
                      </button>
                    )}
                    {editingId && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setFormData({ title: '', content: '', audio: '', imageUrl: '' });
                          setShowAdminPanel(false);
                        }}
                        className="px-6 bg-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-300 focus-visible:ring-4 focus-visible:ring-slate-100 transition-colors"
                      >
                        বাতিল
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Bar */}
        {!activeNewsId && (
          <div className="relative mb-8 group" role="search">
            <label htmlFor="search" className="sr-only">খবর খুঁজুন</label>
            <input 
              id="search"
              type="text" 
              placeholder="খবর খুঁজুন..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full pl-12 pr-28 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={20} aria-hidden="true" />
            <button 
              onClick={handleSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-300 outline-none transition-colors"
              aria-label="খবর সার্চ করুন"
            >
              Search
            </button>
          </div>
        )}

        {activeNewsId && (
          <motion.button 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleGoBack}
            className="flex items-center gap-2 text-slate-600 font-bold mb-6 hover:text-red-600 transition-colors group bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-sm w-fit"
          >
            <motion.span animate={{ x: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              ←
            </motion.span>
            সব খবর ফিরে যান
          </motion.button>
        )}

        {/* News List / Detail */}
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-20 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 font-medium">লোড হচ্ছে...</p>
            </div>
          ) : filteredNews.length > 0 ? (
            activeNewsId ? (
              // DETAIL VIEW
              filteredNews.map((item) => (
                <div key={item.id}>
                  <motion.article 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100"
                  >
                    <div className="p-6 sm:p-8">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
                        <Clock size={14} />
                        {item.time?.toDate 
                          ? new Intl.DateTimeFormat('bn-BD', { 
                              dateStyle: 'long', 
                              timeStyle: 'short' 
                            }).format(item.time.toDate())
                          : 'এখনই'
                        }
                      </div>

                      <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight mb-6">
                        {item.title}
                      </h1>

                      {/* News Image */}
                      {item.imageUrl && (
                        <div className="w-full aspect-video overflow-hidden rounded-2xl mb-8 bg-slate-100 shadow-lg">
                          <img 
                            src={item.imageUrl} 
                            alt={item.title} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      
                      {item.audio && (
                        <div className="bg-red-50 rounded-2xl p-5 mb-8 flex flex-col gap-3 border border-red-100">
                          <div className="flex items-center gap-3 text-red-700 font-bold text-sm">
                            <Volume2 size={20} />
                            খবরের অডিও শুনুন
                          </div>
                          <audio controls className="w-full h-10" src={item.audio}>
                            Your browser does not support playback.
                          </audio>
                        </div>
                      )}
                      
                      <div className="flex gap-4 mb-8">
                        {/* Text to Speech Button */}
                        <button 
                          onClick={() => handleSpeech(item.title + ". " + item.content)}
                          className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all border-2 ${
                            isSpeaking 
                              ? 'bg-red-50 text-red-600 border-red-200' 
                              : 'bg-white text-slate-700 border-slate-200 hover:border-red-600 hover:text-red-600'
                          }`}
                        >
                          <Volume2 size={24} className={isSpeaking ? 'animate-pulse' : ''} />
                          {isSpeaking ? 'পড়া বন্ধ করুন' : 'খবরটি শুনুন'}
                        </button>

                        {/* Copy Link Button */}
                        <button 
                          onClick={() => handleCopyLink(item.id)}
                          className={`px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all border-2 ${
                            copySuccess 
                              ? 'bg-green-50 text-green-600 border-green-200' 
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-800'
                          }`}
                        >
                          {copySuccess ? <div className="flex items-center gap-2 tracking-tight"><Check size={20} /> কপি হয়েছে</div> : <div className="flex items-center gap-2"><LinkIcon size={20} /> লিঙ্ক কপি</div>}
                        </button>
                      </div>

                      <div className="content-segmented">
                        {renderSegmentedContent(item.content)}
                      </div>

                      <div className="mt-12 bg-white pt-8 border-t border-slate-100">
                        <h3 className="text-xl font-bold border-l-4 border-red-600 pl-3 mb-8 text-slate-800">আপনি আরও পড়তে পারেন</h3>
                        <div className="grid gap-8">
                          {relatedNews.map(rel => (
                            <div key={rel.id} onClick={() => handleOpenNews(rel.id)} className="flex gap-4 cursor-pointer group">
                              {rel.imageUrl && (
                                <div className="w-28 h-20 sm:w-36 sm:h-24 shrink-0 rounded-xl overflow-hidden shadow-sm">
                                  <img src={rel.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                </div>
                              )}
                              <div className="flex-1">
                                <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest block mb-1">বিশ্ব সংবাদ</span>
                                <h4 className="text-base sm:text-lg font-bold leading-snug text-slate-800 group-hover:text-red-700 transition-colors line-clamp-2">
                                  {rel.title}
                                </h4>
                                <span className="text-[11px] text-slate-400 mt-2 block font-medium">
                                  {rel.time?.toDate 
                                    ? new Intl.DateTimeFormat('bn-BD', { dateStyle: 'long' }).format(rel.time.toDate())
                                    : 'এখনই'
                                  }
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <AdSection label="নিচের বিজ্ঞাপন" className="mt-12" />
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-8">
                        <div className="flex gap-4">
                          <button 
                            onClick={() => handleCopyLink(item.id)}
                            className="flex items-center gap-2 text-slate-600 font-semibold text-sm hover:text-red-600 transition-colors focus-visible:ring-2 focus-visible:ring-red-100 rounded p-1 outline-none"
                            aria-label={`"${item.title}" খবরের লিঙ্ক কপি করুন`}
                          >
                            <LinkIcon size={16} aria-hidden="true" />
                            {copySuccess ? 'কপি হয়েছে' : 'লিঙ্ক কপি'}
                          </button>
                          <button 
                            onClick={() => copyForThumbnail(item.title, item.content)}
                            className="flex items-center gap-2 text-slate-500 font-semibold text-sm hover:underline focus-visible:ring-2 focus-visible:ring-slate-100 rounded p-1 outline-none"
                            aria-label="থাম্বনেল বানানোর জন্য শিরোনাম কপি করুন"
                          >
                            <Copy size={16} aria-hidden="true" />
                            থাম্বনেল কপি
                          </button>
                        </div>

                        {isAdminMode && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleEdit(item)} 
                              className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-300 outline-none"
                              aria-label={`"${item.title}" এডিট করুন`}
                            >
                              <Edit2 size={18} aria-hidden="true" />
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)} 
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-red-300 outline-none"
                              aria-label={`"${item.title}" ডিলিট করুন`}
                            >
                              <Trash2 size={18} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.article>
                </div>
              ))
            ) : (
              // LIST VIEW (Compact Cards/Buttons)
              <div className="grid gap-4">
                {news.map((item, index) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <div 
                      onClick={() => handleOpenNews(item.id)}
                      className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-red-200 transition-all cursor-pointer overflow-hidden flex items-stretch h-32 sm:h-40"
                    >
                      {item.imageUrl && (
                        <div className="w-1/3 sm:w-1/4 shrink-0 overflow-hidden bg-slate-100">
                          <img 
                            src={item.imageUrl} 
                            alt="" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full bg-red-600"></span>
                            <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">ব্রেকিং নিউজ</span>
                          </div>
                          <h3 className="text-lg sm:text-xl font-bold text-slate-800 leading-tight group-hover:text-red-700 transition-colors line-clamp-2">
                            {item.title}
                          </h3>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                            <Clock size={12} />
                            {item.time?.toDate 
                              ? new Intl.DateTimeFormat('bn-BD', { dateStyle: 'long' }).format(item.time.toDate())
                              : 'এখনই'
                            }
                          </span>
                          <span className="text-xs font-black text-slate-400 group-hover:text-red-600 flex items-center gap-1 transition-colors">
                            পড়ুন <span className="text-lg leading-none">→</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Admin actions in list view */}
                    {isAdminMode && (
                      <div className="flex justify-end gap-2 mt-2 px-2">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold border border-blue-100">এডিট</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded-full font-bold border border-red-100">ডিলিট</button>
                      </div>
                    )}
                    {(index + 1) % 4 === 0 && <AdSection label="তালিকায় বিজ্ঞাপন" />}
                  </motion.div>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-medium">বর্তমানে কোনো খবর নেই</p>
            </div>
          )}
        </div>

        {/* Bottom Ad */}
        <AdSection label="Footer Ad" />
      </main>

      {/* Secret Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative"
            >
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 transition-colors focus-visible:ring-2 focus-visible:ring-slate-300 rounded-full outline-none"
                aria-label="মোডাল বন্ধ করুন"
              >
                <X size={20} aria-hidden="true" />
              </button>

              <div className="p-8">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6 mx-auto" aria-hidden="true">
                  <ShieldCheck size={32} />
                </div>
                
                <h3 id="modal-title" className="text-2xl font-bold text-center mb-2 text-slate-900">অ্যাডমিন প্রবেশ</h3>
                <p className="text-slate-500 text-center text-sm mb-8">সুরক্ষার জন্য পাসওয়ার্ড দিন</p>
                
                <form onSubmit={handleAdminAuth} className="space-y-4">
                  <div className="space-y-1">
                    <label htmlFor="admin-pass" className="sr-only">পাসওয়ার্ড</label>
                    <input 
                      id="admin-pass"
                      type="password" 
                      placeholder="পাসওয়ার্ড"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      required
                      autoFocus
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl hover:bg-red-700 focus-visible:ring-4 focus-visible:ring-red-200 transition-all shadow-lg active:scale-[0.98] outline-none"
                  >
                    ভেরিফাই করুন
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="max-w-xl mx-auto px-4 mt-8 pb-8 text-center" role="contentinfo">
        <div className="flex flex-col items-center gap-4">
          <p className="text-slate-400 text-xs">&copy; {new Date().getFullYear()} BartaNews. All Rights Reserved.</p>
          
          {/* Subtle Google Login Trigger */}
          {!currentUser ? (
            <button 
              onClick={handleGoogleLogin}
              className="text-slate-300 text-[10px] hover:text-slate-500 focus-visible:ring-2 focus-visible:ring-slate-200 outline-none p-1 rounded transition-colors uppercase tracking-widest font-mono"
              aria-label="সিস্টেম লগইন"
            >
              System Login
            </button>
          ) : (
            !isAdminMode && (
              <button 
                onClick={handleLogout}
                className="text-slate-300 text-[10px] hover:text-slate-500 focus-visible:ring-2 focus-visible:ring-slate-200 outline-none p-1 rounded transition-colors uppercase tracking-widest font-mono"
                aria-label="সেশন লগআউট"
              >
                Logout Session
              </button>
            )
          )}
        </div>
      </footer>
    </div>
  );
}
