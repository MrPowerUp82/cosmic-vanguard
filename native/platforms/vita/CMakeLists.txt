cmake_minimum_required(VERSION 3.20)
if(NOT DEFINED ENV{VITASDK})
  message(FATAL_ERROR "VITASDK is required")
endif()
set(CMAKE_TOOLCHAIN_FILE "$ENV{VITASDK}/share/vita.toolchain.cmake" CACHE PATH "toolchain")
project(CosmicVanguardVita LANGUAGES C CXX)
include("$ENV{VITASDK}/share/vita.cmake" REQUIRED)
set(ROOT "${CMAKE_CURRENT_LIST_DIR}/../..")
find_package(SDL2 REQUIRED)
find_package(SDL2_image REQUIRED)
find_package(SDL2_ttf REQUIRED)
set(CMAKE_CXX_STANDARD_LIBRARIES "-lSceShaccCgExt -ltaihen_stub -lSceShaccCg_stub -Wl,--whole-archive -lpthread -Wl,--no-whole-archive ${CMAKE_CXX_STANDARD_LIBRARIES}")
add_executable(cosmic_vita ${ROOT}/src/main.cpp ${ROOT}/src/game.cpp)
target_include_directories(cosmic_vita PRIVATE ${ROOT}/include)
target_compile_features(cosmic_vita PRIVATE cxx_std_17)
target_compile_definitions(cosmic_vita PRIVATE COSMIC_VITA)
target_compile_options(cosmic_vita PRIVATE -O2 -fno-rtti)
target_link_libraries(cosmic_vita PRIVATE SDL2_ttf::SDL2_ttf-static SDL2_image::SDL2_image-static SDL2::SDL2-static freetype png jpeg bz2 z SceCtrl_stub SceProcessmgr_stub)
vita_create_self(eboot.bin cosmic_vita UNSAFE)
vita_create_vpk(cosmic-vanguard.vpk CVAN00001 eboot.bin VERSION 00.11 NAME "Cosmic Vanguard"
  FILE ${ROOT}/assets/solarion.png assets/solarion.png
  FILE ${ROOT}/assets/night_talon.png assets/night_talon.png
  FILE ${ROOT}/assets/valoria.png assets/valoria.png
  FILE ${ROOT}/assets/red_velocity.png assets/red_velocity.png
  FILE ${ROOT}/assets/abyss_king.png assets/abyss_king.png
  FILE ${ROOT}/assets/emerald_nova.png assets/emerald_nova.png
  FILE ${ROOT}/assets/shadow_trooper.png assets/shadow_trooper.png
  FILE ${ROOT}/assets/pulse_gunner.png assets/pulse_gunner.png
  FILE ${ROOT}/assets/armored_brute.png assets/armored_brute.png
  FILE ${ROOT}/assets/rift_assassin.png assets/rift_assassin.png
  FILE ${ROOT}/assets/void_tyrant.png assets/void_tyrant.png
  FILE ${ROOT}/assets/harbor.jpg assets/harbor.jpg
  FILE ${ROOT}/assets/metro.jpg assets/metro.jpg
  FILE ${ROOT}/assets/sky.jpg assets/sky.jpg
  FILE ${ROOT}/assets/void.jpg assets/void.jpg
  FILE ${ROOT}/assets/title.jpg assets/title.jpg
  FILE ${ROOT}/assets/DejaVuSans-Bold.ttf assets/DejaVuSans-Bold.ttf
  FILE ${ROOT}/assets/DejaVu-LICENSE.txt assets/DejaVu-LICENSE.txt)
