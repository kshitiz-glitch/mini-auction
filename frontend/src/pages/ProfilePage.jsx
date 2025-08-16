import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMe } from "../api";
import { updateEmail, updatePin } from "../api";

export default function ProfilePage() {
  const [token] = useState(localStorage.getItem("token") || "");
  const [me, setMe] = useState(null);
  const [email, setEmail] = useState("");
  const [pin, setPinState] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const m = await getMe(token);
        setMe(m.user);
      } catch {
        setMsg("Please log in first.");
      }
    })();
  }, [token]);

  async function saveEmail() {
    setMsg("");
    try {
      const r = await updateEmail(email, token);
      setMe(prev => ({ ...prev, email: r.user.email }));
      setMsg("Email saved ✔");
    } catch (e) { setMsg(e.message); }
  }

  async function savePin() {
    setMsg("");
    try {
      if (!/^\d{4}$/.test(pin)) return setMsg("PIN must be 4 digits");
      await updatePin(pin, token);
      setPinState("");
      setMsg("PIN updated ✔");
    } catch (e) { setMsg(e.message); }
  }

  return (
    <div className="wrap">
      <div className="stack">
        <div className="card">
          <div className="sr"><Link className="link" to="/">← Back</Link></div>
          <h1>Profile</h1>
          {!me ? (
            <div className="sr">Not logged in.</div>
          ) : (
            <>
              <div className="sr">Handle: <strong>{me.handle}</strong> (#{me.id})</div>
              <div className="row two" style={{marginTop:12}}>
                <div>
                  <label>Email (for invoices/notifications)</label>
                  <input value={email} onChange={e=>setEmail(e.target.value)} placeholder={me.email || "you@example.com"} />
                  <button className="btn" onClick={saveEmail} style={{marginTop:8}}>Save email</button>
                </div>
                <div>
                  <label>Change PIN (4 digits)</label>
                  <input value={pin} onChange={e=>setPinState(e.target.value)} placeholder="1234" maxLength={4} />
                  <button className="btn secondary" onClick={savePin} style={{marginTop:8}}>Update PIN</button>
                </div>
              </div>
              {msg && <div className={msg.includes("✔") ? "ok":"error"} style={{marginTop:8}}>{msg}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
