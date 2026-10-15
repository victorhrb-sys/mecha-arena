// Public, trusted-group identities. Knowing a name selects that profile;
// it never grants access to an existing room session or private robot.
export function profileName(value) {
  if(typeof value!=='string')throw new Error('Informe um nome de usuário de até 24 caracteres.');
  const name=value.normalize('NFKC').trim().replace(/\s+/gu,' ');
  if(!name||name.length>24||/[\p{Cc}\p{Cf}]/u.test(name))throw new Error('Informe um nome de usuário de até 24 caracteres, sem caracteres de controle.');
  return name;
}
export const profileKey=value=>profileName(value).toLowerCase();

export function createProfileService(store,{now=Date.now}={}) {
  async function details(profile) {
    if(!profile)return null;
    const {stats,history}=await store.profileSummary(profile.id);
    return {id:profile.id,name:profile.name,createdAt:profile.created_at,
      stats:{matches:stats.matches,wins:stats.wins,losses:stats.matches-stats.wins,arenaWins:stats.arenaWins,
        winRate:stats.matches?Math.round(stats.wins/stats.matches*100):0},history};
  }
  return {
    async open(name){return details(await store.ensureProfile(profileName(name),now()));},
    async get(name){return details(await store.findProfile(profileKey(name)));},
  };
}
