"use client";
import React, { useState } from 'react';

export default function ComposeMessage({ onSend, sendLabel = 'Send' }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await onSend(text.trim());
      setText('');
    } catch (err) {
      // swallow: parent shows error
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea className="w-full border text-white rounded p-2" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex justify-end">
        <button type="submit" className="btn-primary px-4 py-2 rounded" disabled={sending}>{sending ? 'Sending...' : sendLabel}</button>
      </div>
    </form>
  );
}
