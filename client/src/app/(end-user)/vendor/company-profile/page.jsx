"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function CompanyProfilePage() {
  const [taxFile, setTaxFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const taxRef = useRef();
  const logoRef = useRef();

  const onTaxChange = (e) => {
    const f = e.target.files?.[0] || null;
    setTaxFile(f);
  };

  const onLogoChange = (e) => {
    const f = e.target.files?.[0] || null;
    setLogoFile(f);
    if (f && f.type?.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setLogoPreview(url);
    } else {
      setLogoPreview(null);
    }
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoRef.current) logoRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!taxFile && !logoFile) {
      setMessage({ type: "err", text: "Please choose at least one file to upload." });
      return;
    }
    const form = new FormData();
    if (taxFile) form.set("taxCard", taxFile);
    if (logoFile) form.set("logo", logoFile);

    setSaving(true);
    try {
      await api('/vendor/company-profile', { method: 'POST', body: form });
      setMessage({ type: 'ok', text: 'Company profile saved.' });
    } catch (err) {
      setMessage({ type: 'err', text: err?.message || 'Upload failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-root">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Company Profile</h1>
            <p className="text-sm text-gray-300">Upload your tax card and company logo (visible on listings).</p>
          </div>
          <Link href="/vendor" className="px-3 py-2 btn-secondary rounded text-white">Back</Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 shadow border border-root">
          {message && (
            <div className={`mb-4 p-3 rounded ${message.type === 'ok' ? 'bg-green-800/30 text-green-200' : 'bg-red-800/30 text-red-200'}`}>
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-white mb-2">Tax Card (PDF or Image)</label>
              <input
                ref={taxRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={onTaxChange}
                className="w-full text-sm text-white file:rounded file:px-3 file:py-1 file:bg-root-primary file:text-white"
              />
              {taxFile && (
                <div className="mt-2 text-sm text-gray-300">Selected: <strong className="text-white">{taxFile.name}</strong></div>
              )}
            </div>

            <div>
              <label className="block text-sm text-white mb-2">Company Logo (PNG/JPG)</label>
              <div className="flex items-start gap-4">
                <div className="w-28 h-28 bg-root-border rounded flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="object-contain w-full h-full" />
                  ) : (
                    <div className="text-gray-400 text-sm">No logo</div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={logoRef}
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    onChange={onLogoChange}
                    className="w-full text-sm text-white file:rounded file:px-3 file:py-1 file:bg-root-primary file:text-white"
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={clearLogo} className="px-3 py-1 btn btn-ghost">Clear</button>
                    <div className="text-xs text-gray-400">Recommended: square PNG, max 1MB.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 justify-end">
            <Link href="/vendor" className="px-4 py-2 btn btn-ghost">Cancel</Link>
            <button type="submit" disabled={saving} className="px-4 py-2 btn btn-primary">
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
