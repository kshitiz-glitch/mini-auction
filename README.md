# DealDash 🛒⚡
_A Real-Time Auction Platform_

DealDash is a mini-auction system where buyers and sellers connect in real time.  
It includes live bidding, invoice generation, and email integration.

---

## 🚀 Features
- Live auctions with real-time bid updates (WebSockets)
- Secure buyer/seller login with handle + PIN
- Invoice PDF generation for winning bids
- Email delivery of invoices (SendGrid)
- Simple, responsive UI built with React + Tailwind
- Backend powered by Node.js, Express, PostgreSQL, and Redis

---

## 🛠️ Tech Stack
**Frontend:** React, Vite, Tailwind CSS  
**Backend:** Node.js, Express, Sequelize, WebSockets  
**Database:** PostgreSQL (Supabase), Redis (Upstash)  
**Email:** SendGrid API  
**Containerization:** Docker, Render (deployment)

---

## 🎮 Demo Accounts
Use these handles & PINs to log in:

| Handle   | PIN  |
|----------|------|
| playerA  | 1234 |
| playerB  | 2222 |
| playerC  | 3333 |
| playerD  | 4444 |
| playerE  | 5555 |

---

## ⚡ Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/your-username/dealdash.git
cd dealdash
```

### 2. Setup backend
```bash
cd backend
npm install
cp .env.example .env   # add DB + SendGrid creds
```

### 3. Setup frontend
```bash
cd ../frontend
npm install
npm run dev
```

### 4. Run with Docker
```bash
docker build -t auction .
docker run --rm -p 8080:8080 --env-file backend/.env auction
```

---

## 🌐 Deployment
- Deploy on **Render** or any container-ready platform
- Use **Supabase/Postgres** for DB
- Use **Upstash Redis** for cache/session
- Verify your `FROM_EMAIL` in SendGrid

---


