import { Auction } from "./models.js";

export function computeStatus(a) {
  const now = Date.now();
  const start = new Date(a.go_live_at).getTime();
  const end = start + a.duration_seconds * 1000;
  if (a.status === "closed") return "closed";
  if (now < start) return "scheduled";
  if (now >= start && now < end) return "live";
  return "ended";
}

export async function createAuction(data) {
  const row = await Auction.create(data);
  return row.toJSON();
}

export async function listAuctions() {
  const rows = await Auction.findAll({ order: [["createdAt", "DESC"]] });
  return rows.map(r => ({ ...r.toJSON(), status: computeStatus(r) }));
}

export async function getAuction(id) {
  const r = await Auction.findByPk(id);
  return r ? { ...r.toJSON(), status: computeStatus(r) } : null;
}

export async function closeAuction(id) {
  await Auction.update({ status: "closed" }, { where: { id } });
}
