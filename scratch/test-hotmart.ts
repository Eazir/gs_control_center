import { HotmartAdapter } from '../apps/api/src/infrastructure/providers/hotmart/hotmart.adapter';
import * as fs from 'fs';

const payload = JSON.parse(fs.readFileSync('scratch/payload.json', 'utf8'));
const adapter = new HotmartAdapter();
const result = adapter.parseWebhook(payload);
console.dir(result, { depth: null });
