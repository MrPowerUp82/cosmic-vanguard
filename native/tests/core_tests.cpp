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
  return 0;
}
