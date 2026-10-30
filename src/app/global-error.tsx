"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", background: "#F7F3E3", color: "#1E1E1E", display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <main>
          <h1>LaGecto could not load</h1>
          <button onClick={reset} style={{ marginTop: 16, background: "#0B6E4F", color: "white", border: 0, padding: "10px 16px", borderRadius: 999 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
