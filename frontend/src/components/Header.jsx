import React from "react";
import { NavLink } from "react-router-dom";

export default function Header() {
  return (
    <header className="appbar">
      <div className="brand">
        <span className="brand-badge">⚡</span>
        <span>Deal&nbsp;Dash</span>
      </div>
      <nav className="nav">
        
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Profile</button>
      </nav>
    </header>
  );
}
