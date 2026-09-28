#ifdef NDEBUG
#undef NDEBUG
#endif
#include "cosmic/game.hpp"
#include <cassert>
#include <array>

int main() {
  using namespace cosmic;
  Game g; g.load(1);
  assert(g.profile.unlocked[0] && g.profile.unlocked[1] && g.profile.unlocked[2]);
  g.startStage(3); assert(g.screen==Screen::Title);
  g.startStage(0); assert(g.screen==Screen::Stage && g.playerCount==1);
  g.switchHero(0,1); assert(g.players[0].hero==1);
  g.enemies.push_back({EnemyKind::Grunt,100,80,10,10});
  g.damageEnemy(g.enemies.back(),20); assert(g.enemies.back().dead && g.score>0);
  g.startStage(0);
  std::array<Input,2> noInput{};
  for(int wave=0;wave<4;wave++) {
    g.players[0].x=wave==0?210.f:wave==1?950.f:wave==2?1700.f:2370.f;
    g.update(.016f,noInput);
    assert(g.activeWave && g.wave==wave && !g.enemies.empty());
    for(auto& e:g.enemies) e.dead=true;
    g.update(.016f,noInput);
  }
  assert(g.screen==Screen::Clear && g.profile.completed[0] && g.profile.unlocked[3]);
  g.coop=true; g.startStage(1);
  assert(g.playerCount==2 && g.players[0].hero!=g.players[1].hero);
  g.startStage(3); assert(g.selectedStage==1); // requires the other sectors

  const std::array<int,4> rangedHeroes{{0,2,4,5}};
  const std::array<ProjectileStyle,4> rangedStyles{{
    ProjectileStyle::Solarion,ProjectileStyle::Valoria,
    ProjectileStyle::AbyssKing,ProjectileStyle::EmeraldNova
  }};
  for(std::size_t i=0;i<rangedHeroes.size();i++) {
    Game cast; cast.startStage(0);
    cast.players[0].hero=rangedHeroes[i];
    std::array<Input,2> activate{}; activate[0].special=true;
    cast.update(.016f,activate);
    for(int frame=0;frame<32;frame++) cast.update(.016f,noInput);
    bool found=false;
    for(const auto& pr:cast.projectiles)
      if(pr.style==rangedStyles[i] && pr.damage>0 && pr.x>cast.players[0].x) found=true;
    assert(found);
  }

  Game solar; solar.startStage(0);
  Enemy dummy; dummy.kind=EnemyKind::Grunt; dummy.x=260; dummy.y=80;
  dummy.hp=dummy.maxHp=200; dummy.cooldown=99;
  solar.enemies.push_back(dummy);
  std::array<Input,2> castSolar{}; castSolar[0].special=true;
  solar.update(.016f,castSolar);
  for(int frame=0;frame<34;frame++) solar.update(.016f,noInput);
  assert(solar.enemies[0].hp==152);

  Game voidStage;
  voidStage.profile.completed={{true,true,true,false}};
  voidStage.startStage(3);
  Enemy boss; boss.kind=EnemyKind::Boss; boss.x=350; boss.y=80;
  boss.hp=boss.maxHp=500; boss.damage=23; boss.range=300;
  voidStage.enemies.push_back(boss);
  voidStage.update(.016f,noInput);
  for(int frame=0;frame<24;frame++) voidStage.update(.016f,noInput);
  int voidShots=0;
  for(const auto& pr:voidStage.projectiles)
    if(pr.style==ProjectileStyle::VoidTyrant && pr.hostile) voidShots++;
  assert(voidShots==3);
  return 0;
}
