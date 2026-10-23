import Link from 'next/link';

export function Logo({ href = '/', compact = false, inverse = false }: { href?: string; compact?: boolean; inverse?: boolean }) {
  return <Link href={href} className={`brand-logo ${inverse ? 'inverse' : ''}`} aria-label="Woob, accueil"><svg viewBox="0 0 34 34" aria-hidden="true"><path d="M4 7.5 9.7 26h5.1l2.2-7.4L19.4 26h5.1L30 7.5h-5.2l-3.1 11-2.4-8h-4.4l-2.4 8-3-11Z" fill="currentColor" /><circle cx="27.5" cy="26.5" r="3.5" fill="#ef8354" /></svg>{!compact && <span>woob<span className="logo-dot">.</span></span>}</Link>;
}
