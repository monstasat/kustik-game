(function(){
"use strict";

var APP_VERSION="1.0";
var KEY="kustik_game_v1";
var canvas=document.getElementById("game");
var ctx=canvas.getContext("2d");
var menuScreen=document.getElementById("menuScreen");
var gameScreen=document.getElementById("gameScreen");
var overlay=document.getElementById("overlay");
var overlayTitle=document.getElementById("overlayTitle");
var overlayText=document.getElementById("overlayText");
var stageBanner=document.getElementById("stageBanner");
var cucumbersEl=document.getElementById("cucumbers");
var scoreEl=document.getElementById("score");
var livesEl=document.getElementById("lives");
var shieldEl=document.getElementById("shield");
var shellBtn=document.getElementById("shellBtn");
var pauseBtn=document.getElementById("pauseBtn");
var toastEl=document.getElementById("toast");

var W=720,H=420,GROUND=342;
var running=false,paused=false,hidden=false,won=false;
var score=0,cucumberCount=0,lives=3,shield=0,best=0;
var speed=255,spawnTimer=0,birdTimer=2600,last=0;
var objects=[],particles=[];
var bossActive=false,bossLevel=0,bossWaveTotal=0,bossWaveSpawned=0,bossWavePassed=0;
var boss10=false,boss18=false,boss24=false,finalSpawned=false;
var snail={x:94,y:GROUND-52,w:72,h:52,vy:0,jumping:false,inv:0};

function safeGet(){
  try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){return {}}
}
function safeSet(){
  try{localStorage.setItem(KEY,JSON.stringify({best:best}))}catch(e){}
}
function load(){
  var s=safeGet();
  best=Number(s.best)||0;
  document.getElementById("continueBtn").textContent="🏆 Лучший результат: "+best;
}
function rnd(a,b){return a+Math.random()*(b-a)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function overlap(a,b){
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
function rr(c,x,y,w,h,r){
  r=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
}
function toast(msg){
  toastEl.textContent=msg;toastEl.classList.add("show");
  setTimeout(function(){toastEl.classList.remove("show")},1200);
}
function stage(){
  if(finalSpawned)return {name:"ЛЕГЕНДАРНЫЙ ОГУРЕЦ",speed:1.05,bird:999999};
  if(bossActive)return {name:"МУСОРНЫЙ БОСС "+bossLevel,speed:1.12,bird:999999};
  if(cucumberCount>=18)return {name:"Мусорная зона",speed:1.16,bird:2800};
  if(cucumberCount>=10)return {name:"Сад опасностей",speed:1.09,bird:3400};
  return {name:"Клубничная грядка",speed:1,bird:4400};
}
function sync(){
  cucumbersEl.textContent=cucumberCount+"/25";
  scoreEl.textContent=score;
  livesEl.textContent=lives;
  shieldEl.textContent=shield;
  stageBanner.textContent=stage().name;
}
function reset(){
  score=0;cucumberCount=0;lives=3;shield=0;won=false;
  speed=255;spawnTimer=350;birdTimer=2600;objects=[];particles=[];
  bossActive=false;bossLevel=0;bossWaveTotal=0;bossWaveSpawned=0;bossWavePassed=0;
  boss10=false;boss18=false;boss24=false;finalSpawned=false;
  hidden=false;paused=false;
  snail.y=GROUND-snail.h;snail.vy=0;snail.jumping=false;snail.inv=0;
  shellBtn.classList.remove("active");pauseBtn.textContent="⏸ Пауза";
  overlay.classList.add("hidden");
  sync();
}
function showGame(){
  menuScreen.classList.add("hidden");gameScreen.classList.remove("hidden");
  reset();running=true;last=performance.now();requestAnimationFrame(loop);
}
function showMenu(){
  running=false;gameScreen.classList.add("hidden");menuScreen.classList.remove("hidden");
  load();
}
function jump(){
  if(!running||paused||hidden||snail.jumping)return;
  snail.vy=-610;snail.jumping=true;
}
function setHidden(v){
  if(!running)return;
  hidden=!!v;
  shellBtn.classList.toggle("active",hidden);
}
function togglePause(){
  if(!running)return;
  paused=!paused;pauseBtn.textContent=paused?"▶️ Продолжить":"⏸ Пауза";
  if(!paused){last=performance.now();requestAnimationFrame(loop)}
}
function hit(){
  if(snail.inv>0)return;
  if(shield>0){shield--;snail.inv=800;toast("Сепия спасла Кустика!");sync();return}
  lives--;snail.inv=1000;sync();
  if(lives<=0)gameOver();
}
function startBoss(level){
  bossActive=true;bossLevel=level;bossWaveSpawned=0;bossWavePassed=0;
  bossWaveTotal=level===1?4:level===2?6:8;
  objects=objects.filter(function(o){return o.type!=="bird"&&o.type!=="birdWarn"});
  spawnTimer=260;birdTimer=999999;toast("МУСОРНЫЙ БОСС!");
}
function maybeBoss(){
  if(cucumberCount>=24&&!boss24){boss24=true;startBoss(3);return}
  if(cucumberCount>=18&&!boss18){boss18=true;startBoss(2);return}
  if(cucumberCount>=10&&!boss10){boss10=true;startBoss(1)}
}
function finishBoss(){
  bossActive=false;score+=bossLevel*25;
  if(bossLevel===3){
    finalSpawned=true;
    objects.push({type:"gold",x:770,y:GROUND-92,w:102,h:72,v:155,hit:false});
    toast("ЛЕГЕНДАРНЫЙ ОГУРЕЦ!");
  }else toast("Босс пройден!");
  birdTimer=1800;sync();
}
function win(){
  if(won)return;won=true;running=false;
  score+=250;cucumberCount=25;sync();
  if(score>best){best=score;safeSet()}
  overlayTitle.textContent="🏆 ПОБЕДА!";
  overlayText.innerHTML="Кустик собрал все <b>25 огурцов</b>, пережил три Мусорные Катастрофы и нашёл <b>Легендарный Огурец</b>.<br><br><b>Золотой. Огромный. Единственный.</b><br><br>Мягкий. Сочный. Легко соскабливается радулой.<br><b>Это была любовь.</b><br><br>Счёт: <b>"+score+"</b>";
  overlay.classList.remove("hidden");
}
function gameOver(){
  running=false;if(score>best){best=score;safeSet()}
  overlayTitle.textContent="Кустик спрятался";
  overlayText.innerHTML="Собрано огурцов: <b>"+cucumberCount+"/25</b><br>Счёт: <b>"+score+"</b><br><br>Легендарный Огурец всё ещё ждёт.";
  overlay.classList.remove("hidden");
}
function spawn(){
  var s=stage(),r=Math.random();
  if(bossActive){
    if(bossWaveSpawned<bossWaveTotal){
      bossWaveSpawned++;
      objects.push({type:"bossTrash",x:760,y:GROUND-(bossLevel===3?78:68),w:bossLevel===3?66:58,h:bossLevel===3?78:68,v:speed*(1.05+bossLevel*.035),hit:false,counted:false});
    }
    return;
  }
  if(finalSpawned)return;
  if(r<.48)objects.push({type:"cucumber",x:760,y:GROUND-42,w:50,h:34,v:speed,hit:false});
  else if(r<.64)objects.push({type:"water",x:760,y:GROUND-65,w:34,h:42,v:speed,hit:false});
  else if(r<.73)objects.push({type:"calcium",x:760,y:GROUND-48,w:42,h:30,v:speed,hit:false});
  else if(cucumberCount>=18&&r>.90)objects.push({type:"trash",x:760,y:GROUND-68,w:54,h:68,v:speed*1.03,hit:false});
  else objects.push({type:"rock",x:760,y:GROUND-38,w:44,h:38,v:speed,hit:false});
}
function spawnBird(){
  if(bossActive||finalSpawned||cucumberCount<4)return;
  objects.push({type:"birdWarn",x:650,y:80,w:40,h:30,v:0,life:800,hit:false});
}
function burst(x,y,kind){
  for(var i=0;i<9;i++)particles.push({x:x,y:y,vx:rnd(-80,80),vy:rnd(-130,-35),life:620,kind:kind});
}
function update(dt){
  var s=stage();speed=255*s.speed;
  if(snail.inv>0)snail.inv-=dt*1000;
  if(!hidden){
    snail.vy+=1500*dt;snail.y+=snail.vy*dt;
    if(snail.y>=GROUND-snail.h){snail.y=GROUND-snail.h;snail.vy=0;snail.jumping=false}
  }else{
    snail.vy=0;snail.y=GROUND-snail.h+15;
  }

  spawnTimer-=dt*1000;
  if(spawnTimer<=0){
    spawn();spawnTimer=bossActive?rnd(690,930):rnd(650,1040);
  }
  birdTimer-=dt*1000;
  if(!bossActive&&!finalSpawned&&birdTimer<=0&&cucumberCount>=4){
    spawnBird();birdTimer=rnd(s.bird,s.bird+1700);
  }

  var snailHit={x:snail.x+10,y:snail.y+7,w:snail.w-20,h:snail.h-10};
  for(var i=0;i<objects.length;i++){
    var o=objects[i];
    if(o.type==="birdWarn"){
      o.life-=dt*1000;
      if(o.life<=0){o.type="bird";o.x=760;o.y=90;o.w=72;o.h=42;o.v=390;delete o.life}
      continue;
    }
    o.x-=o.v*dt;
    if(o.type==="bird")o.y=92+Math.sin(o.x/55)*22;

    if(!o.hit && overlap(snailHit,o)){
      if(o.type==="cucumber"&&!hidden){
        o.hit=true;score+=10;cucumberCount++;burst(o.x,o.y,"green");sync();maybeBoss();
      }else if(o.type==="water"&&!hidden){
        o.hit=true;score+=4;burst(o.x,o.y,"blue");sync();
      }else if(o.type==="calcium"&&!hidden){
        o.hit=true;shield=1;score+=7;burst(o.x,o.y,"white");toast("Щит сепии!");sync();
      }else if(o.type==="gold"&&!hidden){
        o.hit=true;cucumberCount=25;burst(o.x,o.y,"gold");win();
      }else if(o.type==="bird"){
        if(hidden){o.hit=true;score+=3;sync()}
        else{o.hit=true;hit()}
      }else if((o.type==="rock"||o.type==="trash"||o.type==="bossTrash")&&!hidden){
        o.hit=true;hit();
      }
    }
    if(o.type==="bossTrash"&&!o.hit&&!o.counted&&o.x<-100){o.counted=true;bossWavePassed++}
  }

  objects=objects.filter(function(o){return !o.hit&&o.x>-150&&(o.life===undefined||o.life>0)});
  if(bossActive&&bossWaveSpawned>=bossWaveTotal){
    var left=objects.some(function(o){return o.type==="bossTrash"});
    if(!left)finishBoss();
  }

  for(var p=0;p<particles.length;p++){
    particles[p].x+=particles[p].vx*dt;particles[p].y+=particles[p].vy*dt;particles[p].vy+=350*dt;particles[p].life-=dt*1000;
  }
  particles=particles.filter(function(p){return p.life>0});
}
function drawBackground(){
  var g=ctx.createLinearGradient(0,0,0,H);
  if(cucumberCount>=18){g.addColorStop(0,"#c9d4c4");g.addColorStop(.72,"#e6dfbf");}
  else {g.addColorStop(0,"#cbe9c1");g.addColorStop(.72,"#edf3cf");}
  g.addColorStop(.73,"#a6754d");g.addColorStop(1,"#7a5235");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#7ab16d";
  for(var i=0;i<8;i++){ctx.beginPath();ctx.arc(i*115+20,GROUND+4,62,Math.PI,0);ctx.fill()}
  ctx.fillStyle="rgba(255,255,255,.38)";
  for(var j=0;j<4;j++){ctx.beginPath();ctx.arc(100+j*185,70+(j%2)*28,28,0,Math.PI*2);ctx.arc(130+j*185,65+(j%2)*28,36,0,Math.PI*2);ctx.fill()}
}
function drawSnail(){
  ctx.save();
  if(snail.inv>0&&Math.floor(snail.inv/90)%2===0)ctx.globalAlpha=.35;
  var x=snail.x,y=snail.y;
  if(hidden){
    ctx.fillStyle="#8c623f";ctx.beginPath();ctx.arc(x+37,y+34,27,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#5b3b27";ctx.lineWidth=5;ctx.beginPath();ctx.arc(x+37,y+34,15,0,Math.PI*1.7);ctx.stroke();
  }else{
    ctx.fillStyle="#7eaf62";rr(ctx,x+5,y+25,62,24,12);ctx.fill();
    ctx.fillStyle="#986b45";ctx.beginPath();ctx.arc(x+37,y+24,24,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#68452d";ctx.lineWidth=4;ctx.beginPath();ctx.arc(x+37,y+24,13,0,Math.PI*1.8);ctx.stroke();
    ctx.strokeStyle="#577449";ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(x+62,y+27);ctx.lineTo(x+70,y+6);ctx.moveTo(x+55,y+27);ctx.lineTo(x+58,y+7);ctx.stroke();
    ctx.fillStyle="#253627";ctx.beginPath();ctx.arc(x+70,y+5,3,0,Math.PI*2);ctx.arc(x+58,y+6,3,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawCucumber(o,golden){
  ctx.save();ctx.translate(o.x+o.w/2,o.y+o.h/2);
  if(golden){
    var pulse=1+Math.sin(Date.now()/130)*.06;ctx.scale(pulse,pulse);
    var glow=ctx.createRadialGradient(0,0,5,0,0,o.w*.85);
    glow.addColorStop(0,"rgba(255,239,100,.6)");glow.addColorStop(1,"rgba(255,215,30,0)");
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,o.w*.9,0,Math.PI*2);ctx.fill();
  }
  rr(ctx,-o.w/2,-o.h/2,o.w,o.h,o.h/2);
  if(golden){
    var gr=ctx.createLinearGradient(-o.w/2,0,o.w/2,0);
    gr.addColorStop(0,"#d6a914");gr.addColorStop(.48,"#fff18b");gr.addColorStop(1,"#c58d0b");
    ctx.fillStyle=gr;ctx.strokeStyle="#9f6f06";
  }else{
    ctx.fillStyle="#4f9e56";ctx.strokeStyle="#36733d";
  }
  ctx.lineWidth=3;ctx.fill();ctx.stroke();
  ctx.fillStyle=golden?"#fff7bb":"#9bd285";
  for(var i=0;i<6;i++){ctx.beginPath();ctx.arc(-o.w*.3+i*(o.w*.6/5),(-5)+(i%2)*10,2.4,0,Math.PI*2);ctx.fill()}
  if(golden){
    ctx.fillStyle="#fff3a0";
    for(var s=0;s<4;s++){
      var a=s*Math.PI/2+Date.now()/520,sx=Math.cos(a)*o.w*.72,sy=Math.sin(a)*o.h*1.05;
      ctx.save();ctx.translate(sx,sy);ctx.rotate(a);ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(2,-2);ctx.lineTo(7,0);ctx.lineTo(2,2);ctx.lineTo(0,7);ctx.lineTo(-2,2);ctx.lineTo(-7,0);ctx.lineTo(-2,-2);ctx.closePath();ctx.fill();ctx.restore();
    }
  }
  ctx.restore();
}
function drawObj(o){
  if(o.type==="cucumber"){drawCucumber(o,false);return}
  if(o.type==="gold"){drawCucumber(o,true);return}
  if(o.type==="water"){
    ctx.fillStyle="#54a8dd";ctx.beginPath();ctx.moveTo(o.x+o.w/2,o.y);ctx.quadraticCurveTo(o.x+o.w,o.y+o.h*.55,o.x+o.w/2,o.y+o.h);ctx.quadraticCurveTo(o.x,o.y+o.h*.55,o.x+o.w/2,o.y);ctx.fill();return;
  }
  if(o.type==="calcium"){
    ctx.fillStyle="#f7f2dc";rr(ctx,o.x,o.y,o.w,o.h,10);ctx.fill();ctx.strokeStyle="#d7d0b6";ctx.lineWidth=2;ctx.stroke();return;
  }
  if(o.type==="rock"){
    ctx.fillStyle="#777b75";ctx.beginPath();ctx.moveTo(o.x,o.y+o.h);ctx.lineTo(o.x+9,o.y+10);ctx.lineTo(o.x+28,o.y);ctx.lineTo(o.x+o.w,o.y+o.h);ctx.closePath();ctx.fill();return;
  }
  if(o.type==="trash"||o.type==="bossTrash"){
    ctx.fillStyle=o.type==="bossTrash"?"#5b5551":"#73706b";rr(ctx,o.x,o.y,o.w,o.h,7);ctx.fill();
    ctx.fillStyle="#34312f";ctx.fillRect(o.x-4,o.y+5,o.w+8,7);
    ctx.fillStyle="#aab0a6";ctx.fillRect(o.x+8,o.y+18,6,o.h-26);ctx.fillRect(o.x+o.w-14,o.y+18,6,o.h-26);return;
  }
  if(o.type==="birdWarn"){
    ctx.fillStyle="rgba(177,63,55,.92)";ctx.font="bold 28px system-ui";ctx.fillText("!",o.x,o.y+28);return;
  }
  if(o.type==="bird"){
    ctx.strokeStyle="#3d352f";ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(o.x,o.y+22);ctx.quadraticCurveTo(o.x+18,o.y,o.x+36,o.y+22);ctx.quadraticCurveTo(o.x+52,o.y+3,o.x+70,o.y+20);ctx.stroke();return;
  }
}
function draw(){
  drawBackground();
  for(var i=0;i<objects.length;i++)drawObj(objects[i]);
  drawSnail();

  if(bossActive){
    ctx.save();ctx.fillStyle="rgba(30,25,20,.72)";rr(ctx,190,16,340,42,16);ctx.fill();
    ctx.fillStyle="#fff";ctx.font="bold 18px system-ui";ctx.textAlign="center";
    ctx.fillText("МУСОРНЫЙ БОСС "+bossLevel+"  ·  "+Math.min(bossWavePassed,bossWaveTotal)+"/"+bossWaveTotal,360,44);
    ctx.restore();
  }

  for(var p=0;p<particles.length;p++){
    var q=particles[p];ctx.save();ctx.globalAlpha=clamp(q.life/620,0,1);
    ctx.fillStyle=q.kind==="gold"?"#ffd84a":q.kind==="blue"?"#5cb9ec":q.kind==="white"?"#fff4d8":"#5eaf62";
    ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  if(paused){
    ctx.fillStyle="rgba(22,30,24,.62)";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#fff";ctx.font="bold 38px system-ui";ctx.textAlign="center";ctx.fillText("ПАУЗА",W/2,H/2);ctx.textAlign="left";
  }
}
function loop(t){
  if(!running||paused)return;
  var dt=Math.min(.033,(t-last)/1000||0);last=t;
  update(dt);draw();
  if(running)requestAnimationFrame(loop);
}
function pressShellStart(e){if(e)e.preventDefault();setHidden(true)}
function pressShellEnd(e){if(e)e.preventDefault();setHidden(false)}

document.getElementById("startBtn").addEventListener("click",showGame);
document.getElementById("againBtn").addEventListener("click",showGame);
document.getElementById("menuBtn").addEventListener("click",showMenu);
document.getElementById("quitBtn").addEventListener("click",showMenu);
document.getElementById("jumpBtn").addEventListener("click",jump);
pauseBtn.addEventListener("click",togglePause);

if(window.PointerEvent){
  shellBtn.addEventListener("pointerdown",pressShellStart);
  window.addEventListener("pointerup",pressShellEnd);
  window.addEventListener("pointercancel",pressShellEnd);
}else{
  shellBtn.addEventListener("touchstart",pressShellStart,{passive:false});
  window.addEventListener("touchend",pressShellEnd,{passive:false});
  shellBtn.addEventListener("mousedown",pressShellStart);
  window.addEventListener("mouseup",pressShellEnd);
}

window.addEventListener("keydown",function(e){
  if(e.code==="Space"||e.code==="ArrowUp"){e.preventDefault();jump()}
  if(e.code==="ArrowDown"){e.preventDefault();setHidden(true)}
  if(e.code==="KeyP")togglePause();
});
window.addEventListener("keyup",function(e){if(e.code==="ArrowDown")setHidden(false)});
window.addEventListener("blur",function(){if(running&&!paused)togglePause()});

if("serviceWorker" in navigator){
  window.addEventListener("load",function(){
    navigator.serviceWorker.register("./sw.js?v=1.0",{updateViaCache:"none"}).catch(function(){});
  });
}

load();draw();
})();