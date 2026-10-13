// Re-run the original review inputs against this worktree. Only origin/output,
// accepting the new share confirmation, and explicit sweep commit differ.
import { readFileSync, mkdirSync } from 'node:fs';
const source = '/home/needz/Dev/personal/soc-review/final-ux/notes/final-ux';
const output = '/home/needz/.hermes/cache/scratch/soc-final-ui';
mkdirSync(output, { recursive: true });
for (const name of ['play', 'followup', 'checks']) {
  let text = readFileSync(`${source}/${name}.mjs`, 'utf8')
    .replaceAll('4186', '4188').replaceAll('/home/needz/.hermes/cache/scratch/soc-final-ux', output)
    .replaceAll("'@playwright/test'", JSON.stringify(import.meta.resolve('@playwright/test')))
    .replace('const log=[];', "const log=[];page.on('dialog',d=>d.accept());");
  if (name === 'checks') text = text.replace('const log=[];', "const log=[];page.on('pageerror',e=>log.push({error:e.message}));");
  if (name === 'followup') text = text.replace("await page.getByTestId('mode-sweep').click();await snap('30-sweep-success');", "await page.getByTestId('mode-sweep').click();const self=(await state()).battle.units.find(u=>u.id==='jubal').pos;await tile(self.x,self.y,true);await page.waitForTimeout(500);await snap('30-sweep-success');");
  text = text.replaceAll('await page.screenshot(', `log.push({labelAudit:name,width,...await page.evaluate(()=>{const bounds=document.querySelector('[data-testid=board] canvas')&&window.__soc?.labelBounds?.();if(!bounds)return {};const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;return {labelCount:bounds.labels.length,collisions:bounds.labels.flatMap(l=>bounds.units.filter(u=>overlaps(l,u)).map(u=>({text:l.text,unit:u.id})))}})});await page.screenshot(`);
  await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
}
