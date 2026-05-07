import nodemailer, { type Transporter } from 'nodemailer'

let cached: Transporter | null = null

export function getMailer(): Transporter {
  if (cached) return cached
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER && {
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' },
    }),
  })
  return cached
}

export const MAIL_FROM = process.env.MAIL_FROM || 'shop@kooperative.de'
export const MAIL_OPERATOR = process.env.MAIL_OPERATOR || 'shop@kooperative.de'
