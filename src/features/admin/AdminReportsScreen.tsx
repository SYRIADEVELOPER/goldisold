import React, { useEffect, useState } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../auth/store';
import { Shield, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
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

export default function AdminReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  // In a real app, you'd check for an 'admin' role in the user's profile
  const isAdmin = user?.email === 'kiatrbe3a@gmail.com'; // Using user's email as a temporary admin check

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'reports'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
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

    return () => unsubscribe();
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
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <h1 className="text-xl font-bold text-white flex items-center space-x-2">
          <Shield className="w-5 h-5 text-[#C6A75E]" />
          <span>Moderation Queue</span>
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {reports.length === 0 ? (
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
        )}
      </div>
    </div>
  );
}
