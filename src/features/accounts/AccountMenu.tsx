import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { listAccounts, type Account } from "../../data/accounts";
import { useSession } from "../../data/session";
import { Avatar } from "../../components/Avatar";
import { springs } from "../../components/motion";
import { AddAccountDialog, ProfileDialog } from "./ProfileDialog";

const itemClass = "flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-ink-2 hover:bg-field";

/** Sidebar header: the signed-in account's avatar and name, opening the account menu. */
export function AccountMenu() {
  const accountId = useSession((s) => s.accountId);
  const signIn = useSession((s) => s.signIn);
  const signOut = useSession((s) => s.signOut);
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: listAccounts });
  const me = accounts.find((a) => a.id === accountId);
  const others = accounts.filter((a) => a.id !== accountId);

  const anchor = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const [dialog, setDialog] = useState<"profile" | "add" | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);

  const open = () => {
    const r = anchor.current!.getBoundingClientRect();
    setMenu({ top: r.bottom + 6, left: r.left });
  };
  const switchTo = (a: Account) => {
    setMenu(null);
    if (a.has_password) signOut(a.id);
    else signIn(a.id);
  };

  if (!me) return <div className="h-12" />;
  return (
    <>
      <button
        ref={anchor}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={() => (menu ? setMenu(null) : open())}
        className="mb-3 flex min-h-12 items-center gap-2.5 rounded-xl px-2 text-left hover:bg-surface/60"
      >
        <motion.span layoutId="me-avatar" transition={springs.smooth}>
          <Avatar account={me} size={32} />
        </motion.span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold tracking-tight">{me.name}</span>
          <span className="block text-[11px] text-muted">LifeOS</span>
        </span>
        <motion.svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted"
          animate={{ rotate: menu ? 180 : 0 }}
          transition={springs.snappy}
        >
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>

      {createPortal(
        <AnimatePresence>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
              <motion.div
                role="menu"
                aria-label="账号"
                style={{ top: menu.top, left: menu.left, transformOrigin: "top left" }}
                className="panel panel-sheet fixed z-50 w-[248px] rounded-2xl border border-line bg-surface p-1.5"
                initial={{ opacity: 0, scale: 0.92, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: springs.snappy }}
                exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.12 } }}
              >
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <Avatar account={me} size={36} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{me.name}</div>
                    <div className="text-[11px] text-muted">{me.id === 1 ? "主账号" : "本地账号"} · {me.has_password ? "已设密码" : "无密码"}</div>
                  </div>
                </div>
                <button role="menuitem" className={itemClass} onClick={() => (setMenu(null), setDialog("profile"))}>
                  编辑资料与头像
                </button>
                {others.length > 0 && (
                  <>
                    <div className="mx-2.5 my-1 border-t border-divider" />
                    <div className="px-2.5 pb-0.5 pt-1 text-[11px] text-muted">切换账号</div>
                    {others.map((a) => (
                      <button key={a.id} role="menuitem" className={itemClass} onClick={() => switchTo(a)}>
                        <Avatar account={a} size={22} />
                        <span className="min-w-0 flex-1 truncate">{a.name}</span>
                        {a.has_password && (
                          <svg aria-label="需要密码" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                            <rect x="5" y="11" width="14" height="10" rx="2" />
                            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </>
                )}
                <div className="mx-2.5 my-1 border-t border-divider" />
                <button role="menuitem" className={itemClass} onClick={() => (setMenu(null), setDialog("add"))}>
                  添加账号
                </button>
                <button role="menuitem" className={itemClass} onClick={() => (setMenu(null), signOut())}>
                  {me.has_password ? "锁定" : "退出登录"}
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <ProfileDialog account={me} open={dialog === "profile"} onClose={() => setDialog(null)} />
      <AddAccountDialog open={dialog === "add"} existing={accounts.length} onClose={() => setDialog(null)} />
    </>
  );
}
