export const FLEET_BOARD='18436694577';
export const FLEET_ITEMS:Record<string,{name:string;id:string}>={
 '13364624161':{name:'Medic 83',id:'83'},
 '13364648973':{name:'Royal 1024',id:'custom-1024'},
 '13364608513':{name:'Medic 83-X',id:'custom-medic-83-x'},
 '13364623877':{name:'Medic 183',id:'183'},
};
export const FLEET_COLUMNS={readiness:'color_mm8dcpe6',notes:'long_text_mm8d8wtt'};
export function fleetChange(event:any){
 if(String(event?.boardId)!==FLEET_BOARD||!FLEET_ITEMS[String(event.pulseId||event.itemId)])return null;
 const column=event.columnId;if(!Object.values(FLEET_COLUMNS).includes(column))return null;
 const time=Number(event.changedAt)*1000||Date.parse(event.triggerTime);if(!Number.isFinite(time)||time>Date.now()+300000)throw Error('Invalid event time');
 let value=event.value;if(typeof value==='string'){try{value=JSON.parse(value)}catch{value={text:value}}}
 let field:string,result:string;
 if(column===FLEET_COLUMNS.readiness){field='status';const label=value?.label?.text??value?.label??'';const labels:Record<string,string>={'Ready / In Service':'Available','Limited Service':'Limited service','Out of Service':'Out of service','Not Checked / Not Assigned':'Unverified','':'Unverified'};if(typeof label!=='string'||!(label in labels))throw Error('Unknown readiness');result=labels[label];}
 else{field='note';result=value?.text??'';if(typeof result!=='string'||result.length>10000)throw Error('Invalid notes');result=result.slice(0,250)}
 return {item:FLEET_ITEMS[String(event.pulseId||event.itemId)],field,value:result,time};
}
