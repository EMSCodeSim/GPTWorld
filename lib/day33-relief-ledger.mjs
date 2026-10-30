// Day 33: actual traveler deliveries gain a visible, continuously updated relief receipt.
// The public board reads the authoritative stockpile at refresh; it never moves materials.
export const DAY33 = 33;
export const DAY33_EVENT = 'day33_storehouse_relief_ledger';
export const DAY33_ENTITIES = Object.freeze([
  Object.freeze({
    id:'day33-relief-receipt-path',type:'trail',label:'Relief receipt passage',
    width:0.52,color:'#877660',points:[[8.2,9.15],[8.85,9.6],[9.45,9.95]]
  }),
  Object.freeze({
    id:'day33-relief-herb-baskets',type:'object',label:'Donated herb relief baskets',
    x:9.6,z:9.25,width:0.85,depth:0.6,height:0.65,color:'#6b8d53',
    origin:DAY33_EVENT,
    history:'Travelers delivered eight herbs to the communal storehouse during the latest chapter. These baskets acknowledge real deposits and reflect the live shared herb balance; they do not generate, transfer, or consume resources.'
  }),
  Object.freeze({
    id:'day33-relief-receipt-board',type:'object',label:'Relief receipt ledger',
    x:10.25,z:10.45,width:1.05,depth:0.2,height:1.45,color:'#9d8661',
    origin:DAY33_EVENT,
    history:'Travelers deposited eight herbs, ten stone, and one wood after Day 32. Live quantities come from the authoritative storehouse. Crop disease and forest pressure continue independently. Further donations use the existing storehouse interface; the board does not spend materials or complete other projects.'
  })
]);

const safeCount = value => {
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
};

// Read-only projection: changes become visible on the existing world refresh cycle.
// No mutation of the persisted entity descriptors or resource ledgers.
export function decorateDay33Relief(entities,stockpile){
  if(!Array.isArray(entities))return [];
  const herbs=safeCount(stockpile?.herbs);
  return entities.map(entity=>{
    if(entity?.id==='day33-relief-herb-baskets')return {
      ...entity,
      label:herbs>0?`Donated herb relief baskets (${herbs} in storehouse)`:'Donated herb relief baskets (storehouse empty)',
      color:herbs>0?'#6b8d53':'#7a6956'
    };
    if(entity?.id==='day33-relief-receipt-board')return {
      ...entity,
      label:`Relief ledger: ${herbs} herbs in storehouse`,
      history:`Travelers delivered eight herbs, ten stone, and one wood since Day 32. The authoritative communal storehouse currently holds ${herbs} herbs. Further deposits update this board on world refresh. Edda's garden and the storehouse are separate places; these receipts do not create free supplies or fund unfinished projects. Weather, crop disease, forest pressure, and resource regeneration continue independently.`
    };
    return entity;
  });
}
