import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, LayoutGroup, motion, useAnimationControls } from "motion/react";
import { listAccounts, verifyPassword, type Account } from "../../data/accounts";
import { lastAccountId, useSession } from "../../data/session";
import { cachedPrefs, useApplyPrefs } from "../../data/prefs";
import { Avatar } from "../../components/Avatar";
import { AmbientBackground } from "../../components/AmbientBackground";
import { springs } from "../../components/motion";
import { AddAccountDialog } from "./ProfileDialog";

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center">
      <div className="text-[15px] font-medium text-ink-2">
        {now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}
      </div>
      <div className="text-[88px] font-semibold leading-none tracking-tight tabular-nums text-ink">
        {now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}
      </div>
    </div>
  );
}

function PasswordField({ account, onSuccess }: { account: Account; onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const shake = useAnimationControls();

  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true);
    const ok = await verifyPassword(account.id, pw);
    setBusy(false);
    if (ok) return onSuccess();
    setWrong(true);
    setPw("");
    // The macOS "nope" shake.
    void shake.start({ x: [0, -14, 12, -9, 6, -3, 0], transition: { duration: 0.45 } });
  };

  return (
    <motion.form
      animate={shake}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col items-center gap-2"
    >
      <div className="panel flex h-11 w-60 items-center gap-1 rounded-full border border-line bg-surface/70 pl-4 pr-1.5 backdrop-blur-xl">
        <input
          autoFocus
          type="password"
          aria-label={`${account.name} 的密码`}
          placeholder="输入密码"
          value={pw}
          onChange={(e) => (setPw(e.target.value), setWrong(false))}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none focus:shadow-none"
        />
        <button
          type="submit"
          aria-label="登录"
          disabled={!pw || busy}
          className="flex size-8 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
        >
          {busy ? (
            <motion.span
              className="block size-3.5 rounded-full border-2 border-white/40 border-t-white"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>
      <span className={`h-4 text-xs ${wrong ? "text-warn" : "text-transparent"}`}>密码不对,再试一次</span>
    </motion.form>
  );
}

export function SignInScreen() {
  const locked = useSession((s) => s.locked);
  const signIn = useSession((s) => s.signIn);
  const { data: accounts } = useQuery({ queryKey: ["accounts"], queryFn: listAccounts });
  const [selected, setSelected] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const preferred = accounts?.find((a) => a.id === lastAccountId()) ?? accounts?.[0];
  const current = accounts?.find((a) => a.id === selected) ?? preferred;
  // Paint the lock screen in the look of the account about to sign in.
  const prefs = cachedPrefs(current?.id ?? null);
  useApplyPrefs(prefs);

  // At launch, an account without a password opens straight away.
  const autoOpen = !locked && preferred && !preferred.has_password;
  useEffect(() => {
    if (autoOpen) signIn(preferred.id);
  }, [autoOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!accounts || !current || autoOpen) return null;
  const pick = (a: Account) => (a.has_password ? setSelected(a.id) : signIn(a.id));

  return (
    <div className="relative flex h-screen flex-col items-center justify-center gap-14 overflow-hidden px-6">
      {prefs.style === "glass" && <AmbientBackground />}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={springs.gentle}>
        <Clock />
      </motion.div>

      <LayoutGroup>
        <motion.div
          className="flex flex-wrap items-start justify-center gap-6"
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
        >
          {accounts.map((a) => {
            const on = a.id === current.id;
            return (
              <motion.div
                key={a.id}
                layout
                variants={{ initial: { opacity: 0, y: 20, scale: 0.9 }, animate: { opacity: 1, y: 0, scale: 1, transition: springs.gentle } }}
                className="flex w-32 flex-col items-center gap-2.5"
              >
                <motion.button
                  layout
                  aria-label={`以 ${a.name} 登录`}
                  aria-pressed={on}
                  onClick={() => pick(a)}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  animate={{ opacity: on ? 1 : 0.6 }}
                  transition={springs.snappy}
                  className="rounded-full"
                >
                  <motion.span layoutId={on ? "me-avatar" : undefined} className="block rounded-full shadow-lg">
                    <Avatar account={a} size={on ? 96 : 72} />
                  </motion.span>
                </motion.button>
                <span className={`max-w-full truncate text-sm ${on ? "font-semibold text-ink" : "text-ink-2"}`}>{a.name}</span>
                <AnimatePresence mode="popLayout">
                  {on && a.has_password && (
                    <motion.div
                      key="pw"
                      initial={{ opacity: 0, y: -6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={springs.smooth}
                    >
                      <PasswordField account={a} onSuccess={() => signIn(a.id)} />
                    </motion.div>
                  )}
                  {on && !a.has_password && (
                    <motion.button
                      key="go"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={springs.smooth}
                      onClick={() => signIn(a.id)}
                      className="min-h-9 rounded-full bg-accent px-5 text-[13px] font-semibold text-white"
                    >
                      进入
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          <motion.div
            layout
            variants={{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0, transition: springs.gentle } }}
            className="flex w-32 flex-col items-center gap-2.5"
          >
            <motion.button
              aria-label="添加账号"
              onClick={() => setAdding(true)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={springs.snappy}
              className="flex size-[72px] items-center justify-center rounded-full border-2 border-dashed border-line-strong text-muted hover:border-faint hover:text-ink-2"
            >
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </motion.button>
            <span className="text-sm text-muted">添加账号</span>
          </motion.div>
        </motion.div>
      </LayoutGroup>

      <AddAccountDialog open={adding} existing={accounts.length} onClose={() => setAdding(false)} />
    </div>
  );
}
