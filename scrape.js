const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://var.fff.fr/recherche-clubs?subtab=agenda&tab=resultats&scl=172132', {
    waitUntil: 'networkidle2'
  });

  await page.waitForSelector('.fff-card__agenda-match');

  const matchs = await page.evaluate(() => {
    const elements = document.querySelectorAll('.fff-card__agenda-match');
    return Array.from(elements).map(el => el.innerText.trim());
  });

  const fs = require('fs');
  fs.writeFileSync('matchs.json', JSON.stringify(matchs, null, 2));

  await browser.close();
})();
