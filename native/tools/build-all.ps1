param([ValidateSet('all','linux','windows','switch','vita','psp')][string[]]$Targets=@('all'))
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$native=Join-Path $root 'native'
$release=Join-Path $native 'dist\v0.1.1'
if (-not $release.StartsWith($native + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Release path outside native directory' }
if (($Targets -contains 'all') -and (Test-Path -LiteralPath $release)) { Remove-Item -LiteralPath $release -Recurse -Force }
New-Item -ItemType Directory -Path $release -Force | Out-Null
Set-Location $root
python native/tools/bake_assets.py
if ($LASTEXITCODE -ne 0) { throw 'Asset baking failed' }
$all=$Targets -contains 'all'
$mount="${root}:/src"

if ($all -or $Targets -contains 'linux') {
  & docker run --rm -v $mount -w /src arcana-host bash -lc 'cmake -S native -B native/build-linux -G Ninja -DCMAKE_BUILD_TYPE=Release && cmake --build native/build-linux -j4 && ctest --test-dir native/build-linux --output-on-failure'
  if ($LASTEXITCODE -ne 0) { throw 'Linux build failed' }
  & docker run --rm -v $mount -w /src arcana-host bash -lc 'mkdir -p native/dist/v0.1.1/linux/assets && cp native/build-linux/cosmic_vanguard native/dist/v0.1.1/linux/ && cp native/assets/*.{png,jpg,ttf,txt} native/dist/v0.1.1/linux/assets/ && tar -C native/dist/v0.1.1 -czf native/dist/v0.1.1/cosmic-vanguard-v0.1.1-linux-x86_64.tar.gz linux'
  if ($LASTEXITCODE -ne 0) { throw 'Linux packaging failed' }
}
if ($all -or $Targets -contains 'windows') {
  & docker run --rm -v $mount -w /src arcana-windows bash -lc 'cmake -S native -B native/build-windows -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_SYSTEM_NAME=Windows -DCMAKE_CXX_COMPILER=x86_64-w64-mingw32-g++ -DCMAKE_FIND_ROOT_PATH=/opt/sdl-win64 -DCMAKE_PREFIX_PATH=/opt/sdl-win64 -DCMAKE_FIND_ROOT_PATH_MODE_PACKAGE=BOTH -DCMAKE_FIND_ROOT_PATH_MODE_INCLUDE=BOTH -DCMAKE_FIND_ROOT_PATH_MODE_LIBRARY=BOTH && cmake --build native/build-windows -j4 && mkdir -p native/dist/v0.1.1/windows/assets && cp native/build-windows/cosmic_vanguard.exe native/dist/v0.1.1/windows/ && cp /opt/sdl-win64/bin/SDL2*.dll native/dist/v0.1.1/windows/ && cp native/assets/*.{png,jpg,ttf,txt} native/dist/v0.1.1/windows/assets/'
  if ($LASTEXITCODE -ne 0) { throw 'Windows build failed' }
  Compress-Archive -Path (Join-Path $release 'windows\*') -DestinationPath (Join-Path $release 'cosmic-vanguard-v0.1.1-windows-x86_64.zip') -Force
}
if ($all -or $Targets -contains 'switch') {
  $romfs=Join-Path $native 'platforms\switch\romfs\assets'
  New-Item -ItemType Directory -Path $romfs -Force | Out-Null
  Copy-Item -Path (Join-Path $native 'assets\*.png'),(Join-Path $native 'assets\*.jpg'),(Join-Path $native 'assets\*.ttf'),(Join-Path $native 'assets\*.txt') -Destination $romfs -Force
  & docker run --rm -v $mount -w /src/native/platforms/switch devkitpro/devkita64 make -j4
  if ($LASTEXITCODE -ne 0) { throw 'Switch build failed' }
  Copy-Item (Join-Path $native 'platforms\switch\cosmic-vanguard.nro') (Join-Path $release 'cosmic-vanguard-v0.1.1-switch.nro')
}
if ($all -or $Targets -contains 'vita') {
  & docker run --rm -v $mount -w /src vitasdk/vitasdk bash -lc 'cmake -S native/platforms/vita -B native/build-vita -DCMAKE_BUILD_TYPE=Release && cmake --build native/build-vita -j4'
  if ($LASTEXITCODE -ne 0) { throw 'Vita build failed' }
  Copy-Item (Join-Path $native 'build-vita\cosmic-vanguard.vpk') (Join-Path $release 'cosmic-vanguard-v0.1.1-vita.vpk')
}
if ($all -or $Targets -contains 'psp') {
  & docker run --rm -v $mount -w /src pspdev/pspdev bash -c 'cmake -S native/platforms/psp -B native/build-psp -DCMAKE_TOOLCHAIN_FILE="$PSPDEV/psp/share/pspdev.cmake" -DCMAKE_BUILD_TYPE=Release && cmake --build native/build-psp -j4 && mksfoex -s CATEGORY=UG -s DISC_ID=CVAN90001 -s DISC_VERSION=1.00 -s APP_VER=00.11 -s PSP_SYSTEM_VER=6.60 -d BOOTABLE=1 -d DISC_NUMBER=1 -d DISC_TOTAL=1 -d PARENTAL_LEVEL=1 -d REGION=32768 -d MEMSIZE=1 "Cosmic Vanguard" native/build-psp/PARAM_UMD.SFO'
  if ($LASTEXITCODE -ne 0) { throw 'PSP build failed' }
  $psp=Join-Path $release 'PSP-GAME\CosmicVanguard'
  New-Item -ItemType Directory -Path (Join-Path $psp 'assets') -Force | Out-Null
  Copy-Item (Join-Path $native 'build-psp\EBOOT.PBP') $psp
  Copy-Item -Path (Join-Path $native 'assets\psp\*') -Destination (Join-Path $psp 'assets') -Force
  Compress-Archive -Path (Join-Path $release 'PSP-GAME\*') -DestinationPath (Join-Path $release 'cosmic-vanguard-v0.1.1-psp-eboot.zip') -Force
  & docker run --rm -v $mount -w /src arcana-host bash -lc 'set -e; umd=native/build-psp/umd; mkdir -p "$umd/PSP_GAME/SYSDIR" "$umd/PSP_GAME/USRDIR/assets"; cp native/build-psp/PARAM_UMD.SFO "$umd/PSP_GAME/PARAM.SFO"; cp native/platforms/psp/icon0.png "$umd/PSP_GAME/ICON0.PNG"; cp native/platforms/psp/pic1.png "$umd/PSP_GAME/PIC1.PNG"; cp native/build-psp/cosmic_psp.prx "$umd/PSP_GAME/SYSDIR/EBOOT.BIN"; cp native/assets/psp/* "$umd/PSP_GAME/USRDIR/assets/"; printf "CVAN-90001|0000000000000001|0001|G" > "$umd/UMD_DATA.BIN"; genisoimage -quiet -iso-level 4 -xa -A "PSP GAME" -V "COSMIC" -sysid "PSP GAME" -o native/dist/v0.1.1/cosmic-vanguard-v0.1.1-psp.iso "$umd"; python3 native/tools/make_cso.py native/dist/v0.1.1/cosmic-vanguard-v0.1.1-psp.iso native/dist/v0.1.1/cosmic-vanguard-v0.1.1-psp.cso'
  if ($LASTEXITCODE -ne 0) { throw 'PSP ISO/CSO packaging failed' }
}
$hashes=Get-ChildItem -LiteralPath $release -File | Sort-Object Name | ForEach-Object { "{0}  {1}" -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(),$_.Name }
[IO.File]::WriteAllLines((Join-Path $release 'SHA256SUMS'),$hashes)
Write-Host "Release artifacts: $release"
