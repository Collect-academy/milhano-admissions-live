import 'server-only';
export type TicketMode='test'|'live';
export function ticketMode():TicketMode {const mode=process.env.TICKETING_MODE||'test';if(mode!=='test'&&mode!=='live')throw new Error('INVALID_TICKETING_MODE');return mode;}
export function ticketStripeKeys(){const mode=ticketMode();const secret=mode==='test'?process.env.STRIPE_TICKETING_SECRET_KEY:process.env.STRIPE_TICKETING_LIVE_SECRET_KEY;
const pub=mode==='test'?process.env.NEXT_PUBLIC_STRIPE_TICKETING_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_STRIPE_TICKETING_LIVE_PUBLISHABLE_KEY;
const webhook=mode==='test'?process.env.STRIPE_TICKETING_WEBHOOK_SECRET:process.env.STRIPE_TICKETING_LIVE_WEBHOOK_SECRET;
const prefix=mode==='test'?'test':'live';if(!secret?.startsWith('sk_'+prefix+'_')||!pub?.startsWith('pk_'+prefix+'_'))throw new Error('STRIPE_KEYS_NOT_CONFIGURED');return {mode,secret,pub,webhook};}
