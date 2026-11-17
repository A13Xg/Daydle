import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** Offline, locally rendered QR SVG with a 4-module quiet zone. */
export function FriendQr({ url }: { url: string }) {
  const data = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const size = qr.getModuleCount();
    const path: string[] = [];
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        if (qr.isDark(row, column))
          path.push(`M${column + 4},${row + 4}h1v1h-1z`);
      }
    }
    return { view: size + 8, path: path.join("") };
  }, [url]);
  return (
    <svg
      className="friend-qr"
      viewBox={`0 0 ${data.view} ${data.view}`}
      role="img"
      aria-label="QR code for your Daydle friend invitation link"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={data.view} height={data.view} fill="#ffffff" />
      <path d={data.path} fill="#051424" />
    </svg>
  );
}
