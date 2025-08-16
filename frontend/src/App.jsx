import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createSocket } from "./socket";
import {
  getUsers, getMe,
  listAuctions, getHighest, getNextMin,
  getDecision, postDecision, postAckCounter,
  getInvoice, emailInvoice,
  createAuction,getBids, placeBid
} from "./api";
import { useNotify } from "./notifications/NotificationsProvider";
import Header from "./components/Header.jsx";


function Badge({ status }) {
  const cls =
    status === "live" ? "b-live" :
    status === "ended" ? "b-ended" :
    status === "closed" ? "b-closed" : "b-scheduled";
  return <span className={`badge ${cls}`}>{status}</span>;
}
const fmtMoney = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function App() {
  const { push } = useNotify();

  // ---- auth
  const [users, setUsers] = useState([]);
  const [handle, setHandle] = useState("");
  const [pin, setPin] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [me, setMe] = useState(null);
  const [authMsg, setAuthMsg] = useState("");

  // ---- auctions data
  const [auctions, setAuctions] = useState([]);
  const [highestById, setHighestById] = useState({});  // id -> bid
  const [nextMinById, setNextMinById] = useState({});  // id -> number
  const [decisionById, setDecisionById] = useState({}); // id -> latest decision
  const [invoiceById, setInvoiceById] = useState({});   // id -> {exists,url}
  const [endsAtById, setEndsAtById] = useState({});     // id -> ISO
  const [timers, setTimers] = useState({});             // id -> "MM:SS"

  // ---- ui msgs
  const [createMsg, setCreateMsg] = useState("");
  const [bidMsg, setBidMsg] = useState("");

  // ---- create form
  const [form, setForm] = useState({
    item_name: "", start_price: "", bid_increment: "",
    go_live_at: "", duration_seconds: "", description: ""
  });

  // ---- socket
  const socket = useMemo(() => createSocket(), []);
  const joined = useRef(new Set());

  function saveToken(t){ setToken(t); if(t) localStorage.setItem("token",t); else localStorage.removeItem("token"); }

  // -------- bootstrap
  useEffect(() => {
    (async () => {
      const u = await getUsers(); setUsers(u.users || []);
      try { const m = await getMe(token); setMe(m.user); } catch {}
      const a = await listAuctions(); setAuctions(a.auctions || []);
    })();
  }, []);

  // join rooms
  useEffect(() => {
    auctions.forEach(a => {
      if (!joined.current.has(a.id)) {
        socket.emit("join_auction", { auctionId: a.id });
        joined.current.add(a.id);
      }
    });
  }, [auctions, socket]);

  // fetch per-auction extras
  useEffect(() => {
    (async () => {
      await Promise.all(auctions.map(async (a) => {
        const [h, n, d, i] = await Promise.allSettled([
          getHighest(a.id), getNextMin(a.id), getDecision(a.id), getInvoice(a.id)
        ]);
        if (h.status === "fulfilled") setHighestById(p=>({ ...p, [a.id]: h.value.highest || null }));
        if (n.status === "fulfilled") setNextMinById(p=>({ ...p, [a.id]: n.value.nextMin ?? null }));
        if (d.status === "fulfilled") setDecisionById(p=>({ ...p, [a.id]: d.value.latest || null }));
        if (i.status === "fulfilled") setInvoiceById(p=>({ ...p, [a.id]: { exists: i.value.exists, url: i.value.url }}));
      }));
    })();
  }, [auctions]);

  // -------- socket live updates + toasts
  useEffect(() => {
    socket.on("connect", () => console.log("[socket] connected", socket.id));

    socket.on("auction_state", ({ auctionId, status, highest, endsAt }) => {
      setAuctions(prev => prev.map(a => a.id === auctionId ? { ...a, status } : a));
      setHighestById(prev => ({ ...prev, [auctionId]: highest || null }));
      if (endsAt) setEndsAtById(prev => ({ ...prev, [auctionId]: endsAt }));
      fetch(`/auctions/${auctionId}/next-min`).then(r=>r.json()).then(d=>{
        if (d?.ok) setNextMinById(prev => ({ ...prev, [auctionId]: d.nextMin ?? null }));
      });
    });

    socket.on("new_bid", ({ auctionId, bid }) => {
      setHighestById(prev => ({ ...prev, [auctionId]: bid }));
      fetch(`/auctions/${auctionId}/next-min`).then(r=>r.json()).then(d=>{
        if (d?.ok) setNextMinById(prev => ({ ...prev, [auctionId]: d.nextMin ?? null }));
      });
    });

    socket.on("outbid", ({ previous, current, auctionId }) => {
      if (me && previous?.bidder_handle === me.handle) {
        push(`You were outbid on ${auctionId}: ${fmtMoney(current.amount)} by ${current.bidder_handle}`);
      }
    });

    socket.on("counter_offer", ({ auctionId, price, to_bidder_id }) => {
      if (me && me.id === to_bidder_id) {
        push(`Seller countered on ${auctionId} at ${fmtMoney(price)} — accept or reject from the row actions.`);
      }
      // refresh decision cell
      getDecision(auctionId).then(d => setDecisionById(prev => ({ ...prev, [auctionId]: d.latest || null })));
    });

    socket.on("seller_decision", ({ auctionId }) => {
      Promise.all([fetch(`/auctions/${auctionId}/decision`).then(r=>r.json()), fetch(`/auctions/${auctionId}/invoice`).then(r=>r.json())])
        .then(([d, i]) => {
          if (d?.ok) setDecisionById(prev => ({ ...prev, [auctionId]: d.latest || null }));
          if (i?.ok) setInvoiceById(prev => ({ ...prev, [auctionId]: { exists: i.exists, url: i.url }}));
        });
    });

    socket.on("invoice_ready", ({ auctionId }) => {
      push(`Invoice is ready for ${auctionId}.`);
      setInvoiceById(prev => ({ ...prev, [auctionId]: { exists: true, url: `/invoices/${auctionId}.pdf` } }));
    });

    socket.on("auction_ended", ({ auctionId, finalHighest }) => {
      push(finalHighest
        ? `Auction ended (${auctionId}). Winner: ${finalHighest.bidder_handle} @ ${fmtMoney(finalHighest.amount)}`
        : `Auction ended (${auctionId}). No bids.`);
    });

    return () => { socket.removeAllListeners(); };
  }, [socket, me, push]);

  // countdown timers
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setTimers(prev => {
        const next = { ...prev };
        Object.entries(endsAtById).forEach(([aid, iso]) => {
          const left = new Date(iso).getTime() - now;
          if (!Number.isFinite(left)) return;
          if (left <= 0) next[aid] = "00:00";
          else {
            const s = Math.floor(left/1000);
            const mm = String(Math.floor(s/60)).padStart(2,"0");
            const ss = String(s%60).padStart(2,"0");
            next[aid] = `${mm}:${ss}`;
          }
        });
        return next;
      });
    }, 500);
    return () => clearInterval(id);
  }, [endsAtById]);

  // -------- actions
  async function login() {
    setAuthMsg("");
    try {
      const r = await fetch("/auth/login", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ handle, pin })
      });
      const data = await r.json();
      if (!r.ok || data?.ok === false) throw new Error(data?.error || "Login failed");
      saveToken(data.token);
      const m = await getMe(data.token); setMe(m.user);
    } catch (e) { setAuthMsg(e.message); }
  }
  function logout(){ saveToken(""); setMe(null); }

  async function onCreate() {
    setCreateMsg("");
    const body = {
      item_name: form.item_name.trim(),
      description: (form.description || "").trim(),
      start_price: Number(form.start_price),
      bid_increment: Number(form.bid_increment),
      go_live_at: form.go_live_at ? new Date(form.go_live_at).toISOString() : null,
      duration_seconds: Number(form.duration_seconds)
    };
    if (!body.item_name) return setCreateMsg("Item name required");
    if (!Number.isFinite(body.start_price)) return setCreateMsg("Starting price required");
    if (!Number.isFinite(body.bid_increment) || body.bid_increment <= 0) return setCreateMsg("Bid increment must be > 0");
    if (!body.go_live_at) return setCreateMsg("Go live at required");
    if (!Number.isFinite(body.duration_seconds) || body.duration_seconds < 10) return setCreateMsg("Duration must be ≥ 10s");
    try {
      await createAuction(body, token);
      const a = await listAuctions(); setAuctions(a.auctions || []);
      setForm({ item_name:"", start_price:"", bid_increment:"", go_live_at:"", duration_seconds:"", description:"" });
      setCreateMsg("Created ✔"); setTimeout(()=>setCreateMsg(""),1200);
    } catch (e) { setCreateMsg(e.message); }
  }

  async function onPlaceBid(auctionId, inputId) {
    setBidMsg("");
    const val = Number(document.getElementById(inputId)?.value);
    if (!Number.isFinite(val) || val <= 0) return setBidMsg("Enter a valid amount");
    const min = nextMinById[auctionId];
    if (min != null && val < Number(min)) return setBidMsg(`Bid must be ≥ ${fmtMoney(min)}`);

    try {
      const r = await placeBid(auctionId, val, token);   // { ok, bid }
      document.getElementById(inputId).value = "";
      // optimistic + ensure refresh
      if (r?.bid) setHighestById(prev => ({ ...prev, [auctionId]: r.bid }));
      const [nm, h] = await Promise.all([
        fetch(`/auctions/${auctionId}/next-min`).then(r=>r.json()),
        fetch(`/auctions/${auctionId}/highest`).then(r=>r.json())
      ]);
      if (nm?.ok) setNextMinById(prev => ({ ...prev, [auctionId]: nm.nextMin ?? null }));
      if (h?.ok) setHighestById(prev => ({ ...prev, [auctionId]: h.highest || null }));
    } catch (e) {
      setBidMsg(e.message);
      console.error("[bid] place failed", e);
    }
  }

  async function decide(id, action, price) {
    try {
      const body = action === "counter" ? { action, price: Number(price) } : { action };
      await postDecision(id, body, token);
      const [d, i] = await Promise.all([
        fetch(`/auctions/${id}/decision`).then(r=>r.json()),
        fetch(`/auctions/${id}/invoice`).then(r=>r.json())
      ]);
      if (d?.ok) setDecisionById(prev => ({ ...prev, [id]: d.latest || null }));
      if (i?.ok) setInvoiceById(prev => ({ ...prev, [id]: { exists: i.exists, url: i.url }}));
    } catch (e) { alert(e.message); }
  }

  async function ackCounter(id, accept) {
    try {
      const d = await getDecision(id);
      await postAckCounter(id, { accept, price: d?.latest?.price }, token);
      const [d2, i] = await Promise.all([getDecision(id), getInvoice(id)]);
      setDecisionById(prev => ({ ...prev, [id]: d2.latest || null }));
      setInvoiceById(prev => ({ ...prev, [id]: { exists: i.exists, url: i.url }}));
    } catch (e) { alert(e.message); }
  }

  async function sendInvoice(id) {
    try {
      await emailInvoice(id, token);
      const i = await getInvoice(id);
      setInvoiceById(prev => ({ ...prev, [id]: { exists: i.exists, url: i.url }}));
      alert("Invoice emailed (check server logs for details).");
    } catch (e) { alert(e.message); }
  }

  return (
    <div className="wrap">
      <div className="stack">
        <Header />



        {/* Auth */}
        <div className="card">
          <h1>🔐 Auth</h1>
          <div className="row two">
            <div>
              <label>Handle</label>
              <select value={handle} onChange={e=>setHandle(e.target.value)}>
                <option value="">—</option>
                {users.map(u => <option key={u.id} value={u.handle}>{u.handle}</option>)}
              </select>
            </div>
            <div>
              <label>PIN</label>
              <input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="e.g., 1111" />
            </div>
          </div>
          <div className="row two">
            <button className="btn" onClick={login}>Log In</button>
            <button className="btn secondary" onClick={logout}>Log Out</button>
          </div>
          {authMsg && <div className="error">{authMsg}</div>}
          <div className="sr">{me ? `Logged in as ${me.handle} (id: ${me.id})` : "Not logged in"}</div>
        </div>

        {/* Create Auction */}
        <div className="card">
          <h2>📦 Create Auction</h2>
          <p className="sr">You must be logged in. You become the seller.</p>
          <div className="row two">
            <div><label>Item name</label><input value={form.item_name} onChange={e=>setForm({...form,item_name:e.target.value})} /></div>
            <div><label>Starting price</label><input type="number" value={form.start_price} onChange={e=>setForm({...form,start_price:e.target.value})} /></div>
          </div>
          <div className="row two">
            <div><label>Bid increment</label><input type="number" value={form.bid_increment} onChange={e=>setForm({...form,bid_increment:e.target.value})} /></div>
            <div><label>Go live at</label><input type="datetime-local" value={form.go_live_at} onChange={e=>setForm({...form,go_live_at:e.target.value})} /></div>
          </div>
          <div className="row two">
            <div><label>Duration (seconds)</label><input type="number" value={form.duration_seconds} onChange={e=>setForm({...form,duration_seconds:e.target.value})} /></div>
            <div><label>Description</label><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></div>
          </div>
          <button className="btn" onClick={onCreate}>Create Auction</button>
          {createMsg && <div className={createMsg.includes("✔") ? "ok" : "error"}>{createMsg}</div>}
        </div>

        {/* Auctions */}
        <div className="card">
          <h2>🧾 Auctions</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Item</th><th>Status</th><th>Start ↦ End</th><th>Pricing</th>
                <th>Highest</th><th>Seller</th><th>ID</th><th>Bid</th><th>Decision / Invoice</th>
              </tr>
            </thead>
            <tbody>
              {auctions.length === 0 && <tr><td colSpan="9" className="sr">No auctions yet.</td></tr>}
              {auctions.map(a => {
                const start = a.go_live_at ? new Date(a.go_live_at).toLocaleString() : "—";
                const end = a.go_live_at ? new Date(new Date(a.go_live_at).getTime() + a.duration_seconds*1000).toLocaleString() : "—";
                const highest = highestById[a.id];
                const highestStr = highest ? `${fmtMoney(highest.amount)} by ${highest.bidder_handle}` : "—";
                const nextMin = nextMinById[a.id];
                const amSeller = me && me.id === a.seller_id;
                const amHighest = me && highest && me.handle === highest.bidder_handle;
                const latest = decisionById[a.id];
                const inv = invoiceById[a.id];
                const timer = timers[a.id] || "—";
                const disabled = a.status !== "live";

                return (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.item_name}</strong>
                      <div className="sr">{a.description || ""}</div>
                      <div className="sr"><Link className="link" to={`/a/${a.id}`}>View</Link></div>
                    </td>
                    <td><Badge status={a.status} /></td>
                    <td className="mono">{start}<div className="sr">→ {end}</div></td>
                    <td className="mono">start {fmtMoney(a.start_price)}<div className="sr">+ step {fmtMoney(a.bid_increment)}</div></td>
                    <td className="mono">
                      {highestStr}
                      {a.status === "live" && <div className="sr">⏳ {timer}</div>}
                    </td>
                    <td>{a.seller_handle} <div className="sr mono">#{a.seller_id}</div></td>
                    <td className="mono">{a.id}</td>
                    <td>
                      <div style={{display:"grid", gap:6}}>
                        <div className="sr">Next min: {nextMin != null ? fmtMoney(nextMin) : "—"}</div>
                        <div style={{display:"flex", gap:8, alignItems:"center"}}>
                          <input id={`bid_${a.id}`} disabled={disabled} type="number" step="0.01" placeholder={disabled ? "Not live" : "Amount"} />
                          <button className="btn" disabled={disabled} onClick={() => onPlaceBid(a.id, `bid_${a.id}`)}>Place</button>
                        </div>
                        
                      </div>
                    </td>

                    <td>
                      <div className="sr">
                        {latest ? (
                          <span className="pill">
                            Latest: {latest.type}{latest.price ? ` @ ${fmtMoney(latest.price)}` : ""} • by {latest.by_handle}
                          </span>
                        ) : "—"}
                      </div>

                      {(latest && latest.type === "counter" && amHighest) && (
                        <div style={{display:"flex", gap:8, marginTop:8}}>
                          <button className="btn" onClick={() => ackCounter(a.id, true)}>Accept @ {fmtMoney(latest.price)}</button>
                          <button className="btn secondary" onClick={() => ackCounter(a.id, false)}>Reject</button>
                        </div>
                      )}

                      {(amSeller && a.status === "ended") && (
                        <div style={{display:"grid", gap:8, marginTop:8}}>
                          <div style={{display:"flex", gap:8}}>
                            <button className="btn" onClick={() => decide(a.id, "accept")}>Accept</button>
                            <button className="btn secondary" onClick={() => decide(a.id, "reject")}>Reject</button>
                          </div>
                          <div style={{display:"flex", gap:8}}>
                            <input id={`ctr_${a.id}`} type="number" placeholder="Counter price" />
                            <button className="btn" onClick={() => {
                              const p = Number(document.getElementById(`ctr_${a.id}`).value);
                              if (!Number.isFinite(p) || p <= 0) return alert("Enter a valid counter price");
                              decide(a.id, "counter", p);
                            }}>Counter</button>
                          </div>
                        </div>
                      )}

                      <div style={{marginTop:8}}>
                        {inv?.exists && inv?.url && (
                          <div className="sr" style={{marginBottom:6}}>
                            <a className="link" href={inv.url} target="_blank" rel="noreferrer">⬇ Download invoice</a>
                          </div>
                        )}
                        {amSeller && (
                          <button className="btn secondary" onClick={() => sendInvoice(a.id)}>Email invoice</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
