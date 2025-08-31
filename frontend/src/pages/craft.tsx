import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useUser } from '../UserContext';

const initialState = {
  ipor_name: '',
  version: '',
  description: '',
  supplies: '',
  color: '',
  manufacturing_country: '',
  value: '',
  label: '',
  provider: '',
};

export default function Craft() {
  const [form, setForm] = useState(initialState);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [cid, setCid] = useState('');
  const user = useUser();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      supplies: parseInt(form.supplies),
      value: parseFloat(form.value),
      crafter: user.user?.public_key || '', //< add crafter public key
    };

    const res = await fetch('http://localhost:3001/api/ipor-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: '', // No file upload, just metadata
        metadata: payload,
      }),
    });
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
    setCid(data.metadataCID); 
    setCopied(false);
  };
 
  const previewUrl = cid ? `${window.location.origin}/preview?cid=${cid}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="ipor_name" placeholder="Ipor name" value={form.ipor_name} onChange={handleChange} required />
      <input name="version" placeholder="Version" value={form.version} onChange={handleChange} required />
      <input name="description" placeholder="Description" value={form.description} onChange={handleChange} required />
      <input name="supplies" placeholder="Supplies" value={form.supplies} onChange={handleChange} required />
      <input name="color" placeholder="Color" value={form.color} onChange={handleChange} required />
      <input name="manufacturing_country" placeholder="Manufacturing Country" value={form.manufacturing_country} onChange={handleChange} required />
      <input name="value" placeholder="Value" value={form.value} onChange={handleChange} required />
      <input name="label" placeholder="Brand/Company Name" value={form.label} onChange={handleChange} required />
      <input name="provider" placeholder="Webapp/Provider Name" value={form.provider} onChange={handleChange} required />
      <button type="submit">Create File</button>
      <pre>{result}</pre>
      {cid && (
        <div>
          <p>Scan to preview:</p>
          <QRCodeCanvas value={previewUrl} />
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={handleCopy}>
              Copy preview link
            </button>
            {copied && <span style={{ marginLeft: 8, color: 'green' }}>Copied!</span>}
            <div style={{ marginTop: 5, wordBreak: 'break-all', fontSize: 12 }}>
              {previewUrl}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}