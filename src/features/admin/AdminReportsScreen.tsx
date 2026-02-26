import React, { useEffect, useState } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, setDoc, where } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { Shield, Trash2, CheckCircle, AlertTriangle, Settings, Image as ImageIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/src/lib/utils';

interface Report {
  id: string;
  reporter_id: string;
  reported_content_id: string;
  reported_content_type: string;
  reason: string;
  created_at: any;
  status: string;
  contentPreview?: any;
}

interface PendingStory {
  id: string;
  user_id: string;
  image_url: string;
  text_overlay: string | null;
  created_at: string;
  status: string;
}

export default function AdminReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [pendingStories, setPendingStories] = useState<PendingStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mandatoryPhotoModeration, setMandatoryPhotoModeration] = useState(false);
  const [activeTab, setActiveTab] = useState<'reports' | 'stories' | 'settings'>('reports');
  const { user } = useAuthStore();

  // In a real app, you'd check for an 'admin' role in the user's profile
  const isAdmin = user?.email === 'kiatrbe3a@gmail.com'; // Using user's email as a temporary admin check

  useEffect(() => {
    if (!isAdmin) return;

    // Fetch config
    const fetchConfig = async () => {
      const configDoc = await getDoc(doc(db, 'system_config', 'moderation'));
      if (configDoc.exists()) {
        setMandatoryPhotoModeration(configDoc.data().mandatory_photo_moderation || false);
      }
    };
    fetchConfig();

    // Fetch reports
    const qReports = query(collection(db, 'reports'), orderBy('created_at', 'desc'));
    const unsubscribeReports = onSnapshot(qReports, async (snapshot) => {
      const fetchedReports: Report[] = [];
      for (const reportDoc of snapshot.docs) {
        const data = reportDoc.data();
        let contentPreview = null;

        // Fetch reported content preview
        try {
          const contentDoc = await getDoc(doc(db, data.reported_content_type + 's', data.reported_content_id));
          if (contentDoc.exists()) {
            contentPreview = contentDoc.data();
          }
        } catch (e) {
          console.error('Error fetching content preview:', e);
        }

        fetchedReports.push({
          id: reportDoc.id,
          ...data,
          contentPreview
        } as Report);
      }
      setReports(fetchedReports);
      setLoading(false);
    });

    // Fetch pending stories
    const qStories = query(collection(db, 'stories'), where('status', '==', 'pending_moderation'));
    const unsubscribeStories = onSnapshot(qStories, (snapshot) => {
      const fetchedStories: PendingStory[] = [];
      for (const doc of snapshot.docs) {
        fetchedStories.push({ id: doc.id, ...doc.data() } as PendingStory);
      }
      setPendingStories(fetchedStories);
    });

    return () => {
      unsubscribeReports();
      unsubscribeStories();
    };
  }, [isAdmin]);

  const handleAction = async (reportId: string, action: 'resolve' | 'delete') => {
    try {
      if (action === 'resolve') {
        await updateDoc(doc(db, 'reports', reportId), { status: 'resolved' });
      } else if (action === 'delete') {
        const report = reports.find(r => r.id === reportId);
        if (report && window.confirm('Are you sure you want to delete the reported content?')) {
          await deleteDoc(doc(db, report.reported_content_type + 's', report.reported_content_id));
          await updateDoc(doc(db, 'reports', reportId), { status: 'resolved' });
        }
      }
    } catch (error) {
      console.error('Error taking action on report:', error);
    }
  };

  const handleStoryAction = async (storyId: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await updateDoc(doc(db, 'stories', storyId), { status: 'published' });
      } else if (action === 'reject') {
        if (window.confirm('Are you sure you want to reject and delete this story?')) {
          await deleteDoc(doc(db, 'stories', storyId));
        }
      }
    } catch (error) {
      console.error('Error taking action on story:', error);
    }
  };

  const togglePhotoModeration = async () => {
    try {
      const newValue = !mandatoryPhotoModeration;
      await setDoc(doc(db, 'system_config', 'moderation'), {
        mandatory_photo_moderation: newValue
      }, { merge: true });
      setMandatoryPhotoModeration(newValue);
      alert(`Mandatory photo moderation is now ${newValue ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      console.error('Error updating config:', error);
      alert('Failed to update settings.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Shield className="w-16 h-16 text-red-500 mb-4 opacity-20" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-gray-500">You do not have administrative privileges to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex flex-col space-y-3">
        <h1 className="text-xl font-bold text-white flex items-center space-x-2">
          <Shield className="w-5 h-5 text-[#C6A75E]" />
          <span>Admin Dashboard</span>
        </h1>
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('reports')}
            className={cn(
              "text-sm font-medium transition-colors pb-1 border-b-2",
              activeTab === 'reports' ? "text-white border-[#C6A75E]" : "text-gray-500 border-transparent hover:text-gray-300"
            )}
          >
            Reports
          </button>
          <button
            onClick={() => setActiveTab('stories')}
            className={cn(
              "text-sm font-medium transition-colors pb-1 border-b-2 flex items-center space-x-1",
              activeTab === 'stories' ? "text-white border-[#C6A75E]" : "text-gray-500 border-transparent hover:text-gray-300"
            )}
          >
            <span>Stories</span>
            {pendingStories.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {pendingStories.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "text-sm font-medium transition-colors pb-1 border-b-2",
              activeTab === 'settings' ? "text-white border-[#C6A75E]" : "text-gray-500 border-transparent hover:text-gray-300"
            )}
          >
            Settings
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'reports' ? (
          reports.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>All clear! No pending reports.</p>
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="bg-[#141414] border border-white/5 rounded-2xl p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Reported {report.reported_content_type}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {report.created_at?.seconds ? formatDistanceToNow(new Date(report.created_at.seconds * 1000), { addSuffix: true }) : 'Recently'}
                    </span>
                  </div>
                  <div className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    report.status === 'pending' ? "bg-yellow-500/10 text-yellow-500" : "bg-green-500/10 text-green-500"
                  )}>
                    {report.status}
                  </div>
                </div>

                <div className="bg-[#0a0a0a] rounded-xl p-3 border border-white/5">
                  <p className="text-sm text-white font-medium mb-1">Reason:</p>
                  <p className="text-sm text-gray-400 italic">"{report.reason}"</p>
                </div>

                {report.contentPreview && (
                  <div className="border-l-2 border-[#C6A75E] pl-4 py-1">
                    <p className="text-xs text-gray-500 mb-2">Content Preview:</p>
                    {report.contentPreview.image_url && (
                      <img src={report.contentPreview.image_url} alt="" className="w-20 h-20 object-cover rounded-lg mb-2" />
                    )}
                    <p className="text-sm text-gray-300 line-clamp-3">
                      {report.contentPreview.text_content || report.contentPreview.content || 'No text content'}
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  <button
                    onClick={() => handleAction(report.id, 'resolve')}
                    className="flex-1 bg-white/5 hover:bg-green-500/20 hover:text-green-500 text-gray-400 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Dismiss</span>
                  </button>
                  <button
                    onClick={() => handleAction(report.id, 'delete')}
                    className="flex-1 bg-white/5 hover:bg-red-500/20 hover:text-red-500 text-gray-400 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Content</span>
                  </button>
                </div>
              </div>
            ))
          )
        ) : activeTab === 'stories' ? (
          pendingStories.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>All clear! No pending stories to moderate.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {pendingStories.map((story) => (
                <div key={story.id} className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                  <div className="relative aspect-[9/16] bg-black">
                    {story.image_url ? (
                      <img src={story.image_url} alt="Story" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
                        <ImageIcon className="w-8 h-8 text-white/50" />
                      </div>
                    )}
                    {story.text_overlay && (
                      <div className="absolute inset-0 flex items-center justify-center p-4">
                        <p className="text-white text-center text-xl font-black uppercase tracking-tighter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] leading-none whitespace-pre-wrap">
                          {story.text_overlay}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-2 flex space-x-2">
                    <button
                      onClick={() => handleStoryAction(story.id, 'approve')}
                      className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStoryAction(story.id, 'reject')}
                      className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Settings className="w-5 h-5 text-[#C6A75E]" />
              <h2 className="text-lg font-semibold text-white">System Configuration</h2>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded-xl border border-white/5">
              <div>
                <h3 className="text-white font-medium">Mandatory Photo Moderation</h3>
                <p className="text-sm text-gray-400 mt-1">
                  When enabled, all stories with images must be approved by a moderator before they are visible to others. Text-only stories bypass this.
                </p>
              </div>
              <button
                onClick={togglePhotoModeration}
                className={cn(
                  "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#C6A75E] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]",
                  mandatoryPhotoModeration ? "bg-[#C6A75E]" : "bg-white/10"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    mandatoryPhotoModeration ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
