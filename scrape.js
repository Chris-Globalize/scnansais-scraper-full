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

function buildWeeklyUrls(numberOfWeeks = 6) {
  const todayText = formatParisDate(new Date());
  const [year, month, day] = todayText.split('-').map(Number);
  const today = new Date(Date.UTC(year, month - 1, day, 12));
  const dayOfWeek = today.getUTCDay();
  const daysUntilMonday = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
  const firstMonday = new Date(today);
  firstMonday.setUTCDate(firstMonday.getUTCDate() + daysUntilMonday);

  return Array.from({ length: numberOfWeeks }, (_, index) => {
    const begin = new Date(firstMonday);
    begin.setUTCDate(begin.getUTCDate() + (index * 7));
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
  });
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
    const weeklyUrls = buildWeeklyUrls(6);
    let resultat = [];
    let selectedUrl = '';

    console.log(`Système : ${process.platform} — recherche sur ${weeklyUrls.length} semaine(s).`);
    for (const weeklyUrl of weeklyUrls) {
      console.log(`Test de la semaine : ${weeklyUrl}`);
      const response = await page.goto(weeklyUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      if (!response || response.status() >= 400) {
        throw new Error(`La page FFF répond avec le statut ${response ? response.status() : 'inconnu'}.`);
      }

      await page.locator('.confrontation').first().waitFor({
        state: 'attached',
        timeout: 15000,
      }).catch(() => {});

      const bodyText = cleanText(await page.locator('body').innerText());
      if (/access denied|forbidden|verify you are human|erreur technique|application momentanément indisponible|page ne puisse pas se charger/i.test(bodyText)) {
        throw new Error('La FFF refuse ou bloque actuellement la consultation automatisée.');
      }

      const matchs = await page.locator('.confrontation').allTextContents();
      resultat = [...new Set(matchs.map(cleanText).filter(Boolean))];
      if (resultat.length > 0) {
        selectedUrl = await page.url();
        break;
      }
      console.log('Aucun match sur cette semaine, passage à la suivante.');
    }

    if (resultat.length === 0) {
      throw new Error('Aucun match exploitable trouvé sur les six prochaines semaines : les anciennes données ne seront pas remplacées.');
    }

    fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(resultat, null, 2)}\n`, 'utf8');
    console.log(`${resultat.length} match(s) récupéré(s) depuis ${selectedUrl}.`);
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
