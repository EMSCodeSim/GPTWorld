/** Shared gatherable resource defaults for public and private worlds. */
export const RESOURCE_DEFAULTS=Object.freeze({
  wood:{max:6,regrowMinutes:60},
  stone:{max:4,regrowMinutes:90},
  herbs:{max:3,regrowMinutes:20}
});

export function resourceDefaultsFor(resource){
  return RESOURCE_DEFAULTS[String(resource||'')]||null;
}

export function privateKindToResource(kind){
  if(kind==='tree')return 'wood';
  if(kind==='rock')return 'stone';
  if(kind==='herbs')return 'herbs';
  return null;
}
