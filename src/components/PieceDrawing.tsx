import { INK, fitDrawing, type Drawing } from "@/lib/drawings";

/** el dibujo técnico de una pieza, en SVG */
export function PieceDrawing({ drawing, width = 360, height = 240 }: { drawing: Drawing; width?: number; height?: number }) {
  const { map } = fitDrawing(drawing, width, height);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Dibujo de la pieza con sus medidas">
      {drawing.prims.map((p, i) => {
        if (p.t === "poly") {
          const pts = p.pts.map(map);
          const d = `M${pts.map((q) => q.join(",")).join("L")}${p.close ? "Z" : ""}`;
          return (
            <path
              key={i}
              d={d}
              fill={p.fill ?? "none"}
              stroke={p.stroke ?? "none"}
              strokeWidth={p.w ?? 1}
              strokeDasharray={p.dash?.join(" ")}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        if (p.t === "circle") {
          const [cx, cy] = map(p.c);
          const r = Math.max(p.minPx ?? 0, Math.abs(map([p.r, 0])[0] - map([0, 0])[0]));
          return <circle key={i} cx={cx} cy={cy} r={r} fill={p.fill ?? "none"} stroke={p.stroke ?? "none"} strokeWidth={p.w ?? 1} />;
        }
        // cota: línea corrida hacia afuera, con topes y la medida en el medio
        const [ax, ay] = map(p.a);
        const [bx, by] = map(p.b);
        const horizontal = Math.abs(by - ay) < Math.abs(bx - ax);
        const off = horizontal ? [0, -p.offset] : [p.offset, 0];
        const a = [ax + off[0], ay + off[1]];
        const b = [bx + off[0], by + off[1]];
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const tick = horizontal ? [0, 4] : [4, 0];
        return (
          <g key={i} stroke={INK.dim} strokeWidth={0.8} fill={INK.dim}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            <line x1={a[0] - tick[0]} y1={a[1] - tick[1]} x2={a[0] + tick[0]} y2={a[1] + tick[1]} />
            <line x1={b[0] - tick[0]} y1={b[1] - tick[1]} x2={b[0] + tick[0]} y2={b[1] + tick[1]} />
            <text
              x={mid[0]}
              y={mid[1]}
              stroke="none"
              fontSize={11}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
              transform={horizontal ? undefined : `rotate(-90 ${mid[0]} ${mid[1]})`}
              paintOrder="stroke"
              style={{ paintOrder: "stroke" }}
            >
              <tspan dy={horizontal ? (p.offset < 0 ? 9 : -9) : p.offset < 0 ? -9 : 9}>{p.label}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
