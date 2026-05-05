"use client";
import React from 'react';
import InboxList from '../../../components/InboxList';

export default function AdminInboxPage() {
  return (
    <div className="p-6">
      <h1 className="text-4xl text-root-primary font-extrabold mb-5">Admin Inbox</h1>
      <InboxList role="admin" />
    </div>
  );
}
