import { parseISO, isBefore, isAfter, isWithinInterval } from 'date-fns';

export const ESTADOS = {
  PASADO: 'pasado',
  PRESENTE: 'presente',
  FUTURO: 'futuro',
  TRANSITO: 'transito',
};

// Evaluate the state of each event in the itinerary
export function evaluateItineraryState(itinerary, now = new Date()) {
  let currentState = {
    event: null,
    status: 'No iniciado',
    statusType: ESTADOS.FUTURO,
  };

  const processedEvents = itinerary.map((event, index) => {
    let state = ESTADOS.FUTURO;
    let isActive = false;

    if (event.tipo === 'transporte') {
      const start = parseISO(event.fechaSalida);
      const end = parseISO(event.fechaLlegada);

      if (isAfter(now, end)) {
        state = ESTADOS.PASADO;
      } else if (isBefore(now, start)) {
        state = ESTADOS.FUTURO;
      } else {
        state = ESTADOS.PRESENTE;
        isActive = true;
      }
    } else if (event.tipo === 'estadia') {
      const start = parseISO(event.checkIn);
      const end = parseISO(event.checkOut);

      if (isAfter(now, end)) {
        state = ESTADOS.PASADO;
      } else if (isBefore(now, start)) {
        state = ESTADOS.FUTURO;
      } else {
        state = ESTADOS.PRESENTE;
        isActive = true;
      }
    }

    const processed = { ...event, state, isActive };

    if (isActive) {
      currentState = {
        event: processed,
        statusType: ESTADOS.PRESENTE,
        status:
          event.tipo === 'estadia'
            ? `Estás en ${event.ciudad} — ${event.hotel}`
            : `En tránsito: ${event.origen.nombre} → ${event.destino.nombre}`,
      };
    }

    return processed;
  });

  // Mark the first future event as 'isProximo'
  let foundProximo = false;
  const eventsWithProximo = processedEvents.map(ev => {
    if (ev.state === ESTADOS.FUTURO && !foundProximo) {
      foundProximo = true;
      return { ...ev, isProximo: true };
    }
    return { ...ev, isProximo: false };
  });

  // Check for 'En Tránsito' (gaps)
  if (!currentState.event) {
    let lastPastEvent = null;
    let nextFutureEvent = null;

    for (let i = 0; i < eventsWithProximo.length; i++) {
      if (eventsWithProximo[i].state === ESTADOS.PASADO) {
        lastPastEvent = eventsWithProximo[i];
      }
      if (eventsWithProximo[i].state === ESTADOS.FUTURO) {
        nextFutureEvent = eventsWithProximo[i];
        break;
      }
    }

    if (lastPastEvent && nextFutureEvent) {
      currentState = {
        event: {
            ...lastPastEvent, // Use the destination of the last event
            isGap: true,
            nextEvent: nextFutureEvent
        },
        statusType: ESTADOS.TRANSITO,
        status: `En tránsito en ${lastPastEvent.tipo === 'transporte' ? lastPastEvent.destino.nombre : lastPastEvent.ciudad}. Próximo: ${nextFutureEvent.tipo === 'transporte' ? 'Vuelo' : 'Check-in'} a las ${new Date(nextFutureEvent.tipo === 'transporte' ? nextFutureEvent.fechaSalida : nextFutureEvent.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
      };
      
      // Mark the gap conceptually by modifying the last event or adding a state flag (for UI purposes)
      lastPastEvent.isTransitPoint = true;
    } else if (!lastPastEvent && nextFutureEvent) {
       currentState = {
        event: null,
        statusType: ESTADOS.FUTURO,
        status: `Viaje no iniciado. Próximo: ${nextFutureEvent.tipo === 'transporte' ? 'Viaje' : 'Check-in'} el ${new Date(nextFutureEvent.tipo === 'transporte' ? nextFutureEvent.fechaSalida : nextFutureEvent.checkIn).toLocaleDateString()}`
       }
    } else if (lastPastEvent && !nextFutureEvent) {
        currentState = {
            event: null,
            statusType: ESTADOS.PASADO,
            status: '✅ Viaje completado. ¡Buen regreso!'
        }
    }
  }

  return { events: eventsWithProximo, currentState };
}

export function getColorForState(state) {
  switch (state) {
    case ESTADOS.PASADO:
      return '#9ca3af'; // gray-400
    case ESTADOS.FUTURO:
      return '#3b82f6'; // blue-500
    case ESTADOS.PRESENTE:
      return '#10b981'; // emerald-500
    case ESTADOS.TRANSITO:
      return '#f59e0b'; // amber-500
    default:
      return '#64748b'; // slate-500
  }
}
