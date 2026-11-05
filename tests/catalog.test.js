import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonical, fingerprint, loadOptions, catalogCommand } from '../src/utils/catalogCommands.js'
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map}}
function session(){global.localStorage=storage();localStorage.setItem('auth_token','fixture-token');localStorage.setItem('auth_user',JSON.stringify({id:7,correo:'fixture@example.test'}));return storage()}
test('canonical fingerprint ignores object order and photo names',async()=>{
 assert.deepEqual(canonical({b:2,a:1}),{a:1,b:2});assert.equal(await fingerprint({b:2,a:1}),await fingerprint({a:1,b:2}))
 const a=new FormData(),b=new FormData();a.append('imagenes[]',new Blob(['same']),'first.png');b.append('imagenes[]',new Blob(['same']),'other.png');assert.equal(await fingerprint(a),await fingerprint(b))
})
test('selectors fetch every page without truncating',async()=>{
 const seen=[];const api={get:async(_,options)=>{const page=options.params.page;seen.push(page);return {data:{opciones:{current_page:page,last_page:2,data:[{id:page}]},capabilities:{can_edit_estado:false}}}}}
 const result=await loadOptions(api,'propietarios');assert.deepEqual(seen,[1,2]);assert.deepEqual(result.data.data,[{id:1},{id:2}])
})
test('uncertain POST retains UUID and explicit retry uses same command',async()=>{
 const store=session(),keys=[];const api={defaults:{baseURL:'https://fixture/api'},get:async()=>{throw {response:{status:404}}},request:async config=>{keys.push(config.headers['Idempotency-Key']);if(keys.length===1)throw {response:{status:503}};return {status:201,data:{id:1}}}}
 await assert.rejects(catalogCommand(api,'post','/propiedades',{name:'same'},null,store));assert.equal(store.map.size,1)
 assert.equal((await catalogCommand(api,'post','/propiedades',{name:'same'},null,store)).status,201);assert.equal(keys[0],keys[1]);assert.equal(store.map.size,0)
})
test('known command recovers response without repeating a toggle',async()=>{
 const store=session();let writes=0;const api={defaults:{baseURL:'https://fixture/api'},request:async()=>{writes++;throw new Error('lost reply')},get:async()=>({data:{status:200,result:{activo:false}}})}
 await assert.rejects(catalogCommand(api,'delete','/propiedades/1',undefined,null,store));const result=await catalogCommand(api,'delete','/propiedades/1',undefined,null,store);assert.equal(result.data.activo,false);assert.equal(writes,1)
})
test('changed pending payload is blocked and another identity uses a different key',async()=>{
 const store=session();let reads=0;const keys=[];const api={defaults:{baseURL:'https://fixture/api'},request:async config=>{keys.push(config.headers['Idempotency-Key']);throw new Error('offline')},get:async()=>{reads++;throw {response:{status:404}}}}
 await assert.rejects(catalogCommand(api,'post','/propiedades',{price:'100.00'},null,store));await assert.rejects(catalogCommand(api,'post','/propiedades',{price:'200.00'},null,store),/resultado pendiente/);assert.equal(keys.length,1)
 localStorage.setItem('auth_user',JSON.stringify({id:8,correo:'other@example.test'}));await assert.rejects(catalogCommand(api,'post','/propiedades',{price:'100.00'},null,store));assert.notEqual(keys[0],keys[1]);assert.equal(reads,1)
})

test('same identity keeps pending key after email change and a new session',async()=>{
 const store=session(),keys=[];const api={defaults:{baseURL:'https://fixture/api'},get:async()=>{throw {response:{status:404}}},request:async config=>{keys.push(config.headers['Idempotency-Key']);throw new Error('offline')}}
 await assert.rejects(catalogCommand(api,'post','/propiedades',{price:'100'},null,store));localStorage.setItem('auth_user',JSON.stringify({id:7,correo:'renamed@example.test'}));localStorage.setItem('auth_token','new-local-session')
 await assert.rejects(catalogCommand(api,'post','/propiedades',{price:'100'},null,store));assert.equal(keys[0],keys[1])
})
