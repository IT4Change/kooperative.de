export default ({ env }: { env: any }) => ({
  email: {
    config: {
      provider: "@strapi/provider-email-nodemailer",
      providerOptions: {
        host: env("SMTP_HOST", "smtp.example.com"),
        port: env.int("SMTP_PORT", 587),
        auth: {
          user: env("SMTP_USER"),
          pass: env("SMTP_PASS"),
        },
      },
      settings: {
        defaultFrom: env("SMTP_DEFAULT_FROM", "noreply@kooperative.de"),
        defaultReplyTo: env("SMTP_DEFAULT_REPLY_TO", "info@kooperative.de"),
      },
    },
  },
});
