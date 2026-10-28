// Day 31: rain and recent wildfire leave a visible, inspectable rainwash survey at the existing burn scar.
// This historical chapter does not change autonomous weather, wildfire, regeneration, or resource balances.
export const DAY31 = 31;
export const DAY31_EVENT = 'day31_burn_scar_rainwash_survey';
export const DAY31_ENTITIES = Object.freeze([
  Object.freeze({
    id:'day31-burn-scar-rainwash-path', type:'trail',
    label:'Rainwash survey path', width:0.56, color:'#6b5a48',
    points:[[-26,16],[-26.2,18.5],[-26.6,19.8]]
  }),
  Object.freeze({
    id:'day31-burn-scar-exposed-soil', type:'terrain',
    label:'Exposed rainwashed soil', x:-27.1, z:19.5,
    width:1.5, depth:0.9, height:0.035, color:'#544638',
    origin:DAY31_EVENT,
    history:'After wildfire-1008 and spring rain, exposed ground beside the old burn scar was marked for observation. This is a persistent environmental trace, not a new resource deposit or a change to the disaster simulation.'
  }),
  Object.freeze({
    id:'day31-burn-scar-erosion-stake', type:'object',
    label:'Burn scar erosion stake', x:-26.35, z:20.25,
    width:0.18, depth:0.18, height:1.35, color:'#8d7755',
    origin:DAY31_EVENT,
    history:'The settlement marked a fixed reference point to inspect rainwash beside the burn scar. Recent heavy rain did not erase the high drought risk or the effects of repeated wood harvesting.'
  }),
  Object.freeze({
    id:'day31-burn-scar-risk-board', type:'object',
    label:'Burn scar risk board', x:-27.65, z:20.2,
    width:1.05, depth:0.2, height:1.4, color:'#917552',
    origin:DAY31_EVENT,
    history:'The latest wildfire has passed, but forest harvesting pressure remains critical and the Western Firebreak is unfinished (0 of 6 wood, 0 of 24 stone). Travelers can bring their own materials to the existing firebreak workbench. Storehouse deposits do not count as firebreak contributions.'
  })
]);
