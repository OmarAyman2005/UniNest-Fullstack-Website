"use client";
import React from 'react';
import InboxList from '../../../components/InboxList';
import Link from 'next/link';

export default function InboxPage() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-1">Support Inbox</h1>
        <Link href="/inbox/new" className="text-sm btn-primary px-4 py-2 rounded">New Message</Link>
      </div>
      <InboxList role="user" />
    </div>
  );
}
