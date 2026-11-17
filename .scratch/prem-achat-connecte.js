// Utilisation : dev-browser --browser domaine --timeout 170 run .scratch/prem-achat-connecte.js
// Paramètres lus dans le fichier prem-params.json (writeFile/readFile du bac à sable)
const P = JSON.parse(await readFile('prem-params.json'));
const page = await browser.getPage("prem");
await page.goto("https://sonoo.app/paiement/jakeb-test", { waitUntil: "domcontentloaded" });
await page.evaluate(() => { localStorage.setItem('panier_jakeb-test', JSON.stringify([{ beatId: '80455812-ac28-4e38-9d95-3bdffb8ff95e', licenceId: '40c1f6c5-e3f1-483e-ae6b-dca9eec63f49', titre: 'Memories', imageUrl: null, licenceNom: 'WAV', prix: 60 }])); sessionStorage.clear() });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const caseSouvenir = page.locator('label.pmt-newsletter', { hasText: 'Se souvenir' });
console.log('avant : case cochee =', await caseSouvenir.locator('input').isChecked(), '| texte :', (await caseSouvenir.innerText()).replace(/\s+/g, ' '));
console.log('avant : champs =', JSON.stringify(await page.evaluate(() => ({ p: document.querySelector('input[placeholder="Prénom"]').value, n: document.querySelector('input[placeholder="Nom"]').value, a: document.querySelector('input[placeholder="Adresse"]').value, v: document.querySelector('input[placeholder="Ville"]').value, pro: document.querySelector('.pmt-toggle-row').getAttribute('aria-pressed'), rs: document.querySelector('input[placeholder="Raison sociale"]')?.value ?? null, menu: [...(document.querySelector('select[aria-label="Mes adresses"]')?.options ?? [])].map(o => o.text) }))));
if (P.cocher !== await caseSouvenir.locator('input').isChecked()) await caseSouvenir.locator('input').dispatchEvent('click');
await page.waitForTimeout(300);
console.log('choix : case cochee =', await caseSouvenir.locator('input').isChecked());
if (P.payer) {
  await page.getByPlaceholder('Adresse', { exact: true }).fill(P.adresse);
  await page.getByPlaceholder('Code postal', { exact: true }).fill(P.cp);
  await page.getByPlaceholder('Ville', { exact: true }).fill(P.ville);
  const proActif = (await page.locator('.pmt-toggle-row').getAttribute('aria-pressed')) === 'true';
  if (P.pro !== proActif) await page.locator('.pmt-toggle-row').dispatchEvent('click');
  if (P.pro) {
    await page.getByPlaceholder('Raison sociale', { exact: true }).fill(P.rs);
    await page.getByPlaceholder('N° de TVA intracommunautaire', { exact: true }).fill(P.tva);
  }
  await page.frameLocator('iframe[title*="numéro de carte"]').locator('input[name="cardnumber"]').fill('4242424242424242');
  await page.frameLocator('iframe[title*="expiration"]').locator('input[name="exp-date"]').fill('1230');
  await page.frameLocator('iframe[title*="CVC"]').locator('input[name="cvc"]').fill('123');
  await page.waitForTimeout(2000);
  await page.locator('button.pmt-cta').dispatchEvent('click');
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(2000); if (page.url().includes('/telechargement/')) break; }
  console.log('url finale :', page.url());
  console.log('erreur :', await page.evaluate(() => document.querySelector('.pmt-error-global, .pmt-field-error')?.innerText ?? null));
}
