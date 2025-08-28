import { useUser } from '../UserContext';

export default function UserHeader() {
  const { user } = useUser();
  if (!user) return null;
  return (
    <div style={{ background: "#f5f5f5", padding: "0.5rem 1rem", borderBottom: "1px solid #ddd" }}>
      Logged in as: <strong>{user.unique_nickname}</strong> | Public Key: <span style={{ fontFamily: "monospace" }}>{user.public_key}</span>
    </div>
  );
}