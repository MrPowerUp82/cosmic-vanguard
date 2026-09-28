(() => {
  'use strict';

  // Ações atrasadas que avançam com o dt do mundo: pausa e hitstop as congelam.
  function createScheduler() {
    let timers = [];
    return {
      schedule(delaySec, fn, owner = null) {
        timers.push({ t: Math.max(0, delaySec), fn, owner });
      },
      update(dt) {
        if (!timers.length) return;
        const due = [];
        for (const timer of timers) {
          timer.t -= dt;
          if (timer.t <= 0) due.push(timer);
        }
        if (!due.length) return;
        timers = timers.filter(timer => timer.t > 0);
        due.sort((a, b) => a.t - b.t);
        for (const timer of due) timer.fn();
      },
      cancelOwner(owner) {
        timers = timers.filter(timer => timer.owner !== owner);
      },
      clear() {
        timers = [];
      },
      get size() {
        return timers.length;
      },
    };
  }

  // Converte o dt real em dt de mundo. Hitstop congela; slow-mo escala.
  function createTimeControl({ maxHitstop = .12 } = {}) {
    let hitstop = 0;
    let slowScale = 1;
    let slowTimer = 0;
    return {
      hitstop(sec) {
        hitstop = Math.min(maxHitstop, Math.max(hitstop, sec));
      },
      slowmo(scale, sec) {
        slowScale = slowTimer > 0 ? Math.min(slowScale, scale) : scale;
        slowTimer = Math.max(slowTimer, sec);
      },
      step(realDt) {
        if (hitstop > 0) {
          hitstop = Math.max(0, hitstop - realDt);
          return 0;
        }
        if (slowTimer > 0) {
          slowTimer = Math.max(0, slowTimer - realDt);
          return realDt * slowScale;
        }
        return realDt;
      },
      reset() {
        hitstop = 0;
        slowScale = 1;
        slowTimer = 0;
      },
      get frozen() {
        return hitstop > 0;
      },
    };
  }

  function createEventBus() {
    const handlers = new Map();
    return {
      on(name, fn) {
        if (!handlers.has(name)) handlers.set(name, []);
        handlers.get(name).push(fn);
        return () => {
          const list = handlers.get(name);
          const i = list ? list.indexOf(fn) : -1;
          if (i >= 0) list.splice(i, 1);
        };
      },
      emit(name, data) {
        const list = handlers.get(name);
        if (!list) return;
        for (const fn of [...list]) {
          try {
            fn(data);
          } catch (err) {
            console.error(`[CV] handler de "${name}" falhou`, err);
          }
        }
      },
      clear() {
        handlers.clear();
      },
    };
  }

  window.CV_CORE = { createScheduler, createTimeControl, createEventBus };
})();
