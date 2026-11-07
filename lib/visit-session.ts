type Visit={visitor:string;session:string;lastSeen:number};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function visitSession(storage:Pick<Storage,'getItem'|'setItem'>,now=Date.now(),makeId=()=>crypto.randomUUID()):Visit {
 let previous:Partial<Visit>={};try{previous=JSON.parse(storage.getItem('najd-visit-v1')||'{}')}catch{}
 const visitor=typeof previous.visitor==='string'&&uuid.test(previous.visitor)?previous.visitor:makeId();
 const active=typeof previous.session==='string'&&uuid.test(previous.session)&&typeof previous.lastSeen==='number'&&now>=previous.lastSeen&&now-previous.lastSeen<30*60*1000;
 const value={visitor,session:active?previous.session!:makeId(),lastSeen:now};storage.setItem('najd-visit-v1',JSON.stringify(value));return value;
}
