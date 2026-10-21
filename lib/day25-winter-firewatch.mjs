// Day 25: permanent winter observations at the existing firewatch post.
export const DAY25=25;
export const DAY25_EVENT='day25_winter_firewatch_survey';
export const DAY25_ENTITIES=[
{id:'day25-firewatch-winter-path',type:'trail',label:'Winter survey path',width:.6,color:'#777365',points:[[-23.25,16.55],[-23.7,17.35],[-24,18.4]]},
{id:'day25-firewatch-winter-board',type:'object',label:'Winter survey board',origin:'day24_firewatch_gauge',history:'Inspect the live winter conditions and the unfinished firebreak.',x:-24,z:18.45,width:1.1,depth:.22,height:1.5,color:'#9a8464'},
{id:'day25-firewatch-snow-staff',type:'object',label:'Snow-depth staff',origin:'day24_firewatch_gauge',history:'Snowfall and soil moisture are measured separately.',x:-23.1,z:19.05,width:.16,depth:.16,height:1.7,color:'#c2b7a1'},
{id:'day25-firewatch-wind-screen',type:'object',label:'Winter wind screen',origin:'day24_firewatch_gauge',history:'Shelter for observers.',x:-24.8,z:19.05,width:1.15,depth:.18,height:1.15,color:'#806d51'}
];
