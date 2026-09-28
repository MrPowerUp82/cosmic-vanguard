.SUFFIXES:
ifeq ($(strip $(DEVKITPRO)),)
$(error DEVKITPRO is required)
endif
TOPDIR ?= $(CURDIR)
include $(DEVKITPRO)/libnx/switch_rules
TARGET := cosmic-vanguard
BUILD := build
SOURCES := ../../src
INCLUDES := ../../include
ROMFS := romfs
APP_TITLE := Cosmic Vanguard
APP_AUTHOR := MrPowerUp82
APP_VERSION := 0.1.1
ARCH := -march=armv8-a+crc+crypto -mtune=cortex-a57 -mtp=soft -fPIE
CFLAGS := -Wall -Wextra -O2 -ffunction-sections $(ARCH) `$(PREFIX)pkg-config --cflags sdl2 SDL2_image SDL2_ttf`
CFLAGS += $(INCLUDE) -D__SWITCH__
CXXFLAGS := $(CFLAGS) -std=gnu++17 -fno-rtti
ASFLAGS := -g $(ARCH)
LDFLAGS = -specs=$(DEVKITPRO)/libnx/switch.specs $(ARCH) -Wl,-Map,$(notdir $*.map) -Wl,--gc-sections
LIBS := `$(PREFIX)pkg-config --libs SDL2_image SDL2_ttf sdl2` -lnx
LIBDIRS := $(PORTLIBS) $(LIBNX)
ifneq ($(BUILD),$(notdir $(CURDIR)))
export OUTPUT := $(CURDIR)/$(TARGET)
export TOPDIR := $(CURDIR)
export VPATH := $(foreach dir,$(SOURCES),$(CURDIR)/$(dir))
export DEPSDIR := $(CURDIR)/$(BUILD)
CPPFILES := $(foreach dir,$(SOURCES),$(notdir $(wildcard $(dir)/*.cpp)))
export LD := $(CXX)
export OFILES := $(CPPFILES:.cpp=.o)
export INCLUDE := $(foreach dir,$(INCLUDES),-I$(CURDIR)/$(dir)) $(foreach dir,$(LIBDIRS),-I$(dir)/include) -I$(CURDIR)/$(BUILD)
export LIBPATHS := $(foreach dir,$(LIBDIRS),-L$(dir)/lib)
export APP_ICON := $(TOPDIR)/icon.jpg
export NROFLAGS += --icon=$(APP_ICON) --nacp=$(CURDIR)/$(TARGET).nacp --romfsdir=$(CURDIR)/$(ROMFS)
.PHONY: $(BUILD) clean all
all: $(BUILD)
$(BUILD):
	@[ -d $@ ] || mkdir -p $@
	@$(MAKE) --no-print-directory -C $(BUILD) -f $(CURDIR)/Makefile
clean:
	@rm -fr $(BUILD) $(TARGET).nro $(TARGET).nacp $(TARGET).elf
else
DEPENDS := $(OFILES:.o=.d)
.PHONY: all
all: $(OUTPUT).nro
$(OUTPUT).nro: $(OUTPUT).elf $(OUTPUT).nacp
$(OUTPUT).elf: $(OFILES)
-include $(DEPENDS)
endif
