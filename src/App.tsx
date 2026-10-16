import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Activity, ArrowDownToLine, Cable, Cpu, Grid2X2, Lightbulb, Play, Plus, RotateCcw, Trash2, Zap } from 'lucide-react';

type Kind = 'switch' | 'and' | 'or' | 'not' | 'nand' | 'nor' | 'xor' | 'led' | 'clock' | 'ic7408' | 'ic7404' | 'display';
type Part = { id: string; kind: Kind; x: number; y: number; value?: boolean; label?: string };
type Wire = { id: string; from: string; to: string };
const specs: Record<Kind, { title: string; group: string; inputs: number; outputs: number; color: string }> = {
  switch: { title: 'Switch', group: 'Inputs', inputs: 0, outputs: 1, color: '#16a36a' },
  clock: { title: 'Clock', group: 'Inputs', inputs: 0, outputs: 1, color: '#16a36a' },
  and: { title: 'AND', group: 'Gates', inputs: 2, outputs: 1, color: '#5573ed' },
  or: { title: 'OR', group: 'Gates', inputs: 2, outputs: 1, color: '#5573ed' },
  not: { title: 'NOT', group: 'Gates', inputs: 1, outputs: 1, color: '#5573ed' },
  nand: { title: 'NAND', group: 'Gates', inputs: 2, outputs: 1, color: '#5573ed' },
  nor: { title: 'NOR', group: 'Gates', inputs: 2, outputs: 1, color: '#5573ed' },
  xor: { title: 'XOR', group: 'Gates', inputs: 2, outputs: 1, color: '#5573ed' },
  led: { title: 'LED', group: 'Outputs', inputs: 1, outputs: 0, color: '#e8a23b' },
  display: { title: '7-segment', group: 'Outputs', inputs: 4, outputs: 0, color: '#e8a23b' },
  ic7408: { title: '74HC08', group: 'ICs', inputs: 4, outputs: 2, color: '#8b5bd6' },
  ic7404: { title: '74HC04', group: 'ICs', inputs: 3, outputs: 3, color: '#8b5bd6' },
};
const uid = () => Math.random().toString(36).slice(2, 9);
const starterParts: Part[] = [
  { id: 's1', kind: 'switch', x: 110, y: 110, value: true, label: 'A' },
  { id: 's2', kind: 'switch', x: 110, y: 270, value: true, label: 'B' },
  { id: 'g1', kind: 'and', x: 390, y: 190, label: 'AND' },
  { id: 'l1', kind: 'led', x: 700, y: 190, label: 'OUT' },
];
const starterWires: Wire[] = [
  { id: 'w1', from: 's1:out', to: 'g1:in0' },
  { id: 'w2', from: 's2:out', to: 'g1:in1' },
  { id: 'w3', from: 'g1:out', to: 'l1:in0' },
];
const groups = ['Inputs', 'Gates', 'ICs', 'Outputs'] as const;

function App() {
  const [parts, setParts] = useState<Part[]>(starterParts);
  const [wires, setWires] = useState<Wire[]>(starterWires);
  const [selected, setSelected] = useState<string | null>(null);
  const [wireStart, setWireStart] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [message, setMessage] = useState('Ready');
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const signals = useMemo(() => {
    const result: Record<string, boolean[]> = {};
    const read = (pin: string) => {
      const wire = wires.find(item => item.to === pin);
      if (!wire) return false;
      const [id, output = 'out'] = wire.from.split(':');
      const index = Number(output.replace('out', '') || 0);
      return result[id]?.[index] ?? false;
    };
    for (let pass = 0; pass < parts.length + 2; pass++) {
      parts.forEach(part => {
        const a = read(part.id + ':in0');
        const b = read(part.id + ':in1');
        let out: boolean[] = [];
        if (part.kind === 'switch' || part.kind === 'clock') out = [!!part.value];
        else if (part.kind === 'and' || part.kind === 'ic7408') out = [a && b, read(part.id + ':in2') && read(part.id + ':in3')];
        else if (part.kind === 'or') out = [a || b];
        else if (part.kind === 'not' || part.kind === 'ic7404') out = [!a, !b, !read(part.id + ':in2')];
        else if (part.kind === 'nand') out = [!(a && b)];
        else if (part.kind === 'nor') out = [!(a || b)];
        else if (part.kind === 'xor') out = [a !== b];
        result[part.id] = out;
      });
    }
    return result;
  }, [parts, wires]);

  const outputFor = (part: Part, pin = 0) => signals[part.id]?.[pin] ?? false;
  const valAt = (pin: string) => {
    const wire = wires.find(w => w.to === pin);
    if (!wire) return false;
    const [id, output = 'out'] = wire.from.split(':');
    return signals[id]?.[Number(output.replace('out', '') || 0)] ?? false;
  };
  const partSize = (part: Part) => part.kind === 'ic7408' || part.kind === 'ic7404'
    ? { width: 152, height: 116 }
    : part.kind === 'display' ? { width: 142, height: 116 } : { width: 142, height: 100 };
  const pinPoint = (part: Part, pin: string) => {
    const spec = specs[part.kind];
    const size = partSize(part);
    if (pin.startsWith('out')) {
      const n = Number(pin.replace('out', '') || 0);
      return { x: part.x + size.width, y: part.y + size.height * (n + 1) / (spec.outputs + 1) };
    }
    const n = Number(pin.replace('in', '') || 0);
    return { x: part.x, y: part.y + size.height * (n + 1) / (spec.inputs + 1) };
  };
  const wirePath = (wire: Wire) => {
    const [fromId, fromPin] = wire.from.split(':');
    const [toId, toPin] = wire.to.split(':');
    const from = parts.find(p => p.id === fromId);
    const to = parts.find(p => p.id === toId);
    if (!from || !to) return '';
    const a = pinPoint(from, fromPin);
    const b = pinPoint(to, toPin);
    const bend = Math.max(36, Math.abs(b.x - a.x) * 0.45);
    return 'M ' + a.x + ' ' + a.y + ' C ' + (a.x + bend) + ' ' + a.y + ', ' + (b.x - bend) + ' ' + b.y + ', ' + b.x + ' ' + b.y;
  };
  const addPart = (kind: Kind) => {
    const part: Part = { id: uid(), kind, x: 90 + Math.random() * 220, y: 90 + Math.random() * 340, value: false, label: specs[kind].title };
    setParts(prev => [...prev, part]);
    setSelected(part.id);
    setMessage(specs[kind].title + ' added');
  };
  const removePart = (id: string) => {
    setParts(prev => prev.filter(p => p.id !== id));
    setWires(prev => prev.filter(w => !w.from.startsWith(id + ':') && !w.to.startsWith(id + ':')));
    if (selected === id) setSelected(null);
    setMessage('Component removed');
  };
  const connect = (pin: string) => {
    if (!wireStart) {
      if (!pin.includes(':out')) { setMessage('Start from an output port'); return; }
      setWireStart(pin);
      setMessage('Choose an input port');
      return;
    }
    if (pin === wireStart) { setWireStart(null); setMessage('Wire cancelled'); return; }
    if (pin.includes(':out')) { setWireStart(pin); setMessage('Output selected'); return; }
    const sourceId = wireStart.split(':')[0];
    const targetId = pin.split(':')[0];
    if (sourceId === targetId) { setMessage('Choose another component'); return; }
    setWires(prev => [...prev.filter(w => w.to !== pin), { id: uid(), from: wireStart, to: pin }]);
    setWireStart(null);
    setSelected(targetId);
    setMessage('Connected');
  };
  const startDrag = (event: PointerEvent<HTMLDivElement>, part: Part) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    dragRef.current = { id: part.id, dx: event.clientX - rect.left - part.x, dy: event.clientY - rect.top - part.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(part.id);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(12, event.clientX - rect.left - dragRef.current.dx);
    const y = Math.max(12, event.clientY - rect.top - dragRef.current.dy);
    const id = dragRef.current.id;
    setParts(prev => prev.map(p => p.id === id ? { ...p, x, y } : p));
  };
  const stopDrag = () => { dragRef.current = null; };
  const saveCircuit = () => {
    const blob = new Blob([JSON.stringify({ parts, wires }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'logic-circuit.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const loadExample = () => {
    setParts(starterParts.map(p => ({ ...p })));
    setWires(starterWires.map(w => ({ ...w })));
    setSelected(null);
    setWireStart(null);
    setMessage('Example loaded');
  };
  const clearBoard = () => {
    setParts([]);
    setWires([]);
    setSelected(null);
    setWireStart(null);
    setMessage('Canvas cleared');
  };
  const drawPart = (part: Part) => {
    const spec = specs[part.kind];
    const size = partSize(part);
    return <div
      key={part.id}
      className={'node ' + (selected === part.id ? 'selected ' : '') + (part.kind.startsWith('ic') ? 'chip-node' : '')}
      style={{ left: part.x, top: part.y, width: size.width, height: size.height, '--node-color': spec.color } as CSSProperties}
      onPointerDown={event => startDrag(event, part)}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onClick={() => setSelected(part.id)}
    >
      <div className="node-top">
        <span className="node-mark" style={{ color: spec.color }}>
          {part.kind === 'switch' ? <Grid2X2 size={16} /> : part.kind === 'clock' ? <Activity size={16} /> : part.kind === 'led' ? <Lightbulb size={16} /> : part.kind.startsWith('ic') ? <Cpu size={16} /> : <Zap size={16} />}
        </span>
        <span className="node-name">{part.label || spec.title}</span>
        <button className="node-delete" title="Remove" onClick={e => { e.stopPropagation(); removePart(part.id); }}><Trash2 size={13} /></button>
      </div>
      <div className="node-body">
        {part.kind === 'switch' || part.kind === 'clock' ? <button className={'switch-control ' + (part.value ? 'is-on' : '')} onClick={e => { e.stopPropagation(); setParts(prev => prev.map(p => p.id === part.id ? { ...p, value: !p.value } : p)); }}>
          <span className="switch-track"><span /></span><span>{part.value ? '1' : '0'}</span>
        </button> : part.kind === 'led' ? <div className={'led-state ' + (valAt(part.id + ':in0') ? 'lit' : '')}><span />{valAt(part.id + ':in0') ? 'ON' : 'OFF'}</div> : part.kind === 'display' ? <div className="mini-display"><span className={valAt(part.id + ':in3') ? 'seg lit' : 'seg'} /><span className={valAt(part.id + ':in3') ? 'seg lit' : 'seg'} /><span className={valAt(part.id + ':in2') ? 'seg lit' : 'seg'} /><span className={valAt(part.id + ':in1') ? 'seg lit' : 'seg'} /><span className={valAt(part.id + ':in0') ? 'seg lit' : 'seg'} /><span className={valAt(part.id + ':in0') ? 'seg lit' : 'seg'} /><span className={valAt(part.id + ':in2') ? 'seg lit' : 'seg'} /></div> : part.kind.startsWith('ic') ? <div className="chip-core"><span className="chip-notch" /><strong>{part.kind.toUpperCase()}</strong><small>{part.kind === 'ic7408' ? 'QUAD AND' : 'HEX INVERTER'}</small></div> : <div className="gate-symbol"><svg viewBox="0 0 72 45" aria-label={spec.title}><path d={part.kind === 'not' ? 'M10 5 L10 40 L52 22.5 Z' : ['or', 'nor', 'xor'].includes(part.kind) ? 'M8 5 Q27 22 8 40 Q39 40 62 22.5 Q39 5 8 5' : 'M8 5 L34 5 A22 17 0 0 1 34 40 L8 40 Z'} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />{['not', 'nand', 'nor'].includes(part.kind) && <circle cx={part.kind === 'not' ? 56 : 64} cy="22.5" r="4" fill="white" stroke="currentColor" strokeWidth="2" />}</svg><span>{spec.title}</span></div>}
      </div>
      {Array.from({ length: spec.inputs }, (_, i) => <button key={'in' + i} className={'port input-port ' + (valAt(part.id + ':in' + i) ? 'port-high ' : '') + (wireStart === part.id + ':in' + i ? 'port-pending' : '')} style={{ top: size.height * (i + 1) / (spec.inputs + 1) }} title={'Input ' + (i + 1)} onClick={e => { e.stopPropagation(); connect(part.id + ':in' + i); }} />)}
      {Array.from({ length: spec.outputs }, (_, i) => <button key={'out' + i} className={'port output-port ' + (outputFor(part, i) ? 'port-high ' : '') + (wireStart === part.id + (i ? ':out' + i : ':out') ? 'port-pending' : '')} style={{ top: size.height * (i + 1) / (spec.outputs + 1) }} title={'Output ' + (i + 1)} onClick={e => { e.stopPropagation(); connect(part.id + (i ? ':out' + i : ':out')); }} />)}
    </div>;