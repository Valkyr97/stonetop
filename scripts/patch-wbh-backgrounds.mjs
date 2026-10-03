import fs from 'node:fs'

const DRIVEN = `You once led a simple life, but something happened. Something changed you, burdened you with terrible purpose. What was it? Choose 1:

***Burning Brightly***: You can spend 2 XP after you roll to add +1, even if you don't have enough XP to level.`

const DESTINED = `Fate has laid her hand upon you. Choose 3-4 of the items below to describe your destiny:

At the ***start of a session***, roll +Omens. **On a 7+**, lose all Omens and the GM will describe a vision or portent of your fate, or of your current situation. **On a 10+**, you may ask a follow-up question; get a clear and helpful answer. **On a 6-**, don't mark XP, but hold +1 Omen and describe a nightmare or vision, and how your fears and worries play into it.

***Until your destiny is fulfilled***, treat a 6- on Death's Door as a 7-9, and a 7-9 as a 10+.`

for (const path of ['content/packs/creation-v0.1.json', 'public/content/packs/creation-v0.1.json']) {
  const p = JSON.parse(fs.readFileSync(path, 'utf8'))
  const pb = p.content.playbooks.find((x) => x.id === 'would-be-hero')
  pb.backgrounds.find((b) => b.id === 'driven').rule_text = DRIVEN
  pb.backgrounds.find((b) => b.id === 'destined').rule_text = DESTINED
  fs.writeFileSync(path, JSON.stringify(p, null, 2) + '\n')
  console.log('patched', path)
}
