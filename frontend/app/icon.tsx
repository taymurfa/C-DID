import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FF4F00",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#fff",
            boxShadow:
              "-8px -6px 0 0 #fff, 8px -7px 0 0 #fff, 9px 6px 0 0 #fff, -8px 7px 0 0 #fff",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
