import bcrypt from "bcryptjs";
import { User } from "./models.js";

export async function ensureSeedUsers() {
  const players = [
    { handle: "playerA", pin: "1111", email: "playerA@example.com" },
    { handle: "playerB", pin: "2222", email: "playerB@example.com" },
    { handle: "playerC", pin: "3333", email: "playerC@example.com" },
    { handle: "playerD", pin: "4444", email: "playerD@example.com" }
  ];
  for (const p of players) {
    const existing = await User.findOne({ where: { handle: p.handle } });
    if (!existing) {
      await User.create({
        handle: p.handle,
        pin_hash: await bcrypt.hash(p.pin, 10),
        email: p.email
      });
    }
  }
}

export async function listUsers() {
  const rows = await User.findAll({ attributes: ["id", "handle"] });
  return rows.map(r => r.toJSON());
}

export async function findById(id) {
  return await User.findByPk(id);
}

export async function checkLogin(handle, pin) {
  const u = await User.findOne({ where: { handle } });
  if (!u) return null;
  const ok = await bcrypt.compare(String(pin), u.pin_hash);
  if (!ok) return null;
  return u.toJSON();
}
export async function updateEmail(userId, email) {
  const u = await User.findByPk(userId);
  if (!u) throw new Error("User not found");
  u.email = String(email || "").trim();
  await u.save();
  return { id: u.id, handle: u.handle, email: u.email };
}

export async function setPin(userId, newPin) {
  const u = await User.findByPk(userId);
  if (!u) throw new Error("User not found");
  const pin = String(newPin || "").trim();
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits");
  u.pin_hash = await bcrypt.hash(pin, 10);
  await u.save();
  return { id: u.id, handle: u.handle };
}