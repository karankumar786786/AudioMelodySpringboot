import logging
import threading
from typing import Optional
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


class EmailService:
    """
    Direct in-process transactional email delivery service.
    Replaces the retired background mailEvents queue worker.
    """

    @classmethod
    def _render_otp_html(cls, email: str, purpose: str, otp: str) -> str:
        """
        Renders a responsive, modern HTML template for OTP verification emails.
        """
        purpose_label = purpose.replace("_", " ").upper()
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>One Melody Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0d0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0c0d0e; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #141618; border: 1px solid #272a30; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #1f2228;">
              <div style="display: inline-flex; align-items: center; justify-content: center;">
                <span style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #10b981;">
                  One Melody
                </span>
              </div>
              <div style="margin-top: 8px;">
                <span style="display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25);">
                  {purpose_label}
                </span>
              </div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center;">
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                Your Verification Code
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                Use the single-use passcode below to complete your authentication request for <strong style="color: #f4f4f5;">{email}</strong>.
              </p>

              <!-- OTP Passcode Card -->
              <div style="background: linear-gradient(180deg, #181a1d 0%, #121416 100%); border: 1px solid #2e333d; border-radius: 12px; padding: 22px 16px; margin: 0 auto 28px auto; text-align: center;">
                <span style="font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #34d399; display: inline-block; text-shadow: 0 0 24px rgba(52, 211, 153, 0.35);">
                  {otp}
                </span>
              </div>

              <!-- Expiry Alert -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; text-align: left;">
                <tr>
                  <td style="font-size: 13px; color: #f59e0b; line-height: 1.5;">
                    ⏱ <strong>Valid for 10 minutes.</strong> Never share this verification code with anyone. One Melody support will never ask for your code.
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #71717a;">
                If you did not request this verification code, please ignore this email or review your account activity.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 28px 32px; text-align: center; border-top: 1px solid #1f2228; font-size: 11px; color: #52525b; line-height: 1.6;">
              © One Melody • High-Performance Streaming Platform<br>
              Direct transactional dispatch • Automated system notification
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    @classmethod
    def send_mail_direct(
        cls,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None,
    ) -> bool:
        """
        Sends an email synchronously via Django's configured SMTP backend.
        Returns True if successful, False otherwise (safely logged).
        """
        try:
            from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "One Melody <no-reply@onemelody.com>")
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=from_email,
                to=[to_email],
            )
            if html_content:
                msg.attach_alternative(html_content, "text/html")

            msg.send(fail_silently=False)
            logger.info("[EMAIL SERVICE] Direct email sent successfully to %s: %s", to_email, subject)
            return True
        except Exception as e:
            logger.error("[EMAIL SERVICE] Failed to send direct email to %s: %s", to_email, e, exc_info=True)
            return False

    @classmethod
    def send_otp_email(
        cls,
        to_email: str,
        purpose: str,
        otp: str,
        async_delivery: bool = True,
    ) -> bool:
        """
        Sends an OTP verification email directly to the recipient.
        Dispatches via background thread by default so API responses remain instant.
        """
        purpose_clean = purpose.replace("_", " ").title()
        subject = f"[One Melody] Verification Code - {purpose_clean}"

        text_content = (
            f"Hello,\n\n"
            f"Your One Melody verification code for {purpose_clean} is:\n\n"
            f"  {otp}\n\n"
            f"This code will expire in 10 minutes.\n"
            f"If you did not request this verification code, please disregard this message.\n\n"
            f"Best regards,\n"
            f"One Melody Team\n"
        )

        html_content = cls._render_otp_html(to_email, purpose, otp)

        def _worker():
            try:
                cls.send_mail_direct(
                    to_email=to_email,
                    subject=subject,
                    text_content=text_content,
                    html_content=html_content,
                )
            except Exception as worker_err:
                logger.error("[EMAIL SERVICE] Background worker exception for %s: %s", to_email, worker_err)

        if async_delivery:
            thread = threading.Thread(
                target=_worker,
                name=f"email-otp-{to_email}",
                daemon=True,
            )
            thread.start()
            return True
        else:
            return cls.send_mail_direct(
                to_email=to_email,
                subject=subject,
                text_content=text_content,
                html_content=html_content,
            )
