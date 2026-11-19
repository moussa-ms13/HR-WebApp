import React from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * DocumentQrBadge — Print-ready QR code badge positioned in the top-left A4 header area,
 * mirroring the exact placement, size, and typography of leave certificates.
 */
export default function DocumentQrBadge({ payload = "", referenceCode = "", size = 64 }) {
  if (!payload && !referenceCode) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        width: "130px",
        minWidth: "120px",
        direction: "ltr",
      }}
    >
      {payload && (
        <QRCodeSVG
          value={payload}
          size={size}
          level="M"
          bgColor="#ffffff"
          fgColor="#000000"
        />
      )}
      {referenceCode && (
        <div
          dir="ltr"
          style={{
            marginTop: "4px",
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
