export const PROFILE_KEY='mecha-arena.multiplayer.profile.v1';
export function createProfileClient({storage=localStorage,fetcher=fetch}={}) {
  let profile=null,generation=0;
  try{const saved=JSON.parse(storage.getItem(PROFILE_KEY));if(saved&&typeof saved.name==='string'&&typeof saved.id==='string')profile={id:saved.id,name:saved.name};}catch{}
  async function request(name,create) {
    const own=++generation,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try {
      const response=await fetcher('/api/profiles'+(create?'':'?name='+encodeURIComponent(name)),{
        method:create?'POST':'GET',headers:{'Content-Type':'application/json'},
        body:create?JSON.stringify({name}):undefined,cache:'no-store',signal:controller.signal});
      const value=await response.json();
      if(!response.ok){const error=new Error(value.error||'Não foi possível carregar o perfil.');error.status=response.status;throw error;}
      if(own!==generation)return profile;
      profile=value;
      try{storage.setItem(PROFILE_KEY,JSON.stringify({id:value.id,name:value.name}));}catch{}
      return profile;
    }finally{clearTimeout(timer);}
  }
  return {
    get profile(){return profile;},
    select(name){return request(name,true);},
    refresh(){return profile?request(profile.name,false):Promise.resolve(null);},
    clear(){generation++;profile=null;try{storage.setItem(PROFILE_KEY,'null');}catch{}},
  };
}
