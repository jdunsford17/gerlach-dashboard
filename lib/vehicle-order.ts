export function orderVehicles<T extends {id:string;status:string}>(units:T[],preferred:string[]=[],outOfServiceLast=true):T[]{
 const ranks=new Map(preferred.map((id,index)=>[id,index])),fallback=new Map(units.map((u,index)=>[u.id,index]));
 return [...units].sort((a,b)=>{
  if(outOfServiceLast){const status=Number(a.status==='Out of service')-Number(b.status==='Out of service');if(status)return status}
  return (ranks.get(a.id)??preferred.length+fallback.get(a.id)!)-(ranks.get(b.id)??preferred.length+fallback.get(b.id)!);
 });
}
