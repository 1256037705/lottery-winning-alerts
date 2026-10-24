import https from 'node:https';
import { readFileSync } from 'node:fs';

/** 部署诊断：完整校验证书，只输出状态和 Cookie 安全属性，不记录密码或 Token。 */
const origin=process.env.BETTER_AUTH_URL;
const username=process.env.BOOTSTRAP_USERNAME;
const password=process.env.BOOTSTRAP_PASSWORD;
if(!origin?.startsWith('https://')||!username||!password)throw new Error('缺少 HTTPS 地址或诊断账号环境变量');
const ca=readFileSync('/run/lottery-root.crt');
function request(path,method='GET',body, cookie){return new Promise((resolve,reject)=>{
  const data=body?JSON.stringify(body):undefined;
  const req=https.request(new URL(path,origin),{method,ca,rejectUnauthorized:true,timeout:15000,headers:{Origin:origin,...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{}),...(cookie?{Cookie:cookie}:{})}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,cookies:res.headers['set-cookie']??[],body:Buffer.concat(chunks).toString('utf8')}));
  });req.on('timeout',()=>req.destroy(new Error('诊断超时')));req.on('error',reject);req.end(data);
});}
try {
  const health=await request('/api/health');if(health.status!==200)throw new Error('健康检查失败');
  const login=await request('/api/auth/sign-in/username','POST',{username,password});if(login.status!==200)throw new Error(`认证失败 HTTP ${login.status}`);
  const sessionCookie=login.cookies.find(c=>c.includes('session_token='));
  if(!sessionCookie||!['secure','httponly','samesite=lax'].every(s=>sessionCookie.toLowerCase().includes(s)))throw new Error('会话 Cookie 安全属性不符');
  const cookie=login.cookies.map(c=>c.split(';')[0]).join('; ');
  const session=await request('/api/auth/get-session','GET',undefined,cookie);
  if(session.status!==200||JSON.parse(session.body)?.user?.username!==username)throw new Error('会话验证失败');
  const logout=await request('/api/auth/sign-out','POST',{},cookie);if(logout.status!==200)throw new Error('退出失败');
  console.log('PASS: HTTPS 证书校验 / 数据库健康 / 管理员登录 / Session / Secure+HttpOnly+SameSite / 退出');
} catch(e) {console.error(e.message);process.exitCode=1;}
