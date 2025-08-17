# Deal Dash – Real-Time Auction Platform

**Deal Dash** is a real-time auction web app for creating and participating in auctions with live bidding, decisions (accept/reject/counter), and invoice generation.

---

## ✨ Features
- 🔐 Handle + PIN login (demo accounts below)
- ⚡ Live bidding via WebSockets
- 🧮 Next-min bid & highest bid tracking
- 🤝 Seller decisions: accept / reject / counter
- 🧾 Auto PDF invoice + email (SendGrid)
- 🗄 PostgreSQL + Redis, Dockerized

---

## 🧪 Demo Login Accounts (Public)
Use any of these to log in and test:

- Handle: **playerA** — PIN: **1234**
- Handle: **playerB** — PIN: **2222**
- Handle: **playerC** — PIN: **3333**
- Handle: **playerD** — PIN: **4444**
- Handle: **playerE** — PIN: **5555**

> Login fields are **Handle** and **PIN** (not email/password).

---

## 🛠 Tech Stack
Frontend: React + Vite + Tailwind  
Backend: Node.js (Express) + Socket.IO  
DB: PostgreSQL (Sequelize)  
Cache/RT: Redis  
Email: SendGrid  
Deploy: Docker + Render

---

## ⚡ Quick Start (Docker)
```bash
# from repo root
docker build -t auction .
docker run --rm -p 8080:8080 --env-file backend/.env auction
# open http://localhost:8080
