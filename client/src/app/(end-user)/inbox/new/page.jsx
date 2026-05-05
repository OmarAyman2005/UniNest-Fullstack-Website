"use client";
import React, { useState } from 'react';
import ComposeMessage from '../../../../components/ComposeMessage';
import { post } from '../../../../lib/api';
import { useRouter } from 'next/navigation';

export default function NewSupportPage() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [error, setError] = useState(null);

  async function handleSend(bodyText) {
    setError(null);
    if (!subject.trim()) {
      setError('Please provide a subject for your message');
      return;
    }
    const payload = { subject: subject.trim().slice(0, 200), message: bodyText };
    await post('/support', payload);
    router.push('/inbox');
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-4xl font-extrabold mb-1 mx-50">New Support Message</h1>
        <button
          type="button"
          className="text-sm btn-primary px-4 py-2 rounded mx-50"
          onClick={() => router.push('/inbox')}
        >
          ← Back
        </button>
      </div>
      <div className="max-w-5xl mx-auto bg-surface shadow-elevated rounded-lg p-6 border border-root">
        <div className="mb-3">
          <label className="block text-sm font-medium text-root-secondary mb-1">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full input-surface rounded px-3 py-2"
            placeholder="Short summary of your issue"
          />
        </div>

        {error && <div className="text-red-600 mb-3">{error}</div>}

        <ComposeMessage onSend={handleSend} sendLabel="Send" />
      </div>
    </div>
  );
}
