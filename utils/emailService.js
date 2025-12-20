const nodemailer = require('nodemailer');

// Load Email Config - Production ready with environment variables
const getEmailConfig = () => {
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || '587'), // Use env variable, default to 587
    secure: process.env.SMTP_SECURE === 'true' || false, // Convert string to boolean
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    fromName: process.env.EMAIL_FROM_NAME || "Garbet",
  };
};

let transporter = null;

// Create and cache transporter (singleton)
const getTransporter = () => {
  const config = getEmailConfig();

  if (!config.auth.user || !config.auth.pass) {
    console.warn("⚠️ SMTP credentials missing!");
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, 
      auth: config.auth,
      // ADD THESE LINES BELOW:
      connectionTimeout: 5000, // 5 seconds
      greetingTimeout: 5000,
      tls: {
        rejectUnauthorized: false // Helps avoid errors on local dev machines
      }
    });
  }

  return transporter;
};

// -----------------------------------------------------------------------------
// Send Email
// -----------------------------------------------------------------------------
const sendEmail = async (to, subject, html, text = null) => {
  try {
    const config = getEmailConfig();
    const emailTransporter = getTransporter();

    if (!emailTransporter) return false;

    const mailOptions = {
      from: `"${config.fromName}" <${config.from}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ""), 
      html,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log("📧 Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ Email Error:", error.message);
    return false;
  }
};

// -----------------------------------------------------------------------------
// Email Templates
// -----------------------------------------------------------------------------
exports.sendWelcomeEmail = async (user) => {
  return sendEmail(
    user.email,
    "Hoş Geldiniz - Garbet",
    `
      <div style="font-family:Arial;max-width:600px;margin:auto">
        <h2 style="color:#f1c84b;">Hoş Geldiniz ${user.firstName}!</h2>
        <p>Garbet'e katıldığınız için teşekkür ederiz.</p>
        <p>Kullanıcı adınız: <strong>${user.username}</strong></p>
        <p>İyi eğlenceler!</p>
        <hr><small>Bu e-posta otomatik gönderilmiştir.</small>
      </div>
    `
  );
};

exports.sendDepositApprovedEmail = async (user, amount) => {
  return sendEmail(
    user.email,
    "Yatırım Onaylandı - Garbet",
    `
      <div style="font-family:Arial;max-width:600px;margin:auto">
        <h2 style="color:#10b981">Yatırım Onaylandı</h2>
        <p>₺${amount.toFixed(2)} yatırımı onaylandı.</p>
        <p>Yeni bakiyeniz: ₺${(user.balance + amount).toFixed(2)}</p>
        <hr><small>Bu e-posta otomatik gönderilmiştir.</small>
      </div>
    `
  );
};

exports.sendWithdrawalApprovedEmail = async (user, amount, iban) => {
  return sendEmail(
    user.email,
    "Çekim Onaylandı - Garbet",
    `
      <div style="font-family:Arial;max-width:600px;margin:auto">
        <h2 style="color:#10b981;">Çekim Onaylandı</h2>
        <p>Tutar: ₺${amount.toFixed(2)}</p>
        <p>IBAN: ${iban}</p>
        <p>Transfer 1-3 iş günü içinde hesabınıza geçecektir.</p>
        <hr><small>Bu e-posta otomatik gönderilmiştir.</small>
      </div>
    `
  );
};

exports.sendWithdrawalRejectedEmail = async (user, amount, reason) => {
  return sendEmail(
    user.email,
    "Çekim Reddedildi - Garbet",
    `
      <div style="font-family:Arial;max-width:600px;margin:auto">
        <h2 style="color:#ef4444;">Çekim Reddedildi</h2>
        <p>₺${amount.toFixed(2)} tutarındaki çekim talebiniz reddedildi.</p>
        ${reason ? `<p>Red Nedeni: ${reason}</p>` : ""}
        <hr><small>Bu e-posta otomatik gönderilmiştir.</small>
      </div>
    `
  );
};

exports.sendKYCApprovedEmail = async (user) => {
  return sendEmail(
    user.email,
    "KYC Onaylandı - Garbet",
    `
      <div style="font-family:Arial;max-width:600px;margin:auto">
        <h2 style="color:#10b981;">KYC Doğrulandı</h2>
        <p>Belgeleriniz incelendi ve hesabınız aktifleştirildi.</p>
        <hr><small>Bu e-posta otomatik gönderilmiştir.</small>
      </div>
    `
  );
};

exports.sendPasswordResetEmail = async (user, token) => {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  return sendEmail(
    user.email,
    "Şifre Sıfırlama - Garbet",
    `
      <div style="font-family:Arial;max-width:600px;margin:auto">
        <h2 style="color:#f1c84b">Şifre Sıfırlama</h2>
        <p>Aşağıdaki bağlantıya tıklayın:</p>
        <a href="${url}" style="background:#f1c84b;padding:10px 20px;border-radius:5px;text-decoration:none;color:black;">
          Şifreyi Sıfırla
        </a>
        <hr><small>Bağlantı 1 saat geçerlidir.</small>
      </div>
    `
  );
};

exports.sendSupportResponseEmail = async (user, ticket, response) => {
  return sendEmail(
    user.email,
    `Destek Talebi Yanıtı - ${ticket.subject}`,
    `
      <div style="font-family:Arial;max-width:600px;margin:auto">
        <h2 style="color:#f1c84b;">Destek Yanıtı</h2>
        <p><strong>Konu:</strong> ${ticket.subject}</p>
        <p><strong>Yanıt:</strong> ${response}</p>
        <hr><small>Bu e-posta otomatik gönderilmiştir.</small>
      </div>
    `
  );
};

exports.sendBonusUnlockEmail = async (user, amount) => {
  return sendEmail(
    user.email,
    "Bonus Açıldı - Garbet",
    `
      <div style="font-family:Arial;max-width:600px;margin:auto">
        <h2 style="color:#10b981">Bonus Açıldı</h2>
        <p>₺${amount.toFixed(2)} bonusunuz açıldı ve bakiyenize eklendi.</p>
        <hr><small>Bu e-posta otomatik gönderilmiştir.</small>
      </div>
    `
  );
};

// Export sendEmail as well
module.exports.sendEmail = sendEmail;
