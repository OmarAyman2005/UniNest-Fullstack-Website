"use client";
import React, { useEffect, useState } from 'react';
import { get, post, patch } from '../lib/api';
import ComposeMessage from './ComposeMessage';

export default function InboxThread({ threadId, role = 'user' }) {
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const res = await get(`/support/${threadId}`);
      setThread(res.data);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [threadId]);

  async function handleSend(text) {
    await post(`/support/${threadId}/messages`, { body: text });
    await load();
  }

  async function setStatus(status) {
    await patch(`/support/${threadId}/status`, { status });
    await load();
  }

  if (loading) return <div className="p-6 text-root-secondary">Loading thread...</div>;
  if (error) return <div className="p-6 text-error">{error}</div>;
  if (!thread) return <div className="p-6 text-root-secondary">Not found.</div>;

  return (
    <div className="space-y-6">
      {/* Thread Header */}
      <div className="p-6 rounded-lg bg-surface border border-root shadow-elevated flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <div className="text-2xl font-bold text-root-primary mb-1">{thread.subject}</div>
          <div className="text-sm text-root-secondary capitalize">Status: <span className={`font-semibold px-2 py-1 rounded ${
            thread.status === 'open' ? 'bg-primary text-root-primary' :
            thread.status === 'in_progress' ? 'bg-yellow-500 text-root-primary' :
            thread.status === 'resolved' ? 'bg-success text-root-primary' :
            thread.status === 'closed' ? 'bg-error text-root-primary' :
            'bg-highlight text-root-secondary'
          }`}>
            {thread.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span></div>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        {(thread.messages || []).map((m, idx) => (
          <div
            key={m._id || idx}
            className={`p-4 rounded-lg border border-root bg-highlight shadow-soft flex flex-col`}
          >
            <div className="text-root-primary text-base mb-1 whitespace-pre-line">{m.body}</div>
            <div className="text-xs text-root-secondary flex items-center gap-2 mt-1">
              <span className="capitalize font-medium">{m.senderRole || 'user'}</span>
              <span>•</span>
              <span>{new Date(m.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Compose Message */}
      <div className="p-6 rounded-lg bg-surface border border-root shadow-soft">
        <ComposeMessage onSend={handleSend} sendLabel={role === 'admin' ? 'Reply as Staff' : 'Send Message'} />
      </div>

      {/* Admin Controls */}
      {role === 'admin' && (
        <div className="flex flex-wrap gap-3 mt-2">
          <button
            className="px-4 py-2 rounded bg-yellow-500 text-root-primary font-semibold shadow-soft hover:opacity-90 transition"
            onClick={() => setStatus('in_progress')}
          >
            Mark In Progress
          </button>
          <button
            className="px-4 py-2 rounded bg-success text-root-primary font-semibold shadow-soft hover:opacity-90 transition"
            onClick={() => setStatus('resolved')}
          >
            Mark Resolved
          </button>
          <button
            className="px-4 py-2 rounded bg-error text-root-primary font-semibold shadow-soft hover:opacity-90 transition"
            onClick={() => setStatus('closed')}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
