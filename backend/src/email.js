import nodemailer from 'nodemailer'
import { HttpError } from './tasks/validation.js'

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character])

function emailShell({ eyebrow, title, body, footer = 'Tracklap · Keep work moving forward.' }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f2f5fa;font-family:Arial,Helvetica,sans-serif;color:#243149">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f5fa;padding:36px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4eaf3;border-radius:16px;overflow:hidden;box-shadow:0 12px 36px rgba(24,45,78,.08)">
  <tr><td style="padding:25px 32px;background:#111c2e;color:#fff"><table role="presentation" width="100%"><tr><td><span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;border-radius:9px;background:#3478e5;vertical-align:middle"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="22" viewBox="0 0 44 48" fill="none"><g fill="#fff"><path opacity=".5" d="m36.3068 11.4224c-.4322-.4323-.8644-.8645-1.2967-1.2967-1.2966-1.38311-2.6797-2.76621-4.4086-3.63065-1.9882-1.03733-4.1493-.778-6.3104-.778-3.2849 0-11.4971 0-16.33798 0l3.28488 4.40865h19.6228c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.5186.0864.6051 0z"/><path opacity=".7" d="m39.9368 18.511c-.4322-.4322-.8645-.8645-1.2967-1.2967-1.2967-1.3831-2.6797-2.7662-4.4086-3.6306-1.9882-1.0374-4.1494-.778-6.3105-.778-2.8526 0-9.6817 0-14.5226 0l3.2849 4.4086h17.8939c1.8154 0 3.3714.3458 4.8409 1.2967.1729.0864.3458.0864.5187 0z"/><path d="m44 25.4263c-.4322-.4323-.8645-.8645-1.2967-1.2967-1.2966-1.3831-2.6797-2.7662-4.4086-3.6307-1.9882-1.0373-4.1493-.7779-6.3104-.7779-2.6798 0-8.558 0-13.3124 0l3.2848 4.4086h16.5973c1.8153 0 3.3713.3458 4.8409 1.2967.2593.0864.4322.1729.6051 0z"/><path opacity=".5" d="m7.60742 37.0961c.43222.4322.86444.8644 1.29666 1.2966 1.29662 1.3831 2.67972 2.7662 4.40862 3.6307 1.9882 1.0373 4.1493.778 6.3104.778h16.338l-3.2849-4.4087c-5.9646 0-15.3006 0-19.6228 0-1.8153 0-3.37132-.3457-4.84087-1.2966-.25933-.0865-.43222-.0865-.60511 0z"/><path opacity=".7" d="m3.97656 30.0079c.43222.4323.86444.8645 1.29666 1.2967 1.29667 1.3831 2.67976 2.7662 4.40864 3.6307 1.98824 1.0373 4.14934.778 6.31044.778h14.5226l-3.2849-4.4087c-5.8782 0-13.9175 0-17.89391 0-1.81532 0-3.37132-.3458-4.84087-1.2967-.17289-.0864-.34577-.0864-.51866 0z"/><path d="m0 23.0058c.43222.4322.864441.8644 1.29666 1.2966 1.29666 1.3831 2.67977 2.7662 4.40866 3.6307 1.98821 1.0373 4.1493.778 6.31038.778h13.3124l-3.2849-4.4087c-5.7053 0-12.96657 0-16.59722 0-1.81533 0-3.37132-.3458-4.840874-1.2966-.259332-.0865-.432218-.0865-.605106 0z"/></g></svg></span><span style="margin-left:10px;font-size:15px;font-weight:bold;letter-spacing:2px;vertical-align:middle">TRACK<span style="color:#a9c5ff">LAP</span></span></td></tr></table></td></tr>
  <tr><td style="padding:34px 32px 28px"><p style="margin:0 0 9px;color:#4b7fe0;font-size:10px;font-weight:bold;letter-spacing:1.8px;text-transform:uppercase">${eyebrow}</p><h1 style="margin:0 0 13px;color:#202d43;font-size:25px;line-height:1.25">${title}</h1>${body}</td></tr>
  <tr><td style="padding:18px 32px;border-top:1px solid #edf0f5;color:#8a95a6;font-size:11px;line-height:1.6">${footer}<br/>If you weren’t expecting this email, you can safely ignore it.</td></tr>
  </table><p style="margin:16px 0 0;color:#9aa4b2;font-size:10px">© Tracklap</p></td></tr></table></body></html>`
}

export function verificationEmail(code) {
  return {
    text:`Your Tracklap verification code is ${code}. It expires in 10 minutes. If you didn’t request it, ignore this email.`,
    html:emailShell({ eyebrow:'Email verification', title:'Your sign-up code', body:`<p style="margin:0 0 22px;color:#657187;font-size:14px;line-height:1.7">Enter this one-time code in Tracklap to verify your email address and continue creating your account.</p><div style="padding:17px 14px;border:1px solid #dce6f7;border-radius:12px;background:#f5f8fe;text-align:center"><span style="color:#245fbd;font-size:34px;font-weight:bold;letter-spacing:10px">${escapeHtml(code)}</span></div><p style="margin:16px 0 0;color:#7e899a;font-size:12px">This code expires in <strong>10 minutes</strong>.</p>`}),
  }
}

export function passwordResetEmail(code) {
  return {
    text:`Your Tracklap password reset code is ${code}. It expires in 10 minutes. If you didn’t request it, ignore this email.`,
    html:emailShell({eyebrow:'Account security',title:'Reset your password',body:`<p style="margin:0 0 22px;color:#657187;font-size:14px;line-height:1.7">Enter this one-time code in Tracklap to choose a new password.</p><div style="padding:17px 14px;border:1px solid #dce6f7;border-radius:12px;background:#f5f8fe;text-align:center"><span style="color:#245fbd;font-size:34px;font-weight:bold;letter-spacing:10px">${escapeHtml(code)}</span></div><p style="margin:16px 0 0;color:#7e899a;font-size:12px">This code expires in <strong>10 minutes</strong>. If you did not request a reset, ignore this message.</p>`}),
  }
}

export function teamInvitationEmail(teamName, url) {
  const safeName = escapeHtml(teamName)
  return {
    text:`You were invited to join ${teamName} on Tracklap. Sign in or create an account with this email, then accept here: ${url}. The invitation expires in 7 days.`,
    html:emailShell({ eyebrow:'Team invitation', title:'You’re invited to collaborate', body:`<p style="margin:0 0 22px;color:#657187;font-size:14px;line-height:1.7">You’ve been invited to join <strong style="color:#27364d">${safeName}</strong> on Tracklap. Accept the invitation to work with your team and follow shared progress.</p><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:9px;background:#3478e5"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;border:1px solid #3478e5;border-radius:9px;color:#fff;font-size:13px;font-weight:bold;text-decoration:none">Accept invitation&nbsp; →</a></td></tr></table><p style="margin:19px 0 0;color:#7e899a;font-size:12px;line-height:1.6">Sign in or create an account using the email address this invitation was sent to. The invitation expires in <strong>7 days</strong>.</p>`}),
  }
}

let smtpTransporter = null

function getSmtpTransporter() {
  const user = process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER
  const pass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS
  if (!user || !pass) return null

  if (!smtpTransporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = Number(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587))
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465

    smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    })
  }

  return { transporter: smtpTransporter, user }
}

export async function sendEmail({ to, subject, html, text }) {
  const smtp = getSmtpTransporter()

  if (smtp) {
    try {
      const from = process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('resend.dev')
        ? process.env.EMAIL_FROM
        : `Tracklap <${smtp.user}>`

      await smtp.transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
      })
      return
    } catch (error) {
      console.error('SMTP email sending failed:', error)
      throw new HttpError(502, 'Could not send the email. Please verify SMTP settings and try again.')
    }
  }

  // Fallback to Resend if RESEND_API_KEY is configured
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (apiKey && from) {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    })
    if (!result.ok) {
      const detail = await result.text()
      console.error('Email provider rejected a message:', result.status, detail)
      throw new HttpError(502, 'Could not send the email. Please try again later.')
    }
    return
  }

  throw new HttpError(
    503,
    'Email delivery is not configured. Set EMAIL_USER and EMAIL_PASS (or RESEND_API_KEY and EMAIL_FROM).'
  )
}
