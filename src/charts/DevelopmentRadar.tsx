import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'

const labels: Record<string, string> = {
  development: 'Development',
  importance: 'Importance',
  narrativeTime: 'Narrative time',
  quality: 'Quality',
}

export function DevelopmentRadar({ values }: { values: Record<string, unknown> }) {
  const data = Object.entries(labels).map(([key, subject]) => ({ subject, value: typeof values[key] === 'number' ? values[key] : 0 }))
  return (
    <div className="radar-chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#343434" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#8d8d8d', fontSize: 10 }} />
          <Tooltip contentStyle={{ background: '#181818', border: '1px solid #343434', borderRadius: 10 }} />
          <Radar dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.17} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
