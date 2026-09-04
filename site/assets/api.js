const CSRF_COOKIE='__Host-cf_csrf';

function cookie(name){
  const prefix=`${encodeURIComponent(name)}=`;
  for(const part of document.cookie.split(';')){
    const value=part.trim();
    if(value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
  }
  return null;
}

export async function api(path,{method='GET',body,csrf=false}={}){
  const headers={Accept:'application/json'};
  if(body!==undefined) headers['Content-Type']='application/json';
  if(csrf){
    const token=cookie(CSRF_COOKIE);
    if(!token) throw new Error('csrf_missing');
    headers['X-CSRF-Token']=token;
  }
  const response=await fetch(path,{method,headers,credentials:'same-origin',body:body===undefined?undefined:JSON.stringify(body)});
  let payload={};
  try{payload=await response.json();}catch{}
  if(!response.ok){
    const error=new Error(payload.error||`http_${response.status}`);
    error.status=response.status;
    error.payload=payload;
    throw error;
  }
  return payload;
}

export function messageFor(error){
  const code=error?.message||'';
  const messages={
    invalid_credentials:'Username, password, or selected role is incorrect.',
    setup_required:'CharacterForge needs its first administrator before sign-in can begin.',
    setup_complete:'First-time setup is already complete.',
    password_too_short:'Password must be at least 12 characters.',
    password_mismatch:'The password confirmation does not match.',
    username_unavailable:'That username is unavailable.',
    unauthorized:'Your session has expired. Please sign in again.',
    csrf_invalid:'Your security token is stale. Refresh the page and try again.',
    service_unavailable:'CharacterForge is temporarily unavailable.'
  };
  return messages[code]||'CharacterForge could not complete that request.';
}
