// The Missing Blacksmith Shipment: durable quest state transitions and narrative.
export const SHIPMENT_QUEST_ID='missing-blacksmith-shipment';
export const SHIPMENT_STAGES=Object.freeze(['not_started','tracking','wagon_found','wolf_resolved','shipment_recovered','completed']);
export const SHIPMENT_POINTS=Object.freeze({
 tracks:{x:18,z:15},
 wagon:{x:27,z:16},
 wolf:{x:28,z:8},
 cache:{x:25,z:11},
 tovan:{x:9,z:2}
});
export const SHIPMENT_REWARD=Object.freeze({coins:35,stone:8,blacksmithingXp:2,archeryXp:1});
export function shipmentNext(stage,action,{hasBow=false}={}){
 const transitions={
  not_started:{accept:'tracking'},
  tracking:{inspect_tracks:'wagon_found'},
  wagon_found:{fight_wolf:hasBow?'wolf_resolved':null,avoid_wolf:'wolf_resolved'},
  wolf_resolved:{recover:'shipment_recovered'},
  shipment_recovered:{turn_in:'completed'}
 };
 return transitions[stage]?.[action]||null;
}
export function shipmentNarrative(stage){
 return ({
  not_started:'Tovan is worried about a missing metal shipment. Speak with him to begin.',
  tracking:'Follow wagon tracks northeast into the forest, near the tall pines.',
  wagon_found:'The wagon is damaged. A wolf guards the route to the lost supplies. Fight with an equipped bow, or carefully avoid it.',
  wolf_resolved:'The route is clear. Search the scattered supply crate beside the damaged wagon.',
  shipment_recovered:'You have the recovered shipment. Return to Tovan in town for your reward.',
  completed:'Shipment recovered! Tovan has rewarded you and taught you the Trail Repair Fittings recipe.'
 })[stage]||'Speak to Tovan in town.';
}
