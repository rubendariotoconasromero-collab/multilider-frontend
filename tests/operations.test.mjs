import test from 'node:test'
import assert from 'node:assert/strict'
import { installBusinessInterceptors, pendingOperations, OperationPending } from '../src/api/operations.js'
const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002']
function setup(states=[]) {
  const map=new Map([['auth_user',JSON.stringify({id:1})]])
  const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}
  const callbacks={}
  const api={defaults:{baseURL:'https://example.test/api'},interceptors:{request:{use:f=>callbacks.request=f},response:{use:(f,e)=>{callbacks.response=f;callbacks.error=e}}},get:async()=>({data:states.shift()})}
  let n=0
  installBusinessInterceptors(api,{storage,newId:()=>ids[n++%2],delay:async()=>{},polls:2})
  return {storage,api,callbacks,map}
}
test('a command carries stable UUIDs and stores no form data or secret',()=>{
  const {callbacks,api,storage,map}=setup()
  const config=callbacks.request({method:'post',url:'/ventas',data:{password:'never-store-this',monto_total:100}})
  assert.equal(config.headers['Idempotency-Key'],ids[1])
  assert.equal(config.data.operacion_id,ids[0])
  assert.equal(pendingOperations(api,storage).length,1)
  assert.ok(![...map.values()].some(v=>v.includes('never-store-this')))
})
test('202 remains pending instead of being returned as success',async()=>{
  const {callbacks,api,storage}=setup([{state:'Pendiente'},{state:'Pendiente'}])
  const config=callbacks.request({method:'post',url:'/ventas',data:{}})
  await assert.rejects(callbacks.response({config,status:202,data:{}}),OperationPending)
  assert.equal(pendingOperations(api,storage).length,1)
})
test('a completed asynchronous operation resolves once and clears metadata',async()=>{
  const {callbacks,api,storage}=setup([{state:'Completada',resultado:{data:{id:7}}}])
  const config=callbacks.request({method:'post',url:'/ventas',data:{}})
  const response=await callbacks.response({config,status:202,data:{}})
  assert.equal(response.data.data.id,7)
  assert.equal(response.status,200)
  assert.deepEqual(pendingOperations(api,storage),[])
})
test('auth and mail requests do not acquire business command IDs',()=>{
  const {callbacks}=setup()
  const config={method:'post',url:'/perfil/correo/enviar',data:{password:'temporary'}}
  assert.equal(callbacks.request(config),config)
  assert.equal(config._businessOperation,undefined)
})
test('a network failure keeps its command recoverable',async()=>{
  const {callbacks,api,storage}=setup()
  const config=callbacks.request({method:'post',url:'/pagos',data:{monto:10}})
  await assert.rejects(callbacks.error({config}),OperationPending)
  assert.equal(pendingOperations(api,storage)[0].id,ids[0])
})
