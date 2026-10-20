import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiError,assertSameOrigin} from '../src/lib/auth';
const denied=(status:number)=>(error:unknown)=>error instanceof ApiError&&error.status===status;
const request=(origin:string|null,host='127.0.0.1:3100',extra:Record<string,string>={})=>new Request('http://localhost:3100/api/auth/setup',{method:'POST',headers:{host,...(origin?{origin}:{}),...extra}});

test('CSRF compares actual browser Host in development and configured canonical origin in production',()=>{
 const previousMode=process.env.NODE_ENV, previousOrigin=process.env.WASLI_APP_ORIGIN;
 try {
  Object.assign(process.env,{NODE_ENV:'development'});delete process.env.WASLI_APP_ORIGIN;
  assert.doesNotThrow(()=>assertSameOrigin(request('http://127.0.0.1:3100')));
  assert.throws(()=>assertSameOrigin(request(null)),denied(403));
  assert.throws(()=>assertSameOrigin(request('http://attacker.invalid:3100')),denied(403));
  assert.throws(()=>assertSameOrigin(request('http://attacker.invalid:3100','127.0.0.1:3100',{'x-forwarded-host':'attacker.invalid:3100'})),denied(403));
  assert.throws(()=>assertSameOrigin(request('https://127.0.0.1:3100')),denied(403));
  assert.throws(()=>assertSameOrigin(request('http://attacker.invalid','attacker.invalid@127.0.0.1:3100')),denied(403));
  Object.assign(process.env,{NODE_ENV:'production'});
  assert.throws(()=>assertSameOrigin(request('http://127.0.0.1:3100')),denied(503));
  process.env.WASLI_APP_ORIGIN='https://wasli.example.invalid';
  assert.doesNotThrow(()=>assertSameOrigin(request('https://wasli.example.invalid','internal-service:3100')));
  assert.throws(()=>assertSameOrigin(request('https://attacker.invalid','attacker.invalid')),denied(403));
  process.env.WASLI_APP_ORIGIN='https://wasli.example.invalid/private';
  assert.throws(()=>assertSameOrigin(request('https://wasli.example.invalid')),denied(503));
  process.env.WASLI_APP_ORIGIN='http://public.example.invalid';
  assert.throws(()=>assertSameOrigin(request('http://public.example.invalid')),denied(503));
  process.env.WASLI_APP_ORIGIN='http://127.0.0.1:3100';
  assert.doesNotThrow(()=>assertSameOrigin(request('http://127.0.0.1:3100')));
 } finally {
  if(previousMode===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Object.assign(process.env,{NODE_ENV:previousMode});
  if(previousOrigin===undefined)delete process.env.WASLI_APP_ORIGIN;else process.env.WASLI_APP_ORIGIN=previousOrigin;
 }
});
