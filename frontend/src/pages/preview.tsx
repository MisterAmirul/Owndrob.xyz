import React, { useEffect, useState } from 'react';

export default function Preview() {
  const [metadata, setMetadata] = useState<any>(null);
  const [ownerPublicKey, setOwnerPublicKey] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get('cid');
    if (cid) {
      fetch(`https://gateway.pinata.cloud/ipfs/${cid}`)
        .then(res => res.json())
        .then(data => setMetadata(data));
    }
  }, []);

  // Ownership registration handler (calls backend for secure insert)
  const handleRegisterOwnership = async () => {
    setMessage(null);
    if (!ownerPublicKey) {
      setMessage('Please enter your Ed25519 public key.');
      return;
    }
    if (!metadata) {
      setMessage('Metadata not loaded.');
      return;
    }
    setLoading(true);

    try {
      const params = new URLSearchParams(window.location.search);
      const metadata_cid = params.get('cid') || '';
      const metadata_file_id = metadata.metadata_file_id || '';

      //validating registration conditions
      const validateRes = await fetch('http://localhost:3001/api/validate-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata_cid, public_key: ownerPublicKey }),
      });

      const validateResult = await validateRes.json();
      if (!validateResult.allowed) {
        setMessage(`❌ Registration denied: ${validateResult.reason}`);
        return;
      }

      const payload = {
        owner_public_key: ownerPublicKey,
        metadata_cid,
        metadata_file_id,
      };

      const res = await fetch('http://localhost:3001/api/register-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.error) {
        setMessage(`❌ Error: ${result.error}`);
      } else {
        setMessage('✅ Ownership registered successfully!');
        setOwnerPublicKey('');
      }
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  if (!metadata) return <div>Loading...</div>;

  return (
    <div style={{ border: '1px solid #ccc', padding: 20, maxWidth: 400 }}>
      <h2>{metadata.ipor_name}</h2>
      <p><strong>Version:</strong> {metadata.version}</p>
      <p><strong>Description:</strong> {metadata.description}</p>
      <p><strong>Supplies:</strong> {metadata.supplies}</p>
      <p><strong>Color:</strong> {metadata.color}</p>
      <p><strong>Manufacturing Country:</strong> {metadata.manufacturing_country}</p>
      <p><strong>Value:</strong> {metadata.value}</p>
      <p><strong>Label:</strong> {metadata.label}</p>
      <p><strong>Provider:</strong> {metadata.provider}</p>
      {/* Ownership registration box */}
      <div style={{ marginTop: 24, padding: 12, border: '1px solid #eee', borderRadius: 6 }}>
        <h3>Register Ownership</h3>
        <input
          type="text"
          placeholder="Enter your Ed25519 public key"
          value={ownerPublicKey}
          onChange={e => setOwnerPublicKey(e.target.value)}
          style={{ width: '100%', marginBottom: 8, padding: '0.5rem' }}
        />
        <button
          onClick={handleRegisterOwnership}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.7rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          {loading ? 'Registering...' : 'Register Ownership'}
        </button>
        {message && (
          <div style={{ marginTop: 8, color: message.startsWith('✅') ? 'green' : 'red' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}