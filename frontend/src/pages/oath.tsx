import React, { useState } from "react";
import { useUser } from '../UserContext';
import nacl from "tweetnacl";
import { encode as encodeBase64 } from "base64-arraybuffer";
import { useNavigate } from 'react-router-dom';

// Browser-compatible SHA-256 hash function
async function sha256(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str.trim().toLowerCase());
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgUint8);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Simple XOR encryption for demo (replace with libsodium for real use)
function encryptPrivateKey(privateKey: Uint8Array, pin: string) {
  const pinBytes = new TextEncoder().encode(pin.padEnd(privateKey.length, "0"));
  return privateKey.map((b, i) => b ^ pinBytes[i % pinBytes.length]);
}

export default function OathSignup() {
  // sign up states
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [recovery, setRecovery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // sign in states
  const [signInNickname, setSignInNickname] = useState("");
  const [signInPin, setSignInPin] = useState("");
  const [signInMessage, setSignInMessage] = useState<string | null>(null);
  const [signInLoading, setSignInLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useUser();

  // sign up handler
  const handleSignup = async () => {
    setMessage(null);

    if (!nickname || !pin || !recovery) {
      setMessage("Please fill in all fields.");
      return;
    }
    if (!/^\d{5}$/.test(pin)) {
      setMessage("PIN must be exactly 5 digits.");
      return;
    }

    setLoading(true);

    try {
      // Generate keypair
      const keyPair = nacl.sign.keyPair();

      // Encrypt private key with PIN
      const encryptedPriv = encryptPrivateKey(keyPair.secretKey, pin);
      const encryptedPrivB64 = encodeBase64(encryptedPriv.slice().buffer);

      // Hash social recovery answer (browser SHA-256)
      const recoveryHash = await sha256(recovery);

      // Prepare data
      const data = {
        unique_nickname: nickname,
        pin, // For demo, store raw. Use bcrypt for production.
        social_recovery: recoveryHash,
        public_key: encodeBase64(keyPair.publicKey.slice().buffer),
        private_key: encryptedPrivB64,
      };

      // Send sign up details to backend API
      const res = await fetch("http://localhost:3001/api/oath-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.error) {
        setMessage(`❌ Error: ${result.error}`);
      } else {
        setMessage("✅ Signup successful! Redirecting...");
        setTimeout(() => navigate('/signin'), 1500); //redirect after 1.5 seconds
      }
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // sign in handler
  const handleSignIn = async () => {
    setSignInMessage(null);
    if (!signInNickname || !signInPin) {
      setSignInMessage("Please enter nickname and PIN.");
      return;
    }

    setSignInLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/oath-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({ unique_nickname: signInNickname, pin: signInPin }),
        credentials: 'include', // <-- important to include cookies
      });
      const result = await res.json();
      if (result.success) {
        setSignInMessage("Sign in successful! Redirecting now.");
        // Fetch user data and store in context, then redirect
        const userRes = await fetch(`http://localhost:3001/api/oath-user?nickname=${signInNickname}`);
        const userData = await userRes.json();
        login(userData);
        setTimeout(() => navigate('/dashboard'), 1500); // redirect after 1.5 seconds
      } else {
        setSignInMessage(`${result.error || "sign in failed"}`);
      }    
    } catch (err: any) {
      setSignInMessage(`Error: ${err.message || err}`);
    } finally {
      setSignInLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 400, margin: "2rem auto", padding: "1rem", fontFamily: "Arial, sans-serif" }}>
      <h1>OWNDROB</h1>
      <h3>Sign Up</h3>
      <label>
        Unique Nickname:
        <input
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value.trim())}
          style={{ width: "100%", marginBottom: 10, padding: "0.5rem" }}
        />
      </label>
      <label>
        5-digit PIN:
        <input
          type="password"
          value={pin}
          maxLength={5}
          onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 5))}
          style={{ width: "100%", marginBottom: 10, padding: "0.5rem" }}
        />
      </label>
      <label>
        Social Recovery Question:<br />
        <span style={{ fontSize: "0.95em" }}>What brand are you dreaming to purchase?</span>
        <input
          type="text"
          value={recovery}
          onChange={e => setRecovery(e.target.value)}
          style={{ width: "100%", marginBottom: 10, padding: "0.5rem" }}
        />
      </label>
      <button
        onClick={handleSignup}
        disabled={loading}
        style={{
          width: "100%",
          padding: "0.7rem",
          background: "#007bff",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          marginTop: 10,
        }}
      >
        {loading ? "Signing up..." : "Sign Up"}
      </button>
      {message && (
        <p style={{ marginTop: 16, color: message.startsWith("✅") ? "green" : "red" }}>
          {message}
        </p>
      )}

      {/* sign in form */}
      <hr style={{ margin: "2rem 0" }} />
      <h2>Already have an account? Sign In</h2>
      <label>
        Nickname:
        <input
          type="text"
          value={signInNickname}
          onChange={e => setSignInNickname(e.target.value.trim())}
          style={{ width: "100%", marginBottom: 10, padding: "0.5rem" }}
        />
      </label>
      <label>
        PIN:
        <input
          type="password"
          value={signInPin}
          maxLength={5}
          onChange={e => setSignInPin(e.target.value.replace(/\D/g, "").slice(0, 5))}
          style={{ width: "100%", marginBottom: 10, padding: "0.5rem" }}
        />
      </label>
      <button
        onClick={handleSignIn}
        disabled={signInLoading}
        style={{
          width: "100%",
          padding: "0.7rem",
          background: "#007bff",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          marginTop: 10,
        }}
      >
        {signInLoading ? "Signing in..." : "Sign In"}
      </button>
      {signInMessage && (
        <p style={{ marginTop: 16, color: signInMessage.startsWith("✅") ? "green" : "red" }}>
          {signInMessage}
        </p>
      )}
    </main>
  );
}