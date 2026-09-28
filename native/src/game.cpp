#include "cosmic/game.hpp"
#include <algorithm>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <sstream>

namespace cosmic {
const std::array<HeroDef, 6> heroes{{
  {"solarion", "SOLARION", 124,112,178,18,42,78,255,177,44},
  {"night_talon", "NIGHT TALON", 106,122,210,15,36,86,71,201,255},
  {"valoria", "VALORIA", 138,100,168,21,40,116,255,210,87},
  {"red_velocity", "RED VELOCITY", 96,120,246,13,34,82,255,91,85},
  {"abyss_king", "ABYSS KING", 132,108,166,20,41,125,89,231,255},
  {"emerald_nova", "EMERALD NOVA", 108,126,186,16,38,96,64,255,116},
}};
const std::array<const char*, 4> stageNames{{"NEON HARBOR","IRON DISTRICT","SKYSPIRE","VOID GATE"}};

namespace {
float cap(float x, float lo, float hi) { return std::clamp(x,lo,hi); }
float distance(float x, float y) { return std::sqrt(x*x+y*y); }
int recruit(int stage) { return stage < 3 ? stage+3 : -1; }
const std::array<std::array<float,4>,4> waveX{{
  {{680,1430,2180,2840}}, {{700,1460,2200,2840}},
  {{700,1460,2200,2840}}, {{760,1580,2420,3160}}
}};
float hpFactor(int d) { return d == 0 ? .78f : d == 2 ? 1.25f : 1.f; }
float damageFactor(int d) { return d == 0 ? .72f : d == 2 ? 1.25f : 1.f; }
float rewardFactor(int d) { return d == 0 ? .8f : d == 2 ? 1.35f : 1.f; }
void tick(float& v,float dt) { v=std::max(0.f,v-dt); }
}

void Game::load(int slot) {
  profile=Profile{}; profile.slot=cap(slot,1,3);
  std::ifstream in(saveDir+"/slot"+std::to_string(profile.slot)+".ini");
  std::string line;
  while(std::getline(in,line)) {
    auto at=line.find('='); if(at==std::string::npos) continue;
    auto key=line.substr(0,at); int value=0;
    try { value=std::stoi(line.substr(at+1)); } catch(...) { continue; }
    if(key=="difficulty") profile.difficulty=cap(value,0,2);
    else if(key=="currentHero") profile.currentHero=cap(value,0,5);
    else if(key=="credits") profile.credits=std::max(0,value);
    else if(key=="highScore") profile.highScore=std::max(0,value);
    else if(key=="won") profile.won=value!=0;
    else {
      for(int i=0;i<6;i++) if(key==std::string("hero")+std::to_string(i)) profile.unlocked[i]=value!=0;
      for(int i=0;i<4;i++) if(key==std::string("stage")+std::to_string(i)) profile.completed[i]=value!=0;
    }
  }
  profile.unlocked[0]=profile.unlocked[1]=profile.unlocked[2]=true;
  if(!profile.unlocked[profile.currentHero]) profile.currentHero=0;
  selectedSlot=profile.slot;
}

void Game::save() const {
  if(saveDir.empty()) return;
  std::error_code ec; std::filesystem::create_directories(saveDir,ec);
  auto path=saveDir+"/slot"+std::to_string(profile.slot)+".ini";
  auto temp=path+".tmp";
  std::ofstream out(temp,std::ios::trunc); if(!out) return;
  out<<"difficulty="<<profile.difficulty<<"\ncurrentHero="<<profile.currentHero
     <<"\ncredits="<<profile.credits<<"\nhighScore="<<profile.highScore<<"\nwon="<<profile.won<<'\n';
  for(int i=0;i<6;i++) out<<"hero"<<i<<'='<<profile.unlocked[i]<<'\n';
  for(int i=0;i<4;i++) out<<"stage"<<i<<'='<<profile.completed[i]<<'\n';
  out.close(); if(!out) return;
  std::filesystem::rename(temp,path,ec);
  if(ec) { std::filesystem::remove(path,ec); std::filesystem::rename(temp,path,ec); }
}

void Game::startStage(int stage) {
  if(stage<0||stage>3 || (stage==3 && !(profile.completed[0]&&profile.completed[1]&&profile.completed[2]))) return;
  selectedStage=stage; screen=Screen::Stage; wave=-1; activeWave=false; failed=false;
  score=combo=0; time=camera=clearTimer=0; enemies.clear(); projectiles.clear();
  playerCount=coop?2:1;
  int second=0; while(second<6 && (!profile.unlocked[second] || second==profile.currentHero)) second++;
  for(int i=0;i<playerCount;i++) {
    int h=i==0?profile.currentHero:std::min(second,5);
    players[i]=Player{}; auto& p=players[i]; p.hero=h; p.slot=i+1; p.x=120+i*45; p.y=80+i*35;
    p.maxHp=p.hp=heroes[h].hp; p.maxEnergy=p.energy=heroes[h].energy;
  }
  notice=stageNames[stage]; noticeTimer=2.7f;
}

void Game::switchHero(int slot,int dir) {
  if(slot>=playerCount) return;
  auto& p=players[slot]; if(p.switchCooldown>0||p.hurt>0) return;
  for(int n=1;n<=6;n++) {
    int h=(p.hero+dir*n+36)%6;
    if(!profile.unlocked[h] || (playerCount==2 && players[1-slot].hp>0 && players[1-slot].hero==h)) continue;
    float hpRatio=p.hp/p.maxHp, energyRatio=p.energy/p.maxEnergy;
    p.hero=h; p.maxHp=heroes[h].hp; p.hp=cap(hpRatio*p.maxHp,1,p.maxHp);
    p.maxEnergy=heroes[h].energy; p.energy=cap(energyRatio*p.maxEnergy+14,0,p.maxEnergy);
    p.attack=p.special=p.dash=0; p.switchCooldown=.75f; p.invuln=.42f; p.anim=0;
    if(slot==0) { profile.currentHero=h; save(); } return;
  }
}

void Game::damageEnemy(Enemy& e,float amount,float knock) {
  if(e.dead||e.invuln>0) return;
  e.hp-=amount; e.hurt=.18f; e.invuln=.07f; e.x=cap(e.x+knock*.08f,20,(float)stageWidth()-30);
  if(e.hp>0) return;
  e.hp=0; e.dead=true; int points=e.kind==EnemyKind::Boss?1600:e.kind==EnemyKind::Elite?190:e.kind==EnemyKind::Brute?120:e.kind==EnemyKind::Ranger?85:70;
  score+=(int)(points*rewardFactor(profile.difficulty)); profile.credits+=(int)(points*.08f*rewardFactor(profile.difficulty));
  combo++;
}

void Game::damagePlayer(Player& p,float amount,float knock) {
  if(p.hp<=0||p.invuln>0) return;
  p.hp=std::max(0.f,p.hp-amount); p.x=cap(p.x+knock,40,(float)stageWidth()-120);
  p.hurt=.3f; p.invuln=.75f; p.attack=p.special=0;
}

void Game::update(float dt,const std::array<Input,2>& input) {
  dt=cap(dt,0,.033f);
  auto menu=input[0];
  if(screen==Screen::Title) {
    if(menu.select) selectedSlot=(selectedSlot-1+menu.select+9)%3+1;
    if(menu.confirm) { load(selectedSlot); screen=Screen::Map; }
    return;
  }
  if(screen==Screen::Map) {
    if(menu.select) selectedStage=(selectedStage+menu.select+4)%4;
    if(menu.coop) coop=!coop;
    if(menu.difficulty) { profile.difficulty=(profile.difficulty+1)%3; save(); }
    if(menu.roster) { selectedHero=profile.currentHero; screen=Screen::Roster; }
    if(menu.confirm) startStage(selectedStage);
    if(menu.back) screen=Screen::Title;
    return;
  }
  if(screen==Screen::Roster) {
    if(menu.select) selectedHero=(selectedHero+menu.select+6)%6;
    if(menu.confirm && profile.unlocked[selectedHero]) { profile.currentHero=selectedHero; save(); }
    if(menu.back||menu.roster) screen=Screen::Map;
    return;
  }
  if(screen==Screen::Clear||screen==Screen::Ending) {
    if(menu.confirm||menu.back) screen=Screen::Map;
    return;
  }
  if(screen==Screen::Pause) {
    if(menu.pause||menu.back) screen=resume;
    if(menu.roster) screen=Screen::Map;
    return;
  }
  if(menu.pause) { resume=Screen::Stage; screen=Screen::Pause; return; }
  if(failed) { if(menu.confirm||menu.back) screen=Screen::Map; return; }
  tick(noticeTimer,dt); time+=dt;
  for(int i=0;i<playerCount;i++) {
    auto& p=players[i]; auto in=input[i]; if(p.hp<=0) continue;
    auto h=heroes[p.hero];
    tick(p.invuln,dt); tick(p.hurt,dt); tick(p.attack,dt); tick(p.special,dt);
    tick(p.dash,dt); tick(p.dashCooldown,dt); tick(p.switchCooldown,dt); tick(p.comboWindow,dt);
    p.energy=std::min(p.maxEnergy,p.energy+dt*8.5f);
    if(in.swapPrev) switchHero(i,-1);
    if(in.swapNext) switchHero(i,1);
    if(in.jump&&p.z==0&&p.hurt==0&&p.attack==0&&p.special==0) { p.vz=340; p.z=1; p.anim=0; }
    if(in.mobility&&p.dashCooldown==0&&p.hurt==0&&p.attack==0&&p.special==0) {
      constexpr float duration[]{.42f,.38f,.42f,.31f,.40f,.42f};
      constexpr float cooldown[]{.62f,.58f,.66f,.46f,.62f,.60f};
      p.dash=duration[p.hero]; p.dashCooldown=cooldown[p.hero]; p.invuln=std::max(p.invuln,.28f); p.anim=0;
    }
    if(in.attack&&p.attack==0&&p.hurt==0&&p.special==0&&p.dash==0) {
      p.attack=.48f; p.attackElapsed=0; p.combo=0; p.attackHit=false; p.anim=0;
    }
    if(in.special&&p.energy>=h.specialCost&&p.special==0&&p.hurt==0&&p.attack==0&&p.dash==0) {
      p.energy-=h.specialCost; p.special=.68f; p.specialElapsed=0; p.specialStep=0;
      p.invuln=std::max(p.invuln,.49f); p.anim=0;
    }
    if(p.special>0) {
      p.specialElapsed+=dt;
      auto forward=[&](float range,float lane,float damage) {
        for(auto& e:enemies) if(!e.dead && std::abs(e.y-p.y)<lane &&
          (e.x-p.x)*p.facing>-28 && (e.x-p.x)*p.facing<range) damageEnemy(e,damage,p.facing*100);
      };
      auto area=[&](float radius,float damage) {
        for(auto& e:enemies) if(!e.dead && distance(e.x-p.x,(e.y-p.y)*1.2f)<radius) damageEnemy(e,damage,p.facing*80);
      };
      if(p.hero==0 && p.specialStep==0 && p.specialElapsed>=.28f) {
        projectiles.push_back({p.x+p.facing*55,p.y,p.facing*720.f,0,48,.72f,false,true,ProjectileStyle::Solarion});
        p.specialStep++;
      }
      if(p.hero==1) while(p.specialStep<4 && p.specialElapsed>=.68f*(.28f+.14f*p.specialStep)) {
        p.x=cap(p.x+p.facing*34,40,(float)stageWidth()-120);
        forward(220,72,15+p.specialStep*3.f); p.specialStep++;
      }
      if(p.hero==2 && p.specialStep==0 && p.specialElapsed>=.24f) { area(145,30); p.specialStep++; }
      if(p.hero==2 && p.specialStep==1 && p.specialElapsed>=.40f) {
        projectiles.push_back({p.x+p.facing*55,p.y,p.facing*390.f,0,36,.9f,false,true,ProjectileStyle::Valoria}); p.specialStep++;
      }
      if(p.hero==3) while(p.specialStep<4 && p.specialElapsed>=.68f*(.30f+.12f*p.specialStep)) {
        p.x=cap(p.x+p.facing*62,40,(float)stageWidth()-120);
        forward(185,74,13+p.specialStep*4.f); p.specialStep++;
      }
      if(p.hero==4 && p.specialStep==0 && p.specialElapsed>=.28f) {
        area(95,22); projectiles.push_back({p.x+p.facing*52,p.y,p.facing*315.f,0,48,1.12f,false,true,ProjectileStyle::AbyssKing}); p.specialStep++;
      }
      if(p.hero==5) while(p.specialStep<4 && p.specialElapsed>=.68f*(.28f+.09f*p.specialStep)) {
        projectiles.push_back({p.x+p.facing*38,p.y+(p.specialStep-1.5f)*5,p.facing*(470.f+p.specialStep*35),0,15,.85f,false,true,ProjectileStyle::EmeraldNova}); p.specialStep++;
      }
      if(p.hero==5 && p.specialStep==4 && p.specialElapsed>=.68f*.68f) {
        projectiles.push_back({p.x+p.facing*52,p.y,p.facing*550.f,0,34,.82f,false,true,ProjectileStyle::EmeraldNova});
        p.specialStep++;
      }
    }
    float dx=in.x,dy=in.y;
    if(p.hurt>0||p.attack>.09f||p.special>0) dx=dy=0;
    if(p.dash>0) { constexpr float speed[]{2.35f,2.55f,2.20f,3.35f,2.42f,2.35f}; dx=p.facing*speed[p.hero]; }
    if(dx!=0) p.facing=dx>0?1:-1;
    float len=distance(dx,dy); if(len>1 && p.dash==0) { dx/=len; dy/=len; }
    p.x+=dx*h.speed*dt; p.y+=dy*h.speed*.72f*dt;
    float wall=activeWave?std::min((float)stageWidth()-120,waveX[selectedStage][wave]+260):(float)stageWidth()-120;
    p.x=cap(p.x,40,wall); p.y=cap(p.y,15,180);
    if(p.z>0||p.vz!=0) { p.z+=p.vz*dt; p.vz-=760*dt; if(p.z<0) p.z=p.vz=0; }
    if(p.attack>0) {
      p.attackElapsed+=dt; int frame=std::min(3,(int)(p.attackElapsed/.12f));
      if(frame>p.combo) { p.combo=frame; for(auto& e:enemies) if(!e.dead && std::abs(e.y-p.y)<54 &&
        (e.x-p.x)*p.facing>-26 && (e.x-p.x)*p.facing<h.range+(frame==3?18:0))
        damageEnemy(e,h.damage*(frame==3?1.28f:frame==2?.9f:.72f),p.facing*(frame==3?20:10)); }
    }
    if(p.dash>0) for(auto& e:enemies) if(!e.dead && std::abs(e.y-p.y)<55 && std::abs(e.x-p.x)<50) damageEnemy(e,h.damage*.45f,p.facing*8);
    p.action=p.hurt>0?Action::Hurt:p.special>0?Action::Special:p.attack>0?Action::Attack:p.dash>0?Action::Dash:p.z>0?Action::Jump:len>.05f?Action::Walk:Action::Idle;
    p.anim+=dt;
  }
  if(!activeWave && wave<3) {
    float trigger=waveX[selectedStage][wave+1]-480;
    bool crossed=false; for(int i=0;i<playerCount;i++) crossed|=players[i].hp>0&&players[i].x>=trigger;
    if(crossed) {
      wave++; activeWave=true; enemies.clear(); projectiles.clear();
      auto spawn=[&](EnemyKind kind,int n) {
        for(int k=0;k<n;k++) {
          Enemy e; e.kind=kind; e.x=waveX[selectedStage][wave]+80+(k%2)*130+k*20;
          e.y=28+(k*47)%135; e.hp=kind==EnemyKind::Boss?(selectedStage==3?520:285):kind==EnemyKind::Elite?135:kind==EnemyKind::Brute?94:kind==EnemyKind::Ranger?44:52;
          e.hp*=hpFactor(profile.difficulty); e.maxHp=e.hp;
          e.speed=kind==EnemyKind::Boss?105:kind==EnemyKind::Elite?118:kind==EnemyKind::Brute?72:kind==EnemyKind::Ranger?82:100;
          e.damage=(kind==EnemyKind::Boss?23:kind==EnemyKind::Elite?18:kind==EnemyKind::Brute?16:kind==EnemyKind::Ranger?9:10)*damageFactor(profile.difficulty);
          e.range=kind==EnemyKind::Ranger?230:kind==EnemyKind::Boss?(selectedStage==3?300:78):55;
          e.ranged=kind==EnemyKind::Ranger || (kind==EnemyKind::Boss&&(selectedStage==1||selectedStage==3));
          e.cooldown=.4f+k*.14f; enemies.push_back(e);
        }
      };
      if(wave==3) spawn(EnemyKind::Boss,1);
      else if(wave==0) { spawn(EnemyKind::Grunt,2); spawn(EnemyKind::Ranger,1); }
      else if(wave==1) { spawn(EnemyKind::Grunt,1); spawn(EnemyKind::Brute,2); spawn(EnemyKind::Ranger,1); }
      else { spawn(EnemyKind::Brute,1); spawn(EnemyKind::Ranger,2); spawn(selectedStage==3?EnemyKind::Elite:EnemyKind::Grunt,1); }
      notice=wave==3?"ALVO PRIORITARIO":"ONDA "+std::to_string(wave+1); noticeTimer=1.5f;
    }
  }
  for(auto& e:enemies) {
    if(e.dead) continue;
    tick(e.hurt,dt); tick(e.invuln,dt); tick(e.attack,dt); tick(e.special,dt); tick(e.cooldown,dt); e.anim+=dt;
    Player* target=nullptr; float nearest=1e9f;
    for(int i=0;i<playerCount;i++) if(players[i].hp>0) { float d=distance(players[i].x-e.x,players[i].y-e.y); if(d<nearest) { nearest=d; target=&players[i]; } }
    if(!target) break;
    float dx=target->x-e.x,dy=target->y-e.y; e.facing=dx>=0?1:-1;
    const bool voidBoss=e.kind==EnemyKind::Boss && selectedStage==3;
    if(nearest>e.range*.7f && e.hurt==0 && e.special==0) { float d=std::max(nearest,1.f); e.x+=dx/d*e.speed*dt; e.y+=dy/d*e.speed*.65f*dt; }
    if(voidBoss && e.special>0 && !e.specialFired && e.special<=.58f) {
      float d=std::max(nearest,1.f);
      for(int spread=-1;spread<=1;spread++)
        projectiles.push_back({e.x+e.facing*18,e.y+spread*8,dx/d*300,dy/d*300+spread*35,
                               e.damage*.9f,1.35f,true,false,ProjectileStyle::VoidTyrant});
      e.specialFired=true;
    }
    if(nearest<e.range && e.cooldown==0 && e.special==0) {
      e.cooldown=voidBoss?1.55f:e.kind==EnemyKind::Boss?.8f:e.kind==EnemyKind::Elite?.9f:e.ranged?1.55f:1.2f;
      e.attack=voidBoss?0:.42f;
      if(voidBoss) { e.special=.94f; e.specialFired=false; e.anim=0; }
      else if(e.ranged) { float d=std::max(nearest,1.f); projectiles.push_back({e.x,e.y,dx/d*260,dy/d*260,e.damage,2.f,true,false,ProjectileStyle::PulseGunner}); }
      else if(nearest<e.range+15 && std::abs(dy)<50) damagePlayer(*target,e.damage,e.facing*20);
    }
  }
  for(auto& pr:projectiles) {
    pr.x+=pr.vx*dt; pr.y+=pr.vy*dt; pr.life-=dt;
    if(pr.hostile) {
      for(int i=0;i<playerCount;i++)
        if(pr.life>0 && players[i].hp>0 && distance(pr.x-players[i].x,pr.y-players[i].y)<28) {
          damagePlayer(players[i],pr.damage,pr.vx>0?12:-12); pr.life=0;
        }
    } else {
      constexpr float hitWidth[]{62,48,70,40,30,30};
      for(std::size_t index=0;index<enemies.size();index++) {
        if(index>=64) break;
        auto& e=enemies[index];
        auto bit=std::uint64_t{1}<<index;
        if(pr.life>0 && !e.dead && e.invuln<=0 && !(pr.hitMask&bit) &&
           std::abs(pr.x-e.x)<hitWidth[(int)pr.style] && std::abs(pr.y-e.y)<34) {
          pr.hitMask|=bit;
          damageEnemy(e,pr.damage,pr.vx>0?10:-10);
          if(!pr.pierce) pr.life=0;
        }
      }
    }
  }
  projectiles.erase(std::remove_if(projectiles.begin(),projectiles.end(),[](const Projectile& p){return p.life<=0;}),projectiles.end());
  if(activeWave && std::none_of(enemies.begin(),enemies.end(),[](const Enemy& e){return !e.dead;})) {
    activeWave=false; enemies.clear(); notice="AREA LIMPA"; noticeTimer=1.25f;
    if(wave==3) {
      profile.completed[selectedStage]=true; int r=recruit(selectedStage);
      if(r>=0) { profile.unlocked[r]=true; profile.currentHero=r; }
      if(selectedStage==3) profile.won=true;
      profile.highScore=std::max(profile.highScore,score); save();
      screen=selectedStage==3?Screen::Ending:Screen::Clear;
    }
  }
  failed=true; for(int i=0;i<playerCount;i++) if(players[i].hp>0) failed=false;
  if(failed) { notice="MISSAO FALHOU"; noticeTimer=999; }
  float center=0; int alive=0; for(int i=0;i<playerCount;i++) if(players[i].hp>0) { center+=players[i].x; alive++; }
  if(alive) { center/=alive; camera+=((cap(center-480,0,(float)stageWidth()-840))-camera)*std::min(1.f,dt*8); }
}
} // namespace cosmic
