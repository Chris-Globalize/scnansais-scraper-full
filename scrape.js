const { chromium } = require('playwright');
const fs = require('fs');

const CLUB_URL = process.env.FFF_CLUB_URL
  || 'https://var.fff.fr/recherche-clubs?subtab=agenda&tab=resultats&scl=172132';
const OUTPUT_FILE = 'matchs.json';

function cleanText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'fr-FR' });

  try {
    const response = await page.goto(CLUB_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    if (!response || response.status() >= 400) {
      throw new Error(`La page FFF répond avec le statut ${response ? response.status() : 'inconnu'}.`);
    }

    // L’application FFF charge son calendrier après le HTML principal.
    // L’absence de .confrontation est normale quand aucun calendrier n’est publié.
    await page.locator('.confrontation').first().waitFor({
      state: 'attached',
      timeout: 30000,
    }).catch(() => {});

    const bodyText = cleanText(await page.locator('body').innerText());
    if (/access denied|forbidden|verify you are human|erreur technique/i.test(bodyText)) {
      throw new Error('La FFF refuse ou bloque actuellement la consultation automatisée.');
    }

    const matchs = await page.locator('.confrontation').allTextContents();
    const resultat = [...new Set(matchs.map(cleanText).filter(Boolean))];

    fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(resultat, null, 2)}\n`, 'utf8');

    if (resultat.length === 0) {
      console.log('Aucun match publié actuellement : matchs.json a été généré avec un tableau vide.');
    } else {
      console.log(`${resultat.length} match(s) récupéré(s) depuis ${await page.url()}.`);
    }
  } catch (error) {
    // Ces fichiers restent dans les artefacts GitHub et permettent de diagnostiquer
    // une future modification de la page FFF sans écraser le JSON présent sur le site.
    const debugHtml = await page.content().catch(() => '<!-- Contenu indisponible : navigation FFF encore active. -->');
    fs.writeFileSync('scrape-debug.html', debugHtml, 'utf8');
    await page.screenshot({ path: 'scrape-debug.png', fullPage: true }).catch(() => {});
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
