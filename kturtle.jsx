import { useState, useRef, useEffect, useCallback } from "react";

const INITIAL_CODE = `# Снежинка
pencolor "#00d4ff"
penwidth 2

repeat 6 {
  forward 80
  back 80
  left 60
}

# Спираль
pencolor "#ff6b35"
penwidth 1.5
forward 10
repeat 20 {
  forward 10
  left 90
  forward 10
}
`;

const EXAMPLES = [
  {
    name: "Снежинка",
    code: `pencolor "#00d4ff"\npenwidth 2\nrepeat 6 {\n  forward 80\n  back 80\n  left 60\n}`,
  },
  {
    name: "Квадрат",
    code: `pencolor "#ff6b35"\npenwidth 2\nrepeat 4 {\n  forward 100\n  right 90\n}`,
  },
  {
    name: "Звезда",
    code: `pencolor "#ffe066"\npenwidth 2\nrepeat 5 {\n  forward 100\n  right 144\n}`,
  },
  {
    name: "Спираль",
    code: `pencolor "#aa44ff"\npenwidth 1.5\nrepeat 36 {\n  forward 5\n  right 10\n  forward 5\n  right 10\n}`,
  },
  {
    name: "Цветок",
    code: `pencolor "#ff4488"\npenwidth 2\nrepeat 12 {\n  repeat 4 {\n    forward 40\n    right 90\n  }\n  right 30\n}`,
  },
];

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
  { cmd: "repeat N { }", desc: "повторить N раз" },
  { cmd: "# текст", desc: "комментарий" },
];

function parseTurtle(code) {
  const lines = code.split("\n");
  function parseBlock(lines, startIdx) {
    let i = startIdx;
    const block = [];
    while (i < lines.length) {
      const raw = lines[i].trim();
      if (raw === "" || raw.startsWith("#")) { i++; continue; }
      if (raw === "}") return { block, nextIdx: i + 1 };
      const repeatMatch = raw.match(/^repeat\s+(\d+)\s*\{?$/);
      if (repeatMatch) {
        const count = parseInt(repeatMatch[1]);
        const result = parseBlock(lines, i + 1);
        block.push({ cmd: "repeat", count, body: result.block });
        i = result.nextIdx;
        continue;
      }
      block.push({ cmd: raw });
      i++;
    }
    return { block, nextIdx: i };
  }
  return parseBlock(lines, 0).block;
}

function executeInstructions(instructions) {
  const cmds = [];
  function run(instList) {
    for (const instr of instList) {
      if (instr.cmd === "repeat") {
        for (let i = 0; i < instr.count; i++) run(instr.body);
        continue;
      }
      const raw = instr.cmd;
      const m = {
        fwd: raw.match(/^forward\s+([\d.]+)$/),
        bck: raw.match(/^back\s+([\d.]+)$/),
        lft: raw.match(/^left\s+([\d.]+)$/),
        rgt: raw.match(/^right\s+([\d.]+)$/),
        col: raw.match(/^pencolor\s+"([^"]+)"$/),
        wid: raw.match(/^penwidth\s+([\d.]+)$/),
      };
      if (m.fwd) cmds.push({ type: "move", dist: +m.fwd[1] });
      else if (m.bck) cmds.push({ type: "move", dist: -m.bck[1] });
      else if (m.lft) cmds.push({ type: "turn", angle: -m.lft[1] });
      else if (m.rgt) cmds.push({ type: "turn", angle: +m.rgt[1] });
      else if (m.col) cmds.push({ type: "color", color: m.col[1] });
      else if (m.wid) cmds.push({ type: "width", width: +m.wid[1] });
      else if (raw === "penup") cmds.push({ type: "penup" });
      else if (raw === "pendown") cmds.push({ type: "pendown" });
      else if (raw === "clear") cmds.push({ type: "clear" });
      else if (raw === "home") cmds.push({ type: "home" });
    }
  }
  run(instructions);
  return cmds;
}

function drawTurtle(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(-8, 8); ctx.lineTo(0, 4); ctx.lineTo(8, 8);
  ctx.closePath();
  ctx.fillStyle = "#00ff88";
  ctx.shadowColor = "#00ff88"; ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#003322"; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function initCanvas(ctx, W, H) {
  ctx.fillStyle = "#0d0d1a";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
  for (let gy = 0; gy < H; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
}

const TABS = [
  { id: "code", label: "Код", icon: "⌨" },
  { id: "canvas", label: "Холст", icon: "🎨" },
  { id: "examples", label: "Примеры", icon: "✦" },
  { id: "help", label: "Справка", icon: "?" },
];

export default function KTurtle() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [code, setCode] = useState(INITIAL_CODE);
  const [tab, setTab] = useState("code");
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [inserted, setInserted] = useState(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    initCanvas(ctx, canvas.width, canvas.height);
    drawTurtle(ctx, canvas.width / 2, canvas.height / 2, 0);
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
      const cmds = executeInstructions(parseTurtle(code));
      let x = W / 2, y = H / 2, angle = -90;
      let penDown = true, color = "#00d4ff", lineWidth = 1.5;
      initCanvas(ctx, W, H);
      let step = 0;
      function tick() {
        const batchSize = 8;
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
          } else if (cmd.type === "turn") { angle += cmd.angle; }
          else if (cmd.type === "color") { color = cmd.color; }
          else if (cmd.type === "width") { lineWidth = cmd.width; }
          else if (cmd.type === "penup") { penDown = false; }
          else if (cmd.type === "pendown") { penDown = true; }
          else if (cmd.type === "clear") { initCanvas(ctx, W, H); }
          else if (cmd.type === "home") { x = W/2; y = H/2; angle = -90; }
        }
        if (step < cmds.length) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          drawTurtle(ctx, x, y, angle + 90);
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
      display: "flex", flexDirection: "column", height: "100dvh",
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
      display: "flex",
      flexDirection: "column", overflow: "hidden",
      visibility: visible ? "visible" : "hidden",
      pointerEvents: visible ? "auto" : "none",
      zIndex: visible ? 1 : 0,
    }),
    tabBar: {
      display: "flex", borderTop: "1px solid #1a1a3a",
      background: "#0a0a1a", flexShrink: 0,
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
    tabIcon: { fontSize: "18px", lineHeight: 1 },
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
        <button
          onClick={runCode} disabled={running}
          style={{
            background: running ? "#111" : "#003322",
            color: running ? "#444" : "#00d4ff",
            border: `1px solid ${running ? "#222" : "#00d4ff55"}`,
            padding: "6px 14px", borderRadius: "4px",
            fontSize: "12px", cursor: running ? "not-allowed" : "pointer",
            fontFamily: "inherit", letterSpacing: "0.5px",
            boxShadow: running ? "none" : "0 0 8px #00d4ff22",
          }}
        >
          {running ? "⟳ ..." : "▶ RUN"}
        </button>
      </div>

      {/* Content panes */}
      <div style={S.content}>

        {/* CODE TAB */}
        <div style={S.pane(tab === "code")}>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
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
            <button onClick={() => tab === "code" ? setCode("") : clearCanvas()} style={{ background: "#1a1a2a", color: "#8888ff", border: "1px solid #8888ff44", padding: "7px 14px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
              ⬜ {tab === "code" ? "Очистить код" : "Очистить холст"}
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: "11px", color: "#33337a", alignSelf: "center" }}>
              {code.split("\n").length} строк
            </span>
          </div>
        </div>

        {/* CANVAS TAB */}
        <div style={{ ...S.pane(tab === "canvas"), alignItems: "center", justifyContent: "center", background: "#060610" }}>
          <canvas
            ref={canvasRef}
            width={480} height={480}
            style={{
              maxWidth: "100%", maxHeight: "100%",
              border: "1px solid #1a1a4a",
              boxShadow: "0 0 40px #00d4ff14, 0 0 80px #00008833",
            }}
          />
          {running && (
            <div style={{ position: "absolute", top: "14px", right: "14px", fontSize: "11px", color: "#00d4ff", background: "#00d4ff11", border: "1px solid #00d4ff33", padding: "4px 10px", borderRadius: "20px" }}>
              ⟳ выполнение
            </div>
          )}
        </div>

        {/* EXAMPLES TAB */}
        <div style={{ ...S.pane(tab === "examples"), overflowY: "auto", padding: "16px 14px", gap: "10px" }}>
          <div style={{ fontSize: "11px", color: "#4444aa", letterSpacing: "2px", marginBottom: "6px" }}>ПРИМЕРЫ</div>
          {EXAMPLES.map(ex => (
            <div key={ex.name} style={{ background: "#0d0d22", border: "1px solid #1a1a3a", borderRadius: "8px", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #1a1a3a" }}>
                <span style={{ flex: 1, color: "#aabbff", fontSize: "14px", fontWeight: "bold" }}>{ex.name}</span>
                <button
                  onClick={() => { setCode(ex.code); setTab("code"); }}
                  style={{ background: "#003322", color: "#00d4ff", border: "1px solid #00d4ff44", padding: "5px 12px", borderRadius: "4px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Загрузить
                </button>
              </div>
              <pre style={{ margin: 0, padding: "10px 14px", fontSize: "11px", color: "#6688bb", lineHeight: "1.6", overflow: "hidden" }}>
                {ex.code}
              </pre>
            </div>
          ))}
        </div>

        {/* HELP TAB */}
        <div style={{ ...S.pane(tab === "help"), overflowY: "auto", padding: "16px 14px", gap: "8px" }}>
          <div style={{ fontSize: "11px", color: "#4444aa", letterSpacing: "2px", marginBottom: "8px" }}>КОМАНДЫ</div>
          {COMMANDS.map(({ cmd, desc }) => (
            <div
              key={cmd}
              onClick={() => insertCmd(cmd)}
              style={{
                display: "flex", alignItems: "center",
                background: inserted === cmd ? "#003322" : "#0d0d22",
                border: `1px solid ${inserted === cmd ? "#00d4ff55" : "#1a1a3a"}`,
                borderRadius: "6px", padding: "10px 14px", gap: "12px",
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              <code style={{ color: "#00d4ff", fontSize: "12px", minWidth: "130px", flexShrink: 0 }}>{cmd}</code>
              <span style={{ color: "#6677aa", fontSize: "12px" }}>{desc}</span>
              <span style={{ marginLeft: "auto", color: "#2a4a3a", fontSize: "11px" }}>＋</span>
            </div>
          ))}
          <div style={{ marginTop: "16px", padding: "14px", background: "#0d0d22", border: "1px solid #1a1a3a", borderRadius: "8px" }}>
            <div style={{ fontSize: "11px", color: "#4444aa", letterSpacing: "1px", marginBottom: "8px" }}>ПРИМЕР ПОВТОРА</div>
            <pre style={{ margin: 0, fontSize: "12px", color: "#6688bb", lineHeight: "1.8" }}>
{`repeat 4 {
  forward 100
  right 90
}`}
            </pre>
          </div>
          <div style={{ height: "20px" }} />
        </div>
      </div>

      {/* Tab Bar */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <div key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            <span style={S.tabIcon}>{t.icon}</span>
            <span style={{ letterSpacing: "0.5px" }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
