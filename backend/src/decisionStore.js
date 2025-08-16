import { Decision } from "./models.js";

export async function addDecision({ auction_id, type, price, by_user_id, by_handle }) {
  const row = await Decision.create({ auction_id, type, price: price ?? null, by_user_id, by_handle });
  return row.toJSON();
}

export async function latestDecision(auction_id) {
  const row = await Decision.findOne({
    where: { auction_id }, order: [["created_at","DESC"]]
  });
  return row ? row.toJSON() : null;
}

export async function listDecisions(auction_id) {
  const rows = await Decision.findAll({
    where: { auction_id }, order: [["created_at","DESC"]]
  });
  return rows.map(r => r.toJSON());
}
