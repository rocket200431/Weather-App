
  
    const $ = (id) => document.getElementById(id);

    const codeToInfo = (code) => {
      // https://open-meteo.com/en/docs#latitude=51.5&longitude=-0.1
      const map = {
        0: ['Clear sky', '☀️'],
        1: ['Mainly clear', '🌤️'],
        2: ['Partly cloudy', '⛅'],
        3: ['Overcast', '☁️'],
        45: ['Fog', '🌫️'],
        48: ['Depositing rime fog', '🌫️'],
        51: ['Light drizzle', '🌦️'],
        53: ['Moderate drizzle', '🌦️'],
        55: ['Dense drizzle', '🌧️'],
        56: ['Freezing drizzle', '🌧️'],
        57: ['Dense freezing drizzle', '🌧️'],
        61: ['Slight rain', '🌦️'],
        63: ['Moderate rain', '🌧️'],
        65: ['Heavy rain', '🌧️'],
        66: ['Light freezing rain', '🌧️'],
        67: ['Heavy freezing rain', '🌧️'],
        71: ['Slight snow fall', '🌨️'],
        73: ['Moderate snow fall', '🌨️'],
        75: ['Heavy snow fall', '❄️'],
        77: ['Snow grains', '❄️'],
        80: ['Rain showers: slight', '🌦️'],
        81: ['Rain showers: moderate', '🌧️'],
        82: ['Rain showers: violent', '⛈️'],
        85: ['Snow showers: slight', '🌨️'],
        86: ['Snow showers: heavy', '❄️'],
        95: ['Thunderstorm', '⛈️'],
        96: ['Thunderstorm w/ slight hail', '⛈️'],
        99: ['Thunderstorm w/ heavy hail', '⛈️'],
      };
      return map[code] || ['Unknown', '❔'];
    };

    let units = { temp: 'celsius', wind: 'kmh' }; // default

    const fmtTemp = (t) => `${Math.round(t)}°${units.temp === 'celsius' ? 'C' : 'F'}`;
    const fmtWind = (w) => `${Math.round(w)} ${units.wind === 'kmh' ? 'km/h' : 'mph'}`;

    // --- DOM Handlers ---
    async function searchCity(name){
      setStatus('Searching…');
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
      const res = await fetch(url);
      if(!res.ok){ throw new Error('Geocoding failed'); }
      const data = await res.json();
      if(!data.results || !data.results.length){ throw new Error('City not found'); }
      const c = data.results[0];
      await loadWeather({
        latitude: c.latitude,
        longitude: c.longitude,
        name: c.name,
        country: c.country,
        timezone: c.timezone
      });
    }

    async function loadWeather({latitude, longitude, name, country, timezone}){
      setStatus('Loading weather…');
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,weathercode,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&temperature_unit=${units.temp}&wind_speed_unit=${units.wind}`;
      const res = await fetch(url);
      if(!res.ok){ throw new Error('Weather fetch failed'); }
      const wx = await res.json();

      // Current
      const cw = wx.current_weather;
      const [desc, emo] = codeToInfo(cw.weathercode);
      $('place').textContent = `${name}, ${country}`;
      $('coords').textContent = `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`;
      $('emoji').textContent = emo;
      $('temp').textContent = fmtTemp(cw.temperature);
      $('desc').textContent = desc;
      $('timezone').textContent = wx.timezone || timezone || '—';
      $('lat').textContent = latitude.toFixed(3);
      $('lon').textContent = longitude.toFixed(3);

      // Hourly helpers for feels like & humidity
      const idx = wx.hourly.time.indexOf(cw.time);
      const feels = idx >= 0 ? wx.hourly.apparent_temperature[idx] : cw.temperature;
      const hum = idx >= 0 ? wx.hourly.relative_humidity_2m[idx] : null;
      $('feels').textContent = fmtTemp(feels);
      $('humidity').textContent = hum != null ? `${hum}%` : '—';
      $('wind').textContent = fmtWind(cw.windspeed);
      $('updated').textContent = new Date(cw.time).toLocaleString();

      // Forecast
      const days = $('days');
      days.innerHTML = '';
      wx.daily.time.forEach((d, i) => {
        const [dDesc, dEmo] = codeToInfo(wx.daily.weathercode[i]);
        const el = document.createElement('div');
        el.className = 'rounded-xl border border-slate-200 p-3 text-center';
        const date = new Date(d);
        const day = date.toLocaleDateString(undefined, { weekday: 'short'});
        el.innerHTML = `
          <div class="text-xs text-slate-500">${day}</div>
          <div class="text-3xl my-1">${dEmo}</div>
          <div class="text-xs text-slate-500">${dDesc}</div>
          <div class="mt-2 font-semibold">${Math.round(wx.daily.temperature_2m_min[i])}° / ${Math.round(wx.daily.temperature_2m_max[i])}°</div>
        `;
        days.appendChild(el);
      });

      // Reveal sections
      $('current').style.opacity = 1;
      $('forecast').style.opacity = 1;
      setStatus('');
    }

    function setStatus(msg){ $('status').textContent = msg; }

    // --- Events ---
    $('search-form').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const q = $('query').value.trim();
      if(!q) return;
      try{ await searchCity(q); }catch(err){ setStatus(err.message); }
    });

    $('loc-btn').addEventListener('click', ()=>{
      if(!navigator.geolocation){ setStatus('Geolocation not supported'); return; }
      setStatus('Getting your location…');
      navigator.geolocation.getCurrentPosition(async (pos)=>{
        const { latitude, longitude } = pos.coords;
        try{
          // Reverse geocode to get city name (simple nearest)
          const geoUrl = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`;
          const res = await fetch(geoUrl);
          let name='Your location', country='';
          if(res.ok){
            const g = await res.json();
            if(g && g.results && g.results.length){
              name = g.results[0].name;
              country = g.results[0].country || '';
            }
          }
          await loadWeather({ latitude, longitude, name, country });
        }catch(err){ setStatus('Failed to load your location'); }
      }, (err)=> setStatus('Permission denied or unavailable'));
    });

    $('unit-c').addEventListener('click', async ()=>{
      if(units.temp==='celsius') return;
      units = { temp: 'celsius', wind: 'kmh' };
      // Re-run if we already have a place shown
      const place = $('place').textContent;
      if(place && place !== '—'){
        const [name, rest] = place.split(',');
        try{ await searchCity(name); }catch(e){}
      }
    });
    $('unit-f').addEventListener('click', async ()=>{
      if(units.temp==='fahrenheit') return;
      units = { temp: 'fahrenheit', wind: 'mph' };
      const place = $('place').textContent;
      if(place && place !== '—'){
        const [name, rest] = place.split(',');
        try{ await searchCity(name); }catch(e){}
      }
    });

    // Optional: load a default city on first visit
    window.addEventListener('DOMContentLoaded', ()=>{
      searchCity('Bhubaneswar').catch(()=>{});
    });
 