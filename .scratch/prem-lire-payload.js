const page = await browser.getPage("prem");
for (const slug of ['jakeb-test', 'nic-beat-2809']) {
  const r = await page.evaluate(async (s) => { const h = await (await fetch('/paiement/' + s)).text(); const i = h.indexOf('preremplissage'); return h.slice(i, i + 520).replace(/\\"/g, '"'); }, slug);
  console.log(slug, '=>', r.split(',"abonnement"')[0]);
}
