import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { InboxIcon } from "./icons";

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap active:scale-[0.98]";
const buttonVariants = {
  primary: "bg-accent text-accent-fg shadow-card hover:bg-accent-hover",
  secondary: "border border-border bg-card text-fg shadow-card hover:bg-subtle",
  ghost: "text-fg hover:bg-subtle",
  danger: "bg-danger text-white shadow-card hover:opacity-90",
};
const buttonSizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-[15px]" };

type ButtonStyle = { variant?: keyof typeof buttonVariants; size?: keyof typeof buttonSizes };

export function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}) {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size]);
}

export function Button({ variant, size, className, type = "button", ...props }: ComponentProps<"button"> & ButtonStyle) {
  return <button type={type} className={cx(buttonClass({ variant, size }), className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={cx(buttonClass({ variant, size }), className)} {...props} />;
}

const fieldBase =
  "w-full rounded-lg border border-border bg-card px-3 text-sm text-fg shadow-card placeholder:text-muted/70 transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-ring/20 aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldBase, "py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(fieldBase, "h-10 pr-8", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-border bg-card shadow-card", className)} {...props} />;
}

const tones = {
  neutral: "bg-subtle text-muted",
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

export function Alert({ tone = "neutral", title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div className={cx("rounded-xl px-4 py-3 text-sm", tones[tone])} role={tone === "danger" ? "alert" : "status"}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
        <InboxIcon width={20} height={20} />
      </span>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1.5 text-sm text-muted">{children}</div>}
    </Card>
  );
}
