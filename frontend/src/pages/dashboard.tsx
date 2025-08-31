import React, { useState } from 'react';
import { useUser } from '../UserContext';
import { useNavigate } from 'react-router-dom';
import QRCode from "react-qr-code";

type IPOR = {
  metadata_cid: string;
  metadata_file_id?: string;
  ipor_name?: string;
  version?: string;
  description?: string;
  supplies?: number;
  color?: string;
  manufacturing_country?: string;
  value?: number;
  label?: string;
  provider?: string;
};

// QR Modal Component
function QRModal({ value, onClose }: { value: string; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          padding: 32,
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.20)",
          textAlign: "center",
          minHeight: 400,
          height: 500,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        }}
        onClick={e => e.stopPropagation()}
      >
        <QRCode value={value} size={200} />
        <div style={{ marginTop: 16, fontSize: 14, color: "#888" }}>{value}</div>
        <button onClick={onClose} style={{ marginTop: 24 }}>Close</button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useUser();
  const [ipors, setIPORs] = useState<IPOR[]>([]);
  const [role, setRole] = useState<'crafter' | 'owner' | null>(null);
  const [qrModal, setQRModal] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRoleSelect = async (selectedRole: 'crafter' | 'owner') => {
    setRole(selectedRole);
    setIPORs([]);
    if (!user?.public_key) return;
    const sanitizedKey = user.public_key.replace(/\s+/g, '');
    const endpoint =
      selectedRole === 'crafter'
        ? `http://localhost:3001/api/crafter-ipors?public_key=${encodeURIComponent(sanitizedKey)}`
        : `http://localhost:3001/api/owner-ipors?public_key=${encodeURIComponent(sanitizedKey)}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    setIPORs(data);
  };

  const handleLogout = async () => {
    await fetch('http://localhost:3001/api/logout', {
      method: 'POST',
      credentials: 'include',
    });
    logout();
    navigate('/signin');
  };

  if (!user?.public_key) return <div>Please sign in to view your dashboard.</div>;

  // Helper to render IPOR like preview.tsx
  const renderIPOR = (ipor: IPOR) => (
    <div key={ipor.metadata_cid} style={{
      border: '1px solid #ccc',
      padding: 20,
      maxWidth: 400,
      marginBottom: 24,
      position: "relative",
      display: "flex",
      flexDirection: "column",
      minHeight: 320,
      background: "#fff",
      borderRadius: 10,
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <div>
        <h2>{ipor.ipor_name}</h2>
        <p><strong>Version:</strong> {ipor.version}</p>
        <p><strong>Description:</strong> {ipor.description}</p>
        <p><strong>Supplies:</strong> {ipor.supplies}</p>
        <p><strong>Color:</strong> {ipor.color}</p>
        <p><strong>Manufacturing Country:</strong> {ipor.manufacturing_country}</p>
        <p><strong>Value:</strong> {ipor.value}</p>
        <p><strong>Label:</strong> {ipor.label}</p>
        <p><strong>Provider:</strong> {ipor.provider}</p>
      </div>
      {/* QR Button at bottom for Crafter */}
      {role === 'crafter' && (
        <button
          onClick={() => setQRModal(ipor.metadata_cid)}
          style={{
            marginTop: "auto",
            alignSelf: "center",
            background: "#3498db",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "16px 0",      // taller button
            width: "90%",           // wider button
            fontSize: 18,           // larger text
            cursor: "pointer"
          }}
        >
          QR
        </button>
      )}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        minHeight: "100vh",
        background: "#fff",
      }}
    >
      <div
        style={{
          width: "800px",
          maxWidth: "90vw",
          margin: "60px 0",
          padding: 32,
          backgroundColor: "#fff",
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontSize: "1.15rem",
        }}
      >
        <h1 style={{ marginBottom: 32 }}>
          {role === 'crafter' ? 'Crafter' : role === 'owner' ? 'Owner' : 'Dashboard'}
        </h1>

        <button onClick={handleLogout} style={{ marginBottom: 24, background: '#e74c3c', color: '#fff' }}>
          Logout
        </button>

        <div style={{ marginBottom: 24 }}>
          <button onClick={() => handleRoleSelect('crafter')} style={{ marginRight: 12 }}>
            View as Crafter
          </button>
          <button onClick={() => handleRoleSelect('owner')}>
            View as Owner
          </button>
          <button onClick={() => navigate('/craft')} style={{ marginLeft: 24 }}>
            Craft
          </button>
          <button
            onClick={() => navigate('/livequery')}
            style={{ marginLeft: 12, background: '#3498db', color: '#fff' }}
          >
            Live Query
          </button>
        </div>

        {ipors.length > 0 ? (
          <>
            <h2>
              {role === 'crafter' ? 'Your Created IPORs' : 'Your Owned IPORs'}
            </h2>
            {ipors.map(renderIPOR)}
          </>
        ) : (
          role && <div>No IPORs found for your account as {role}.</div>
        )}

        {/* QR Modal */}
        {qrModal && <QRModal value={qrModal} onClose={() => setQRModal(null)} />}
      </div>
    </div>
  );
}