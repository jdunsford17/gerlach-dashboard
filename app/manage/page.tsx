import Manager from './manager-client';
import {headers} from 'next/headers';
import {stationAuthorized} from '../../lib/station-auth';
export const dynamic='force-dynamic';
export default async function ManagePage(){
 if(!stationAuthorized(await headers()))return <main className="managePortal"><h1>Management access restricted</h1><a href="/">View station board</a></main>;
 return <Manager/>;
}
