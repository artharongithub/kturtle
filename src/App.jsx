import { useState, useRef, useEffect, useCallback } from "react";

// ─── FULLSCREEN META (injected into <head> via effect) ───────────────────────
function useFullscreenMeta() {
  useEffect(() => {
    // viewport-fit=cover hides browser chrome on iOS
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
    meta.content = "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no";
    // theme-color hides Android status bar tint
    let tc = document.querySelector('meta[name="theme-color"]');
    if (!tc) { tc = document.createElement("meta"); tc.name = "theme-color"; document.head.appendChild(tc); }
    tc.content = "#080810";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.background = "#080810";
    document.body.style.overflow = "hidden";
  }, []);
}

// ─── INITIAL CODE ─────────────────────────────────────────────────────────────
const INITIAL_CODE = `# Чётные/нечётные итерации
$i = 1
repeat 12 {
  if ($i % 2 == 0) {
    pencolor "#00d4ff"
  } else {
    pencolor "#ff6b35"
  }
  forward 80
  back 80
  left 30
  $i = $i + 1
}
`;

// ─── EXAMPLES ─────────────────────────────────────────────────────────────────
const EXAMPLES = [
  { name: "Снежинка", code: `pencolor "#00d4ff"\npenwidth 2\nrepeat 6 {\n  forward 80\n  back 80\n  left 60\n}` },
  { name: "Квадрат", code: `pencolor "#ff6b35"\npenwidth 2\nrepeat 4 {\n  forward 100\n  right 90\n}` },
  { name: "Звезда", code: `pencolor "#ffe066"\npenwidth 2\nrepeat 5 {\n  forward 100\n  right 144\n}` },
  { name: "Цветок", code: `pencolor "#ff4488"\npenwidth 2\nrepeat 12 {\n  repeat 4 {\n    forward 40\n    right 90\n  }\n  right 30\n}` },
  { name: "Чётные/нечётные", code: `$i = 1\nrepeat 12 {\n  if ($i % 2 == 0) {\n    pencolor "#00d4ff"\n  } else {\n    pencolor "#ff6b35"\n  }\n  forward 80\n  back 80\n  left 30\n  $i = $i + 1\n}` },
  { name: "Спираль", code: `pencolor "#aa44ff"\npenwidth 1.5\n$s = 5\nrepeat 40 {\n  forward $s\n  right 30\n  $s = $s + 2\n}` },
  { name: "Концентрические круги", code: `$r = 10\nrepeat 8 {\n  penup\n  forward $r\n  pendown\n  repeat 36 {\n    forward 3\n    right 10\n  }\n  penup\n  back $r\n  home\n  $r = $r + 15\n}` },
];

// ─── COMMANDS REFERENCE ───────────────────────────────────────────────────────
const COMMANDS = [
  { cmd: "forward N", desc: "вперёд на N шагов" },
  { cmd: "back N", desc: "назад на N шагов" },
  { cmd: "left N", desc: "повернуть влево на N°" },
  { cmd: "right N", desc: "повернуть вправо на N°" },
  { cmd: 'pencolor "#цвет"', desc: "цвет пера (hex)" },
  { cmd: "penwidth N", desc: "толщина линии" },
  { cmd: "penup", desc: "поднять перо" },
  { cmd: "pendown", desc: "опустить перо" },
  { cmd: "clear", desc: "очистить холст" },
  { cmd: "home", desc: "черепашка в центр" },
  { cmd: "canvascolor \"#цвет\"", desc: "цвет фона холста" },
  { cmd: "show", desc: "показать черепашку" },
  { cmd: "hide", desc: "скрыть черепашку" },
  { cmd: "print \"текст\"", desc: "напечатать текст" },
  { cmd: "fontsize N", desc: "размер шрифта" },
  { cmd: "repeat N { }", desc: "повторить N раз" },
  { cmd: "if (условие) { }", desc: "условие" },
  { cmd: "if (условие) { } else { }", desc: "условие с иначе" },
  { cmd: "$x = N", desc: "присвоить переменную" },
  { cmd: "$x = $x + N", desc: "изменить переменную" },
  { cmd: "mod($x, N)", desc: "остаток от деления" },
  { cmd: "# текст", desc: "комментарий" },
];

// ─── PARSER ───────────────────────────────────────────────────────────────────
function tokenize(code) {
  // returns array of lines, trimmed, comments removed
  return code.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
}

function parseProgram(code) {
  const lines = tokenize(code);
  let pos = 0;

  function peek() { return pos < lines.length ? lines[pos] : null; }
  function consume() { return lines[pos++]; }

  function parseBlock() {
    const stmts = [];
    while (pos < lines.length) {
      const line = peek();
      if (line === "}") { consume(); break; }
      stmts.push(parseStatement());
    }
    return stmts;
  }

  function parseStatement() {
    const line = consume();

    // repeat N {
    const repeatM = line.match(/^repeat\s+(.+?)\s*\{?$/);
    if (repeatM) {
      const body = parseBlock();
      return { type: "repeat", count: repeatM[1], body };
    }

    // if (cond) {
    const ifM = line.match(/^if\s*\((.+)\)\s*\{?$/);
    if (ifM) {
      const thenBody = parseBlock();
      let elseBody = [];
      if (peek() && peek().match(/^else\s*\{?$/)) {
        consume();
        elseBody = parseBlock();
      }
      return { type: "if", cond: ifM[1], thenBody, elseBody };
    }

    // $var = expr
    const assignM = line.match(/^\$(\w+)\s*=\s*(.+)$/);
    if (assignM) return { type: "assign", name: assignM[1], expr: assignM[2] };

    return { type: "cmd", raw: line };
  }

  const stmts = [];
  while (pos < lines.length) stmts.push(parseStatement());
  return stmts;
}

// ─── EVALUATOR ────────────────────────────────────────────────────────────────
function evalExpr(expr, vars) {
  // replace $var with values
  let e = expr.replace(/\$(\w+)/g, (_, name) => {
    if (vars[name] === undefined) throw new Error(`Неизвестная переменная: $${name}`);
    return vars[name];
  });
  // replace mod(a,b) with (a%b)
  e = e.replace(/mod\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, (_, a, b) => `(${a}%${b})`);
  try {
    // safe eval via Function
    // eslint-disable-next-line no-new-func
    return Function('"use strict"; return (' + e + ')')();
  } catch {
    throw new Error(`Ошибка выражения: ${expr}`);
  }
}

function evalCond(cond, vars) {
  return !!evalExpr(cond, vars);
}

function executeProgram(stmts) {
  const cmds = [];
  const vars = {};

  function run(stmtList) {
    for (const stmt of stmtList) {
      if (stmt.type === "assign") {
        vars[stmt.name] = evalExpr(stmt.expr, vars);
        continue;
      }
      if (stmt.type === "repeat") {
        const count = Math.floor(evalExpr(stmt.count, vars));
        if (count > 5000) throw new Error("Слишком много повторений (макс 5000)");
        for (let i = 0; i < count; i++) run(stmt.body);
        continue;
      }
      if (stmt.type === "if") {
        if (evalCond(stmt.cond, vars)) run(stmt.thenBody);
        else run(stmt.elseBody);
        continue;
      }
      // cmd
      const raw = stmt.raw;
      // resolve $vars in raw cmd
      const resolved = raw.replace(/\$(\w+)/g, (_, name) => {
        if (vars[name] === undefined) throw new Error(`Неизвестная переменная: $${name}`);
        return vars[name];
      });

      const m = {
        fwd:  resolved.match(/^forward\s+([\d.]+)$/),
        bck:  resolved.match(/^back\s+([\d.]+)$/),
        lft:  resolved.match(/^left\s+([\d.]+)$/),
        rgt:  resolved.match(/^right\s+([\d.]+)$/),
        col:  resolved.match(/^pencolor\s+"([^"]+)"$/),
        col2: resolved.match(/^pencolor\s+([#\w]+)$/),
        wid:  resolved.match(/^penwidth\s+([\d.]+)$/),
        bgc:  resolved.match(/^canvascolor\s+"([^"]+)"$/),
        bgc2: resolved.match(/^canvascolor\s+([#\w]+)$/),
        fns:  resolved.match(/^fontsize\s+([\d.]+)$/),
        prn:  resolved.match(/^print\s+"([^"]*)"$/),
      };

      if (m.fwd)  cmds.push({ type: "move", dist: +m.fwd[1] });
      else if (m.bck)  cmds.push({ type: "move", dist: -m.bck[1] });
      else if (m.lft)  cmds.push({ type: "turn", angle: -m.lft[1] });
      else if (m.rgt)  cmds.push({ type: "turn", angle: +m.rgt[1] });
      else if (m.col)  cmds.push({ type: "color", color: m.col[1] });
      else if (m.col2) cmds.push({ type: "color", color: m.col2[1] });
      else if (m.wid)  cmds.push({ type: "width", width: +m.wid[1] });
      else if (m.bgc)  cmds.push({ type: "bgcolor", color: m.bgc[1] });
      else if (m.bgc2) cmds.push({ type: "bgcolor", color: m.bgc2[1] });
      else if (m.fns)  cmds.push({ type: "fontsize", size: +m.fns[1] });
      else if (m.prn)  cmds.push({ type: "print", text: m.prn[1] });
      else if (resolved === "penup")   cmds.push({ type: "penup" });
      else if (resolved === "pendown") cmds.push({ type: "pendown" });
      else if (resolved === "clear")   cmds.push({ type: "clear" });
      else if (resolved === "home")    cmds.push({ type: "home" });
      else if (resolved === "show")    cmds.push({ type: "show" });
      else if (resolved === "hide")    cmds.push({ type: "hide" });
      else throw new Error(`Неизвестная команда: ${resolved}`);
    }
  }

  run(stmts);
  return cmds;
}

// ─── CANVAS HELPERS ───────────────────────────────────────────────────────────
function drawTurtle(ctx, x, y, angle, visible) {
  if (!visible) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(-8, 8); ctx.lineTo(0, 4); ctx.lineTo(8, 8);
  ctx.closePath();
  ctx.fillStyle = "#00ff88";
  ctx.shadowColor = "#00ff88"; ctx.shadowBlur = 10;
  ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = "#003322"; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function initCanvas(ctx, W, H, bg = "#0d0d1a") {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
  for (let gy = 0; gy < H; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "code",     label: "Код",      icon: "⌨" },
  { id: "canvas",   label: "Холст",    icon: "🎨" },
  { id: "examples", label: "Примеры",  icon: "✦" },
  { id: "help",     label: "Справка",  icon: "?" },
];

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function KTurtle() {
  useFullscreenMeta();
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const [code, setCode]       = useState(INITIAL_CODE);
  const [tab, setTab]         = useState("code");
  const [error, setError]     = useState(null);
  const [running, setRunning] = useState(false);
  const [inserted, setInserted] = useState(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    initCanvas(ctx, canvas.width, canvas.height);
    drawTurtle(ctx, canvas.width / 2, canvas.height / 2, 0, true);
  }, []);

  useEffect(() => { setupCanvas(); }, [setupCanvas]);

  const clearCanvas = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setRunning(false);
    setupCanvas();
  }, [setupCanvas]);

  const runCode = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    setError(null);
    setRunning(true);
    setTab("canvas");

    try {
      const stmts = parseProgram(code);
      const cmds  = executeProgram(stmts);
      let x = W / 2, y = H / 2, angle = -90;
      let penDown = true, color = "#00d4ff", lineWidth = 1.5;
      let turtleVisible = true, fontSize = 14;
      let bgColor = "#0d0d1a";
      initCanvas(ctx, W, H, bgColor);
      let step = 0;

      function tick() {
        const batchSize = 12;
        for (let b = 0; b < batchSize && step < cmds.length; b++, step++) {
          const cmd = cmds[step];
          if (cmd.type === "move") {
            const rad = (angle * Math.PI) / 180;
            const nx = x + Math.cos(rad) * cmd.dist;
            const ny = y + Math.sin(rad) * cmd.dist;
            if (penDown) {
              ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny);
              ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
              ctx.shadowColor = color; ctx.shadowBlur = 4;
              ctx.lineCap = "round"; ctx.stroke(); ctx.shadowBlur = 0;
            }
            x = nx; y = ny;
          } else if (cmd.type === "turn")    { angle += cmd.angle; }
          else if (cmd.type === "color")     { color = cmd.color; }
          else if (cmd.type === "width")     { lineWidth = cmd.width; }
          else if (cmd.type === "penup")     { penDown = false; }
          else if (cmd.type === "pendown")   { penDown = true; }
          else if (cmd.type === "show")      { turtleVisible = true; }
          else if (cmd.type === "hide")      { turtleVisible = false; }
          else if (cmd.type === "fontsize")  { fontSize = cmd.size; }
          else if (cmd.type === "bgcolor")   { bgColor = cmd.color; initCanvas(ctx, W, H, bgColor); }
          else if (cmd.type === "clear")     { initCanvas(ctx, W, H, bgColor); }
          else if (cmd.type === "home")      { x = W / 2; y = H / 2; angle = -90; }
          else if (cmd.type === "print") {
            ctx.save();
            ctx.font = `${fontSize}px Courier New`;
            ctx.fillStyle = color;
            ctx.shadowColor = color; ctx.shadowBlur = 4;
            ctx.fillText(cmd.text, x, y);
            ctx.shadowBlur = 0;
            ctx.restore();
          }
        }
        if (step < cmds.length) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          drawTurtle(ctx, x, y, angle + 90, turtleVisible);
          setRunning(false);
        }
      }
      animRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  }, [code]);

  const insertCmd = (cmd) => {
    setCode(prev => prev + "\n" + cmd);
    setInserted(cmd);
    setTimeout(() => setInserted(null), 1200);
    setTab("code");
  };

  const S = {
    root: {
      display: "flex", flexDirection: "column",
      height: "100dvh",
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
      background: "#080810", color: "#e0e0ff",
      fontFamily: "'Courier New', monospace", overflow: "hidden",
    },
    header: {
      display: "flex", alignItems: "center", gap: "10px",
      padding: "8px 16px", borderBottom: "1px solid #1a1a3a",
      background: "linear-gradient(90deg,#0d0d2a,#080810)",
      flexShrink: 0,
    },
    content: { flex: 1, overflow: "hidden", position: "relative" },
    pane: (visible) => ({
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", overflow: "hidden",
      visibility: visible ? "visible" : "hidden",
      pointerEvents: visible ? "auto" : "none",
      zIndex: visible ? 1 : 0,
    }),
    tabBar: {
      display: "flex", borderTop: "1px solid #1a1a3a",
      background: "#0a0a1a", flexShrink: 0,
      paddingBottom: "env(safe-area-inset-bottom)",
    },
    tab: (active) => ({
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "10px 4px 8px",
      background: active ? "#0d0d28" : "transparent",
      borderTop: active ? "2px solid #00d4ff" : "2px solid transparent",
      color: active ? "#00d4ff" : "#4455aa",
      cursor: "pointer", fontSize: "10px", gap: "3px",
      transition: "all 0.15s", userSelect: "none",
    }),
  };

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <span style={{ fontSize: "18px" }}>🐢</span>
        <span style={{ fontSize: "13px", fontWeight: "bold", letterSpacing: "3px", color: "#00d4ff", textShadow: "0 0 10px #00d4ff88" }}>
          KTURTLE
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={runCode} disabled={running} style={{
          background: running ? "#111" : "#003322",
          color: running ? "#444" : "#00d4ff",
          border: `1px solid ${running ? "#222" : "#00d4ff55"}`,
          padding: "6px 14px", borderRadius: "4px",
          fontSize: "12px", cursor: running ? "not-allowed" : "pointer",
          fontFamily: "inherit", letterSpacing: "0.5px",
          boxShadow: running ? "none" : "0 0 8px #00d4ff22",
        }}>
          {running ? "⟳ ..." : "▶ RUN"}
        </button>
      </div>

      <div style={S.content}>

        {/* CODE */}
        <div style={S.pane(tab === "code")}>
          <textarea
            value={code} onChange={e => setCode(e.target.value)}
            spellCheck={false} autoCorrect="off" autoCapitalize="off"
            style={{
              flex: 1, background: "#0a0a18", color: "#c0e0ff",
              border: "none", outline: "none", padding: "14px 16px",
              fontSize: "14px", lineHeight: "1.8", resize: "none",
              fontFamily: "'Courier New', monospace",
            }}
          />
          {error && (
            <div style={{ padding: "10px 16px", background: "#1a0808", color: "#ff6666", fontSize: "12px", borderTop: "1px solid #330000", flexShrink: 0 }}>
              ⚠ {error}
            </div>
          )}
          <div style={{ display: "flex", gap: "8px", padding: "10px 12px", borderTop: "1px solid #1a1a3a", background: "#080810", flexShrink: 0 }}>
            <button onClick={() => setCode("")} style={{ background: "#1a1a2a", color: "#8888ff", border: "1px solid #8888ff44", padding: "7px 14px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
              ⬜ Очистить код
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: "11px", color: "#33337a", alignSelf: "center" }}>
              {code.split("\n").length} строк
            </span>
          </div>
        </div>

        {/* CANVAS */}
        <div style={{ ...S.pane(tab === "canvas"), alignItems: "center", justifyContent: "center", background: "#060610" }}>
          <canvas ref={canvasRef} width={480} height={480}
            style={{ maxWidth: "100%", maxHeight: "100%", display: "block" }}
          />
          <div style={{ display: "flex", gap: "8px", padding: "10px 12px", borderTop: "1px solid #1a1a3a", background: "#080810", width: "100%", boxSizing: "border-box", flexShrink: 0 }}>
            <button onClick={clearCanvas} style={{ background: "#1a1a2a", color: "#8888ff", border: "1px solid #8888ff44", padding: "7px 14px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
              ⬜ Очистить холст
            </button>
            {running && <span style={{ fontSize: "11px", color: "#00d4ff", alignSelf: "center", marginLeft: "8px" }}>⟳ выполнение...</span>}
          </div>
        </div>

        {/* EXAMPLES */}
        <div style={{ ...S.pane(tab === "examples"), overflowY: "auto", padding: "16px 14px", gap: "10px" }}>
          <div style={{ fontSize: "11px", color: "#4444aa", letterSpacing: "2px", marginBottom: "6px" }}>ПРИМЕРЫ</div>
          {EXAMPLES.map(ex => (
            <div key={ex.name} style={{ background: "#0d0d22", border: "1px solid #1a1a3a", borderRadius: "8px", overflow: "hidden", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #1a1a3a" }}>
                <span style={{ flex: 1, color: "#aabbff", fontSize: "14px", fontWeight: "bold" }}>{ex.name}</span>
                <button onClick={() => { setCode(ex.code); setTab("code"); }}
                  style={{ background: "#003322", color: "#00d4ff", border: "1px solid #00d4ff44", padding: "5px 12px", borderRadius: "4px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
                  Загрузить
                </button>
              </div>
              <pre style={{ margin: 0, padding: "10px 14px", fontSize: "11px", color: "#6688bb", lineHeight: "1.6", overflowX: "auto" }}>
                {ex.code}
              </pre>
            </div>
          ))}
          <div style={{ height: "20px" }} />
        </div>

        {/* HELP */}
        <div style={{ ...S.pane(tab === "help"), overflowY: "auto", padding: "16px 14px", gap: "8px" }}>
          <div style={{ fontSize: "11px", color: "#4444aa", letterSpacing: "2px", marginBottom: "8px" }}>КОМАНДЫ — нажми чтобы вставить</div>
          {COMMANDS.map(({ cmd, desc }) => (
            <div key={cmd} onClick={() => insertCmd(cmd)} style={{
              display: "flex", alignItems: "center",
              background: inserted === cmd ? "#003322" : "#0d0d22",
              border: `1px solid ${inserted === cmd ? "#00d4ff55" : "#1a1a3a"}`,
              borderRadius: "6px", padding: "10px 14px", gap: "12px",
              cursor: "pointer", transition: "all 0.2s", marginBottom: "6px",
            }}>
              <code style={{ color: "#00d4ff", fontSize: "12px", minWidth: "160px", flexShrink: 0 }}>{cmd}</code>
              <span style={{ color: "#6677aa", fontSize: "12px" }}>{desc}</span>
              <span style={{ marginLeft: "auto", color: "#2a4a3a", fontSize: "11px" }}>＋</span>
            </div>
          ))}
          <div style={{ marginTop: "8px", padding: "14px", background: "#0d0d22", border: "1px solid #1a1a3a", borderRadius: "8px" }}>
            <div style={{ fontSize: "11px", color: "#4444aa", letterSpacing: "1px", marginBottom: "8px" }}>ПЕРЕМЕННЫЕ И УСЛОВИЯ</div>
            <pre style={{ margin: 0, fontSize: "12px", color: "#6688bb", lineHeight: "1.8" }}>{`$i = 1
repeat 10 {
  if ($i % 2 == 0) {
    pencolor "#00d4ff"
  } else {
    pencolor "#ff6b35"
  }
  forward 20
  right 36
  $i = $i + 1
}`}</pre>
          </div>
          <div style={{ height: "20px" }} />
        </div>

      </div>

      {/* Tab Bar */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <div key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            <span style={{ fontSize: "18px", lineHeight: 1 }}>{t.icon}</span>
            <span style={{ letterSpacing: "0.5px" }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
