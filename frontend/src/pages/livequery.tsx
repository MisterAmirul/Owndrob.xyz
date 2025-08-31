import React, { useState } from "react";
import axios from "axios";

const LiveQuery: React.FC = () => {
  const [mode, setMode] = useState<"crafter" | "ownership">("crafter");
  const [groupId, setGroupId] = useState("");
  const [fileId, setFileId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = async () => {
    setLoading(true);
    setResult(null);
    try {
      const params: any = { mode, groupId };
      if (mode === "ownership" && fileId) params.fileId = fileId;
      const res = await axios.get("http://localhost:3001/api/live-query", { params });
      console.log("API response:", res.data);  
      setResult(res.data);
    } catch (err) {
      setResult({ error: "Failed to fetch data" });
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      minHeight: "100vh",
      background: "#fff",
    }}>
      <div style={{
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
      }}>
        <h2 style={{ textAlign: "center", fontSize: "2rem" }}>Live Query</h2>

        {/* Input Container */}
        <div style={{
          width: "100%",
          background: "#f8f8f8",
          borderRadius: 10,
          padding: 32,
          marginBottom: 40,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontSize: "1.1rem",
        }}>
          <div>
            <label>
              Mode:
              <select
                value={mode}
                onChange={e => setMode(e.target.value as "crafter" | "ownership")}
                style={{ marginLeft: 8 }}
              >
                <option value="crafter">Crafter</option>
                <option value="ownership">Ownership</option>
              </select>
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>
              Group ID:
              <input
                type="text"
                value={groupId}
                onChange={e => setGroupId(e.target.value)}
                style={{ marginLeft: 8, width: "60%" }}
                placeholder="Enter group ID"
              />
            </label>
          </div>

          {mode === "ownership" && (
            <div style={{ marginTop: 12 }}>
              <label>
                Ownership File ID:
                <input
                  type="text"
                  value={fileId}
                  onChange={e => setFileId(e.target.value)}
                  style={{ marginLeft: 8, width: "60%" }}
                  placeholder="Enter ownership file ID"
                />
              </label>
            </div>
          )}

          <button onClick={handleQuery} disabled={loading || !groupId} style={{ marginTop: 16 }}>
            {loading ? "Querying..." : "Run Query"}
          </button>
        </div>

        {/* Result Container */}
        {result && (
          <div style={{
            width: "100%",
            background: "#f4f4f4",
            padding: 28,
            borderRadius: 10,
            textAlign: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            fontSize: "1.1rem",
          }}>
            {/* Show error message if any */}
            {result.error && <div style={{ color: "red", fontWeight: "bold" }}>{result.error}</div>}

            {/* Crafter mode */}
            {result.mode === "crafter" && result.files && (
              <>
                <h3>{result.message || "Files in group"}</h3>
                <p>
                  Total files: <strong>{result.total_files}</strong>
                </p>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: 12,
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid #ddd" }}>
                      <th style={{ padding: 8, textAlign: "center" }}>ID</th>
                      <th style={{ padding: 8, textAlign: "center" }}>Name</th>
                      <th style={{ padding: 8, textAlign: "center" }}>CID</th>
                      <th style={{ padding: 8, textAlign: "center" }}>Size (bytes)</th>
                      <th style={{ padding: 8, textAlign: "center" }}>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.files.map((file: any) => (
                      <tr key={file.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: 8, fontSize: 12, textAlign: "center" }}>{file.id}</td>
                        <td style={{ padding: 8, textAlign: "center" }}>{file.name}</td>
                        <td style={{ padding: 8, fontSize: 12, wordBreak: "break-all", textAlign: "center" }}>{file.cid}</td>
                        <td style={{ padding: 8, textAlign: "center" }}>{file.size}</td>
                        <td style={{ padding: 8, textAlign: "center" }}>{new Date(file.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Ownership mode */}
            {result.mode === "ownership" && (
              <>
                {result.verified ? (
                  <div
                    style={{
                      border: "1px solid #4CAF50",
                      backgroundColor: "#d7f5d2",
                      padding: 16,
                      borderRadius: 6,
                      textAlign: "center"
                    }}
                  >
                    <h3>Ownership Verified</h3>
                    <p>
                      <strong>Ownership File ID:</strong> {result.file_id}
                    </p>
                    <p>
                      <strong>File Name:</strong> {result.file_name}
                    </p>
                    <p>
                      <strong>Ownership CID:</strong> {result.cid}
                    </p>
                    <p>
                      <strong>Uploaded On:</strong>{" "}
                      {new Date(result.uploaded_on).toLocaleString()}
                    </p>
                    <p>
                      <a
                        href={result.ipfs_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#2a7ae2", textDecoration: "underline" }}
                      >
                        View on IPFS
                      </a>
                    </p>
                    <p style={{ fontStyle: "italic", color: "#4CAF50" }}>{result.message}</p>
                  </div>
                ) : (
                  <div style={{ color: "red", fontWeight: "bold" }}>
                    {result.message || "Ownership not verified"}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveQuery;