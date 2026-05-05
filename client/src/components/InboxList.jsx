"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '../lib/api';

export default function InboxList({ role = 'user' }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const q = role === 'admin' ? '' : '';
        const res = await get('/support' + (q || ''));
        if (!mounted) return;
        setThreads(res.data || []);
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [role]);

  if (loading) return <div className="p-4">Loading inbox...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!threads.length) return <div className="p-4">No conversations yet.</div>;

  const base = role === 'admin' ? '/admin' : '';
  return (
    <div className="bg-surface shadow-elevated rounded-lg overflow-hidden border border-root">
      <div className="px-6 py-4 border-b border-root bg-highlight flex items-center justify-between">
        <h2 className="text-lg font-semibold text-root-primary">Support Conversations</h2>
        <span className="text-xs text-root-secondary">{threads.length} thread{threads.length !== 1 ? 's' : ''}</span>
      </div>
      <ul className="divide-y divide-root">
        {threads.map((t) => (
          <li key={t._id}>
            <Link href={`${base}/inbox/${t._id}`} className="flex items-center justify-between px-6 py-4 hover:bg-primary-hover transition group">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="font-medium text-root-primary truncate group-hover:underline">{t.subject}</div>
                <div className="text-xs text-root-secondary flex gap-2">
                  <span>{t.messages?.length || 0} messages</span>
                  <span className={`px-2 py-0.5 rounded text-xs text-root-primary ${t.status === 'open' ? 'bg-success' : t.status === 'in_progress' ? 'bg-primary' : t.status === 'resolved' ? 'bg-success' : 'bg-error'}`}>{t.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                </div>
              </div>
              <div className="text-xs text-root-secondary whitespace-nowrap ml-4">{new Date(t.lastMessageAt).toLocaleString()}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
