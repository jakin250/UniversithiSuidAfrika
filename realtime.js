(function(){
  const API='';
  const tokenKey='sessionToken';
  async function api(path, method='GET', body){
    const res=await fetch(API+path,{method,headers:{'Content-Type':'application/json','x-session-token':localStorage.getItem(tokenKey)||''},body:body?JSON.stringify(body):undefined});
    const data=await res.json(); if(!res.ok) throw new Error(data.error||'Request failed'); return data;
  }
  async function loginPrompt(){
    const email=prompt('Enter student email'); if(!email) return null;
    const out=await api('/api/login','POST',{email}); localStorage.setItem(tokenKey,out.token); return out.user;
  }
  window.sharedCampus={api,loginPrompt};
})();
