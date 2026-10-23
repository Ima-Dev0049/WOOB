// Next 16 laisse au lanceur le soin de coordonner les signaux. Woob peut ainsi
// synchroniser PGlite avant la sortie au lieu d'interrompre son WAL en cours.
const command = process.argv[2];

if (command === 'dev' || command === 'start') {
  process.env.NEXT_MANUAL_SIG_HANDLE = '1';

  if (command === 'dev') {
    // Le parent Next attend le worker. Sans base initialisée, son arrêt reste
    // borné ; avec PGlite, le handler applicatif termine dès la synchronisation.
    process.env.NEXT_EXIT_TIMEOUT_MS ||= '5000';
  } else {
    // Avant la première requête, aucun handler de base n'est encore nécessaire.
    const exitWithoutDatabase = (exitCode) => {
      if (!globalThis.__woobDbShutdownRegistered) process.exit(exitCode);
    };
    process.once('SIGINT', () => exitWithoutDatabase(130));
    process.once('SIGTERM', () => exitWithoutDatabase(143));
  }
}

import('next/dist/bin/next').catch((error) => {
  console.error('Impossible de démarrer Next.js', error);
  process.exitCode = 1;
});
