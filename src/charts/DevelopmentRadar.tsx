import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'

const labels = [
  ['development', 'Development'],
  ['importance', 'Importance'],
  ['narrativeTime', 'Narrative time'],
  ['quality', 'Quality'],
] as const

interface DevelopmentRadarValues {
  development?: number
  importance?: number
  narrativeTime?: number
  quality?: number
}

export function DevelopmentRadar({ values }: { values: DevelopmentRadarValues }) {
  const data = labels.map(([key, subject]) => ({ subject, value: typeof values[key] === 'number' ? values[key] : 0 }))
  return (
    <div className="radar-chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#343434" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#8d8d8d', fontSize: 10 }} />
          <PolarRadiusAxis domain={[0, 100]} axisLine={false} tick={false} />
          <Tooltip formatter={(value) => [`${value}/100`, 'Score']} contentStyle={{ background: '#181818', border: '1px solid #343434', borderRadius: 10 }} />
          <Radar dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.17} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
