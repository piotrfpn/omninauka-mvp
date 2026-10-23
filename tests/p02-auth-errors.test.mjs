import { assertReviewedCandidate } from './helpers/p03b-contract.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { authErrorKey, recoveryErrorKey } from '../src/lib/auth-errors.ts';

const read = p => fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const messages = JSON.parse(read('src/i18n/locales/pl/common.json'));
const translate = key => key.split('.').reduce((obj,k)=>obj?.[k],messages) ?? key;
function arrow(file,name) {
 const source=read(file), ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let found;
 function visit(node) {if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name&&node.initializer&&ts.isArrowFunction(node.initializer))found=node.initializer.getText(ast);ts.forEachChild(node,visit);}
 visit(ast);assert.ok(found);return found;
}
function load(file,name,deps) {
 const output=ts.transpileModule('const extracted = '+arrow(file,name),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return new Function(...Object.keys(deps),output+';return extracted;')(...Object.values(deps));
}
const event = {preventDefault(){}};
function contextLogin(response) {
 return load('src/lib/auth-context.tsx','login',{logoutRequested:{current:false},setIsDemoMode(){},authErrorKey,supabase:{auth:{signInWithPassword:response}}});
}
function contextRegister(response) {
 return load('src/lib/auth-context.tsx','register',{setIsDemoMode(){},authErrorKey,supabase:{auth:{signUp:response}}});
}
function form(kind,request,options={}) {
 const state={loading:false,submitted:false,error:'',success:'',password:'synthetic-password',linked:null};
 const submitting={current:false};
 const deps={submitting,email:'synthetic@example.invalid',password:'synthetic-password',name:'Synthetic',userRole:'student',ageBand:'16_17',
 setIsLoading:v=>{state.loading=v;},setError:v=>{state.error=v;},setErrorMessage:v=>{state.error=v;},setIsSubmitted:v=>{state.submitted=v;},
 setSuccessMessage:v=>{state.success=v;},setPassword:v=>{state.password=v;},setUnder13LinkResult:v=>{state.linked=v;},
 t:translate,toast:{success(){}},document:{activeElement:null},HTMLElement:class {},window:{location:{origin:'https://example.invalid'}},authErrorKey,recoveryErrorKey,
 ...options};
 if(kind==='recovery')deps.supabase={auth:{resetPasswordForEmail:request}};
 if(kind==='login')deps.login=request;
 if(kind==='register'){deps.register=request;deps.supabase=options.supabase??{rpc:async()=>({data:{linked:false}})};}
 const file={recovery:'ForgotPasswordPage',login:'LoginPage',register:'RegisterPage'}[kind];
 return {state,submitting,handler:load('src/pages/'+file+'.tsx','handleSubmit',deps)};
}
const successSignup={user:{identities:[{}]},session:null};
for (const [error,key] of [
 [{code:'email_not_confirmed'},'auth.errors.unconfirmed'],[{code:'invalid_credentials'},'auth.login.error.invalid'],
 [{code:'over_email_send_rate_limit',message:'changed wording'},'auth.errors.emailLimit'],[{code:'over_request_rate_limit'},'auth.errors.requestLimit'],
 [{status:429},'auth.errors.requestLimit'],[{code:'request_timeout'},'auth.errors.network'],[new TypeError('private details'),'auth.errors.network'],
 [{name:'AuthRetryableFetchError',status:503},'auth.errors.network'],[{status:500,message:'secret'},'auth.errors.generic'],
 [{message:'email_not_confirmed'},'auth.errors.generic'],[null,'auth.errors.generic']
]) test('codes map safely: '+key+' '+JSON.stringify(error),()=>assert.equal(authErrorKey(error),key));

for(const address of ['known','unknown'])test('recovery success is neutral for '+address+' address',async()=>{
 const expectedEmail=address+'@example.invalid';
 const f=form('recovery',async(email,opts)=>{assert.equal(email,expectedEmail);assert.equal(opts.redirectTo,'https://example.invalid/reset-password');return {error:null};},{email:expectedEmail});
 await f.handler(event);assert.equal(f.state.submitted,true);assert.equal(f.state.error,'');
 assert.match(messages.auth.forgot.successDesc1,/Jeśli konto/);assert.doesNotMatch(messages.auth.forgot.successDesc1,/wysłaliśmy/);
});
for(const [label,response,key] of [
 ['email rate',async()=>({error:{code:'over_email_send_rate_limit',status:429}}),'auth.errors.emailLimit'],
 ['429',async()=>({error:{status:429}}),'auth.errors.requestLimit'],
 ['network',async()=>{throw new TypeError('private transport details');},'auth.forgot.sendFailed'],
 ['SMTP',async()=>({error:{status:500,message:'private SMTP details'}}),'auth.forgot.sendFailed'],
 ['account-specific failure',async()=>({error:{code:'email_not_confirmed'}}),'auth.forgot.sendFailed']
])test('recovery '+label+' never shows success',async()=>{
 const f=form('recovery',response);await f.handler(event);assert.equal(f.state.submitted,false);assert.equal(f.state.error,translate(key));assert.equal(f.submitting.current,false);
});
for(const [code,key]of [['email_not_confirmed','auth.errors.unconfirmed'],['invalid_credentials','auth.login.error.invalid'],['over_email_send_rate_limit','auth.errors.emailLimit']])test('login '+code+' reaches UI',async()=>{
 const f=form('login',contextLogin(async()=>({error:{code,message:'private provider wording'}})));
 await f.handler(event);assert.equal(f.state.error,translate(key));
});
test('login network rejection is neutral',async()=>{const f=form('login',contextLogin(async()=>{throw new TypeError('private');}));await f.handler(event);assert.equal(f.state.error,translate('auth.errors.network'));});
test('login success keeps existing Auth-driven navigation',async()=>{const login=contextLogin(async()=>({error:null}));assert.deepEqual(await login('a','b'),{success:true});const f=form('login',login);await f.handler(event);assert.equal(f.state.error,'');assert.match(read('src/pages/LoginPage.tsx'),/if \(isAuthenticated && user\)/);});
for(const role of ['parent','student'])for(const ageBand of role==='parent'?['parent']:['under_13','13_15','16_17','18_plus'])test('signup metadata/confirmation preserved '+role+' '+ageBand,async()=>{
 const register=contextRegister(async(opts)=>{assert.deepEqual(opts.options.data,{name:'Synthetic',ageBand,user_role:role});return {data:successSignup,error:null};});
 const f=form('register',register,{userRole:role,ageBand});await f.handler(event);assert.equal(f.state.success,translate('auth.register.success.verify'));assert.equal(f.state.password,'');assert.equal(f.state.linked,null);
});
test('signup rate limit uses code and translated UI',async()=>{const f=form('register',contextRegister(async()=>({data:{},error:{code:'over_email_send_rate_limit',message:'private'}})));await f.handler(event);assert.equal(f.state.error,translate('auth.errors.emailLimit'));});
test('signup unknown error is not exposed',async()=>{const f=form('register',contextRegister(async()=>({data:{},error:{code:'unexpected',message:'private'}})));await f.handler(event);assert.equal(f.state.error,translate('auth.errors.generic'));});
for(const ageBand of ['under_13','13_15','16_17','parent'])test('existing signup session branch preserved '+ageBand,async()=>{
 let rpcCalls=0;const f=form('register',async()=>({success:true}),{ageBand,userRole:ageBand==='parent'?'parent':'student',supabase:{rpc:async name=>{assert.equal(name,'link_child_account');rpcCalls++;return {data:{linked:false}};}}});
 await f.handler(event);assert.equal(rpcCalls,ageBand==='under_13'?1:0);assert.equal(f.state.linked,ageBand==='under_13'?'no_preapproval':null);if(ageBand==='13_15')assert.equal(f.state.success,translate('auth.register.success.consent'));
});
for(const kind of ['recovery','login','register'])for(const fails of [true,false])test(kind+' double submit, unlock and retry '+fails,async()=>{
 let calls=0,release;const pending=new Promise(resolve=>{release=resolve;});
 const request=async()=>{calls++;await pending;if(fails)throw new TypeError('synthetic');return kind==='recovery'?{error:null}:{success:true};};
 const f=form(kind,request);const a=f.handler(event);const b=f.handler(event);assert.equal(calls,1);assert.equal(f.state.loading,true);release();await Promise.all([a,b]);assert.equal(f.submitting.current,false);assert.equal(f.state.loading,false);await f.handler(event);assert.equal(calls,2);
});
for(const options of [{userRole:''},{ageBand:''},{password:'x'}])test('register validation releases guard '+JSON.stringify(options),async()=>{
 let calls=0;const f=form('register',async()=>{calls++;},{...options});await f.handler(event);await f.handler(event);assert.equal(calls,0);assert.equal(f.submitting.current,false);assert.equal(f.state.loading,false);
});
test('PL/EN new keys are complete and recovery success is neutral',()=>{
 const en=JSON.parse(read('src/i18n/locales/en/common.json'));assert.deepEqual(Object.keys(en.auth.errors).sort(),Object.keys(messages.auth.errors).sort());assert.ok(en.auth.forgot.sendFailed);assert.match(en.auth.forgot.successDesc1,/If an account/);
});
test('security boundary sources remain byte-identical to HEAD',()=>{
 assertReviewedCandidate();
 assert.doesNotMatch(read('src/lib/auth-errors.ts'),/supabase|fetch\(|\.rpc\(|\.from\(|\.admin\./);
 assert.doesNotMatch(arrow('src/lib/auth-context.tsx','login'),/\.from\(|\.rpc\(|\.admin\./);
});
