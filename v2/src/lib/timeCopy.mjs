export function greetingForHour(hour){
 if(!Number.isFinite(hour) || hour<0 || hour>23) return 'Hello';
 if(hour<12) return 'Good morning';
 if(hour<17) return 'Good afternoon';
 return 'Good evening';
}
