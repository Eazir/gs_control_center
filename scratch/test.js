const payload = require('./payload.json');
const data = payload.data || {};
const affiliates = data.affiliates || payload.affiliates || [];
console.log('affiliates:', affiliates);
const hasReynald = affiliates.some(a => a.affiliate_code === 'B100311196F' && a.name && a.name.includes('Reynald'));
console.log('hasReynald:', hasReynald);
