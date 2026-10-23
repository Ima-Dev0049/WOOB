import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export function MarketingHeader() {
  return <header className="marketing-header"><div className="marketing-nav"><Logo /><nav aria-label="Navigation principale"><Link href="/#product">Produit</Link><Link href="/#templates">Modèles</Link><Link href="/pricing">Tarifs</Link><Link href="/#modules">Modules</Link></nav><div className="nav-actions"><Link className="login-link" href="/login">Se connecter</Link><Link className="button dark small" href="/register">Créer un site <span aria-hidden="true">↗</span></Link></div></div></header>;
}
