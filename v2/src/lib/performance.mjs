/** Closed-session P&L metrics, deliberately excluding incomplete games. */
export function playerPerformance(nights,playerId,range='all',now=new Date()) {
 const days=range==='30d'?30:range==='90d'?90:null;
 const threshold=days===null?null:new Date(now.getTime()-days*24*60*60*1000).getTime();
 const sessions=nights
  .filter(n=>threshold===null||new Date(n.game.started_at).getTime()>=threshold)
  .map(n=>({game:n.game,player:n.items.find(x=>x.key===playerId)}))
  .filter(n=>n.player&&Number.isFinite(n.player.net))
  .map(n=>({gameId:n.game.id,title:n.game.title||'Completed table',date:n.game.started_at,net:n.player.net,buyin:n.player.buyin||0}))
  .sort((a,b)=>a.date.localeCompare(b.date));
 let net=0,staked=0,wins=0,losses=0;
 const values=[0];
 for(const session of sessions){
  net+=session.net;staked+=session.buyin;
  if(session.net>0)wins++;
  else if(session.net<0)losses++;
  values.push(net);
 }
 return {
  sessions,values,net,buyins:staked,games:sessions.length,wins,losses,
  winRate:sessions.length?wins/sessions.length:0,
  average:sessions.length?Math.round(net/sessions.length):0,
  best:sessions.length?Math.max(...sessions.map(s=>s.net)):0,
  worst:sessions.length?Math.min(...sessions.map(s=>s.net)):0
 };
}
