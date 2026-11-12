import {displayHtml} from '../../lib/display-html';
export async function GET(request:Request){
 return new Response(displayHtml,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
