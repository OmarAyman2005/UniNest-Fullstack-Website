"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import InboxThread from '../../../../components/InboxThread';

export default function ThreadPage({ params }) {
  const { id } = params;
  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-5xl font-extrabold mx-2">Conversation</h1>
        <a href="/inbox" className="btn-primary p-2 rounded mx-2">← Back</a>
      </div>
      <InboxThread threadId={id} role="user" />
    </div>
  );
}
