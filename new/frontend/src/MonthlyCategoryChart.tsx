
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

type Props = Readonly<{ data: any[] }>

export default function MonthlyCategoryChart({ data }: Props) {
  const grouped = React.useMemo(() => {
    const map: Record<string, any> = {};
    data.forEach(({ month, category, sum }) => {
      if (!map[month]) map[month] = { month };
      map[month][category] = sum;
    });
    return Object.values(map);
  }, [data]);
 
  const categories = Array.from(new Set(data.map(d => d.category)));

  if (!data || data.length === 0) return <div>Keine Daten für Diagramm vorhanden.</div>;

  return (
    <div style={{background:'#fff', borderRadius:12, boxShadow:'0 2px 16px 0 #dbeafe55', padding:24, marginTop:32}}>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={grouped} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          {categories.map(cat => (
            <Bar key={cat} dataKey={cat} stackId="a" fill={stringToColor(cat)} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    color += ('00' + ((hash >> (i * 8)) & 0xFF).toString(16)).slice(-2);
  }
  return color;
}
