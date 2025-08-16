🚀 Deal Dash – Real-Time Auction Platform
Deal Dash is a real-time auction web app built with a modern stack and designed for buyers and sellers to connect seamlessly. It supports live bidding, invoice generation, and email notifications — all wrapped in a polished UI.
✨ Features
🔥 Live Auctions – real-time bidding powered by WebSockets
👥 Multi-User Roles – buyers & sellers with secure interactions
📄 Invoice Generation – automatic PDF invoices for completed auctions
📧 Email Notifications – integrated with SendGrid
🗄 Database + Cache – Postgres for persistence & Redis for speed
🎨 Responsive UI – clean layout with header, profile, and intuitive bidding flow
🛠 Tech Stack
Frontend: React + Vite + TailwindCSS
Backend: Node.js + Express + WebSockets
Database: PostgreSQL
Cache/Queue: Redis
Other: Docker, SendGrid (email API), Render (deployment)
📂 Project Structure
/frontend   → React (UI)
/backend    → Node.js API, WebSockets, invoice services
/public     → static assets (invoices, builds)
render.yaml → Render deployment blueprint
Dockerfile  → Multi-stage build (frontend + backend)
⚡️ Getting Started
1. Clone repo
git clone https://github.com/yourusername/deal-dash.git
cd deal-dash
2. Environment setup
Create a file backend/.env:

DATABASE_URL=postgres://user:password@host:5432/dealdash
REDIS_URL=redis://default:password@host:6379
SENDGRID_API_KEY=your_sendgrid_key
FROM_EMAIL=your_verified_sender@example.com


3. Run with Docker
docker build -t dealdash .
docker run --rm -p 8080:8080 --env-file backend/.env dealdash
App runs at 👉 http://localhost:8080
🚀 Deploy to Render
This repo includes a render.yaml for one-click deploy. It provisions Postgres + Redis + Web service automatically.
1. Push code to GitHub.
2. In Render, create a Blueprint Deploy → select this repo.
3. Set SENDGRID_API_KEY and FROM_EMAIL in the web service’s environment variables.
📸 Screenshots
Auction Dashboard – screenshot-auction.png
Invoice Example – screenshot-invoice.png
🤝 Contributing
Contributions are welcome!
1. Fork this repo
2. Create a feature branch
3. Submit a PR 🚀
