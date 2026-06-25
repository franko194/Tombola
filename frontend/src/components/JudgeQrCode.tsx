import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { isJudgeUrl } from "../lib/publicUrl";

export function JudgeQrCode({ url, size, alt }: { url: string; size: number; alt: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDataUrl("");
    setError("");

    if (!url || !isJudgeUrl(url)) {
      return;
    }

    void QRCode.toDataURL(url, {
      width: size,
      margin: 4,
      errorCorrectionLevel: "H",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((nextDataUrl) => {
        if (!cancelled) setDataUrl(nextDataUrl);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message || "No se pudo generar el QR.");
      });

    return () => {
      cancelled = true;
    };
  }, [alt, size, url]);

  if (error) {
    return <p className="p-4 text-center text-sm font-bold text-red-700">{error}</p>;
  }

  if (!dataUrl) {
    return <p className="p-8 font-bold text-slate-500">Preparando QR...</p>;
  }

  return <img src={dataUrl} alt={alt} width={size} height={size} className="rounded bg-white" />;
}
