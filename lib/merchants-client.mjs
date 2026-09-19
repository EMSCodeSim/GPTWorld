/** Public merchant spawn info for the browser (no pricing). Keep in sync with netlify/lib/economy-core.mjs MERCHANTS. */

export const MERCHANTS_CLIENT=Object.freeze([
  {
    key:'general',
    name:'Rowan the Trader',
    title:'General merchant',
    building:'storehouse',
    x:5.8,z:5.2,
    outfit:0x6a5a3e,
    lines:Object.freeze(['“I’ll take honest goods for fair coin.”','“Stack what you can. Trade what you don’t need.”'])
  },
  {
    key:'carpenter',
    name:'Bren the Carpenter',
    title:'Carpenter',
    building:'inn',
    x:6.2,z:-6.5,
    outfit:0x7a5a40,
    lines:Object.freeze(['“Bring me timber work. I’ll pay for clean joins.”'])
  },
  {
    key:'blacksmith',
    name:'Tovan the Smith',
    title:'Blacksmith',
    building:'smithy',
    x:11,z:1.2,
    outfit:0x455c6b,
    lines:Object.freeze(['“Metal and tools, if they’re sound.”'])
  },
  {
    key:'mason',
    name:'Cal the Mason',
    title:'Mason',
    building:'council',
    x:-4.2,z:6.4,
    outfit:0x6b6a68,
    lines:Object.freeze(['“Stone that holds is worth coin.”'])
  },
  {
    key:'provisioner',
    name:'Nessa the Provisioner',
    title:'Provisioner',
    building:'healer',
    x:-3.2,z:-6.2,
    outfit:0x5f6b48,
    lines:Object.freeze(['“Food, seed, and trail remedies keep the valley alive.”'])
  }
]);

export function merchantClientByKey(key){
  return MERCHANTS_CLIENT.find(merchant=>merchant.key===String(key))||null;
}
