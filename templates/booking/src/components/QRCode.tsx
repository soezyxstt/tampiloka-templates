import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useBooking } from "../lib/store";
import { ErrorNote } from "./ui";
export function TicketQR({ payload }: { payload: string }) {
  const { t } = useBooking(),
    [image, setImage] = useState(""),
    [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(payload, {
      width: 260,
      margin: 3,
      errorCorrectionLevel: "M",
    })
      .then((value) => {
        if (active) setImage(value);
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [payload]);
  return (
    <>
      {image ? (
        <img
          className="b-ticket-qr"
          src={image}
          alt={t("Kode QR tiket janji", "Appointment ticket QR code")}
        />
      ) : (
        <p role="status">
          {t("Menyiapkan kode QR...", "Preparing QR code...")}
        </p>
      )}
      <ErrorNote error={error} />
    </>
  );
}
