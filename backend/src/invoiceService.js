import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, "../public");
const INVOICE_DIR = path.join(PUBLIC_DIR, "invoices");

if (!fs.existsSync(INVOICE_DIR)) fs.mkdirSync(INVOICE_DIR, { recursive: true });

export function invoiceFilePath(auctionId) {
  return path.join(INVOICE_DIR, `${auctionId}.pdf`);
}

export function invoiceUrlPath(auctionId) {
  return `/invoices/${auctionId}.pdf`;
}

/**
 * Generate a very simple invoice PDF for an auction.
 * args: { auction, winner:{id,handle,email}, seller:{id,handle,email}, price:number }
 */
export async function generateInvoicePDF({ auction, winner, seller, price }) {
  const p = invoiceFilePath(auction.id);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = fs.createWriteStream(p);
  doc.pipe(stream);

  // Header
  doc.fontSize(20).text("Invoice", { align: "right" });
  doc.moveDown();
  doc.fontSize(12).text(`Auction ID: ${auction.id}`);
  doc.text(`Item: ${auction.item_name}`);
  if (auction.description) doc.text(`Description: ${auction.description}`);
  doc.moveDown();

  // Parties
  doc.fontSize(14).text("Seller");
  doc.fontSize(12).text(`${seller?.handle || "N/A"}  <${seller?.email || "no-email"}>`);
  doc.moveDown(0.5);
  doc.fontSize(14).text("Buyer");
  doc.fontSize(12).text(`${winner?.handle || "N/A"}  <${winner?.email || "no-email"}>`);
  doc.moveDown();

  // Price
  doc.fontSize(16).text(`Final Price: ₹${Number(price).toLocaleString("en-IN")}`);
  doc.moveDown(2);

  doc.fontSize(10).fillColor("#666")
     .text("This is a computer-generated invoice.", { align: "center" });

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return { path: p, url: invoiceUrlPath(auction.id) };
}

/**
 * Send invoice email with PDF attachment via SendGrid.
 */
export async function sendInvoiceEmail({ to, from, replyTo, subject, text, attachmentPath }) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) { const e = new Error("SENDGRID_API_KEY missing"); e.code = "NO_SENDGRID"; throw e; }

  const sgMail = (await import("@sendgrid/mail")).default;
  sgMail.setApiKey(key);

  const content = fs.readFileSync(attachmentPath).toString("base64");
  const msg = {
    to,
    from,
    subject,
    text,
    attachments: [
      {
        content,
        filename: path.basename(attachmentPath),
        type: "application/pdf",
        disposition: "attachment",
      },
    ],
  };
  try {
    const [resp] = await sgMail.send(msg);
    return resp?.statusCode >= 200 && resp?.statusCode < 300;
  } catch (err) {
    // Print the *exact* SendGrid error details
    const details = err?.response?.body?.errors || err?.response?.body || err?.message || err;
    console.error("[mail] ❌ send failed \n", JSON.stringify(details, null, 2));
    throw err;
  }
}

/**
 * Send a simple text email (no attachment). Used for "Sale confirmed".
 */
export async function sendPlainEmail({ to, from, subject, text, replyTo }) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) { const e = new Error("SENDGRID_API_KEY missing"); e.code = "NO_SENDGRID"; throw e; }

  const sgMail = (await import("@sendgrid/mail")).default;
  sgMail.setApiKey(key);

  const msg = { to, from, subject, text };
  if (replyTo) msg.replyTo = replyTo;

  const [resp] = await sgMail.send(msg);
  return resp?.statusCode >= 200 && resp?.statusCode < 300;
}
