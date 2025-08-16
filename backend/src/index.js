import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import express from "express";
import morgan from "morgan";
import { Server } from "socket.io";

// DB + models
import { syncModels } from "./models.js";
import { ensureSeedUsers, listUsers, findById, checkLogin, updateEmail, setPin } from "./userStore.js";

// Auth helpers
import { authenticate, requireAuth, signToken } from "./auth.js";

// Stores (Sequelize-backed)
import { createAuction, listAuctions, getAuction, computeStatus, closeAuction } from "./auctionStore.js";
import { placeBid, listBidsByAuction, getHighestBid, nextMinBid } from "./bidStore.js";
import { addDecision, latestDecision, listDecisions } from "./decisionStore.js";

// Invoice/email
import { generateInvoicePDF, invoiceFilePath, invoiceUrlPath, sendInvoiceEmail, sendPlainEmail } from "./invoiceService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const FROM_EMAIL = (process.env.FROM_EMAIL || "").trim();

// ---------------- DB boot & seed ----------------
await syncModels();
await ensureSeedUsers();

// ---------------- middleware -------------------
app.use(morgan("tiny"));
app.use(express.json());
app.use(authenticate(JWT_SECRET));

// ---------------- helpers ----------------------
const roomName = (id) => `auction:${id}`;

async function emitAuctionState(auctionId) {
  const a = await getAuction(auctionId);
  if (!a) return;
  const highest = await getHighestBid(auctionId);
  const start = Date.parse(a.go_live_at);
  const endsAt = isNaN(start) ? null : new Date(start + a.duration_seconds * 1000).toISOString();

  io.to(roomName(auctionId)).emit("auction_state", {
    auctionId,
    status: computeStatus(a),
    highest: highest
      ? { amount: Number(highest.amount), bidder_handle: highest.bidder_handle, bidder_id: Number(highest.bidder_id) }
      : null,
    endsAt
  });
}

async function maybeGenerateInvoice(auctionId) {
  const a = await getAuction(auctionId);
  if (!a) throw new Error("Auction not found");

  const file = invoiceFilePath(auctionId);
  if (fs.existsSync(file)) {
    console.log(`[invoice] already exists for auction ${auctionId} → ${invoiceUrlPath(auctionId)}`);
    io.to(roomName(auctionId)).emit("invoice_ready", { auctionId, url: invoiceUrlPath(auctionId) });
    return { created: false, path: file };
  }

  // Primary highest
  let highest = await getHighestBid(auctionId);

  // Fallback: compute from full bids list if needed
  if (!highest) {
    const bids = await listBidsByAuction(auctionId);
    if (bids.length) {
      bids.sort((b1, b2) => Number(b2.amount) - Number(b1.amount) || Date.parse(b2.created_at) - Date.parse(b1.created_at));
      highest = bids[0];
      console.warn("[invoice] highest not found via primary path; using fallback:", highest);
    }
  }

  if (!highest) throw new Error("No highest bid to invoice");

  const latest = await latestDecision(auctionId);
  const finalPrice =
    latest && latest.type === "counter_accepted" && Number.isFinite(Number(latest.price))
      ? Number(latest.price)
      : Number(highest.amount);

  const seller = await findById(a.seller_id);
  const winner = await findById(highest.bidder_id);

  const { path: p, url } = await generateInvoicePDF({
    auction: a,
    winner: { id: winner?.id, handle: winner?.handle, email: winner?.email },
    seller: { id: seller?.id, handle: seller?.handle, email: seller?.email },
    price: finalPrice
  });

  console.log(`[invoice] generated for auction ${auctionId} → ${url}`);
  io.to(roomName(auctionId)).emit("invoice_ready", { auctionId, url });
  return { created: true, path: p };
}

// ---------------- HTTP API ---------------------

app.get("/health", (_req, res) =>
  res.status(200).json({ ok: true, service: "auction-backend", time: new Date().toISOString() })
);

// --- ADMIN (demo) ---
app.get("/admin/auctions", async (_req, res) => {
  const list = await listAuctions();
  res.json({ ok: true, auctions: list });
});

// Force-close an auction (demo control)
app.post("/admin/auctions/:id/close", async (req, res) => {
  const a = await getAuction(req.params.id);
  if (!a) return res.status(404).json({ ok:false, error:"Auction not found" });
  await closeAuction(a.id);
  await emitAuctionState(a.id);
  res.json({ ok:true });
});

app.get("/users", async (_req, res) => {
  const users = (await listUsers()).map((u) => ({ id: u.id, handle: u.handle }));
  res.json({ ok: true, users });
});

app.post("/auth/login", async (req, res) => {
  try {
    const handle = String(req.body?.handle ?? "").trim();
    const pin = String(req.body?.pin ?? "").trim();
    const user = await checkLogin(handle, pin);
    if (!user) return res.status(401).json({ ok: false, error: "Invalid handle or PIN" });
    const token = signToken(user, JWT_SECRET);
    res.json({ ok: true, token, id: user.id, handle: user.handle });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Login failed" });
  }
});

app.get("/me", requireAuth, (req, res) => res.json({ ok: true, user: req.user }));

// Profile: email + pin
app.put("/me/email", requireAuth, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    if (!email || !email.includes("@")) return res.status(400).json({ ok:false, error:"Valid email required" });
    const out = await updateEmail(req.user.id, email);
    res.json({ ok:true, user: out });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message || "Failed to update email" });
  }
});

app.put("/me/pin", requireAuth, async (req, res) => {
  try {
    const pin = String(req.body?.pin || "").trim();
    const out = await setPin(req.user.id, pin);
    res.json({ ok:true, user: out });
  } catch (e) {
    res.status(400).json({ ok:false, error: e.message || "Failed to update PIN" });
  }
});

// Create auction
app.post("/auctions", requireAuth, async (req, res) => {
  try {
    const created = await createAuction({
      ...(req.body || {}),
      seller_id: req.user.id,
      seller_handle: req.user.handle
    });
    res.status(201).json({ ok: true, auction: created });
    emitAuctionState(created.id);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || "Failed to create auction" });
  }
});

// List / fetch auctions
app.get("/auctions", async (_req, res) => res.json({ ok: true, auctions: await listAuctions() }));

app.get("/auctions/:id", async (req, res) => {
  const a = await getAuction(req.params.id);
  if (!a) return res.status(404).json({ ok: false, error: "Auction not found" });
  res.json({ ok: true, auction: a });
});

// Next minimum bid
app.get("/auctions/:id/next-min", async (req, res) => {
  const a = await getAuction(req.params.id);
  if (!a) return res.status(404).json({ ok: false, error: "Auction not found" });
  const min = await nextMinBid(a);
  res.json({ ok: true, nextMin: min });
});

// Bids
app.get("/auctions/:id/bids", async (req, res) => {
  const a = await getAuction(req.params.id);
  if (!a) return res.status(404).json({ ok: false, error: "Auction not found" });
  res.json({ ok: true, bids: await listBidsByAuction(a.id) });
});

app.get("/auctions/:id/highest", async (req, res) => {
  const a = await getAuction(req.params.id);
  if (!a) return res.status(404).json({ ok: false, error: "Auction not found" });
  res.json({ ok: true, highest: await getHighestBid(a.id) });
});

app.post("/bids", requireAuth, async (req, res) => {
  try {
    const { auction_id, amount } = req.body || {};
    const a = await getAuction(String(auction_id || ""));
    if (!a) return res.status(404).json({ ok: false, error: "Auction not found" });

    const previous = await getHighestBid(a.id);
    const bid = await placeBid({
      auction: a,
      bidder_id: req.user.id,
      bidder_handle: req.user.handle,
      amount
    });

    console.log(`[bids] HTTP: auction=${a.id} bidder=${req.user.id} amount=${amount}`);
    const room = roomName(a.id);
    io.to(room).emit("new_bid", { auctionId: a.id, bid });
    if (previous && previous.bidder_id !== bid.bidder_id) {
      io.to(room).emit("outbid", { auctionId: a.id, previous, current: bid });
    }
    emitAuctionState(a.id);

    res.status(201).json({ ok: true, bid });
  } catch (e) {
    res.status(e.code === "BAD_INPUT" ? 400 : e.code === "FORBIDDEN" ? 403 : 500)
       .json({ ok: false, error: e.message || "Failed to place bid" });
  }
});

// Decisions
function ensureSellerDecisionAllowed(a, user) {
  if (!a) { const e = new Error("Auction not found"); e.status = 404; throw e; }
  if (a.seller_id !== user.id) { const e = new Error("Only the seller can decide"); e.status = 403; throw e; }
  const st = computeStatus(a);
  if (st === "live" || st === "scheduled") { const e = new Error("You can decide only after auction ends"); e.status = 400; throw e; }
  if (st === "closed") { const e = new Error("Auction already closed"); e.status = 400; throw e; }
}

app.get("/auctions/:id/decision", async (req, res) => {
  const a = await getAuction(req.params.id);
  if (!a) return res.status(404).json({ ok: false, error: "Auction not found" });
  res.json({ ok: true, latest: await latestDecision(a.id), history: await listDecisions(a.id) });
});

app.post("/auctions/:id/decision", requireAuth, async (req, res) => {
  const a = await getAuction(req.params.id);
  try {
    ensureSellerDecisionAllowed(a, req.user);
    const { action, price } = req.body || {};
    if (!["accept", "reject", "counter"].includes(action)) {
      return res.status(400).json({ ok: false, error: "Invalid action" });
    }

    let decision;
    if (action === "accept") {
      decision = await addDecision({ auction_id: a.id, type: "accept", by_user_id: req.user.id, by_handle: req.user.handle });
      await closeAuction(a.id);
      io.to(roomName(a.id)).emit("seller_decision", { auctionId: a.id, decision });
      await emitAuctionState(a.id);
      await maybeGenerateInvoice(a.id);

      // sale-confirmation email (accept)
      try {
        const highest = await getHighestBid(a.id);
        const seller = await findById(a.seller_id);
        const buyer = highest ? await findById(highest.bidder_id) : null;
        if (buyer?.email && seller?.email && FROM_EMAIL) {
          const subject = `Sale confirmed — ${a.item_name}`;
          const text = `Sale confirmed for auction "${a.item_name}" at ₹${highest.amount}.
Seller: ${seller.handle} <${seller.email}>
Buyer: ${buyer.handle} <${buyer.email}>`;
          await Promise.all([
            sendPlainEmail({ to: buyer.email, from: FROM_EMAIL, replyTo: seller.email, subject, text }),
            sendPlainEmail({ to: seller.email, from: FROM_EMAIL, replyTo: buyer.email, subject, text }),
          ]);
          console.log("[mail] ✅ sale-confirmation sent (accept)");
        } else {
          console.log("[mail] (accept) skipped sale-confirmation: missing emails or FROM_EMAIL");
        }
      } catch (e) {
        console.warn("[mail] ❌ sale-confirmation failed (accept)", e.message);
      }

      return res.json({ ok: true, decision });
    }

    if (action === "reject") {
      decision = await addDecision({ auction_id: a.id, type: "reject", by_user_id: req.user.id, by_handle: req.user.handle });
      await closeAuction(a.id);
      io.to(roomName(a.id)).emit("seller_decision", { auctionId: a.id, decision });
      await emitAuctionState(a.id);
      return res.json({ ok: true, decision });
    }

    // counter
    const highest = await getHighestBid(a.id);
    if (!highest) return res.status(400).json({ ok: false, error: "No highest bidder to counter" });
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return res.status(400).json({ ok: false, error: "Counter price must be a positive number" });

    decision = await addDecision({ auction_id: a.id, type: "counter", price: p, by_user_id: req.user.id, by_handle: req.user.handle });
    io.to(roomName(a.id)).emit("counter_offer", {
      auctionId: a.id,
      price: p,
      to_bidder_id: Number(highest.bidder_id),
      to_bidder_handle: highest.bidder_handle
    });
    console.log(`[decision] counter → price=${p} auction=${a.id}`);
    return res.json({ ok: true, decision });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message || "Failed to make decision" });
  }
});

app.post("/auctions/:id/counter/ack", requireAuth, async (req, res) => {
  const a = await getAuction(req.params.id);
  if (!a) return res.status(404).json({ ok: false, error: "Auction not found" });
  const highest = await getHighestBid(a.id);
  if (!highest) return res.status(400).json({ ok: false, error: "No highest bid to respond to" });
  if (Number(highest.bidder_id) !== req.user.id) return res.status(403).json({ ok: false, error: "Only the highest bidder can respond" });

  const { accept, price } = req.body || {};
  let decision;
  if (accept) {
    decision = await addDecision({ auction_id: a.id, type: "counter_accepted", price: Number(price), by_user_id: req.user.id, by_handle: req.user.handle });
    await closeAuction(a.id);
    io.to(roomName(a.id)).emit("seller_decision", { auctionId: a.id, decision });
    await emitAuctionState(a.id);
    await maybeGenerateInvoice(a.id);

    // sale-confirmation email (counter accepted)
    try {
      const seller = await findById(a.seller_id);
      const buyer = await findById(req.user.id);
      const final = Number(price);
      if (buyer?.email && seller?.email && FROM_EMAIL) {
        const subject = `Sale confirmed — ${a.item_name}`;
        const text = `Counter accepted for auction "${a.item_name}" at ₹${final}.
Seller: ${seller.handle} <${seller.email}>
Buyer: ${buyer.handle} <${buyer.email}>`;
        await Promise.all([
          sendPlainEmail({ to: buyer.email, from: FROM_EMAIL, replyTo: seller.email, subject, text }),
          sendPlainEmail({ to: seller.email, from: FROM_EMAIL, replyTo: buyer.email, subject, text }),
        ]);
        console.log("[mail] ✅ sale-confirmation sent (counter accepted)");
      } else {
        console.log("[mail] (counter) skipped sale-confirmation: missing emails or FROM_EMAIL");
      }
    } catch (e) {
      console.warn("[mail] ❌ sale-confirmation failed (counter)", e.message);
    }

    return res.json({ ok: true, decision });
  } else {
    decision = await addDecision({ auction_id: a.id, type: "counter_rejected", by_user_id: req.user.id, by_handle: req.user.handle });
    await closeAuction(a.id);
    io.to(roomName(a.id)).emit("seller_decision", { auctionId: a.id, decision });
    await emitAuctionState(a.id);
    return res.json({ ok: true, decision });
  }
});

// Invoices
app.get("/auctions/:id/invoice", async (req, res) => {
  const a = await getAuction(req.params.id);
  if (!a) return res.status(404).json({ ok: false, error: "Auction not found" });
  const p = invoiceFilePath(a.id);
  const exists = fs.existsSync(p);
  res.json({ ok: true, exists, url: exists ? invoiceUrlPath(a.id) : null });
});

app.post("/auctions/:id/invoice/email", requireAuth, async (req, res) => {
  const a = await getAuction(req.params.id);
  if (!a) return res.status(404).json({ ok: false, error: "Auction not found" });
  if (a.seller_id !== req.user.id) return res.status(403).json({ ok: false, error: "Only the seller can send invoice" });

  const { created, path: pdfPath } = await maybeGenerateInvoice(a.id);

  const highest = await getHighestBid(a.id);
  const seller = await findById(a.seller_id);
  const buyer = highest ? await findById(highest.bidder_id) : null;
  if (!buyer?.email) return res.status(400).json({ ok: false, error: "Winner has no email set" });
  if (!seller?.email) return res.status(400).json({ ok: false, error: "Seller has no email set" });

  try {
    const subject = `Invoice for Auction ${a.id} — ${a.item_name}`;
    const text = `Please find attached the invoice for auction "${a.item_name}".`;

    console.log(`[mail] preparing to send invoice: buyer=${buyer.email}, seller=${seller.email}, file=${pdfPath}`);
    await sendInvoiceEmail({ to: buyer.email, from: FROM_EMAIL, replyTo: seller.email, subject, text, attachmentPath: pdfPath });
    await sendInvoiceEmail({ to: seller.email, from: FROM_EMAIL, replyTo: buyer.email, subject, text, attachmentPath: pdfPath });
    console.log(`[mail] ✅ invoice emailed to buyer and seller for auction ${a.id}`);

    res.json({ ok: true, emailed: true, created });
  } catch (e) {
    console.error("[mail] ❌ failed to send (route)", e?.message || e);
    if (e.code === "NO_SENDGRID") {
      return res.status(400).json({ ok: false, error: "SENDGRID_API_KEY not set. Set it and retry." });
    }
    res.status(500).json({ ok: false, error: e.message || "Failed to send email" });
  }
});

// ------- debug helpers -------
app.get("/debug/email", (_req, res) => {
  res.json({
    ok: true,
    from_email: process.env.FROM_EMAIL || null,
    sandbox: process.env.SENDGRID_SANDBOX === "1",
    has_key: !!process.env.SENDGRID_API_KEY
  });
});

app.get("/debug/auction/:id", async (req, res) => {
  try {
    const a = await getAuction(req.params.id);
    if (!a) return res.status(404).json({ ok:false, error:"not found" });
    const bids = await listBidsByAuction(a.id);
    const highest = await getHighestBid(a.id);
    res.json({
      ok: true,
      auction: { id: a.id, status: a.status, go_live_at: a.go_live_at, duration_seconds: a.duration_seconds },
      metrics: { bidsCount: bids.length, hasHighest: !!highest },
      highest,
      sample: bids.slice(0, 3)
    });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message || String(e) });
  }
});

// ---------------- Socket.IO --------------------
io.on("connection", (socket) => {
  console.log("[socket] client connected", socket.id);

  socket.on("join_auction", async ({ auctionId }) => {
    if (!auctionId) return;
    socket.join(roomName(String(auctionId)));
    console.log(`[socket] ${socket.id} joined ${roomName(auctionId)}`);
    await emitAuctionState(String(auctionId));
  });

  socket.on("place_bid", async ({ auctionId, amount, bidder_id, bidder_handle }) => {
    try {
      const a = await getAuction(String(auctionId || ""));
      if (!a) return socket.emit("bid_error", { error: "Auction not found" });

      const previous = await getHighestBid(a.id);
      const bid = await placeBid({ auction: a, bidder_id, bidder_handle, amount });

      console.log(`[bids] WS: auction=${a.id} bidder=${bidder_id} amount=${amount}`);
      io.to(roomName(a.id)).emit("new_bid", { auctionId: a.id, bid });
      if (previous && previous.bidder_id !== bid.bidder_id) {
        io.to(roomName(a.id)).emit("outbid", { auctionId: a.id, previous, current: bid });
      }
      await emitAuctionState(a.id);
    } catch (e) {
      socket.emit("bid_error", { error: e.message || "Bid failed" });
    }
  });

  socket.on("disconnect", () => {
    console.log("[socket] client disconnected", socket.id);
  });
});

// ------ status watcher (emits changes) -------
const lastStatusById = new Map();
setInterval(async () => {
  const arr = await listAuctions();
  for (const a of arr) {
    const prev = lastStatusById.get(a.id);
    if (prev !== a.status) {
      lastStatusById.set(a.id, a.status);
      console.log(`[status] ${a.id}: ${prev ?? "?"} → ${a.status}`);
      await emitAuctionState(a.id);
      if (a.status === "ended") {
        const finalHighest = await getHighestBid(a.id);
        io.to(roomName(a.id)).emit("auction_ended", {
          auctionId: a.id,
          finalHighest: finalHighest
            ? { amount: Number(finalHighest.amount), bidder_handle: finalHighest.bidder_handle, bidder_id: Number(finalHighest.bidder_id) }
            : null
        });
      }
    }
  }
}, 1000);

// --------------- static & start ---------------
const publicDir = path.join(__dirname, "../public");
app.use(express.static(publicDir));
app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

server.listen(PORT, () => console.log(`✅ API + WS listening on http://localhost:${PORT}`));
