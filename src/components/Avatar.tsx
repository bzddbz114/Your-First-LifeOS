import type { Account } from "../data/accounts";

/** First visible character of a name, uppercased for Latin letters. */
export function initialOf(name: string) {
  return (Array.from(name.trim())[0] ?? "?").toUpperCase();
}

/** Round avatar: a photo, an emoji on a color, or the name's initial on a color. */
export function Avatar({
  account,
  size = 32,
  className = "",
}: {
  account: Pick<Account, "name" | "avatar_kind" | "avatar_value" | "avatar_color">;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (account.avatar_kind === "image" && account.avatar_value) {
    return (
      <img
        src={account.avatar_value}
        alt=""
        draggable={false}
        style={style}
        className={`shrink-0 rounded-full object-cover ring-1 ring-black/5 ${className}`}
      />
    );
  }
  const emoji = account.avatar_kind === "emoji" && account.avatar_value;
  return (
    <span
      aria-hidden="true"
      style={{ ...style, background: account.avatar_color, fontSize: size * (emoji ? 0.56 : 0.44) }}
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none text-white ${className}`}
    >
      {emoji || initialOf(account.name)}
    </span>
  );
}

/** Center-crops an image file to a square JPEG data URL, small enough to keep in the database. */
export function imageToAvatar(file: File, px = 192): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = px;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, px, px);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取这张图片"));
    };
    img.src = url;
  });
}
