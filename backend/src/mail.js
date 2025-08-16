import sgMail from "@sendgrid/mail";
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendInvoiceEmail(to, subject, text, pdfBuffer) {
  try {
    console.log(`[mail] preparing to send email to ${to} subject="${subject}"`);

    const msg = {
      to,
      from: process.env.FROM_EMAIL,
      subject,
      text,
      attachments: [
        {
          content: pdfBuffer.toString("base64"),
          filename: "invoice.pdf",
          type: "application/pdf",
          disposition: "attachment"
        }
      ]
    };

    await sgMail.send(msg);
    console.log(`[mail] ✅ email successfully sent to ${to}`);
    return { ok: true };
  } catch (err) {
    console.error("[mail] ❌ failed to send email", err);
    return { ok: false, error: err.message };
  }
}
