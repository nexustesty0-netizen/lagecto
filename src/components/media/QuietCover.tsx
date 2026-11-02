export function QuietCover({ className = "" }: { className?: string }) {
  return <div className={`lg-quiet-cover ${className}`.trim()} aria-hidden />;
}
