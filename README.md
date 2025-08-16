# Deal Dash - Mini Auction Platform

🚀 **Deal Dash** is a real-time auction platform where buyers and sellers can interact, place bids, and finalize deals instantly.  
Built with **React, Node.js, PostgreSQL, Redis, and Docker**, deployed seamlessly on **Render**.

---

## ✨ Features
- 🔑 User authentication for buyers & sellers
- 📦 Create & manage auctions in real-time
- 💸 Place, accept, reject, and counter bids
- 📊 Live bidding updates with WebSockets
- 🧾 Automatic invoice generation (PDF)
- 📧 Email notifications using SendGrid
- 📱 Responsive UI with modern design

---

## 🛠️ Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js (Express) + Sequelize
- **Database**: PostgreSQL
- **Cache & Realtime**: Redis + WebSockets
- **Containerization**: Docker
- **Deployment**: Render

---

## 📂 Project Structure
```
/frontend   → React UI (Vite)
/backend    → Node.js API + services
/public     → Static files & invoices
```
---

## ⚡ Getting Started

### 1️⃣ Clone the repo
```bash
git clone https://github.com/your-username/deal-dash.git
cd deal-dash
```

### 2️⃣ Run with Docker
```bash
docker build -t auction .
docker run -p 8080:8080 --env-file backend/.env auction
```

### 3️⃣ Access the app
- 🌐 Open: `http://localhost:8080`
- 🛠️ Debug emails: `http://localhost:8080/debug/email`

---

## 📬 Environment Variables (`.env`)
```env
DATABASE_URL=your_postgres_url
REDIS_URL=your_redis_url
SENDGRID_API_KEY=your_key
FROM_EMAIL=your_verified_sender@example.com
```

---



## 🤝 Contributing
Pull requests are welcome. For major changes, open an issue first.  

---

