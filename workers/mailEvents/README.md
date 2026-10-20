# MailEvents Worker (DECOMMISSIONED)

> [!NOTE]
> **Status**: Decommissioned on branch `alive`.
> **Successor**: Direct in-process transactional email dispatch:
> - **adminBackend (Django)**: `EmailService` utilizing Django's configured SMTP backend (`django.core.mail.backends.smtp.EmailBackend`) with async threaded dispatch.
> - **coreEngine (Spring Boot)**: `MailUtil` utilizing Spring Mail's `JavaMailSender` with async virtual threads and password whitespace sanitization.
> **Removal**: The standalone Bun/NodeMailer queue consumer listening on Redis `mail_queue` and polling loops have been retired.

This worker directory is retained for historical archive and reference only. It is not started or used in production on the `alive` branch.
