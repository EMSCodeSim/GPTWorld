// Day 50: drought-stressed ecology makes the existing recovery junction a place to observe regrowth.
export const DAY50=50;
export const DAY50_EVENT='day50_recovery_monitoring_plot_recorded';
export const DAY50_ENTITIES=Object.freeze([
 Object.freeze({id:'day50-recovery-plot-path',type:'trail',label:'Recovery monitoring spur',width:0.34,color:'#7c745c',points:[[-41.3,14.2],[-40.8,12.9],[-40.2,11.9]],origin:DAY50_EVENT,history:'Seven earlier player patrols and the firebreak recovery survey inspired a permanent observation spur during a severe summer drought.'}),
 Object.freeze({id:'day50-recovery-plot-marker',type:'object',label:'Drought recovery plot',x:-40.2,z:11.9,width:0.38,depth:0.38,height:1.3,color:'#827c55',origin:DAY50_EVENT,history:'A permanent field marker records the drought-stressed recovery plot; weather, ecology, and regeneration continue autonomously.'})
]);