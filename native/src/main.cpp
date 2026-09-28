#include "cosmic/game.hpp"
#include <SDL.h>
#include <SDL_image.h>
#include <SDL_ttf.h>
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>
#if defined(COSMIC_PSP)
#include <pspctrl.h>
#include <psppower.h>
#elif defined(COSMIC_VITA)
#include <psp2/ctrl.h>
#include <psp2/power.h>
extern "C" {
unsigned int sceUserMainThreadStackSize = 1024 * 1024;
unsigned int _newlib_heap_size_user = 96 * 1024 * 1024;
}
#elif defined(__SWITCH__)
#include <switch.h>
#endif

using namespace cosmic;
namespace {
constexpr int W=960,H=540;
#if defined(COSMIC_PSP)
constexpr int CELL=72;
constexpr int PROJECTILE_W=64,PROJECTILE_H=32;
#else
constexpr int CELL=144;
constexpr int PROJECTILE_W=128,PROJECTILE_H=64;
#endif
SDL_Renderer* renderer=nullptr;
TTF_Font* font=nullptr;
std::array<SDL_Texture*,11> sprite{};
std::array<SDL_Texture*,4> backgrounds{};
SDL_Texture* titleBanner=nullptr;
SDL_Texture* projectileAtlas=nullptr;
std::array<const char*,11> spriteNames{{"solarion","night_talon","valoria","red_velocity","abyss_king","emerald_nova","shadow_trooper","pulse_gunner","armored_brute","rift_assassin","void_tyrant"}};
constexpr int frameCounts[11][7] = {
  {4,7,4,3,4,2,6}, {4,7,4,3,4,2,6}, {4,7,4,3,4,2,6},
  {4,7,4,3,4,2,5}, {4,6,4,3,4,2,6}, {4,7,4,3,4,2,6},
  {4,6,4,3,6,1,6}, {4,6,4,3,6,2,5}, {4,6,4,2,6,2,6},
  {4,6,4,3,6,2,6}, {4,7,3,3,7,2,3}
};
std::string assetRoot;
std::array<SDL_GameController*,2> pads{};
std::array<std::array<bool,SDL_CONTROLLER_BUTTON_MAX>,2> oldPad{};

void color(SDL_Color c) { SDL_SetRenderDrawColor(renderer,c.r,c.g,c.b,c.a); }
void rect(float x,float y,float w,float h,SDL_Color c) { color(c); SDL_Rect r{(int)x,(int)y,(int)w,(int)h}; SDL_RenderFillRect(renderer,&r); }
void line(float x,float y,float x2,float y2,SDL_Color c) { color(c); SDL_RenderDrawLine(renderer,(int)x,(int)y,(int)x2,(int)y2); }
void text(const std::string& s,int x,int y,int size,SDL_Color c={240,245,255,255},bool center=false) {
  if(!font||s.empty()) return;
  TTF_SetFontSize(font,size);
  SDL_Surface* surface=TTF_RenderUTF8_Blended(font,s.c_str(),c);
  if(!surface) return;
  SDL_Texture* t=SDL_CreateTextureFromSurface(renderer,surface);
  if(t) { SDL_Rect r{x-(center?surface->w/2:0),y,surface->w,surface->h}; SDL_RenderCopy(renderer,t,nullptr,&r); SDL_DestroyTexture(t); }
  SDL_FreeSurface(surface);
}
SDL_Texture* image(const std::string& name) { return IMG_LoadTexture(renderer,(assetRoot+name).c_str()); }
void bar(float x,float y,float w,float h,float ratio,SDL_Color fg) {
  rect(x,y,w,h,{14,25,44,240}); rect(x,y,w*std::clamp(ratio,0.f,1.f),h,fg);
  color({180,202,225,90}); SDL_Rect r{(int)x,(int)y,(int)w,(int)h}; SDL_RenderDrawRect(renderer,&r);
}
int enemySprite(EnemyKind kind,int stage) { switch(kind) {
  case EnemyKind::Grunt:return 6; case EnemyKind::Ranger:return 7; case EnemyKind::Brute:return 8;
  case EnemyKind::Elite:return 9; default:return stage==0?8:stage==1?7:stage==2?9:10; }
}
void character(int id,Action action,float t,float x,float y,int facing,float scale=1) {
  auto* tex=sprite[id]; if(!tex) { rect(x-16,y-60,32,60,{220,220,240,255}); return; }
  int row=(int)action; int frames=frameCounts[id][row];
  int frame=((int)(t*(row==1?12:8)))%frames;
  SDL_Rect src{frame*CELL,row*CELL,CELL,CELL};
  int side=(int)(202.5f*scale); SDL_Rect dest{(int)x-side/2,(int)y-side+(int)std::round(side*5.f/144.f),side,side};
  SDL_RendererFlip flip=facing<0?SDL_FLIP_HORIZONTAL:SDL_FLIP_NONE;
  SDL_RenderCopyEx(renderer,tex,&src,&dest,0,nullptr,flip);
}
void projectile(const Projectile& pr,float camera) {
  constexpr float lift[]{43,43,42,42,47,49};
  const int style=(int)pr.style;
  const float x=pr.x-camera,y=370+pr.y*.7f-lift[style];
  if(!projectileAtlas) {
    rect(x-6,y-5,12,10,pr.hostile?SDL_Color{255,80,145,255}:SDL_Color{255,208,80,255});
    return;
  }
  SDL_Rect src{0,style*PROJECTILE_H,PROJECTILE_W,PROJECTILE_H};
  SDL_Rect dst{(int)std::round(x)-64,(int)std::round(y)-32,128,64};
  SDL_RenderCopyEx(renderer,projectileAtlas,&src,&dst,0,nullptr,
                   pr.vx<0?SDL_FLIP_HORIZONTAL:SDL_FLIP_NONE);
}
void backdrop(int stage,float camera) {
  auto* bg=backgrounds[stage];
  if(bg) {
    SDL_Rect src{(int)(camera*.07f),0,
#if defined(COSMIC_PSP)
      480,270
#else
      960,540
#endif
    };
    if(src.x>0) src.x=0; // baked background is exactly one viewport; stage floor carries movement.
    SDL_RenderCopy(renderer,bg,&src,nullptr);
  } else rect(0,0,W,H,{8,16,33,255});
  rect(0,350,960,190,{5,13,25,125});
  for(int k=-1;k<7;k++) {
    float x=k*200-std::fmod(camera*.5f,200.f);
    line(x,390,x+100,540,{100,175,220,35});
  }
  line(0,365,960,365,{123,211,250,130});
}
void render(const Game& game) {
  color({5,12,26,255}); SDL_RenderClear(renderer);
  if(game.screen==Screen::Stage || game.screen==Screen::Pause || game.screen==Screen::Clear || game.screen==Screen::Ending) {
    backdrop(game.selectedStage,game.camera);
    std::vector<const Enemy*> sorted;
    for(auto& e:game.enemies) if(!e.dead) sorted.push_back(&e);
    std::sort(sorted.begin(),sorted.end(),[](auto a,auto b){return a->y<b->y;});
    for(auto* e:sorted) {
      float x=e->x-game.camera,y=370+e->y*.7f;
      rect(x-25,y-4,50,6,{0,0,0,100});
      Action a=e->hurt>0?Action::Hurt:e->special>0?Action::Special:e->attack>0?Action::Attack:Action::Walk;
      character(enemySprite(e->kind,game.selectedStage),a,e->anim,x,y,e->facing,e->kind==EnemyKind::Boss?1.7f:1.1f);
      bar(x-26,y-87,52,5,e->hp/e->maxHp,{238,82,109,255});
    }
    for(auto& pr:game.projectiles) projectile(pr,game.camera);
    for(int i=0;i<game.playerCount;i++) {
      const auto& p=game.players[i]; float x=p.x-game.camera,y=370+p.y*.7f;
      rect(x-22,y-5,44,6,{0,0,0,105});
      character(p.hero,p.action,p.anim,x,y-p.z,p.facing,1.25f);
    }
    rect(0,0,960,67,{5,12,30,225});
    for(int i=0;i<game.playerCount;i++) {
      auto& p=game.players[i]; auto& h=heroes[p.hero]; int x=20+i*360;
      text(std::string("P")+std::to_string(i+1)+"  "+h.name,x,7,17,{h.r,h.g,h.b,255});
      bar(x,32,235,10,p.hp/p.maxHp,{237,77,110,255});
      bar(x,47,235,6,p.energy/p.maxEnergy,{79,196,255,255});
    }
    text(std::string(stageNames[game.selectedStage])+"  SCORE "+std::to_string(game.score),690,15,15,{230,237,255,255});
    if(game.noticeTimer>0) { rect(255,107,450,65,{4,12,30,200}); text(game.notice,480,123,28,{255,235,164,255},true); }
    if(game.failed) { rect(0,0,W,H,{0,0,0,165}); text("MISSAO FALHOU",480,205,42,{255,90,115,255},true); text("ENTER: MAPA",480,265,21,{255,255,255,255},true); }
    if(game.screen==Screen::Pause) { rect(0,0,W,H,{0,0,0,165}); text("PAUSA",480,205,46,{255,255,255,255},true); text("ESC: CONTINUAR  |  R: MAPA",480,273,20,{226,232,250,255},true); }
    if(game.screen==Screen::Clear||game.screen==Screen::Ending) {
      rect(0,0,W,H,{0,0,0,185});
      text(game.screen==Screen::Ending?"COSMIC VANGUARD":"MISSAO CONCLUIDA",480,174,39,{255,216,105,255},true);
      text(game.screen==Screen::Ending?"O Vazio foi detido":"Novo heroi recrutado",480,235,23,{242,248,255,255},true);
      text("ENTER: MAPA",480,319,20,{200,229,255,255},true);
    }
  } else if(game.screen==Screen::Title) {
    if(titleBanner) {
      SDL_Rect src{0,0,
#if defined(COSMIC_PSP)
        480,192
#else
        960,384
#endif
      };
      SDL_Rect dst{0,0,960,384}; SDL_RenderCopy(renderer,titleBanner,&src,&dst);
    } else backdrop(0,0);
    rect(0,375,960,165,{3,7,19,255});
    rect(0,353,960,22,{3,7,19,185});
    text("SELECIONE UM SLOT",50,380,16,{157,186,217,255});
    for(int i=0;i<3;i++) {
      int x=50+i*305;
      rect(x,410,270,67,i+1==game.selectedSlot?SDL_Color{25,76,117,240}:SDL_Color{13,27,54,220});
      text("SLOT "+std::to_string(i+1),x+16,424,21,{248,250,255,255});
      text("ENTER / A: JOGAR",x+16,452,13,{183,211,235,255});
    }
    text("SETAS / DIRECIONAL: ESCOLHER SLOT",480,499,18,{226,235,255,255},true);
  } else if(game.screen==Screen::Map) {
    backdrop(0,0); rect(0,0,W,H,{5,10,26,190});
    text("MAPA DE OPERACOES",480,34,35,{255,216,105,255},true);
    for(int i=0;i<4;i++) {
      int x=80+(i%2)*475,y=139+(i/2)*154; bool locked=i==3&&!(game.profile.completed[0]&&game.profile.completed[1]&&game.profile.completed[2]);
      rect(x,y,420,120,i==game.selectedStage?SDL_Color{30,86,121,240}:SDL_Color{12,28,51,230});
      text(stageNames[i],x+20,y+16,24,locked?SDL_Color{125,139,160,255}:SDL_Color{240,245,255,255});
      text(locked?"BLOQUEADO":game.profile.completed[i]?"CONCLUIDO":"DISPONIVEL",x+20,y+63,17,{177,215,242,255});
    }
    const char* difficulty=game.profile.difficulty==0?"FACIL":game.profile.difficulty==2?"DIFICIL":"NORMAL";
    text(std::string("CREDITOS ")+std::to_string(game.profile.credits)+"   RECORDE "+std::to_string(game.profile.highScore)+"   DIFICULDADE "+difficulty,480,449,15,{245,219,149,255},true);
    text(std::string("M / Y: CO-OP ")+(game.coop?"2 JOGADORES":"SOLO")+"  |  TAB / OMBRO DIR.: DIFICULDADE",480,476,16,{231,241,255,255},true);
    text("R / SELECT: EQUIPE  |  ENTER / A: INICIAR",480,501,16,{231,241,255,255},true);
  } else if(game.screen==Screen::Roster) {
    backdrop(2,0); rect(0,0,W,H,{5,10,26,205});
    text("EQUIPE COSMIC VANGUARD",480,24,32,{255,216,105,255},true);
    for(int i=0;i<6;i++) {
      int x=95+i*135; bool available=game.profile.unlocked[i];
      rect(x,142,112,235,i==game.selectedHero?SDL_Color{32,91,130,245}:SDL_Color{13,31,57,235});
      if(available) character(i,Action::Idle,0,x+56,280,1,1.4f);
      else text("?",x+56,192,42,{119,137,161,255},true);
      text(available?heroes[i].name:"BLOQUEADO",x+56,305,available?12:11,{237,245,255,255},true);
    }
    text("SETAS: SELECIONAR  |  ENTER: EQUIPAR  |  ESC: VOLTAR",480,452,18,{228,239,255,255},true);
  }
  SDL_RenderPresent(renderer);
}
bool key(const Uint8* keys,SDL_Scancode code) { return keys[code]!=0; }
Input controls(const Uint8* keys,const Uint8* old,int slot,bool coop) {
  auto down=[&](SDL_Scancode c){return key(keys,c);};
  auto press=[&](SDL_Scancode c){return key(keys,c)&&!key(old,c);};
  Input in;
  if(slot==0) {
    in.x=(down(SDL_SCANCODE_D)?1:0)-(down(SDL_SCANCODE_A)?1:0);
    in.y=(down(SDL_SCANCODE_S)?1:0)-(down(SDL_SCANCODE_W)?1:0);
    if(!coop) { in.x+=(down(SDL_SCANCODE_RIGHT)?1:0)-(down(SDL_SCANCODE_LEFT)?1:0); in.y+=(down(SDL_SCANCODE_DOWN)?1:0)-(down(SDL_SCANCODE_UP)?1:0); }
    in.attack=press(coop?SDL_SCANCODE_F:SDL_SCANCODE_J)||(!coop&&press(SDL_SCANCODE_Z));
    in.special=press(coop?SDL_SCANCODE_G:SDL_SCANCODE_K)||(!coop&&press(SDL_SCANCODE_X));
    in.mobility=press(coop?SDL_SCANCODE_H:SDL_SCANCODE_L)||(!coop&&press(SDL_SCANCODE_C));
    in.jump=press(SDL_SCANCODE_SPACE); in.swapPrev=press(SDL_SCANCODE_Q); in.swapNext=press(SDL_SCANCODE_E);
    in.confirm=press(SDL_SCANCODE_RETURN)||press(SDL_SCANCODE_SPACE);
    in.back=press(SDL_SCANCODE_BACKSPACE)||press(SDL_SCANCODE_ESCAPE);
    in.pause=press(SDL_SCANCODE_ESCAPE)||press(SDL_SCANCODE_P);
    in.roster=press(SDL_SCANCODE_R); in.coop=press(SDL_SCANCODE_M);
    in.difficulty=press(SDL_SCANCODE_TAB);
    in.select=press(SDL_SCANCODE_RIGHT)||press(SDL_SCANCODE_DOWN)?1:press(SDL_SCANCODE_LEFT)||press(SDL_SCANCODE_UP)?-1:0;
  } else {
    in.x=(down(SDL_SCANCODE_RIGHT)?1:0)-(down(SDL_SCANCODE_LEFT)?1:0);
    in.y=(down(SDL_SCANCODE_DOWN)?1:0)-(down(SDL_SCANCODE_UP)?1:0);
    in.attack=press(SDL_SCANCODE_J); in.special=press(SDL_SCANCODE_K); in.mobility=press(SDL_SCANCODE_L);
    in.jump=press(SDL_SCANCODE_RSHIFT); in.swapPrev=press(SDL_SCANCODE_U); in.swapNext=press(SDL_SCANCODE_O);
  }
  in.x=std::clamp(in.x,-1.f,1.f); in.y=std::clamp(in.y,-1.f,1.f);
  if(pads[slot]) {
    auto pad=pads[slot];
    auto held=[&](SDL_GameControllerButton b){return SDL_GameControllerGetButton(pad,b)!=0;};
    auto tapped=[&](SDL_GameControllerButton b){return held(b)&&!oldPad[slot][b];};
    float ax=SDL_GameControllerGetAxis(pad,SDL_CONTROLLER_AXIS_LEFTX)/32767.f;
    float ay=SDL_GameControllerGetAxis(pad,SDL_CONTROLLER_AXIS_LEFTY)/32767.f;
    if(std::abs(ax)<.2f) ax=0;
    if(std::abs(ay)<.2f) ay=0;
    in.x=std::clamp(in.x+ax+(held(SDL_CONTROLLER_BUTTON_DPAD_RIGHT)?1:0)-(held(SDL_CONTROLLER_BUTTON_DPAD_LEFT)?1:0),-1.f,1.f);
    in.y=std::clamp(in.y+ay+(held(SDL_CONTROLLER_BUTTON_DPAD_DOWN)?1:0)-(held(SDL_CONTROLLER_BUTTON_DPAD_UP)?1:0),-1.f,1.f);
    in.attack|=tapped(SDL_CONTROLLER_BUTTON_A);
    in.special|=tapped(SDL_CONTROLLER_BUTTON_X);
    in.mobility|=tapped(SDL_CONTROLLER_BUTTON_B);
    in.jump|=tapped(SDL_CONTROLLER_BUTTON_Y);
    in.swapPrev|=tapped(SDL_CONTROLLER_BUTTON_LEFTSHOULDER);
    in.swapNext|=tapped(SDL_CONTROLLER_BUTTON_RIGHTSHOULDER);
    in.confirm|=tapped(SDL_CONTROLLER_BUTTON_A);
    in.back|=tapped(SDL_CONTROLLER_BUTTON_B);
    in.pause|=tapped(SDL_CONTROLLER_BUTTON_START);
    in.roster|=tapped(SDL_CONTROLLER_BUTTON_BACK);
    in.coop|=tapped(SDL_CONTROLLER_BUTTON_Y);
    in.difficulty|=tapped(SDL_CONTROLLER_BUTTON_RIGHTSHOULDER);
    in.select+=(tapped(SDL_CONTROLLER_BUTTON_DPAD_RIGHT)||tapped(SDL_CONTROLLER_BUTTON_DPAD_DOWN))?1:0;
    in.select-=(tapped(SDL_CONTROLLER_BUTTON_DPAD_LEFT)||tapped(SDL_CONTROLLER_BUTTON_DPAD_UP))?1:0;
  }
  return in;
}

#if defined(COSMIC_PSP) || defined(COSMIC_VITA)
Input consoleControls() {
  static unsigned previous=0;
  unsigned buttons=0; float ax=0,ay=0;
#if defined(COSMIC_PSP)
  SceCtrlData pad{}; sceCtrlPeekBufferPositive(&pad,1);
  buttons=pad.Buttons; ax=(int(pad.Lx)-128)/127.f; ay=(int(pad.Ly)-128)/127.f;
  constexpr unsigned up=PSP_CTRL_UP,down=PSP_CTRL_DOWN,left=PSP_CTRL_LEFT,right=PSP_CTRL_RIGHT;
  constexpr unsigned a=PSP_CTRL_CROSS,b=PSP_CTRL_CIRCLE,x=PSP_CTRL_SQUARE,y=PSP_CTRL_TRIANGLE;
  constexpr unsigned l=PSP_CTRL_LTRIGGER,r=PSP_CTRL_RTRIGGER,start=PSP_CTRL_START,select=PSP_CTRL_SELECT;
#else
  SceCtrlData pad{}; sceCtrlPeekBufferPositive(0,&pad,1);
  buttons=pad.buttons; ax=(int(pad.lx)-128)/127.f; ay=(int(pad.ly)-128)/127.f;
  constexpr unsigned up=SCE_CTRL_UP,down=SCE_CTRL_DOWN,left=SCE_CTRL_LEFT,right=SCE_CTRL_RIGHT;
  constexpr unsigned a=SCE_CTRL_CROSS,b=SCE_CTRL_CIRCLE,x=SCE_CTRL_SQUARE,y=SCE_CTRL_TRIANGLE;
  constexpr unsigned l=SCE_CTRL_LTRIGGER,r=SCE_CTRL_RTRIGGER,start=SCE_CTRL_START,select=SCE_CTRL_SELECT;
#endif
  auto tap=[&](unsigned bit){return (buttons&bit)!=0 && (previous&bit)==0;};
  Input input;
  input.x=std::clamp((std::abs(ax)>.28f?ax:0.f)+((buttons&right)?1.f:0.f)-((buttons&left)?1.f:0.f),-1.f,1.f);
  input.y=std::clamp((std::abs(ay)>.28f?ay:0.f)+((buttons&down)?1.f:0.f)-((buttons&up)?1.f:0.f),-1.f,1.f);
  input.attack=tap(x); input.special=tap(a); input.mobility=tap(b); input.jump=tap(y);
  input.swapPrev=tap(l); input.swapNext=tap(r); input.confirm=tap(a); input.back=tap(b);
  input.pause=tap(start); input.roster=tap(select);
  input.coop=tap(y);
  input.difficulty=tap(r);
  input.select=(tap(right)||tap(down)?1:0)-(tap(left)||tap(up)?1:0);
  previous=buttons; return input;
}
#endif
}

int main(int argc,char** argv) {
#if defined(COSMIC_PSP)
  scePowerSetClockFrequency(333,333,166);
  sceCtrlSetSamplingCycle(0); sceCtrlSetSamplingMode(PSP_CTRL_MODE_ANALOG);
#elif defined(COSMIC_VITA)
  scePowerSetArmClockFrequency(444); scePowerSetBusClockFrequency(222);
  scePowerSetGpuClockFrequency(222); scePowerSetGpuXbarClockFrequency(166);
  sceCtrlSetSamplingMode(SCE_CTRL_MODE_ANALOG);
#elif defined(__SWITCH__)
  romfsInit();
#endif
  int frames=-1,stage=0; bool play=false,localCoop=false; std::string screenshot;
  for(int i=1;i<argc;i++) { std::string arg=argv[i];
    if(arg=="--frames"&&i+1<argc) frames=std::atoi(argv[++i]);
    else if(arg=="--screenshot"&&i+1<argc) screenshot=argv[++i];
    else if(arg=="--play") play=true;
    else if(arg=="--stage"&&i+1<argc) stage=std::atoi(argv[++i]);
    else if(arg=="--coop") localCoop=true;
  }
  if(SDL_Init(SDL_INIT_VIDEO|SDL_INIT_GAMECONTROLLER)!=0) { std::fprintf(stderr,"SDL: %s\n",SDL_GetError()); return 1; }
  IMG_Init(IMG_INIT_PNG|IMG_INIT_JPG); TTF_Init();
#if defined(COSMIC_PSP)
  SDL_Window* window=SDL_CreateWindow("Cosmic Vanguard",0,0,480,272,0);
#elif defined(COSMIC_VITA)
  SDL_Window* window=SDL_CreateWindow("Cosmic Vanguard",0,0,960,544,0);
#else
  SDL_Window* window=SDL_CreateWindow("Cosmic Vanguard",SDL_WINDOWPOS_CENTERED,SDL_WINDOWPOS_CENTERED,960,540,SDL_WINDOW_RESIZABLE);
#endif
#if defined(COSMIC_VITA)
  SDL_SetHint(SDL_HINT_RENDER_DRIVER,"VITA gxm");
#endif
  renderer=SDL_CreateRenderer(window,-1,SDL_RENDERER_ACCELERATED|SDL_RENDERER_PRESENTVSYNC);
  if(!renderer) renderer=SDL_CreateRenderer(window,-1,SDL_RENDERER_SOFTWARE);
  if(!renderer) { std::fprintf(stderr,"Renderer: %s\n",SDL_GetError()); return 1; }
  SDL_RenderSetLogicalSize(renderer,W,H); SDL_SetRenderDrawBlendMode(renderer,SDL_BLENDMODE_BLEND);
  char* base=SDL_GetBasePath(); assetRoot=base?std::string(base)+"assets/":"assets/"; if(base) SDL_free(base);
  auto assetExists=[](const std::string& path){ SDL_RWops* f=SDL_RWFromFile(path.c_str(),"rb"); if(!f) return false; SDL_RWclose(f); return true; };
  if(!assetExists(assetRoot+"solarion.png")) {
    for(const char* path:{"native/assets/","romfs:/assets/","app0:assets/","ms0:/PSP/GAME/CosmicVanguard/assets/"})
      if(assetExists(std::string(path)+"solarion.png")) { assetRoot=path; break; }
  }
#if defined(COSMIC_PSP)
  for(const char* path:{"assets/","ms0:/PSP/GAME/CosmicVanguard/assets/","disc0:/PSP_GAME/USRDIR/assets/"})
    if(assetExists(std::string(path)+"solarion.png")) { assetRoot=path; break; }
#endif
  for(int i=0;i<11;i++) sprite[i]=image(std::string(spriteNames[i])+".png");
  projectileAtlas=image("projectiles.png");
  if(projectileAtlas) SDL_SetTextureBlendMode(projectileAtlas,SDL_BLENDMODE_BLEND);
  for(int i=0;i<4;i++) backgrounds[i]=image(std::string(i==0?"harbor":i==1?"metro":i==2?"sky":"void")+".jpg");
  titleBanner=image("title.jpg");
  font=TTF_OpenFont((assetRoot+"DejaVuSans-Bold.ttf").c_str(),20);
  if(!font) std::fprintf(stderr,"Font: %s\n",TTF_GetError());
  Game game;
#if defined(COSMIC_PSP)
  game.saveDir="ms0:/data/cosmic-vanguard";
#elif defined(COSMIC_VITA)
  game.saveDir="ux0:data/cosmic-vanguard";
#elif defined(__SWITCH__)
  game.saveDir="sdmc:/switch/cosmic-vanguard";
#else
  char* pref=SDL_GetPrefPath("Cosmic Vanguard","Native"); game.saveDir=pref?pref:"."; if(pref) SDL_free(pref);
#endif
  if(play) { game.coop=localCoop; game.load(1); game.startStage(stage); }
  std::array<Uint8,SDL_NUM_SCANCODES> old{};
  for(int i=0,j=0;i<SDL_NumJoysticks()&&j<2;i++) if(SDL_IsGameController(i)) pads[j++]=SDL_GameControllerOpen(i);
  Uint64 last=SDL_GetPerformanceCounter(); bool running=true; int ticks=0;
  while(running) {
    SDL_Event event; while(SDL_PollEvent(&event)) {
      if(event.type==SDL_QUIT) running=false;
      if(event.type==SDL_CONTROLLERDEVICEADDED)
        for(auto& pad:pads) if(!pad) { pad=SDL_GameControllerOpen(event.cdevice.which); break; }
    }
    SDL_PumpEvents(); const Uint8* keys=SDL_GetKeyboardState(nullptr);
    std::array<Input,2> input{{controls(keys,old.data(),0,game.coop),controls(keys,old.data(),1,game.coop)}};
#if defined(COSMIC_PSP) || defined(COSMIC_VITA)
    input[0]=consoleControls();
#endif
    Uint64 now=SDL_GetPerformanceCounter(); float dt=(float)(now-last)/SDL_GetPerformanceFrequency(); last=now;
    game.update(dt,input); render(game);
    std::copy(keys,keys+SDL_NUM_SCANCODES,old.begin());
    for(int i=0;i<2;i++) if(pads[i]) for(int b=0;b<SDL_CONTROLLER_BUTTON_MAX;b++) oldPad[i][b]=SDL_GameControllerGetButton(pads[i],(SDL_GameControllerButton)b)!=0;
    if(frames>=0 && ++ticks>=frames) running=false;
  }
  if(!screenshot.empty()) {
    SDL_Surface* shot=SDL_CreateRGBSurfaceWithFormat(0,W,H,32,SDL_PIXELFORMAT_ARGB8888);
    SDL_RenderReadPixels(renderer,nullptr,SDL_PIXELFORMAT_ARGB8888,shot->pixels,shot->pitch);
    SDL_SaveBMP(shot,screenshot.c_str()); SDL_FreeSurface(shot);
  }
  if(font) TTF_CloseFont(font);
  for(auto* pad:pads) if(pad) SDL_GameControllerClose(pad);
  for(auto* t:sprite) if(t) SDL_DestroyTexture(t);
  if(projectileAtlas) SDL_DestroyTexture(projectileAtlas);
  for(auto* t:backgrounds) if(t) SDL_DestroyTexture(t);
  if(titleBanner) SDL_DestroyTexture(titleBanner);
  SDL_DestroyRenderer(renderer); SDL_DestroyWindow(window); TTF_Quit(); IMG_Quit(); SDL_Quit();
#if defined(__SWITCH__)
  romfsExit();
#endif
  return 0;
}
