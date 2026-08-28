import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import bezierSpline from '@turf/bezier-spline';
import { lineString } from '@turf/helpers';
import destination from '@turf/destination';
import distance from '@turf/distance';
import bearing from '@turf/bearing';
import length from '@turf/length';
import along from '@turf/along';
import { formatDuration, differenceInMinutes } from 'date-fns';
import { ESTADOS, getColorForState } from './utils';

// Helper component to bind map instance to App state and fit bounds on mount
const MapController = ({ events, setMapRef, currentState }) => {
  const map = useMap();

  useEffect(() => {
    if (setMapRef) setMapRef(map);
  }, [map, setMapRef]);

  useEffect(() => {
    if (events.length === 0) return;

    // Collect all lat/lng to fit bounds
    const bounds = [];
    events.forEach(event => {
      if (event.tipo === 'transporte') {
        bounds.push([event.origen.lat, event.origen.lng]);
        bounds.push([event.destino.lat, event.destino.lng]);
      } else {
        bounds.push([event.coordenadas.lat, event.coordenadas.lng]);
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    // If there's an active present event, zoom to it after a short delay
    if (currentState && (currentState.statusType === ESTADOS.PRESENTE || currentState.statusType === ESTADOS.TRANSITO)) {
      setTimeout(() => {
        const ev = currentState.event;
        if (ev) {
          if (ev.tipo === 'estadia') {
            map.flyTo([ev.coordenadas.lat, ev.coordenadas.lng], 12, { duration: 2 });
          } else if (ev.tipo === 'transporte') {
            // For transport, we might be anywhere on the line. 
            // In transit, we pan to the last known destination
            if (ev.isGap) {
              map.flyTo([ev.destino.lat, ev.destino.lng], 10, { duration: 2 });
            } else {
              // Present transport, fly to destination
              map.flyTo([ev.destino.lat, ev.destino.lng], 7, { duration: 2 });
            }
          }
        }
      }, 1500); // 1.5s delay to let the initial fitBounds settle
    }
  }, [map]); // run once basically, but depends on map

  return null;
};


const MapComponent = ({ events, currentState, setMapRef, mapTheme = 'dark_all' }) => {
  const tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
  const attribution = '&copy; <a href="https://www.esri.com/">Esri</a>, DeLorme, NAVTEQ';

  const formatFlightDuration = (start, end) => {
    const mins = differenceInMinutes(new Date(end), new Date(start));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <MapContainer 
      center={[20, 0]} 
      zoom={2} 
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer url={tileUrl} attribution={attribution} />
      
      <MapController events={events} setMapRef={setMapRef} currentState={currentState} />

      {events.map((event) => {
        const color = getColorForState(event.state);
        const isActive = event.state === ESTADOS.PRESENTE;
        
        if (event.tipo === 'transporte') {
          const start = [event.origen.lng, event.origen.lat];
          const end = [event.destino.lng, event.destino.lat];
          let positions = [];
          
          let curvedLineFeature = null;
          try {
            const dist = distance(start, end);
            const angle = bearing(start, end);
            const mid = destination(start, dist / 2, angle);
            
            // Curve to the right. Planes have larger curve (8%), trains smaller (4%)
            const isAvion = event.medio === 'avion';
            const offsetDist = dist * (isAvion ? 0.08 : 0.04);
            const controlPoint = destination(mid, offsetDist, angle + 90);
            
            curvedLineFeature = bezierSpline(lineString([start, controlPoint.geometry.coordinates, end]), { resolution: 10000, sharpness: 0.85 });
            positions = curvedLineFeature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
          } catch (e) {
            positions = [[event.origen.lat, event.origen.lng], [event.destino.lat, event.destino.lng]];
            curvedLineFeature = lineString([start, end]);
          }

          const isAvion = event.medio === 'avion';
          const routeColor = (isActive || event.state === ESTADOS.PASADO) ? color : (isAvion ? color : '#f97316');
          const dashArray = isAvion 
            ? (isActive ? '10, 10' : undefined) 
            : (isActive ? '12, 12' : '4, 6');
          const classNames = isActive ? 'animate-[dash_1s_linear_infinite]' : ''; 

          let arrowMarker = null;
          if (positions.length >= 2) {
            const midIndex = Math.floor(positions.length / 2);
            const prev = positions[midIndex - 1] || positions[0];
            const next = positions[midIndex];
            
            // turf.bearing takes [lng, lat]
            const angle = bearing([prev[1], prev[0]], [next[1], next[0]]);
            
            // Subtract 90 degrees because ▶ is naturally pointing right (0 deg in math, but bearing is 0 at North)
            // Wait, bearing 0 is North. ▶ points East (90 deg). 
            // So if bearing is 90 (East), we want to rotate by 0 (relative to ▶) or just use ▲ and rotate by angle.
            // Let's use ▲ pointing up (North) and rotate by angle.
            const arrowIcon = L.divIcon({
              className: 'custom-arrow-icon',
              html: `<div style="transform: rotate(${angle}deg); color: ${routeColor}; font-size: 16px; line-height: 1; text-align: center; text-shadow: 0 0 3px black; opacity: ${event.state === ESTADOS.PASADO ? 0.3 : (event.state === ESTADOS.FUTURO && !event.isProximo ? 0.3 : 1)};">▲</div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });
            
            arrowMarker = <Marker position={next} icon={arrowIcon} interactive={false} />;
          }

          let liveMarker = null;
          if (isActive && curvedLineFeature) {
             const now = new Date();
             const tStart = new Date(event.fechaSalida).getTime();
             const tEnd = new Date(event.fechaLlegada).getTime();
             let progress = (now.getTime() - tStart) / (tEnd - tStart);
             progress = Math.max(0, Math.min(1, progress));

             const totalLen = length(curvedLineFeature);
             const currentPos = along(curvedLineFeature, totalLen * progress);
             const [lng, lat] = currentPos.geometry.coordinates;
             
             let vehicle = '🚗';
             if (event.medio === 'avion') vehicle = '✈️';
             else if (event.medio === 'tren') vehicle = '🚂';
             else if (event.medio === 'bus') vehicle = '🚌';
             
             const liveIcon = L.divIcon({
                className: 'live-vehicle-icon',
                html: `<div style="font-size: 20px; background: rgba(0,0,0,0.7); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px ${routeColor}; border: 1px solid ${routeColor}">${vehicle}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
             });
             
             liveMarker = <Marker position={[lat, lng]} icon={liveIcon} zIndexOffset={1000} />;
          }

          const lineOpacity = event.state === ESTADOS.PASADO ? 0.3 : (event.state === ESTADOS.FUTURO && !event.isProximo ? 0.3 : 0.8);

          return (
            <React.Fragment key={`route-frag-${event.id}-${event.state}`}>
              {/* Invisible thick line for easier tapping/clicking */}
              <Polyline positions={positions} pathOptions={{ color: 'transparent', weight: 30 }}>
                <Tooltip className="dark-tooltip" sticky>
                  <div className="font-bold text-sm mb-1">
                    {event.medio === 'avion' ? '✈️ Vuelo' : '🚂 Tren'} — {event.detalle}
                  </div>
                  <div className="text-xs text-slate-300">
                    {event.origen.nombre} → {event.destino.nombre}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Sale: {new Date(event.fechaSalida).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}<br/>
                    Llega: {new Date(event.fechaLlegada).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}<br/>
                    Duración: {formatFlightDuration(event.fechaSalida, event.fechaLlegada)}
                  </div>
                </Tooltip>
                <Popup className="dark-popup">
                  <div className="font-bold text-sm mb-1">
                    {event.medio === 'avion' ? '✈️ Vuelo' : '🚂 Tren'} — {event.detalle}
                  </div>
                  <div className="text-xs text-slate-300">
                    {event.origen.nombre} → {event.destino.nombre}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Sale: {new Date(event.fechaSalida).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}<br/>
                    Llega: {new Date(event.fechaLlegada).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}<br/>
                    Duración: {formatFlightDuration(event.fechaSalida, event.fechaLlegada)}
                  </div>
                </Popup>
              </Polyline>

              {/* Visible thin line */}
              <Polyline 
                key={`route-${event.id}-${event.state}`}
                positions={positions} 
                pathOptions={{
                  color: routeColor,
                  weight: isActive ? 4 : 2,
                  opacity: lineOpacity,
                  dashArray: dashArray,
                  className: classNames
                }}
                interactive={false}
              />
              {arrowMarker}
              {liveMarker}
            </React.Fragment>
          );
        }
        if (event.tipo === 'estadia') {
          const hotelOpacity = event.state === ESTADOS.PASADO ? 0.4 : (event.state === ESTADOS.FUTURO && !event.isProximo ? 0.3 : 1);
          
          return (
            <React.Fragment key={`hotel-group-${event.id}-${event.state}`}>
              {/* Invisible large circle for easier tapping/clicking */}
              <CircleMarker
                center={[event.coordenadas.lat, event.coordenadas.lng]}
                pathOptions={{ color: 'transparent', weight: 0 }}
                radius={24}
              >
                <Tooltip className="dark-tooltip" sticky>
                  <div className="font-bold text-sm mb-1">🏨 {event.hotel}</div>
                  <div className="text-xs text-slate-300 mb-1">{event.ciudad} — {event.direccion}</div>
                  <div className="text-xs text-slate-400">
                    Check-in: {new Date(event.checkIn).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}<br/>
                    Check-out: {new Date(event.checkOut).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                  </div>
                </Tooltip>
                <Popup className="dark-popup">
                  <div className="font-bold text-sm mb-1">🏨 {event.hotel}</div>
                  <div className="text-xs text-slate-300 mb-1">{event.ciudad} — {event.direccion}</div>
                  <div className="text-xs text-slate-400">
                    Check-in: {new Date(event.checkIn).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}<br/>
                    Check-out: {new Date(event.checkOut).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                  </div>
                </Popup>
              </CircleMarker>

              {/* Visible small circle */}
              <CircleMarker
                key={`hotel-${event.id}-${event.state}`}
                center={[event.coordenadas.lat, event.coordenadas.lng]}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: isActive ? 1 : hotelOpacity * 0.7,
                  opacity: hotelOpacity,
                  weight: 2
                }}
                radius={isActive ? 8 : 6}
                interactive={false}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 w-full h-full -ml-3 -mt-3 animate-pulse-ring rounded-full bg-emerald-500" style={{ width: '24px', height: '24px', position: 'absolute', transform: 'translate3d(-50%, -50%, 0)' }} />
                )}
              </CircleMarker>
            </React.Fragment>
          );
        }
        return null;
      })}

      {/* Render a pulsing marker for active states */}
      {currentState && (currentState.statusType === ESTADOS.PRESENTE || currentState.statusType === ESTADOS.TRANSITO) && currentState.event && (
        <CircleMarker
           center={
             currentState.event.tipo === 'estadia' 
              ? [currentState.event.coordenadas.lat, currentState.event.coordenadas.lng] 
              : [currentState.event.destino.lat, currentState.event.destino.lng] // For transport and transit, show blip at destination
           }
           radius={12}
           pathOptions={{ color: 'transparent', fillColor: getColorForState(currentState.statusType), fillOpacity: 0.3 }}
           className="animate-pulse-ring"
           interactive={false}
        />
      )}
    </MapContainer>
  );
};

export default MapComponent;
