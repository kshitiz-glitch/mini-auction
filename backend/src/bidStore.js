import { Bid } from "./models.js";
import { getAuction } from "./auctionStore.js";
import { cache } from "./redis.js";

// derive Redis key
const rkey = (auctionId) => `auction:${auctionId}:highest`;

export async function listBidsByAuction(auctionId) {
  const rows = await Bid.findAll({
    where: { auction_id: auctionId },
    order: [["created_at", "DESC"]]
  });
  return rows.map(r => r.toJSON());
}

export async function getHighestBid(auctionId) {
  // try fast path from Redis
  const cached = await cache.get(rkey(auctionId));
  if (cached) {
    const [amount, bidder_id, bidder_handle] = cached.split("|");
    return { auction_id: auctionId, amount: Number(amount), bidder_id: Number(bidder_id), bidder_handle };
  }
  // fallback – query DB
  const row = await Bid.findOne({
    where: { auction_id: auctionId },
    order: [["amount", "DESC"], ["created_at", "DESC"]]
  });
  return row ? row.toJSON() : null;
}

export async function nextMinBid(auction) {
  const highest = await getHighestBid(auction.id);
  if (!highest) return Number(auction.start_price);
  return Number(highest.amount) + Number(auction.bid_increment);
}

export async function placeBid({ auction, bidder_id, bidder_handle, amount }) {
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) {
    const e = new Error("Amount must be positive"); e.code = "BAD_INPUT"; throw e;
  }

  // Guard: time/status
  const status = auction.status;
  if (status !== "live") { const e = new Error("Auction not live"); e.code = "BAD_INPUT"; throw e; }

  // Guard: min increment
  const min = await nextMinBid(auction);
  if (a < min) { const e = new Error(`Bid must be ≥ ${min}`); e.code = "BAD_INPUT"; throw e; }

  // Guard: seller cannot bid
  if (Number(auction.seller_id) === Number(bidder_id)) {
    const e = new Error("Seller cannot bid on own auction"); e.code = "FORBIDDEN"; throw e;
  }

  const bid = await Bid.create({
    auction_id: auction.id,
    amount: a,
    bidder_id,
    bidder_handle
  });

  // Update Redis cache for fastest next checks
  await cache.set(rkey(auction.id), `${a}|${bidder_id}|${bidder_handle}`);

  return bid.toJSON();
}
