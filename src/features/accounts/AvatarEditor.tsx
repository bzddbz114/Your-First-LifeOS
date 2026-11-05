import { useRef, useState } from "react";
import { motion } from "motion/react";
import { AVATAR_COLORS, type Account, type AvatarKind } from "../../data/accounts";
import { Avatar, imageToAvatar } from "../../components/Avatar";
import { Segmented, ghostButtonClass } from "../../components/Card";
import { springs } from "../../components/motion";

export type AvatarDraft = Pick<Account, "name" | "avatar_kind" | "avatar_value" | "avatar_color">;

const EMOJIS = ["🙂", "😎", "🤓", "🥳", "😺", "🐶", "🦊", "🐼", "🐧", "🦄", "🐳", "🌱", "🌸", "🌙", "☀️", "⚡️", "🔥", "🍀", "🍊", "☕️", "🎧", "📚", "🚀", "🎯"];

/** Live preview plus pickers for each avatar kind; reports every change through `onChange`. */
export function AvatarEditor({ value, onChange }: { value: AvatarDraft; onChange: (v: AvatarDraft) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<AvatarDraft>) => onChange({ ...value, ...patch });

  return (
    <div className="flex items-start gap-4">
      <motion.div
        key={`${value.avatar_kind}:${value.avatar_value}:${value.avatar_color}`}
        initial={{ scale: 0.85, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springs.snappy}
      >
        <Avatar account={value} size={72} />
      </motion.div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <Segmented<AvatarKind>
          label="头像类型"
          value={value.avatar_kind}
          onChange={(k) => {
            setError(null);
            if (k === "emoji") set({ avatar_kind: k, avatar_value: EMOJIS[0] });
            else if (k === "initial") set({ avatar_kind: k, avatar_value: null });
            else fileRef.current?.click();
          }}
          options={[
            { value: "initial", label: "首字" },
            { value: "emoji", label: "表情" },
            { value: "image", label: "照片" },
          ]}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              set({ avatar_kind: "image", avatar_value: await imageToAvatar(file) });
              setError(null);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
        {value.avatar_kind === "emoji" && (
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={e}
                aria-pressed={value.avatar_value === e}
                onClick={() => set({ avatar_value: e })}
                className={`flex size-8 items-center justify-center rounded-lg text-lg ${
                  value.avatar_value === e ? "bg-accent-soft ring-2 ring-accent" : "hover:bg-field"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {value.avatar_kind === "image" ? (
          <button type="button" className={`${ghostButtonClass} self-start`} onClick={() => fileRef.current?.click()}>
            更换照片
          </button>
        ) : (
          <div role="radiogroup" aria-label="头像底色" className="flex gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={value.avatar_color === c}
                aria-label={c}
                onClick={() => set({ avatar_color: c })}
                className="relative flex size-7 items-center justify-center rounded-full"
              >
                {value.avatar_color === c && (
                  <motion.span
                    layoutId="avatar-color-ring"
                    transition={springs.snappy}
                    className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: c }}
                  />
                )}
                <span className="size-5 rounded-full" style={{ background: c }} />
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-warn">{error}</p>}
      </div>
    </div>
  );
}
