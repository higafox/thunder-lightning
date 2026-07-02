import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        textAlign: "center",
        padding: 24,
      }}
    >
      <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20, color: "var(--dim)" }}>
        That thread doesn&apos;t exist.
      </div>
      <Link href="/" style={{ fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--active)" }}>
        Back to the player
      </Link>
    </div>
  );
}
