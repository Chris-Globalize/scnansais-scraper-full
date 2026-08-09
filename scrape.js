const { chromium } = require('playwright');
const fs = require('fs');

const CLUB_URL = process.env.FFF_CLUB_URL
  || 'https://var.fff.fr/recherche-clubs?subtab=agenda&tab=resultats&scl=172132';
const OUTPUT_FILE = 'matchs.json';

function formatParisDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function buildWeeklyUrl() {
  const todayText = formatParisDate(new Date());
  const [year, month, day] = todayText.split('-').map(Number);
  const today = new Date(Date.UTC(year, month - 1, day, 12));
  const dayOfWeek = today.getUTCDay();
  const daysUntilMonday = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
  const begin = new Date(today);
  begin.setUTCDate(begin.getUTCDate() + daysUntilMonday);
  const end = new Date(begin);
  end.setUTCDate(end.getUTCDate() + 6);

  const url = new URL(CLUB_URL);
  url.searchParams.set('subtab', 'agenda');
  url.searchParams.set('tab', 'resultats');
  url.searchParams.set('scl', '172132');
  url.searchParams.set('beginWeek', formatParisDate(begin));
  url.searchParams.set('endWeek', formatParisDate(end));
  url.searchParams.set('limitWeek', todayText);
  return url.toString();
}

function cleanText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'fr-FR' });

  page.on('response', (response) => {
    if (response.status() >= 400 && /fff\.fr/i.test(response.url())) {
      console.warn(`FFF HTTP ${response.status()} — ${response.url()}`);
    }
  });

  try {
    const weeklyUrl = buildWeeklyUrl();
    console.log(`Système : ${process.platform} — récupération : ${weeklyUrl}`);
    const response = await page.goto(weeklyUrl, {
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
    if (/access denied|forbidden|verify you are human|erreur technique|application momentanément indisponible|page ne puisse pas se charger/i.test(bodyText)) {
      throw new Error('La FFF refuse ou bloque actuellement la consultation automatisée.');
    }

    const matchs = await page.locator('.confrontation').allTextContents();
    const resultat = [...new Set(matchs.map(cleanText).filter(Boolean))];

    if (resultat.length === 0) {
      throw new Error('Aucun match exploitable trouvé : les anciennes données ne seront pas remplacées.');
    }

    fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(resultat, null, 2)}\n`, 'utf8');
    console.log(`${resultat.length} match(s) récupéré(s) depuis ${await page.url()}.`);
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
