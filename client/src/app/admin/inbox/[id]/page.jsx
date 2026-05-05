"use client";
import React from 'react';
import InboxThread from '../../../../components/InboxThread';

export default function AdminThreadPage({ params }) {
  const { id } = params;
  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-4xl text-root-primary font-extrabold mx-2">Conversation</h1>
        <a href="/admin/inbox" className="btn-primary p-2 rounded mx-2">← Back</a>
      </div>
      <InboxThread threadId={id} role="admin" />
    </div>
  );
}
