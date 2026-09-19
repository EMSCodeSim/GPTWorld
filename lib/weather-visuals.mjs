/** Shared precipitation classification for public and private weather visuals. */

export function classifyPrecipitation(value){
  const precip=String(value||'clear').toLowerCase();
  const wet=precip.includes('rain')||precip.includes('storm')||precip.includes('shower');
  const snow=precip.includes('snow');
  const cloudy=wet||snow||precip.includes('cloud')||precip.includes('overcast');
  const foggy=wet||precip.includes('fog');
  return{precip,wet,snow,cloudy,foggy,clear:!wet&&!snow&&!cloudy};
}
