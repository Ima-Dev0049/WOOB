export function createId(_prefix = 'id'): string {
  void _prefix;
  if (!globalThis.crypto?.randomUUID) throw new Error('Générateur UUID sécurisé indisponible');
  // Les UUID non préfixés sont compatibles avec les colonnes uuid PostgreSQL.
  // Le paramètre reste disponible pour documenter l’intention aux points d’appel.
  return globalThis.crypto.randomUUID();
}

export function sha256SyncFallbackUnavailable(): never {
  throw new Error('Utilisez le hachage serveur pour les secrets.');
}
