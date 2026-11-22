import React from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * DocumentQrBadge — Print-ready QR code badge positioned in the top-left A4 header area,
 * with crisp 84x84 SVG dimensions, white quiet-zone padding, and level="M" error correction
 * for instant mobile camera decoding.
 */
export default function DocumentQrBadge({ payload = "", referenceCode = "", size = 84 }) {
  const safePayload =
    String(payload || "").trim() ||
    "وثيقة إدارية رسمية - المديرية الجهوية للأملاك الوطنية بالشلف";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        width: "136px",
        minWidth: "126px",
        direction: "ltr",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "4px",
          borderRadius: "2px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <QRCodeSVG
          value={safePayload}
          size={size}
          level="M"
          marginSize={1}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      {referenceCode && (
        <div
          dir="ltr"
          style={{
            marginTop: "3px",
            fontSize: "7.5pt",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontWeight: "600",
            letterSpacing: "-0.3px",
            whiteSpace: "nowrap",
            overflow: "visible",
            display: "block",
            textAlign: "center",
            color: "#111827",
            direction: "ltr",
          }}
        >
          {referenceCode}
        </div>
      )}
    </div>
  );
}
