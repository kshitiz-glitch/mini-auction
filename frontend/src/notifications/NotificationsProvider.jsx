import React, { createContext, useCallback, useContext, useState } from "react";

const Ctx = createContext(null);
export function useNotify(){ return useContext(Ctx); }

export default function NotificationsProvider({ children }) {
  const [items, setItems] = useState([]); // { id, text }

  const push = useCallback((text) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, text }]);
    setTimeout(() => setItems((prev) => prev.filter(i => i.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div style={{
        position:"fixed", right:12, bottom:12, display:"grid", gap:8, zIndex:9999
      }}>
        {items.map(n => (
          <div key={n.id} style={{
            background:"#111", color:"#fff", padding:"10px 12px", borderRadius:12,
            boxShadow:"0 6px 24px rgba(0,0,0,.2)", maxWidth:360
          }}>{n.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
