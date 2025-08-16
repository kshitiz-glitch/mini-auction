import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const fmt = (n) => n == null ? "—" : `₹${Number(n).toLocaleString("en-IN")}`;

export default function AdminPage() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await fetch("/admin/auctions");
    const d = await r.json();
    if (d?.ok) setRows(d.auctions || []);
  }

  async function forceClose(id) {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/admin/auctions/${id}/close`, { method: "POST" });
      const d = await r.json();
      if (!d?.ok) throw new Error(d?.error || "close failed");
      await load();
      setMsg(`Closed ${id} ✔`);
      setTimeout(()=>setMsg(""), 1200);
    } catch (e) {
      setMsg(e.message);
    } finally { setBusy(false); }
  }

  useEffect(()=>{ load(); }, []);

  return (
    <div className="wrap">
      <div className="stack">
        <div className="card">
          <div className="sr"><Link className="link" to="/">← Back</Link></div>
          <h1>Admin</h1>
          <div className="sr" style={{marginBottom:8}}>
            Read-only list + demo “force close”.
          </div>
          {msg && <div className={msg.includes("✔") ? "ok" : "error"}>{msg}</div>}
          <table className="table">
            <thead>
              <tr>
                <th>Item</th><th>Status</th><th>Start/Step</th><th>Seller</th><th>ID</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="sr">No auctions</td></tr>}
              {rows.map(a => (
                <tr key={a.id}>
                  <td><strong>{a.item_name}</strong><div className="sr">{a.description || ""}</div></td>
                  <td>{a.status}</td>
                  <td className="mono">start ₹{a.start_price} • step ₹{a.bid_increment}</td>
                  <td>{a.seller_handle} <span className="sr mono">#{a.seller_id}</span></td>
                  <td className="mono">{a.id}</td>
                  <td style={{display:"flex", gap:8}}>
                    <a className="btn" href={`/auctions/${a.id}/bids`} target="_blank" rel="noreferrer">Bids JSON</a>
                    <Link className="btn secondary" to={`/a/${a.id}`}>Open</Link>
                    <button className="btn" disabled={busy || a.status !== "live"} onClick={()=>forceClose(a.id)}>Force close</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{marginTop:8}}>
            <button className="btn secondary" disabled={busy} onClick={load}>Refresh</button>
          </div>
        </div>
      </div>
    </div>
  );
}
