import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AVATAR_COLORS,
  createAccount,
  deleteAccount,
  setPassword,
  updateProfile,
  verifyPassword,
  type Account,
} from "../../data/accounts";
import { useSession } from "../../data/session";
import { useInvalidating } from "../../data/useInvalidating";
import { ConfirmButton, fieldClass, ghostButtonClass, primaryButtonClass } from "../../components/Card";
import { Modal } from "../../components/Modal";
import { AvatarEditor, type AvatarDraft } from "./AvatarEditor";

const draftOf = (a: Account): AvatarDraft => ({
  name: a.name,
  avatar_kind: a.avatar_kind,
  avatar_value: a.avatar_value,
  avatar_color: a.avatar_color,
});

function PasswordSection({ account }: { account: Account }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const save = useInvalidating("accounts", async (remove: boolean) => {
    if (account.has_password && !(await verifyPassword(account.id, current))) throw new Error("当前密码不对");
    if (!remove && next !== repeat) throw new Error("两次输入的新密码不一致");
    if (!remove && next.length < 4) throw new Error("密码至少 4 位");
    await setPassword(account.id, remove ? "" : next);
    return remove;
  });
  const submit = (remove: boolean) =>
    save.mutate(remove, {
      onSuccess: (removed) => {
        setCurrent("");
        setNext("");
        setRepeat("");
        setMsg({ text: removed ? "已移除密码" : "密码已更新", ok: true });
      },
      onError: (e) => setMsg({ text: (e as Error).message, ok: false }),
    });

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <div className="flex items-baseline gap-2">
        <h3 className="flex-1 text-[13px] font-semibold text-ink-2">登录密码</h3>
        <span className="text-xs text-muted">{account.has_password ? "已设置" : "未设置,打开即用"}</span>
      </div>
      {account.has_password && (
        <input type="password" placeholder="当前密码" value={current} onChange={(e) => setCurrent(e.target.value)} className={fieldClass} />
      )}
      <div className="flex gap-2">
        <input type="password" placeholder="新密码" value={next} onChange={(e) => setNext(e.target.value)} className={`${fieldClass} flex-1`} />
        <input type="password" placeholder="再输一次" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={`${fieldClass} flex-1`} />
      </div>
      <div className="flex items-center gap-2">
        <span className={`flex-1 text-xs ${msg?.ok ? "text-accent" : "text-warn"}`}>{msg?.text}</span>
        {account.has_password && (
          <button type="button" className={ghostButtonClass} onClick={() => submit(true)}>
            移除密码
          </button>
        )}
        <button type="submit" className={`${ghostButtonClass} font-semibold`} disabled={!next || save.isPending}>
          {account.has_password ? "修改密码" : "设置密码"}
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted">密码只用于本机的登录锁屏,数据库文件本身没有加密。</p>
    </form>
  );
}

export function ProfileDialog({ account, open, onClose }: { account: Account; open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState(draftOf(account));
  useEffect(() => {
    if (open) setDraft(draftOf(account));
  }, [open, account]);
  const signOut = useSession((s) => s.signOut);
  const qc = useQueryClient();
  const save = useInvalidating("accounts", () => updateProfile(account.id, { ...draft, name: draft.name.trim() || account.name }));
  const remove = async () => {
    await deleteAccount(account.id);
    await qc.invalidateQueries({ queryKey: ["accounts"] });
    signOut(1);
  };

  return (
    <Modal open={open} onClose={onClose} label="个人资料">
      <div className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold">个人资料</h2>
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
          名字
          <input
            value={draft.name}
            maxLength={20}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className={fieldClass}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-2">头像</span>
          <AvatarEditor value={draft} onChange={setDraft} />
        </div>
        <div className="flex justify-end gap-2">
          <button className={`${ghostButtonClass} min-h-11 px-4`} onClick={onClose}>
            取消
          </button>
          <button className={primaryButtonClass} disabled={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            保存
          </button>
        </div>
        <hr className="border-divider" />
        <PasswordSection account={account} />
        {account.id !== 1 && (
          <>
            <hr className="border-divider" />
            <div className="flex items-center gap-3">
              <p className="flex-1 text-xs text-muted">删除这个账号和它的全部数据(任务、项目、账本、日记……),无法恢复。</p>
              <ConfirmButton label="删除账号" confirmLabel="确认删除全部数据" onConfirm={() => void remove()} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function AddAccountDialog({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: number }) {
  const [name, setName] = useState("");
  const signIn = useSession((s) => s.signIn);
  const add = useInvalidating("accounts", () => createAccount(name.trim(), AVATAR_COLORS[existing % AVATAR_COLORS.length]));
  useEffect(() => {
    if (open) setName("");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} label="添加账号" width={400}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          add.mutate(undefined, { onSuccess: (id) => (onClose(), signIn(id)) });
        }}
      >
        <div>
          <h2 className="text-lg font-semibold">添加账号</h2>
          <p className="mt-1 text-[13px] text-muted">每个账号有独立的数据和设置,可以给家人用,也可以把工作和生活分开。</p>
        </div>
        <input autoFocus placeholder="名字" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        {add.isError && <p className="text-xs text-warn">{(add.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={`${ghostButtonClass} min-h-11 px-4`} onClick={onClose}>
            取消
          </button>
          <button type="submit" className={primaryButtonClass} disabled={!name.trim() || add.isPending}>
            创建并切换
          </button>
        </div>
      </form>
    </Modal>
  );
}
