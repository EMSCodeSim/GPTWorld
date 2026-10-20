// Day 24: the existing firewatch post gains a working weather-reading stop.
// These are permanent visual marks, not free materials or an extra simulation clock.
export const DAY24=24;
export const DAY24_TITLE='The Firewatch Weather Gauge';
export const DAY24_EVENT='day24_firewatch_weather_gauge';
export const DAY24_ENTITIES=Object.freeze([
  Object.freeze({id:'day24-firewatch-gauge-path',type:'trail',label:'Firewatch gauge footpath',width:.55,color:'#786c55',points:[[-24.55,15.15],[-23.7,15.9],[-23.25,16.55]]}),
  Object.freeze({id:'day24-firewatch-gauge-stand',type:'object',label:'Firewatch weather gauge',origin:'day24_firewatch_gauge',history:'The settlement began reading actual weather and fire risk at the firewatch post rather than guessing from dry ground. Inspect for live drought, wildfire, soil moisture and firebreak needs.',x:-23.25,z:16.55,width:.7,depth:.5,height:1.4,color:'#957c56'}),
  Object.freeze({id:'day24-firewatch-rain-tube',type:'object',label:'Firewatch rain collector',origin:'day24_firewatch_gauge',history:'This observation point reports live conditions. Rain does not automatically complete the unfinished firebreak.',x:-22.85,z:16.5,width:.2,depth:.2,height:1.7,color:'#a4aaa1'}),
  Object.freeze({id:'day24-firewatch-soil-stake',type:'object',label:'Dry soil observation stake',origin:'day24_firewatch_gauge',history:'A visible record of persistent drought and fire pressure. Visit the firebreak workbench to contribute materials.',x:-22.45,z:17.3,width:.26,depth:.26,height:.95,color:'#765d3f'})
]);
