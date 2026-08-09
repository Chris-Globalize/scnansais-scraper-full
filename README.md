# Scraper des matchs du SC Nansais

Ce dépôt récupère toutes les six heures les rencontres publiées sur la fiche FFF
du SC Nansais (`scl=172132`) et envoie uniquement `matchs.json` vers
`/www/Scrap-fff/`.

## Secrets GitHub nécessaires

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`

## Lancement manuel

Dans **Actions → Scrape and Upload Matchs → Run workflow**.

L'absence de rencontres n'est pas une erreur : le fichier contient alors `[]`.
Si la FFF bloque la page ou renvoie une erreur, le FTP n'est pas exécuté et un
artefact `fff-scrape-diagnostic` est conservé pendant sept jours.
