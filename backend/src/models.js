// backend/src/models.js
import { DataTypes } from "sequelize";
import { sequelize } from "./sequelize.js";

export const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  handle: { type: DataTypes.STRING, unique: true, allowNull: false },
  pin_hash: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: true }
}, { tableName: "users", timestamps: true });

export const Auction = sequelize.define("Auction", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  item_name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  start_price: { type: DataTypes.DECIMAL(18,2), allowNull: false },
  bid_increment: { type: DataTypes.DECIMAL(18,2), allowNull: false },
  go_live_at: { type: DataTypes.DATE, allowNull: false },
  duration_seconds: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: "scheduled" },
  seller_id: { type: DataTypes.INTEGER, allowNull: false },
  seller_handle: { type: DataTypes.STRING, allowNull: false }
}, { tableName: "auctions", timestamps: true });

export const Bid = sequelize.define("Bid", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  auction_id: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.DECIMAL(18,2), allowNull: false },
  bidder_id: { type: DataTypes.INTEGER, allowNull: false },
  bidder_handle: { type: DataTypes.STRING, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { tableName: "bids", timestamps: false });

export const Decision = sequelize.define("Decision", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  auction_id: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false }, // accept|reject|counter|counter_accepted|counter_rejected
  price: { type: DataTypes.DECIMAL(18,2), allowNull: true },
  by_user_id: { type: DataTypes.INTEGER, allowNull: false },
  by_handle: { type: DataTypes.STRING, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { tableName: "decisions", timestamps: false });

// relationships
User.hasMany(Auction, { foreignKey: "seller_id", as: "auctions" });
Auction.belongsTo(User, { foreignKey: "seller_id", as: "seller" });

Auction.hasMany(Bid, { foreignKey: "auction_id", as: "bids" });
Bid.belongsTo(Auction, { foreignKey: "auction_id", as: "auction" });
User.hasMany(Bid, { foreignKey: "bidder_id", as: "bids" });
Bid.belongsTo(User, { foreignKey: "bidder_id", as: "bidder" });

Auction.hasMany(Decision, { foreignKey: "auction_id", as: "decisions" });
Decision.belongsTo(Auction, { foreignKey: "auction_id", as: "auction" });

export async function syncModels() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true }); // quick dev path; for prod use migrations
}
