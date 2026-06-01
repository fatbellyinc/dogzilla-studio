import { NextRequest, NextResponse } from 'next/server';

// Uses Open-Meteo — free, no API key needed
// Caloocan City coordinates: 14.6507° N, 120.9622° E
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=14.6507&longitude=120.9622&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%2FManila&start_date=${date}&end_date=${date}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();

    const codes: Record<number, string> = {
      0: 'Clear sky ☀️', 1: 'Mainly clear 🌤', 2: 'Partly cloudy ⛅', 3: 'Overcast ☁️',
      45: 'Foggy 🌫', 48: 'Foggy 🌫', 51: 'Light drizzle 🌦', 53: 'Drizzle 🌦', 55: 'Heavy drizzle 🌧',
      61: 'Light rain 🌧', 63: 'Rain 🌧', 65: 'Heavy rain 🌧',
      80: 'Rain showers 🌦', 81: 'Heavy showers 🌧', 82: 'Violent showers ⛈',
      95: 'Thunderstorm ⛈', 96: 'Thunderstorm ⛈', 99: 'Thunderstorm ⛈',
    };

    const code = data.daily?.weathercode?.[0];
    const maxTemp = data.daily?.temperature_2m_max?.[0];
    const minTemp = data.daily?.temperature_2m_min?.[0];
    const rain = data.daily?.precipitation_sum?.[0];

    return NextResponse.json({
      description: codes[code] || 'Unknown',
      max_temp: maxTemp,
      min_temp: minTemp,
      rain_mm: rain,
      is_rainy: rain > 5 || [61,63,65,80,81,82,95,96,99].includes(code),
    });
  } catch {
    return NextResponse.json({ error: 'Weather fetch failed' }, { status: 500 });
  }
}
