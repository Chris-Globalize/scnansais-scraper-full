# Scraper des matchs du SC Nansais — multi-runner

Version 1.2.0. Chaque lundi, GitHub essaie Ubuntu, puis macOS si Ubuntu échoue,
puis Windows si les deux premiers environnements échouent. Le premier résultat
contenant au moins un match est envoyé vers `/www/Scrap-fff/matchs.json`.

La semaine à consulter est ajoutée automatiquement à l'adresse FFF dans le
fuseau `Europe/Paris`. Une réponse HTTP 403, une page FFF indisponible ou un
tableau vide ne remplacent jamais les anciennes données du site.

## Secrets GitHub nécessaires

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`

## Lancement manuel

Dans **Actions → Scrape and Upload Matchs → Run workflow**.

Si les trois environnements échouent, le FTP n'est pas exécuté. Des artefacts
`diagnostic-ubuntu`, `diagnostic-macos` et `diagnostic-windows` sont conservés
pendant sept jours pour identifier le comportement de la FFF.
