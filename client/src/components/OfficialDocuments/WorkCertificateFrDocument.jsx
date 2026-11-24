import React from "react";
import DocumentQrBadge from "./DocumentQrBadge";
import { generateOfficialRefCode } from "./officialDocumentUtils";
import {
  formatFrenchDateDMY,
  formatFrenchQualityPreposition,
  buildFrenchWorkCertificateQrPayload,
} from "./frenchDocumentHelpers";

export const WORK_CERT_FR_SIGNATORIES = {
  le_directeur: {
    id: "le_directeur",
    label: "LE DIRECTEUR, (الافتراضي)",
    signatureTitle: "LE DIRECTEUR,",
  },
  le_sous_directeur: {
    id: "le_sous_directeur",
    label: "LE SOUS-DIRECTEUR,",
    signatureTitle: "LE SOUS-DIRECTEUR,",
  },
};

/**
 * WorkCertificateFrDocument — Official Printable A4 French "ATTESTATION DE TRAVAIL"
 * 100% faithful replica of 1000114486.jpg (without bottom contact/address footer).
 */
export default function WorkCertificateFrDocument({
  employeeId,
  fullNameFr = "",
  gender = "ذكر",
  birthDate = "",
  birthPlaceFr = "Chlef",
  rankFr = "",
  directorateFr = "Direction REGIONALE DU DOMAINE de CHLEF",
  firstHireDate = "",
  includeHighPosition = false,
  highPositionFr = "",
  refNumber = "",
  year = new Date().getFullYear(),
  issueDate = "",
  signatoryKey = "le_directeur",
  interestedCopies = 1,
  archiveCopies = 1,
}) {
  const safeInterestedCopies = Math.max(1, parseInt(interestedCopies, 10) || 1);
  const safeArchiveCopies = Math.max(1, parseInt(archiveCopies, 10) || 1);
  const valGender = String(gender || "").trim().toLowerCase();
  const isFemale =
    valGender === "أنثى" ||
    valGender === "انثى" ||
    valGender === "female" ||
    valGender === "f";

  const signatory =
    WORK_CERT_FR_SIGNATORIES[signatoryKey] ||
    WORK_CERT_FR_SIGNATORIES.le_directeur;

  const formattedIssueDate = formatFrenchDateDMY(issueDate, "../.../....");
  const formattedBirthDate = formatFrenchDateDMY(birthDate, "../.../....");
  const formattedHireDate = formatFrenchDateDMY(firstHireDate, "../.../....");
  const displayRefNum = String(refNumber || "").trim() || "......";
  const displayYear = year || new Date().getFullYear();

  const cleanBirthPlace = String(birthPlaceFr || "Chlef")
    .replace(/\s*\(ALG[EÉ]RIE\)\s*$/i, "")
    .trim();
  const displayBirthPlace = cleanBirthPlace
    ? `${cleanBirthPlace} (ALGERIE)`
    : "............ (ALGERIE)";

  const { prep: qualityPrep, rank: cleanRankFr } =
    formatFrenchQualityPreposition(rankFr);

  const hasHighPos =
    Boolean(includeHighPosition) && Boolean(String(highPositionFr || "").trim());

  const qrPayload = buildFrenchWorkCertificateQrPayload({
    refNumber: String(refNumber || "").trim(),
    year: displayYear,
    issueDate,
    fullNameFr,
    rankFr: cleanRankFr,
    directorateFr,
    firstHireDate,
  });

  const qrRefCode = generateOfficialRefCode(
    "WCF",
    employeeId,
    refNumber,
    displayYear
  );

  return (
    <div
      className="official-a4-sheet-fr"
      dir="ltr"
      lang="fr"
      style={{
        width: "210mm",
        minHeight: "297mm",
        maxHeight: "297mm",
        backgroundColor: "#ffffff",
        color: "#000000",
        padding: "14mm 18mm 16mm 18mm",
        boxSizing: "border-box",
        fontFamily: "'Calibri', 'Arial', 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        direction: "ltr",
        textAlign: "left",
      }}
    >
      {/* ══════════════ TOP CENTER REPUBLIC HEADER ══════════════ */}
      <div
        style={{
          textAlign: "center",
          fontSize: "12pt",
          fontWeight: "bold",
          textTransform: "uppercase",
          letterSpacing: "0.3px",
          color: "#000000",
          marginBottom: "8mm",
        }}
      >
        REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE
      </div>

      {/* ══════════════ HEADER ROW (LEFT: HIERARCHY & REF | RIGHT: QR & DATE) ══════════════ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          direction: "ltr",
          marginBottom: "14mm",
        }}
      >
        {/* TOP LEFT: Directorate Hierarchy & Ref Number */}
        <div
          style={{
            textAlign: "left",
            fontSize: "10.5pt",
            fontWeight: "bold",
            lineHeight: "1.55",
            color: "#000000",
          }}
        >
          <div>DIRECTION GENERALE DU DOMAINE NATIONAL</div>
          <div>DIRECTION RÉGIONALE DU DOMAINE NATIONAL DE CHLEF</div>
          <div>Sous- DIRECTION DE L&apos;ADMINISTRATION GENERALE</div>
          <div style={{ marginTop: "6px" }}>
            N°: {displayRefNum} / DRDNC / {displayYear}
          </div>
        </div>

        {/* TOP RIGHT: QR Code + Chlef, DD/MM/YYYY */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            minWidth: "150px",
          }}
        >
          <DocumentQrBadge
            payload={qrPayload}
            referenceCode={qrRefCode}
            size={80}
          />
          <div
            style={{
              fontSize: "10.5pt",
              fontWeight: "normal",
              color: "#000000",
              marginTop: "2px",
              whiteSpace: "nowrap",
            }}
          >
            Chlef, {issueDate ? formattedIssueDate : "......................."}
          </div>
        </div>
      </div>

      {/* ══════════════ TITLE BOX (ATTESTATION DE TRAVAIL) ══════════════ */}
      <div style={{ textAlign: "center", margin: "10px 0 32px 0" }}>
        <div
          style={{
            display: "inline-block",
            minWidth: "56%",
            padding: "12px 36px",
            border: "1px solid #000000",
            borderRadius: "12px",
            backgroundColor: "#f3f4f6",
            boxShadow: "2px 3px 0px rgba(0,0,0,0.2)",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: "18pt",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.6px",
              color: "#000000",
              whiteSpace: "nowrap",
            }}
          >
            ATTESTATION DE TRAVAIL
          </span>
        </div>
      </div>

      {/* ══════════════ MAIN BODY PARAGRAPH ══════════════ */}
      <p
        style={{
          width: "100%",
          marginTop: "8px",
          marginBottom: 0,
          textIndent: "16mm",
          fontSize: "13pt",
          lineHeight: "2.05",
          textAlign: "justify",
          textAlignLast: "left",
          color: "#000000",
        }}
      >
        Je soussigné Sous Directeur De L&apos;Administration Générale De La
        direction régionale du domaine national de chlef, certifie que{" "}
        {isFemale ? (
          <span>
            M<sup style={{ fontSize: "9pt" }}>me</sup>
          </span>
        ) : (
          <span>M.</span>
        )}{" "}
        <strong style={{ fontWeight: "bold", color: "#000000" }}>
          {String(fullNameFr || "").trim() || "........................."}
        </strong>{" "}
        {isFemale ? "née le" : "né le"}{" "}
        <strong style={{ fontWeight: "bold", color: "#000000" }}>
          {formattedBirthDate}
        </strong>{" "}
        à{" "}
        <strong style={{ fontWeight: "bold", color: "#000000" }}>
          {displayBirthPlace}
        </strong>{" "}
        fait partie du personnel de la{" "}
        {String(directorateFr || "").trim() ||
          "Direction REGIONALE DU DOMAINE de CHLEF"}{" "}
        en qualité{" "}
        <strong style={{ fontWeight: "bold", color: "#000000" }}>
          {qualityPrep}
          {cleanRankFr}
        </strong>{" "}
        depuis le{" "}
        <strong style={{ fontWeight: "bold", color: "#000000" }}>
          {formattedHireDate}
        </strong>{" "}
        à{" "}
        <strong style={{ fontWeight: "bold", color: "#000000" }}>
          ce jour
        </strong>{" "}
        .
        {hasHighPos && (
          <>
            {" "}
            Ainsi {isFemale ? "elle" : "il"} occupe un poste supérieur (
            <strong style={{ fontWeight: "bold", color: "#000000" }}>
              {String(highPositionFr).trim()}
            </strong>
            ).
          </>
        )}
      </p>

      {/* ══════════════ CLOSING SENTENCE ══════════════ */}
      <p
        style={{
          width: "100%",
          marginTop: "22px",
          marginBottom: 0,
          textIndent: "16mm",
          fontSize: "13pt",
          lineHeight: "1.9",
          textAlign: "justify",
          textAlignLast: "left",
          color: "#000000",
        }}
      >
        Cette attestation lui est délivrée, suite à sa demande pour servir et
        valoir ce que de droit.
      </p>

      {/* ══════════════ SIGNATURE BLOCK (RIGHT SIDE) ══════════════ */}
      <div
        style={{
          marginTop: "42px",
          paddingLeft: "58%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "13pt",
            fontWeight: "bold",
            fontStyle: "italic",
            color: "#000000",
          }}
        >
          {signatory.signatureTitle}
        </div>
      </div>

      {/* ══════════════ BOTTOM LEFT COPY BLOCK (FINAL ELEMENT) ══════════════ */}
      <div
        style={{
          marginTop: "auto",
          paddingBottom: "14mm",
          textAlign: "left",
          fontSize: "9.5pt",
          lineHeight: "1.55",
          color: "#000000",
        }}
      >
        <div
          style={{
            fontWeight: "bold",
            textDecoration: "underline",
            marginBottom: "2px",
          }}
        >
          Copie à :
        </div>
        <div>1- ({safeInterestedCopies} Or.) Intéressé(e).</div>
        <div>2- ({safeArchiveCopies} Cp.) Dossier d&apos;archive</div>
      </div>
    </div>
  );
}
