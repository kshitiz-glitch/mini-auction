import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { createSocket } from "../socket";
import { useNotify } from "../notifications/NotificationsProvider";
import {
  getMe, getInvoice, getDecision, getHighest, getNextMin, getBids,
  placeBid, postDecision, postAckCounter, emailInvoice
} from "../api";
import Header from "../components/Header.jsx"; // ← new header

const fmtMoney = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function AuctionPage() {
  const { id } = useParams();
  const { push } = useNotify();
  const [token] = useState(localStorage.getItem("token") || "");
  const [me, setMe] = useState(null);

  const [auction, setAuction] = useState(null);
  const [highest, setHighest] = useState(null);
  const [nextMin, setNextMin] = useState(null);
  const [decision, setDecision] = useState(null);
  const [invoice, setInvoice] = useState({ exists:false, url:null });
  const [bids, setBids] = useState([]);
  const [timer, setTimer] = useState("—");
  const [endsAt, setEndsAt] = useState(null);
  const [msg, setMsg] = useState("");

  const socket = useMemo(() => createSocket(), []);
  const polling = useRef(null);

  useEffect(() => {
    (async () => {
      try { const m = await getMe(token); setMe(m.user); } catch {}
      const aRes = await fetch(`/auctions/${id}`).then(r=>r.json());
      if (aRes?.ok) { setAuction(aRes.auction); }
      const [h, n, d, i, bl] = await Promise.all([
        getHighest(id), getNextMin(id), getDecision(id), getInvoice(id), getBids(id)
      ]);
      setHighest(h?.highest || null);
      setNextMin(n?.nextMin ?? null);
      setDecision(d?.latest || null);
      setInvoice({ exists: i?.exists, url: i?.url });
      setBids(bl?.bids || []);
    })();
  }, [id, token]);

  useEffect(() => {
    socket.emit("join_auction", { auctionId: id });

    socket.on("auction_state", ({ auctionId, status, highest, endsAt }) => {
      if (auctionId !== id) return;
      setAuction(prev => prev ? { ...prev, status } : prev);
      setHighest(highest || null);
      if (endsAt) setEndsAt(endsAt);
      getNextMin(id).then(d => setNextMin(d?.nextMin ?? null)).catch(()=>{});
    });

    socket.on("new_bid", ({ auctionId, bid }) => {
      if (auctionId !== id) return;
      setHighest(bid);
      setBids(prev => [bid, ...prev]);
      getNextMin(id).then(d => setNextMin(d?.nextMin ?? null)).catch(()=>{});
    });

    socket.on("counter_offer", ({ auctionId, price, to_bidder_id }) => {
      if (auctionId !== id) return;
      if (me && me.id === to_bidder_id) {
        push(`Seller countered at ${fmtMoney(price)}. You can accept or reject below.`);
      }
      getDecision(id).then(d => setDecision(d?.latest || null));
    });

    socket.on("seller_decision", ({ auctionId }) => {
      if (auctionId !== id) return;
      Promise.all([getDecision(id), getInvoice(id)]).then(([d, i]) => {
        setDecision(d?.latest || null);
        setInvoice({ exists: i?.exists, url: i?.url });
      });
    });

    socket.on("invoice_ready", ({ auctionId, url }) => {
      if (auctionId !== id) return;
      push("Invoice ready for this auction.");
      setInvoice({ exists: true, url });
    });

    socket.on("auction_ended", ({ auctionId, finalHighest }) => {
      if (auctionId !== id) return;
      push(finalHighest
        ? `Auction ended. Winner: ${finalHighest.bidder_handle} @ ${fmtMoney(finalHighest.amount)}`
        : `Auction ended with no bids.`);
    });

    return () => { socket.removeAllListeners(); };
  }, [socket, id, me, push]);

  useEffect(() => {
    const t = setInterval(()=>{
      if (!endsAt) return setTimer("—");
      const left = new Date(endsAt).getTime() - Date.now();
      if (left <= 0) return setTimer("00:00");
      const s = Math.floor(left/1000);
      const mm = String(Math.floor(s/60)).padStart(2,"0");
      const ss = String(s%60).padStart(2,"0");
      setTimer(`${mm}:${ss}`);
    }, 500);
    return () => clearInterval(t);
  }, [endsAt]);

  // safety polling every 5s
  useEffect(() => {
    polling.current = setInterval(async () => {
      const [h, bl] = await Promise.all([getHighest(id), getBids(id)]);
      setHighest(h?.highest || null);
      setBids(bl?.bids || []);
    }, 5000);
    return () => clearInterval(polling.current);
  }, [id]);

  async function place() {
    setMsg("");
    const input = document.getElementById("amount");
    const val = Number(input?.value);
    if (!Number.isFinite(val) || val <= 0) return setMsg("Enter a valid amount");
    if (nextMin != null && val < Number(nextMin)) return setMsg(`Bid must be ≥ ${fmtMoney(nextMin)}`);
    try {
      const r = await placeBid(id, val, token);
      input.value = "";
      if (r?.bid) { setHighest(r.bid); setBids(prev => [r.bid, ...prev]); }
      const [nm, h] = await Promise.all([getNextMin(id), getHighest(id)]);
      setNextMin(nm?.nextMin ?? null);
      setHighest(h?.highest || null);
    } catch (e) { setMsg(e.message); }
  }

  async function decide(action) {
    const price = action === "counter" ? Number(prompt("Counter price ₹", nextMin ?? "")) : undefined;
    try {
      await postDecision(id, action === "counter" ? { action, price } : { action }, token);
      const [d, i] = await Promise.all([getDecision(id), getInvoice(id)]);
      setDecision(d?.latest || null);
      setInvoice({ exists: i?.exists, url: i?.url });
    } catch (e) { alert(e.message); }
  }

  if (!auction) return (
    <>
      <div className="wrap"><Header /></div>
      <div className="wrap"><div className="stack"><div className="card">Loading… <Link className="link" to="/">Back</Link></div></div></div>
    </>
  );

  const amSeller = me && me.id === auction.seller_id;
  const amHighest = me && highest && me.handle === highest.bidder_handle;

  return (
    <>
      <div className="wrap">
        <Header />
      </div>

      <div className="wrap">
        <div className="stack">

          <div className="card">
            <div className="sr"><Link className="link" to="/">← Back</Link></div>
            <h1>{auction.item_name}</h1>
            <div className="sr">{auction.description}</div>
            <div className="sr">Status: <strong>{auction.status}</strong> {auction.status==="live" && <>• ⏳ {timer}</>}</div>
            {/* 🔒 Hide numeric seller id; show handle only */}
            <div className="sr">Seller: {auction.seller_handle}</div>
            <div className="sr">Start {fmtMoney(auction.start_price)} • Step {fmtMoney(auction.bid_increment)}</div>
            <div className="sr">Next min: {nextMin != null ? fmtMoney(nextMin) : "—"}</div>

            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
              <input id="amount" type="number" step="0.01" placeholder={auction.status!=="live"?"Not live":"Your bid"} disabled={auction.status!=="live"} />
              <button className="btn" disabled={auction.status!=="live"} onClick={place}>Place bid</button>
            </div>
            {msg && <div className="error" style={{marginTop:6}}>{msg}</div>}
            <div className="sr" style={{marginTop:8}}>
              Highest: {highest ? `${fmtMoney(highest.amount)} by ${highest.bidder_handle}` : "—"}
            </div>

            {/* Decisions */}
            <div style={{marginTop:12}}>
              <div className="sr">Latest decision: {decision ? `${decision.type}${decision.price?` @ ${fmtMoney(decision.price)}`:""} by ${decision.by_handle}` : "—"}</div>
              {amSeller && auction.status === "ended" && (
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button className="btn" onClick={() => decide("accept")}>Accept</button>
                  <button className="btn secondary" onClick={() => decide("reject")}>Reject</button>
                  <button className="btn" onClick={() => decide("counter")}>Counter…</button>
                </div>
              )}
              {decision && decision.type === "counter" && amHighest && (
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button className="btn" onClick={async ()=>{
                    await postAckCounter(id, { accept:true, price: decision.price }, token);
                    const [d, i] = await Promise.all([getDecision(id), getInvoice(id)]);
                    setDecision(d?.latest || null);
                    setInvoice({ exists: i?.exists, url: i?.url });
                  }}>Accept @ {fmtMoney(decision.price)}</button>
                  <button className="btn secondary" onClick={async ()=>{
                    await postAckCounter(id, { accept:false, price: decision.price }, token);
                    const d = await getDecision(id);
                    setDecision(d?.latest || null);
                  }}>Reject</button>
                </div>
              )}
            </div>

            {/* Invoice */}
            <div style={{marginTop:12, display:"flex", gap:8, flexWrap:"wrap"}}>
              {invoice?.exists && invoice?.url && (
                // ⬇ proper Download button (no debug link)
                <a className="btn secondary" href={invoice.url} download>
                  Download invoice
                </a>
              )}
              {amSeller && (
                <button className="btn" onClick={async ()=>{
                  await emailInvoice(id, token);
                  const i = await getInvoice(id);
                  setInvoice({ exists: i.exists, url: i.url });
                  alert("Invoice email attempted; check server logs.");
                }}>
                  Email invoice
                </button>
              )}
            </div>
          </div>

          {/* Bid history */}
          <div className="card">
            <h2>Bid history</h2>
            {bids.length === 0 && <div className="sr">No bids yet.</div>}
            <table className="table">
              <thead><tr><th>Time</th><th>Bidder</th><th>Amount</th></tr></thead>
              <tbody>
                {bids.map(b => (
                  <tr key={b.id}>
                    <td className="mono">{new Date(b.created_at).toLocaleString()}</td>
                    {/* 🔒 Hide numeric bidder id; show handle only */}
                    <td>{b.bidder_handle}</td>
                    <td className="mono">{fmtMoney(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </>
  );
}
