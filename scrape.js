const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://var.fff.fr/recherche-clubs?subtab=agenda&tab=resultats&scl=172132', { waitUntil: 'networkidle' });

  // Attente du bon sélecteur .confrontation
  await page.waitForSelector('.confrontation', { timeout: 30000 });

  const matchs = await page.evaluate(() => {
    const elements = document.querySelectorAll('.confrontation');
    return Array.from(elements).map(el => el.innerText.trim());
  });

  fs.writeFileSync('matchs.json', JSON.stringify(matchs, null, 2));

  await browser.close();
})();
