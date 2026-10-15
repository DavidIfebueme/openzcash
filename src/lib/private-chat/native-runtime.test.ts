import { afterEach, expect, it } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { openRoom, signRoomOperation } from "./discovery-room";
import { createDeviceIdentity } from "./identity";
import { createLiveInvite } from "./live-invite";
import { presenceCommand } from "./presence";
import { directoryRoomProofBody, sealDirectory, openDirectory } from "./directory-wire";
import { messageId } from "./messages";
import { parseNativeFrame } from "./native-wire";
const address="DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf";
const cleanups: Array<()=>Promise<unknown>>=[];
afterEach(async()=>{ for(const cleanup of cleanups.reverse()) await cleanup(); cleanups.length=0; });
async function availablePort() {
  const server=createServer(); server.listen(0,"127.0.0.1"); await once(server,"listening");
  const port=(server.address() as {port:number}).port;
  await new Promise<void>(resolve=>server.close(()=>resolve())); return port;
}
async function until<T>(read:()=>Promise<T|undefined>, timeout=20_000):Promise<T>{
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){ const value=await read(); if(value!==undefined)return value; await new Promise(r=>setTimeout(r,30)); }
  throw new Error("Local runtime did not become ready");
}
it("persists the provider and removals across restart, replies only via transport SURBs, closes when native transport fails", async()=>{
  // Local native-WebSocket fixture: this proves integration, not mixnet delivery.
  const directory=await mkdtemp(join(tmpdir(),"oz-directory-runtime-"));
  cleanups.push(()=>rm(directory,{recursive:true,force:true}));
  const room=(await openRoom())!;
  const gateway=new WebSocketServer({host:"127.0.0.1",port:0});
  await once(gateway,"listening");
  cleanups.push(async()=>{for(const client of gateway.clients)client.terminate(); await new Promise<void>(r=>gateway.close(()=>r()));});
  let socket:WebSocket|undefined;
  let nativeIdentityByte=1;
  const replies:Buffer[]=[];
  gateway.on("connection",client=>{
    socket=client;
    client.on("message",data=>{
      const bytes=Buffer.from(data as Buffer);
      if(bytes.length===1&&bytes[0]===3){
        const frame=Buffer.alloc(97,nativeIdentityByte); frame[0]=2;
        client.send(frame);
      } else replies.push(bytes);
    });
  });
  const healthPort=await availablePort();
  const key=randomBytes(32).toString("base64url");
  const selfAddressFrame=Buffer.alloc(97,1); selfAddressFrame[0]=2;
  const selfAddress=parseNativeFrame(selfAddressFrame);
  expect(selfAddress?.kind).toBe("address");
  let pinned={address:(selfAddress as {kind:"address";address:string}).address,publicKey:(await createDeviceIdentity()).publicKey};
  let child:ChildProcess|undefined;
  let errors="";
  cleanups.push(async()=>{if(child&&child.exitCode===null){const closed=once(child,"exit");child.kill("SIGTERM");await closed;}});
  async function start(){
    socket=undefined;errors="";
    child=spawn("python3",["scripts/private-chat-directory-lock.py",process.execPath,"--import","tsx","scripts/private-chat-directory-server.ts"],{
      cwd:process.cwd(),stdio:["ignore","ignore","pipe"],env:{
        ...process.env,NODE_ENV:"production",
        PRIVATE_CHAT_DIRECTORY_DATA:directory,PRIVATE_CHAT_DIRECTORY_STORAGE_KEY:key,
        PRIVATE_CHAT_DIRECTORY_ADDRESS:pinned.address,PRIVATE_CHAT_DIRECTORY_PUBLIC_KEY:pinned.publicKey,
        PRIVATE_CHAT_DIRECTORY_ROOMS:JSON.stringify({[room.id]:10}),
        PRIVATE_CHAT_NYM_WEBSOCKET:"ws://127.0.0.1:"+(gateway.address() as {port:number}).port,
        PRIVATE_CHAT_DIRECTORY_HEALTH_PORT:String(healthPort),
      }});
    child.stderr!.on("data", chunk=>{errors+=chunk.toString();});
    return until(async()=>{
      if(child!.exitCode!==null)throw new Error("Runtime exited: "+errors);
      try{
        const health=await fetch("http://127.0.0.1:"+healthPort+"/healthz");
        if(health.status!==200)return undefined;
        return JSON.parse(await readFile(join(directory,"descriptor.json"),"utf8")) as {publicKey:string;address:string;replyMode:string};
      }catch{return undefined;}
    });
  }
  async function stop(){
    const closed=once(child!,"exit");child!.kill("SIGTERM");await closed;
    expect(child!.exitCode).toBe(0);
  }
  await expect(start()).rejects.toThrow("Runtime exited");
  const init=spawn("python3",["scripts/private-chat-directory-lock.py",process.execPath,"--import","tsx","scripts/private-chat-directory-init.ts"],{
    cwd:process.cwd(),stdio:"ignore",env:{...process.env,NODE_ENV:"production",
      PRIVATE_CHAT_DIRECTORY_DATA:directory,PRIVATE_CHAT_DIRECTORY_STORAGE_KEY:key,
      PRIVATE_CHAT_DIRECTORY_ADDRESS:pinned.address}});
  await once(init,"exit"); expect(init.exitCode).toBe(0);
  pinned=JSON.parse(await readFile(join(directory,"descriptor.json"),"utf8"));
  const config=await start();
  expect(config.replyMode).toBe("surb");
  const sender=await createDeviceIdentity(), person=await createDeviceIdentity();
  async function request(body:unknown){
    const q={v:1 as const,id:messageId(),at:Date.now(),body};
    const bytes=await sealDirectory(2,{...q,roomProof:await signRoomOperation(room.authSecret,directoryRoomProofBody(q))},sender,config.publicKey);
    const tag=randomBytes(16), frame=Buffer.alloc(26+bytes.length);
    frame[0]=1;frame[1]=1;tag.copy(frame,2);frame.writeBigUInt64BE(BigInt(bytes.length),18);frame.set(bytes,26);
    socket!.send(frame);
    const reply=await until(async()=>replies.shift());
    expect(reply[0]).toBe(2);
    expect(reply.subarray(1,17)).toEqual(tag);
    expect(reply.readBigUInt64BE(17)).toBe(0n);
    expect(reply.readBigUInt64BE(25)).toBe(16_457n);
    const opened=await openDirectory(new Uint8Array(reply.subarray(33)),3,sender.secretKey,config.publicKey);
    expect(opened?.value).toMatchObject({id:q.id});
    return opened?.value as {status:number;entries?:unknown[]};
  }
  const invite=await createLiveInvite(person,"Test participant",address);
  const publish=await presenceCommand(person,room,invite,"upsert",1,person);
  expect((await request(publish)).status).toBe(200);
  const metrics=await (await fetch("http://127.0.0.1:"+healthPort+"/metrics")).json() as Record<string,unknown>;
  expect(Object.keys(metrics).sort()).toEqual(["discarded","failures","queued","ready","received","uptimeSeconds"]);
  expect(metrics).toMatchObject({ready:true,received:1,queued:1,discarded:0,failures:0});
  expect(JSON.stringify(metrics)).not.toContain(room.id);
  expect(JSON.stringify(metrics)).not.toContain(person.publicKey);
  expect(JSON.stringify(metrics)).not.toContain(config.address);
  const duplicate=spawn("python3",["scripts/private-chat-directory-lock.py",process.execPath,"-e","process.exit(0)"],{
    cwd:process.cwd(),stdio:"ignore",env:{...process.env,PRIVATE_CHAT_DIRECTORY_DATA:directory}});
  await once(duplicate,"exit"); expect(duplicate.exitCode).toBe(75);
  const crashed=once(child!,"exit"); child!.kill("SIGKILL"); await crashed;
  expect(await start()).toEqual(config);
  expect((await request({op:"list",room:room.id,after:null})).entries).toHaveLength(1);
  expect((await request(await presenceCommand(person,room,invite,"remove",2))).status).toBe(200);
  await stop(); await start();
  expect((await request(publish)).status).toBe(409);
  expect((await request({op:"list",room:room.id,after:null})).entries).toEqual([]);
  const exit=once(child!,"exit"); socket!.terminate(); await exit;
  expect(child!.exitCode).toBe(1);

  // A fresh native identity must never rewrite the published address.
  nativeIdentityByte=2;
  await expect(start()).rejects.toThrow("Runtime exited");
  expect(JSON.parse(await readFile(join(directory,"descriptor.json"),"utf8"))).toEqual(config);
  nativeIdentityByte=1;
  expect(await start()).toEqual(config);
  await stop();
  await rm(directory,{recursive:true,force:true});
  await mkdir(directory,{mode:0o700});
  await expect(start()).rejects.toThrow("Runtime exited");
},90_000);
