import { useEffect, useState } from 'react';
import { evaluateItineraryState, ESTADOS } from './utils';
import itineraryData from './itinerary.json';
import Sidebar, { CurrentStateCard } from './Sidebar';
import MapComponent from './MapComponent';
import { List, Map as MapIcon, Moon, Sun } from 'lucide-react';

import bezierSpline from '@turf/bezier-spline';
import { lineString } from '@turf/helpers';
import destination from '@turf/destination';
import distance from '@turf/distance';
import bearing from '@turf/bearing';
import length from '@turf/length';
import along from '@turf/along';

function App() {
  const [now, setNow] = useState(new Date());
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mapTheme, setMapTheme] = useState('dark_all');
  
  // Real-time update every 60 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(new Date());
    }, 60000); // 60 seconds
    return () => clearInterval(intervalId);
  }, []);

  const { events, currentState } = evaluateItineraryState(itineraryData, now);

  const [mapRef, setMapRef] = useState(null);

  const handleEventClick = (event) => {
    if (!mapRef) return;
    
    let latlng;
    if (event.tipo === 'estadia') {
      latlng = [event.coordenadas.lat, event.coordenadas.lng];
    } else if (event.tipo === 'transporte') {
      if (event.state === ESTADOS.PRESENTE) {
        const start = [event.origen.lng, event.origen.lat];
        const end = [event.destino.lng, event.destino.lat];
        let curvedLineFeature = null;
        try {
          const dist = distance(start, end);
          const angle = bearing(start, end);
          const mid = destination(start, dist / 2, angle);
          const isAvion = event.medio === 'avion';
          const offsetDist = dist * (isAvion ? 0.08 : 0.04);
          const controlPoint = destination(mid, offsetDist, angle + 90);
          curvedLineFeature = bezierSpline(lineString([start, controlPoint.geometry.coordinates, end]), { resolution: 10000, sharpness: 0.85 });
        } catch (e) {
          curvedLineFeature = lineString([start, end]);
        }

        const tStart = new Date(event.fechaSalida).getTime();
        const tEnd = new Date(event.fechaLlegada).getTime();
        let progress = (now.getTime() - tStart) / (tEnd - tStart);
        progress = Math.max(0, Math.min(1, progress));

        const totalLen = length(curvedLineFeature);
        const currentPos = along(curvedLineFeature, totalLen * progress);
        const [lng, lat] = currentPos.geometry.coordinates;
        latlng = [lat, lng];
      } else {
        latlng = [event.origen.lat, event.origen.lng];
      }
    }
    
    if (latlng) {
      mapRef.flyTo(latlng, 10, { duration: 1.5 });
      setShowMobileSidebar(false);
    }
  };

  return (
    <div className="flex w-full bg-slate-900 overflow-hidden font-sans text-slate-50 relative" style={{ height: '100dvh' }}>
      {/* Mobile Toggle Button */}
      <button 
        onClick={() => setShowMobileSidebar(!showMobileSidebar)}
        className="md:hidden absolute bottom-6 right-4 z-[1000] bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-full p-4 shadow-lg shadow-emerald-500/50 flex items-center justify-center transition-transform active:scale-95"
      >
        {showMobileSidebar ? <MapIcon size={24} /> : <List size={24} />}
      </button>



      {/* Sidebar Container */}
      <div className={`
        absolute inset-0 z-[500] transform transition-transform duration-300 ease-in-out
        md:relative md:transform-none md:w-[30%] md:min-w-[320px] md:max-w-[400px]
        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar 
          events={events} 
          currentState={currentState} 
          onEventClick={handleEventClick} 
          mapTheme={mapTheme}
          setMapTheme={setMapTheme}
        />
      </div>

      <div className="flex-1 relative z-0 w-full h-full">
        {/* Floating Current State on Mobile */}
        <div className={`md:hidden absolute top-0 left-0 right-0 z-[1000] transition-opacity duration-300 pointer-events-none ${showMobileSidebar ? 'opacity-0' : 'opacity-100'}`}>
          <div className="pointer-events-auto">
            <CurrentStateCard 
              currentState={currentState} 
              onEventClick={handleEventClick} 
              hideTitle={true}
              className="p-3 shadow-lg border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-md"
            />
          </div>
        </div>

        {/* Mobile Theme Switcher */}
        <div className={`md:hidden absolute bottom-6 left-4 z-[1000] flex bg-slate-900/90 backdrop-blur-md rounded-xl shadow-lg shadow-black/50 border border-slate-700/50 transition-opacity duration-300 ${showMobileSidebar ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}>
          <button onClick={() => setMapTheme('dark_all')} className={`p-3 rounded-l-xl transition-colors ${mapTheme === 'dark_all' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400'}`}><Moon size={20} /></button>
          <button onClick={() => setMapTheme('light_all')} className={`p-3 transition-colors border-x border-slate-700/50 ${mapTheme === 'light_all' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400'}`}><Sun size={20} /></button>
          <button onClick={() => setMapTheme('voyager')} className={`p-3 rounded-r-xl transition-colors ${mapTheme === 'voyager' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400'}`}><MapIcon size={20} /></button>
        </div>

        <MapComponent 
          events={events} 
          currentState={currentState} 
          setMapRef={setMapRef} 
          mapTheme={mapTheme}
        />
      </div>
    </div>
  );
}

export default App;
