import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import AuctionPage from "./pages/AuctionPage.jsx";
import "./styles.css";
import ProfilePage from "./pages/ProfilePage.jsx";
import NotificationsProvider from "./notifications/NotificationsProvider.jsx";
import AdminPage from "./pages/AdminPage.jsx";
// ...
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <NotificationsProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/a/:id" element={<AuctionPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </NotificationsProvider>
    </BrowserRouter>
  </React.StrictMode>
);


