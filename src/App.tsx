import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
} from 'react';
import {
  Activity,
  Cable,
  Cpu,
  Lightbulb,
  MousePointer2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Zap,
} from 'lucide-react';

type Kind =
  | 'switch'
  | 'and'
  | 'or'
  | 'not'
  | 'nand'
  | 'nor'
  | 'xor'
  | 'led'
  | 'clock'
  | 'ic7408'
  | 'ic7404'
  | 'display';
type Part = {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  value?: boolean;
  label?: string;
};
type Wire = { id: string; from: string; to: string };
const specs: Record<
  Kind,
  {
    title: string;
    short: string;
    group: string;
    inputs: number;
    outputs: number;
    color: string;
  }
> = {
  switch: {
    title: 'Logic switch',
    short: 'INPUT',
    group: 'Inputs',
    inputs: 0,
    outputs: 1,
    color: '#39d98a',
  },
  clock: {
    title: 'Pulse source',
    short: 'CLK',
    group: 'Inputs',
    inputs: 0,
    outputs: 1,
    color: '#39d98a',
  },
  and: {
    title: 'AND gate',
    short: 'AND',
    group: 'Logic gates',
    inputs: 2,
    outputs: 1,
    color: '#67b7ff',
  },
  or: {
    title: 'OR gate',
    short: 'OR',
    group: 'Logic gates',
    inputs: 2,
    outputs: 1,
    color: '#67b7ff',
  },
  not: {
    title: 'NOT gate',
    short: 'NOT',
    group: 'Logic gates',
    inputs: 1,
    outputs: 1,
    color: '#67b7ff',
  },
  nand: {
    title: 'NAND gate',
    short: 'NAND',
    group: 'Logic gates',
    inputs: 2,
    outputs: 1,
    color: '#67b7ff',
  },
  nor: {
    title: 'NOR gate',
    short: 'NOR',
    group: 'Logic gates',
    inputs: 2,
    outputs: 1,
    color: '#67b7ff',
  },
  xor: {
    title: 'XOR gate',
    short: 'XOR',
    group: 'Logic gates',
    inputs: 2,
    outputs: 1,
    color: '#67b7ff',
  },
  led: {
    title: 'LED indicator',
    short: 'LED',
    group: 'Outputs',
    inputs: 1,
    outputs: 0,
    color: '#ffbe55',
  },
  display: {
    title: '7-segment display',
    short: '7 SEG',
    group: 'Outputs',
    inputs: 4,
    outputs: 0,
    color: '#ffbe55',
  },
  ic7408: {
    title: '74HC08 · Quad AND',
    short: '74HC08',
    group: 'IC chips',
    inputs: 4,
    outputs: 2,
    color: '#c4a1ff',
  },
  ic7404: {
    title: '74HC04 · Hex NOT',
    short: '74HC04',
    group: 'IC chips',
    inputs: 3,
    outputs: 3,
    color: '#c4a1ff',
  },
};
const uid = () => Math.random().toString(36).slice(2, 9);
const initial: Part[] = [
  { id: 's1', kind: 'switch', x: 105, y: 150, value: true, label: 'A' },
  { id: 's2', kind: 'switch', x: 105, y: 285, value: true, label: 'B' },
  { id: 'g1', kind: 'and', x: 355, y: 220, label: 'AND 1' },
  { id: 'l1', kind: 'led', x: 610, y: 220, label: 'OUT' },
];
const initialWires: Wire[] = [
  { id: 'w1', from: 's1:out', to: 'g1:in0' },
  { id: 'w2', from: 's2:out', to: 'g1:in1' },
  { id: 'w3', from: 'g1:out', to: 'l1:in0' },
];
function App() {
  const [parts, setParts] = useState<Part[]>(initial);
  const [wires, setWires] = useState<Wire[]>(initialWires);
  const [selected, setSelected] = useState<string | null>(null);
  const [wireMode, setWireMode] = useState(false);
  const [wireStart, setWireStart] = useState<string | null>(null);
  const [message, setMessage] = useState(
    'Ready to build · Try toggling A and B'
  );
  const [running, setRunning] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [nextLabel, setNextLabel] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const signals = useMemo(() => {
    const result: Record<string, boolean[]> = {};
    const read = (pin: string) => {
      const w = wires.find(item => item.to === pin);
      if (!w) return false;
      const [id] = w.from.split(':');
      const output = w.from.split(':')[1] || 'out';
      const index = Number(output.replace('out', '') || 0);
      return result[id]?.[index] ?? false;
    };
    for (let pass = 0; pass < parts.length + 2; pass++) {
      parts.forEach(p => {
        const a = read(p.id + ':in0');
        const b = read(p.id + ':in1');
        let out: boolean[] = [];
        if (p.kind === 'switch') out = [!!p.value];
        else if (p.kind === 'clock') out = [!!p.value];
        else if (p.kind === 'and' || p.kind === 'ic7408')
          out = [a && b, read(p.id + ':in2') && read(p.id + ':in3')];
        else if (p.kind === 'or') out = [a || b];
        else if (p.kind === 'not' || p.kind === 'ic7404')
          out = [!a, !b, !read(p.id + ':in2')];
        else if (p.kind === 'nand') out = [!(a && b)];
        else if (p.kind === 'nor') out = [!(a || b)];
        else if (p.kind === 'xor') out = [a !== b];
        else out = [];
        result[p.id] = out;
      });
    }
    return result;
  }, [parts, wires]);
  const outputFor = (part: Part, pin = 0) => signals[part.id]?.[pin] ?? false;
  const valAt = (pin: string) => {
    const wire = wires.find(w => w.to === pin);
    if (!wire) return false;
    const [id, output] = wire.from.split(':');
    const index = Number(output.replace('out', '') || 0);
    return signals[id]?.[index] ?? false;
  };
  const addPart = (kind: Kind) => {
    const spec = specs[kind];
    const part: Part = {
      id: uid(),
      kind,
      x: 80 + Math.random() * 160,
      y: 70 + Math.random() * 220,
      value: false,
      label: spec.short + ' ' + nextLabel,
    };
    setNextLabel(n => n + 1);
    setParts(p => [...p, part]);
    setSelected(part.id);
    setMessage(spec.title + ' added to canvas');
  };
  const removeSelected = () => {
    if (!selected) return;
    setParts(p => p.filter(part => part.id !== selected));
    setWires(w =>
      w.filter(
        wire =>
          !wire.from.startsWith(selected + ':') &&
          !wire.to.startsWith(selected + ':')
      )
    );
    setSelected(null);
    setMessage('Component and connected wires removed');
  };
  const connect = (pin: string) => {
    if (!wireMode) return;
    if (!wireStart) {
      if (pin.endsWith(':out')) {
        setWireStart(pin);
        setMessage('Output selected · Now tap an input pin');
      } else if (/out\d+$/.test(pin)) {
        setWireStart(pin);
        setMessage('Output selected · Now tap an input pin');
      } else setMessage('Start from an output pin');
      return;
    }
    if (pin === wireStart) {
      setWireStart(null);
      setMessage('Wire cancelled');
      return;
    }
    const isOut = /:out\d*$/.test(pin);
    if (isOut) {
      setWireStart(pin);
      setMessage('Output changed · Tap an input pin');
      return;
    }
    const [sourceId] = wireStart.split(':');
    const [targetId] = pin.split(':');
    if (sourceId === targetId) {
      setMessage('Connect different components');
      return;
    }
    setWires(prev => [
      ...prev.filter(w => w.to !== pin),
      { id: uid(), from: wireStart, to: pin },
    ]);
    setWireStart(null);
    setSelected(targetId);
    setMessage('Connected! Signal will update automatically');
  };
  const setPartPosition = (id: string, x: number, y: number) =>
    setParts(prev =>
      prev.map(p =>
        p.id === id ? { ...p, x: Math.max(40, x), y: Math.max(35, y) } : p
      )
    );
  const onDragStart = (event: DragEvent, part: Part) => {
    event.dataTransfer.setData('partId', part.id);
    event.dataTransfer.effectAllowed = 'move';
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('partId');
    const box = canvasRef.current?.getBoundingClientRect();
    if (!id || !box) return;
    setPartPosition(
      id,
      (event.clientX - box.left) / zoom,
      (event.clientY - box.top) / zoom
    );
  };
  const saveCircuit = () => {
    const data = JSON.stringify({ parts, wires }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logic-circuit.json';
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Circuit exported as JSON');
  };
  const loadExample = () => {
    setParts(initial.map(p => ({ ...p })));
    setWires(initialWires.map(w => ({ ...w })));
    setSelected(null);
    setMessage('AND gate demo loaded');
  };
  const clearCircuit = () => {
    setParts([]);
    setWires([]);
    setSelected(null);
    setWireStart(null);
    setMessage('Blank canvas · Add a component to begin');
  };
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    if ((event.target as HTMLElement).dataset.canvas === 'true')
      setSelected(null);
  }, []);
  const groups = ['Inputs', 'Logic gates', 'IC chips', 'Outputs'] as const;
  const pinPoint = (part: Part, pin: string) => {
    const spec = specs[part.kind];
    const width =
      part.kind === 'switch' || part.kind === 'clock' || part.kind === 'led'
        ? 110
        : part.kind === 'display'
          ? 112
          : part.kind.startsWith('ic')
            ? 126
            : 112;
    const height =
      part.kind === 'display' ? 120 : part.kind.startsWith('ic') ? 128 : 96;
    if (pin === 'out' || pin.startsWith('out')) {
      const n = Number(pin.replace('out', '') || 0);
      return {
        x: part.x + width,
        y: part.y + (height * (n + 1)) / (spec.outputs + 1),
      };
    }
    const n = Number(pin.replace('in', '') || 0);
    return { x: part.x, y: part.y + (height * (n + 1)) / (spec.inputs + 1) };
  };
  const wirePath = (wire: Wire) => {
    const [fromId, fromPin] = wire.from.split(':');
    const [toId, toPin] = wire.to.split(':');
    const source = parts.find(p => p.id === fromId),
      target = parts.find(p => p.id === toId);
    if (!source || !target) return '';
    const a = pinPoint(source, fromPin),
      b = pinPoint(target, toPin);
    const mid = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;
  };
  const partSize = (part: Part) =>
    part.kind === 'display'
      ? { width: 112, height: 120 }
      : part.kind.startsWith('ic')
        ? { width: 126, height: 128 }
        : {
            width:
              part.kind === 'switch' ||
              part.kind === 'clock' ||
              part.kind === 'led'
                ? 110
                : 112,
            height: 96,
          };
  const drawPart = (p: Part) => {
    const spec = specs[p.kind];
    const size = partSize(p);
    return (
      <div
        key={p.id}
        className={`part ${selected === p.id ? 'selected' : ''} ${p.kind.startsWith('ic') ? 'chip' : ''}`}
        style={
          {
            left: p.x,
            top: p.y,
            width: size.width,
            height: size.height,
            '--part-color': spec.color,
          } as CSSProperties
        }
        draggable
        onDragStart={e => onDragStart(e, p)}
        onClick={e => {
          e.stopPropagation();
          setSelected(p.id);
        }}
      >
        <div className="part-head">
          <span className="part-symbol">
            {p.kind === 'switch'
              ? '◉'
              : p.kind === 'led'
                ? '●'
                : p.kind.startsWith('ic')
                  ? '▤'
                  : p.kind === 'display'
                    ? '8'
                    : p.kind === 'clock'
                      ? '⌁'
                      : '⌁'}
          </span>
          <span>{p.label || spec.short}</span>
          <button
            className="mini-remove"
            onClick={e => {
              e.stopPropagation();
              setParts(all => all.filter(q => q.id !== p.id));
              setWires(all =>
                all.filter(
                  w =>
                    !w.from.startsWith(p.id + ':') &&
                    !w.to.startsWith(p.id + ':')
                )
              );
              if (selected === p.id) setSelected(null);
            }}
          >
            ×
          </button>
        </div>
        {p.kind === 'switch' || p.kind === 'clock' ? (
          <button
            className={`toggle ${p.value ? 'on' : ''}`}
            onClick={e => {
              e.stopPropagation();
              setParts(all =>
                all.map(q => (q.id === p.id ? { ...q, value: !q.value } : q))
              );
              setMessage(
                (p.label || 'Input') + ' switched ' + (!p.value ? 'ON' : 'OFF')
              );
            }}
          >
            <span />
            {p.value ? 'HIGH · 1' : 'LOW · 0'}
          </button>
        ) : p.kind === 'led' ? (
          <div className={`led-light ${valAt(p.id + ':in0') ? 'lit' : ''}`}>
            <span />
            {valAt(p.id + ':in0') ? 'HIGH' : 'LOW'}
          </div>
        ) : p.kind === 'display' ? (
          <div className="seven-seg">
            <div className={valAt(p.id + ':in3') ? 'seg a lit' : 'seg a'} />
            <div className={valAt(p.id + ':in3') ? 'seg b lit' : 'seg b'} />
            <div className={valAt(p.id + ':in2') ? 'seg c lit' : 'seg c'} />
            <div className={valAt(p.id + ':in1') ? 'seg d lit' : 'seg d'} />
            <div className={valAt(p.id + ':in0') ? 'seg e lit' : 'seg e'} />
            <div className={valAt(p.id + ':in0') ? 'seg f lit' : 'seg f'} />
            <div className={valAt(p.id + ':in2') ? 'seg g lit' : 'seg g'} />
          </div>
        ) : p.kind.startsWith('ic') ? (
          <div className="chip-core">
            <span className="notch" />
            {p.kind.toUpperCase()}
            <small>
              {p.kind === 'ic7408' ? 'QUAD 2-INPUT AND' : 'HEX INVERTER'}
            </small>
            <div className="chip-pins">
              {Array.from({ length: spec.inputs }, (_, i) => (
                <span key={i}>IN{i + 1}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="gate-core">
            <svg viewBox="0 0 72 45" aria-label={spec.title}>
              <path
                d={
                  p.kind === 'not'
                    ? 'M10 5 L10 40 L52 22.5 Z'
                    : p.kind === 'or' || p.kind === 'nor' || p.kind === 'xor'
                      ? 'M8 5 Q27 22 8 40 Q39 40 62 22.5 Q39 5 8 5'
                      : 'M8 5 L34 5 A22 17 0 0 1 34 40 L8 40 Z'
                }
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {['not', 'nand', 'nor'].includes(p.kind) && (
                <circle
                  cx={p.kind === 'not' ? 56 : 64}
                  cy="22.5"
                  r="4"
                  fill="#111827"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              )}
            </svg>
            <small>{spec.title}</small>
          </div>
        )}
        {Array.from({ length: spec.inputs }, (_, i) => (
          <button
            key={'i' + i}
            title={'Input ' + (i + 1) + ' · click to connect'}
            className={`pin in-pin ${valAt(p.id + ':in' + i) ? 'high' : ''}`}
            style={{ top: ((i + 1) / (spec.inputs + 1)) * 100 + '%' }}
            onClick={e => {
              e.stopPropagation();
              connect(p.id + ':in' + i);
            }}
          />
        ))}
        {Array.from({ length: spec.outputs }, (_, i) => (
          <button
            key={'o' + i}
            title={'Output ' + (i + 1) + ' · click to connect'}
            className={`pin out-pin ${outputFor(p, i) ? 'high' : ''}`}
            style={{ top: ((i + 1) / (spec.outputs + 1)) * 100 + '%' }}
            onClick={e => {
              e.stopPropagation();
              connect(p.id + (i === 0 ? ':out' : ':out' + i));
            }}
          />
        ))}
      </div>
    );
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <Zap size={20} fill="currentColor" />
        </div>
        <div className="brand">
          <strong>
            logic<span>lab</span>
          </strong>
          <small>DIGITAL CIRCUIT PLAYGROUND</small>
        </div>
        <div className="top-divider" />
        <span className="project-name">
          Untitled circuit <span className="unsaved-dot" />
        </span>
        <div className="top-actions">
          <span className={`run-state ${running ? 'running' : ''}`}>
            <span />
            {running ? 'SIMULATING' : 'PAUSED'}
          </span>
          <button className="btn secondary" onClick={() => setRunning(r => !r)}>
            <Play size={15} />
            {running ? 'Pause' : 'Run'}
          </button>
          <button className="btn primary" onClick={saveCircuit}>
            <Save size={15} />
            Export
          </button>
        </div>
      </header>
      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-title">
            <span>COMPONENTS</span>
            <span className="count">{parts.length} placed</span>
          </div>
          <div className="search-hint">
            <MousePointer2 size={14} /> Tap to add to canvas
          </div>
          {groups.map(group => (
            <section className="component-group" key={group}>
              <h3>{group}</h3>
              <div className="component-grid">
                {(Object.keys(specs) as Kind[])
                  .filter(k => specs[k].group === group)
                  .map(k => (
                    <button
                      className="component-tile"
                      key={k}
                      onClick={() => addPart(k)}
                    >
                      <span
                        className="tile-glyph"
                        style={{ color: specs[k].color }}
                      >
                        {k === 'switch'
                          ? '◉'
                          : k === 'clock'
                            ? '⌁'
                            : k === 'led'
                              ? '●'
                              : k === 'display'
                                ? '8'
                                : k.startsWith('ic')
                                  ? '▤'
                                  : k === 'not'
                                    ? '▷○'
                                    : k === 'and'
                                      ? '∩'
                                      : k === 'or'
                                        ? '≥1'
                                        : k === 'xor'
                                          ? '=1'
                                          : k.toUpperCase()}
                      </span>
                      <span className="tile-name">{specs[k].title}</span>
                      <Plus size={13} className="tile-plus" />
                    </button>
                  ))}
              </div>
            </section>
          ))}
          <div className="sidebar-bottom">
            <div className="tip-icon">
              <Lightbulb size={17} />
            </div>
            <div>
              <strong>Pro tip</strong>
              <p>
                Enable Wire mode, then tap an output pin and an input pin to
                connect them.
              </p>
            </div>
          </div>
        </aside>
        <section className="canvas-area">
          <div className="canvas-toolbar">
            <div className="canvas-heading">
              <span className="live-dot" />
              <div>
                <strong>Circuit board</strong>
                <small>MAIN WORKSPACE / {parts.length} COMPONENTS</small>
              </div>
            </div>
            <div className="canvas-tools">
              <button
                className={`tool-btn ${wireMode ? 'active' : ''}`}
                onClick={() => {
                  setWireMode(w => !w);
                  setWireStart(null);
                  setMessage(
                    !wireMode
                      ? 'Wire mode on · tap an output pin to start'
                      : 'Wire mode off'
                  );
                }}
              >
                <Cable size={16} />
                {wireMode ? 'Wiring…' : 'Wire mode'}
              </button>
              <span className="tool-separator" />
              <button
                className="icon-btn"
                title="Load AND demo"
                onClick={loadExample}
              >
                <RotateCcw size={16} />
              </button>
              <button
                className="icon-btn danger"
                title="Delete selected component"
                onClick={removeSelected}
                disabled={!selected}
              >
                <Trash2 size={16} />
              </button>
              <button
                className="icon-btn"
                title="Clear board"
                onClick={clearCircuit}
              >
                <span className="clear-icon">⌫</span>
              </button>
            </div>
          </div>
          <div className="board-wrap">
            <div
              className="board"
              ref={canvasRef}
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={handleCanvasClick}
              data-canvas="true"
              style={{ '--zoom': zoom } as CSSProperties}
            >
              <div className="board-grid" data-canvas="true" />
              <svg
                className="wire-layer"
                width="100%"
                height="100%"
                viewBox={`0 0 ${Math.max(900, ...parts.map(p => p.x + 200))} ${Math.max(620, ...parts.map(p => p.y + 180))}`}
                preserveAspectRatio="none"
                data-canvas="true"
              >
                {wires.map(w => (
                  <g key={w.id}>
                    <path
                      d={wirePath(w)}
                      fill="none"
                      stroke="#0c1825"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    <path
                      d={wirePath(w)}
                      fill="none"
                      stroke={valAt(w.from) ? '#39d98a' : '#456078'}
                      strokeWidth="2.3"
                      strokeLinecap="round"
                      strokeDasharray={valAt(w.from) ? 'none' : '5 5'}
                      className={running && valAt(w.from) ? 'flowing' : ''}
                      onClick={e => {
                        e.stopPropagation();
                        setWires(prev => prev.filter(q => q.id !== w.id));
                        setMessage('Wire removed');
                      }}
                      style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    />
                    <circle
                      cx={
                        pinPoint(
                          parts.find(p => p.id === w.from.split(':')[0])!,
                          w.from.split(':')[1]
                        ).x
                      }
                      cy={
                        pinPoint(
                          parts.find(p => p.id === w.from.split(':')[0])!,
                          w.from.split(':')[1]
                        ).y
                      }
                      r="3"
                      fill={valAt(w.from) ? '#39d98a' : '#456078'}
                    />
                  </g>
                ))}
              </svg>
              <div
                className="parts-layer"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              >
                {parts.map(drawPart)}
              </div>
              {parts.length === 0 && (
                <div className="empty-board">
                  <div>
                    <Cpu size={30} />
                  </div>
                  <h2>Your board is a blank slate.</h2>
                  <p>
                    Add a component from the left to start creating a circuit.
                  </p>
                  <button onClick={loadExample} className="btn primary">
                    Load a sample circuit
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="canvas-footer">
            <span>
              <MousePointer2 size={13} /> Drag components to arrange
            </span>
            <span>
              <span className="legend-dot high-dot" /> HIGH{' '}
              <span className="legend-dot low-dot" /> LOW
            </span>
            <div className="zoom-controls">
              <button onClick={() => setZoom(z => Math.max(0.65, z - 0.1))}>
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(1.4, z + 0.1))}>
                +
              </button>
            </div>
          </div>
        </section>
        <aside className="inspector">
          <div className="inspector-header">
            <span>INSPECTOR</span>
            <Activity size={15} />
          </div>
          {selected && parts.find(p => p.id === selected) ? (
            (() => {
              const p = parts.find(q => q.id === selected)!;
              const spec = specs[p.kind];
              return (
                <>
                  <div className="selected-card">
                    <div
                      className="selected-icon"
                      style={{ color: spec.color }}
                    >
                      {p.kind.startsWith('ic') ? (
                        <Cpu size={22} />
                      ) : p.kind === 'led' ? (
                        <Lightbulb size={22} />
                      ) : (
                        <Zap size={22} />
                      )}
                    </div>
                    <div>
                      <strong>{p.label || spec.title}</strong>
                      <small>{spec.title}</small>
                    </div>
                  </div>
                  <div className="inspector-section">
                    <label>REFERENCE</label>
                    <div className="info-row">
                      <span>Component ID</span>
                      <code>{p.id}</code>
                    </div>
                    <div className="info-row">
                      <span>Signal inputs</span>
                      <strong>{spec.inputs}</strong>
                    </div>
                    <div className="info-row">
                      <span>Signal outputs</span>
                      <strong>{spec.outputs}</strong>
                    </div>
                  </div>
                  <div className="inspector-section">
                    <label>LIVE STATE</label>
                    {spec.outputs > 0 ? (
                      Array.from({ length: spec.outputs }, (_, i) => (
                        <div className="signal-row" key={i}>
                          <span>OUT {i + 1}</span>
                          <strong
                            className={
                              outputFor(p, i) ? 'signal-high' : 'signal-low'
                            }
                          >
                            {outputFor(p, i) ? 'HIGH · 1' : 'LOW · 0'}
                          </strong>
                        </div>
                      ))
                    ) : (
                      <div className="signal-row">
                        <span>INPUT</span>
                        <strong
                          className={
                            valAt(p.id + ':in0') ? 'signal-high' : 'signal-low'
                          }
                        >
                          {valAt(p.id + ':in0') ? 'HIGH · 1' : 'LOW · 0'}
                        </strong>
                      </div>
                    )}
                  </div>
                  <button className="delete-wide" onClick={removeSelected}>
                    <Trash2 size={14} /> Remove component
                  </button>
                </>
              );
            })()
          ) : (
            <div className="inspector-empty">
              <div className="selection-target">
                <MousePointer2 size={22} />
              </div>
              <strong>No component selected</strong>
              <p>
                Select any component on the board to inspect its pins and
                current logic state.
              </p>
            </div>
          )}
          <div className="inspector-section truth-table">
            <label>LOGIC CHEAT SHEET</label>
            <div className="truth-head">
              <span>A</span>
              <span>B</span>
              <span>AND</span>
              <span>OR</span>
              <span>XOR</span>
            </div>
            {[
              [0, 0, 0, 0, 0],
              [0, 1, 0, 1, 1],
              [1, 0, 0, 1, 1],
              [1, 1, 1, 1, 0],
            ].map((r, i) => (
              <div className="truth-row" key={i}>
                {r.map((v, j) => (
                  <span className={j > 1 && v ? 'on-val' : ''} key={j}>
                    {v}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </aside>
      </main>
      <footer className="statusbar">
        <div>
          <span className="status-pulse" /> {message}
        </div>
        <div>
          <span>{parts.length} components</span>
          <span className="status-divider">/</span>
          <span>{wires.length} wires</span>
          <span className="status-divider">/</span>
          <span>5V LOGIC</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
