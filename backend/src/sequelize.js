// backend/src/sequelize.js
import { Sequelize } from "sequelize";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");

// Dev-friendly SSL settings: require TLS but don't reject self-signed chains.
// (Use proper CA verification in production.)
export const sequelize = new Sequelize(url, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // <-- fixes "self-signed certificate in certificate chain"
    },
  },
});
