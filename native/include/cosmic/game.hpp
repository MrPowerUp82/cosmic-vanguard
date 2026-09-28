#pragma once

#include <array>
#include <cstdint>
#include <string>
#include <vector>

namespace cosmic {

enum class Screen { Title, Map, Roster, Stage, Pause, Clear, Ending };
enum class Action { Idle, Walk, Attack, Jump, Dash, Hurt, Special };
enum class EnemyKind { Grunt, Ranger, Brute, Elite, Boss };
enum class ProjectileStyle { Solarion, Valoria, AbyssKing, EmeraldNova, PulseGunner, VoidTyrant };

struct HeroDef {
  const char* id;
  const char* name;
  float hp, energy, speed, damage, specialCost, range;
  std::uint8_t r, g, b;
};
extern const std::array<HeroDef, 6> heroes;
extern const std::array<const char*, 4> stageNames;

struct Input {
  float x{}, y{};
  bool attack{}, special{}, mobility{}, jump{}, swapPrev{}, swapNext{};
  bool confirm{}, back{}, pause{}, roster{}, coop{}, difficulty{};
  int select{};
};

struct Player {
  int hero{}, slot{};
  float x{}, y{}, z{}, vz{}, hp{}, energy{}, maxHp{}, maxEnergy{};
  float invuln{}, hurt{}, attack{}, special{}, dash{}, dashCooldown{}, switchCooldown{}, comboWindow{};
  float anim{}, attackElapsed{}, specialElapsed{};
  int combo{}, specialStep{}, facing{1};
  bool attackHit{};
  Action action{Action::Idle};
};

struct Enemy {
  EnemyKind kind{};
  float x{}, y{}, hp{}, maxHp{}, speed{}, damage{}, range{}, cooldown{}, attack{}, hurt{}, invuln{}, anim{};
  int facing{-1}, phase{};
  bool dead{}, ranged{};
  float special{};
  bool specialFired{};
};

struct Projectile {
  float x{}, y{}, vx{}, vy{}, damage{}, life{};
  bool hostile{}, pierce{};
  ProjectileStyle style{ProjectileStyle::PulseGunner};
  std::uint64_t hitMask{};
};

struct Profile {
  int slot{1}, difficulty{1}, currentHero{}, credits{}, highScore{};
  std::array<bool, 6> unlocked{{true,true,true,false,false,false}};
  std::array<bool, 4> completed{};
  bool won{};
};

struct Game {
  Screen screen{Screen::Title}, resume{Screen::Stage};
  Profile profile{};
  std::string saveDir;
  std::array<Player, 2> players{};
  int playerCount{1}, selectedSlot{1}, selectedStage{}, selectedHero{}, wave{-1}, score{}, combo{};
  bool coop{}, activeWave{}, failed{};
  float camera{}, time{}, clearTimer{}, noticeTimer{};
  std::string notice;
  std::vector<Enemy> enemies;
  std::vector<Projectile> projectiles;

  void load(int slot);
  void save() const;
  void startStage(int stage);
  void update(float dt, const std::array<Input, 2>& input);
  void switchHero(int slot, int dir);
  void damageEnemy(Enemy& enemy, float amount, float knock = 0);
  void damagePlayer(Player& player, float amount, float knock = 0);
  int stageWidth() const { return selectedStage == 3 ? 3500 : 3200; }
};

} // namespace cosmic
