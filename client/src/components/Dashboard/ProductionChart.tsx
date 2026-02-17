import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import type { ProductionTimelinePoint } from '../../types/analysis.types';
import type { PlayerInfo } from '../../types/replay.types';

const PLAYER_COLORS = ['#3b82f6', '#ef4444'];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  data: ProductionTimelinePoint[];
  players: PlayerInfo[];
  ageUpTimes?: Array<{ time: number; label: string }>;
}

export function ProductionChart({ data, players, ageUpTimes = [] }: Props) {
  const merged = useMemo(() => {
    const timeMap = new Map<number, Record<string, number>>();
    for (const pt of data) {
      const existing = timeMap.get(pt.time) ?? { time: pt.time };
      existing[`p${pt.playerId}_villagers`] = pt.villagers;
      existing[`p${pt.playerId}_military`] = pt.military;
      timeMap.set(pt.time, existing);
    }
    return [...timeMap.values()].sort((a, b) => a.time - b.time);
  }, [data]);

  if (merged.length === 0) return null;

  return (
    <div className="bg-aoe-panel/40 rounded-lg p-5 border border-aoe-border">
      <h3 className="font-cinzel text-xs tracking-[0.15em] text-aoe-text-secondary mb-4 uppercase">
        Production Timeline
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={merged}>
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            stroke="#7a756b"
            tick={{ fontSize: 10, fontFamily: 'Crimson Text' }}
          />
          <YAxis stroke="#7a756b" tick={{ fontSize: 10, fontFamily: 'Crimson Text' }} />
          <Tooltip
            labelFormatter={(v) => formatTime(Number(v))}
            contentStyle={{
              backgroundColor: '#1a1a24',
              border: '1px solid #2a2a35',
              borderRadius: '6px',
              fontFamily: 'Crimson Text',
            }}
            itemStyle={{ fontSize: 13 }}
          />
          {/* Age-up reference lines */}
          {ageUpTimes.map((a) => (
            <ReferenceLine
              key={a.label}
              x={a.time}
              stroke="#c9a84c"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{ value: a.label, position: 'top', fontSize: 10, fill: '#c9a84c' }}
            />
          ))}
          {players.map((p, i) => (
            <Area
              key={`${p.playerId}_vil`}
              type="monotone"
              dataKey={`p${p.playerId}_villagers`}
              name={`${p.name} Villagers`}
              stroke={PLAYER_COLORS[i]}
              fill={PLAYER_COLORS[i]}
              fillOpacity={0.08}
              strokeWidth={2}
            />
          ))}
          {players.map((p, i) => (
            <Area
              key={`${p.playerId}_mil`}
              type="monotone"
              dataKey={`p${p.playerId}_military`}
              name={`${p.name} Military`}
              stroke={PLAYER_COLORS[i]}
              fill={PLAYER_COLORS[i]}
              fillOpacity={0.2}
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          ))}
          <Legend
            wrapperStyle={{ fontSize: 11, fontFamily: 'Crimson Text' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
