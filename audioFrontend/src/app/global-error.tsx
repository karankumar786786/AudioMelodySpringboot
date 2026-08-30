"use client";

/**
 * global-error.tsx catches errors that occur in the root layout itself.
 * It must provide its own <html> and <body> tags since the layout may have crashed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          backgroundColor: "#000000",
          color: "#ffffff",
          fontFamily:
            'var(--font-spotify), "CircularSp", "Circular", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            maxWidth: 440,
            padding: "0 24px",
          }}
        >
          {/* Icon in #181818 container */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
              backgroundColor: "#181818",
              border: "1px solid #282828",
              color: "#ffffff",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d4d4d8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 9999,
              backgroundColor: "#181818",
              border: "1px solid #282828",
              fontSize: 12,
              fontFamily: "monospace",
              color: "#a1a1aa",
              marginBottom: 12,
            }}
          >
            Critical Error
          </span>

          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: "0 0 8px",
              color: "#ffffff",
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#a1a1aa",
              lineHeight: 1.6,
              margin: "0 0 32px",
            }}
          >
            The application encountered an unexpected error. Try refreshing the page to restart.
          </p>

          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 28px",
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 700,
              color: "#000000",
              backgroundColor: "#ffffff",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
