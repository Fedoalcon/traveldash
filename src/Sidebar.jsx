import React, { useEffect, useRef } from 'react';
import { ESTADOS, getColorForState } from './utils';
import { Plane, Train, Hotel, MapPin, CheckCircle2, Clock, Moon, Sun, Map as MapIcon } from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';

export const CurrentStateCard = ({ currentState, onEventClick, className = '', hideTitle = false }) => {
  const formatShortDate = (dateString) => {
    return format(parseISO(dateString), 'd MMM, HH:mm');
  };

  return (
    <div 
      className={`border-slate-800 bg-slate-800/90 backdrop-blur-sm ${currentState.event ? 'cursor-pointer hover:bg-slate-800 transition-colors' : ''} ${className}`}
      onClick={() => {
        if (currentState.event && onEventClick) {
          onEventClick(currentState.event);
        }
      }}
    >
      {!hideTitle && <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Estado Actual</h2>}
      <div className="flex items-start gap-3">
        <div className="mt-1">
          {currentState.statusType === ESTADOS.PRESENTE && <MapPin className="text-emerald-400" />}
          {currentState.statusType === ESTADOS.TRANSITO && <MapPin className="text-amber-500" />}
          {currentState.statusType === ESTADOS.FUTURO && <Clock className="text-blue-400" />}
          {currentState.statusType === ESTADOS.PASADO && <CheckCircle2 className="text-slate-400" />}
        </div>
        <div>
          <p className="text-sm font-medium leading-relaxed">{currentState.status}</p>
          {currentState.statusType === ESTADOS.PRESENTE && currentState.event?.tipo === 'transporte' && (() => {
            const ev = currentState.event;
            const minsLeft = differenceInMinutes(parseISO(ev.fechaLlegada), new Date());
            const hLeft = Math.floor(Math.max(0, minsLeft) / 60);
            const mLeft = Math.max(0, minsLeft) % 60;
            const timeLeft = hLeft > 0 ? `${hLeft}h ${mLeft}m` : `${mLeft}m`;
            
            return (
              <div className="text-xs text-slate-400 mt-2 space-y-1 border-t border-slate-700/50 pt-2">
                <p><span className="text-slate-500">Sale:</span> {formatShortDate(ev.fechaSalida)}</p>
                <p><span className="text-slate-500">Llega:</span> {formatShortDate(ev.fechaLlegada)}</p>
                <p className="text-emerald-400/90 font-medium mt-1 pt-1">Faltan {timeLeft} para arribar</p>
              </div>
            );
          })()}

          {currentState.statusType === ESTADOS.PRESENTE && currentState.event?.tipo === 'estadia' && (() => {
            const ev = currentState.event;
            const minsLeft = differenceInMinutes(parseISO(ev.checkOut), new Date());
            const dLeft = Math.floor(Math.max(0, minsLeft) / (60 * 24));
            const hLeft = Math.floor((Math.max(0, minsLeft) % (60 * 24)) / 60);
            
            let timeLeftStr = '';
            if (dLeft > 0) {
               timeLeftStr = `${dLeft} día${dLeft > 1 ? 's' : ''} y ${hLeft} hora${hLeft !== 1 ? 's' : ''}`;
            } else {
               const mLeft = Math.max(0, minsLeft) % 60;
               timeLeftStr = hLeft > 0 ? `${hLeft}h ${mLeft}m` : `${mLeft}m`;
            }
            
            return (
              <div className="text-xs text-slate-400 mt-2 space-y-1 border-t border-slate-700/50 pt-2">
                <p><span className="text-slate-500">Check-in:</span> {formatShortDate(ev.checkIn)}</p>
                <p><span className="text-slate-500">Check-out:</span> {formatShortDate(ev.checkOut)}</p>
                <p className="text-emerald-400/90 font-medium mt-1 pt-1">Quedan {timeLeftStr} de estadía</p>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ events, currentState, onEventClick, mapTheme, setMapTheme }) => {
  const getIconForEvent = (event) => {
    if (event.tipo === 'estadia') return <Hotel size={18} />;
    if (event.medio === 'avion') return <Plane size={18} />;
    if (event.medio === 'tren') return <Train size={18} />;
    return <MapPin size={18} />;
  };

  const formatShortDate = (dateString) => {
    return format(parseISO(dateString), 'd MMM, HH:mm');
  };

  const activeEventRef = useRef(null);

  // Auto-scroll to the current event when the component mounts or events change
  useEffect(() => {
    if (activeEventRef.current) {
      setTimeout(() => {
        activeEventRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500); // Slight delay to ensure the layout has rendered
    }
  }, [currentState.event?.id]);

  const targetEventId = currentState.event?.id || events.find(e => e.state === ESTADOS.FUTURO)?.id;

  return (
    <div className="w-full h-full bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl relative">
      {/* Header */}
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-1">
          Viaje Europa 2026
        </h1>
        <p className="text-slate-400 text-sm flex items-center gap-1">
          <Clock size={14} /> Tiempo Real
        </p>
      </div>

      {/* Current State Panel */}
      <CurrentStateCard 
        currentState={currentState} 
        onEventClick={onEventClick} 
        className="p-6 border-b bg-slate-800/30"
      />

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-4">Itinerario</h2>
        <div className="relative border-l border-slate-700 ml-3 space-y-6">
          {events.map((event) => {
            const color = getColorForState(event.state);
            const isFuture = event.state === ESTADOS.FUTURO;
            const opacityClass = (isFuture && !event.isProximo) ? 'opacity-40' : 'opacity-80';
            const isTarget = targetEventId === event.id;

            return (
              <div 
                key={event.id} 
                ref={isTarget ? activeEventRef : null}
                className={`relative pl-6 cursor-pointer group transition-opacity ${opacityClass} hover:opacity-100`}
                onClick={() => onEventClick(event)}
              >
                {/* Timeline dot */}
                <div 
                  className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-slate-900 transition-transform group-hover:scale-125"
                  style={{ backgroundColor: color }}
                />
                
                {/* Content */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color }}>{getIconForEvent(event)}</span>
                    <span className="font-semibold text-sm">
                      {event.tipo === 'transporte' 
                        ? `${event.origen.nombre.substring(0, 3)} → ${event.destino.nombre.substring(0, 3)}`
                        : event.ciudad}
                    </span>
                    {event.isProximo && (
                      <span className="text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded ml-2">Próximo</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 space-y-0.5">
                    {event.tipo === 'transporte' ? (
                      <>
                        <p>Sale: {formatShortDate(event.fechaSalida)}</p>
                        <p>Llega: {formatShortDate(event.fechaLlegada)}</p>
                      </>
                    ) : (
                      <>
                        <p>In: {formatShortDate(event.checkIn)}</p>
                        <p>Out: {formatShortDate(event.checkOut)}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend & Controls */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 w-full md:w-auto">
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div> Pasado</div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> Futuro</div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Presente</div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div> Tránsito</div>
        </div>

        {setMapTheme && (
          <div className="hidden md:flex bg-slate-950 rounded-lg border border-slate-800 flex-shrink-0">
            <button onClick={() => setMapTheme('dark_all')} className={`p-1.5 rounded-l-lg transition-colors ${mapTheme === 'dark_all' ? 'bg-slate-700 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`} title="Modo Oscuro"><Moon size={14} /></button>
            <button onClick={() => setMapTheme('light_all')} className={`p-1.5 transition-colors border-x border-slate-800 ${mapTheme === 'light_all' ? 'bg-slate-700 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`} title="Modo Claro"><Sun size={14} /></button>
            <button onClick={() => setMapTheme('voyager')} className={`p-1.5 rounded-r-lg transition-colors ${mapTheme === 'voyager' ? 'bg-slate-700 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`} title="Modo Color"><MapIcon size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
