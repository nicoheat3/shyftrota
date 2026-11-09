// Spanish for the employee side of ShyftRota.
//
// t("English text") returns the Spanish version when the person picked
// Español in Settings, otherwise the English text unchanged. Anything not in
// the list below stays in English, so a missing line never breaks a screen.
// The choice is saved per phone (localStorage "sr_lang").
//
// To add or fix a translation: add a line to ES below. Keep the English key
// exactly as it appears in the app.

var LANG = "en";
try { LANG = localStorage.getItem("sr_lang") === "es" ? "es" : "en"; } catch (e) {}

export function getLang() { return LANG; }
export function setLang(l) {
  LANG = l === "es" ? "es" : "en";
  try { localStorage.setItem("sr_lang", LANG); } catch (e) {}
  try { document.documentElement.lang = LANG; } catch (e) {}
}
export function t(s) {
  if (LANG !== "es" || s == null) return s;
  var v = ES[s];
  return v == null ? s : v;
}
// "Mon" -> "Lun" (display only; data keeps English day names)
export function tDay(d) { return t(d); }

var ES = {
  // Navigation
  "My Schedule": "Mi horario",
  "Who's Working": "Quién trabaja",
  "Open Shifts": "Turnos abiertos",
  "Time Off": "Tiempo libre",
  "Shift Swap": "Cambio de turno",
  "Call In": "Avisar ausencia",
  "Clock In": "Marcar entrada",
  "Team Chat": "Chat del equipo",
  "Settings": "Ajustes",
  "Hi": "Hola",
  "Schedule": "Horario",
  "Requests": "Solicitudes",
  "Chat": "Chat",
  "Time off": "Tiempo libre",
  "Call in": "Ausencia",

  // Days
  "Mon": "Lun", "Tue": "Mar", "Wed": "Mié", "Thu": "Jue", "Fri": "Vie", "Sat": "Sáb", "Sun": "Dom",
  "Today": "Hoy",

  // My Schedule
  "NEXT SHIFT": "PRÓXIMO TURNO",
  "ON SHIFT": "EN TURNO",
  "ON NOW": "AHORA",
  "IN ": "EN ",
  "Next shift": "Próximo turno",
  "No more shifts this week": "No hay más turnos esta semana",
  "No schedule found.": "No se encontró horario.",
  "Not scheduled": "Sin turno",
  "Off": "Libre",
  "Hours this week": "Horas esta semana",
  "hrs paid": "h pagadas",
  "On with": "Con",
  "You are clocked in. Have a great shift!": "Ya marcaste entrada. ¡Que tengas un buen turno!",
  "Remember to clock in!": "¡No olvides marcar entrada!",
  "clock in now!": "¡marca entrada ya!",
  "Not posted yet": "Aún no publicado",
  "Your manager is still working on": "Tu gerente todavía está preparando",
  "this week": "esta semana",
  "It'll show up here once it's posted.": "Aparecerá aquí cuando lo publique.",
  "Add shifts to your calendar": "Agrega tus turnos a tu calendario",
  "Your posted shifts show up in your phone's calendar and update on their own.": "Tus turnos publicados aparecen en el calendario de tu teléfono y se actualizan solos.",
  "Set up": "Configurar",
  "Getting your link…": "Obteniendo tu enlace…",
  "Couldn't get your calendar link. Check your connection and try again.": "No se pudo obtener tu enlace. Revisa tu conexión e inténtalo de nuevo.",
  "Apple Calendar": "Calendario de Apple",
  "Google Calendar": "Google Calendar",
  "Copy link": "Copiar enlace",
  "Copied": "Copiado",
  "Apple opens Calendar and asks to subscribe. Google opens in your browser; tap Add. Calendars check for changes every hour or so (Google can take longer). Only posted weeks show, and days off are left out.": "Apple abre Calendario y pide suscribirte. Google se abre en tu navegador; toca Agregar. Los calendarios buscan cambios más o menos cada hora (Google puede tardar más). Solo aparecen las semanas publicadas y se omiten tus días libres.",
  "This link is private to you; anyone with it can see your shifts.": "Este enlace es privado; cualquiera que lo tenga puede ver tus turnos.",
  "Reset link": "Restablecer enlace",
  "Tap again to reset (old link stops working)": "Toca otra vez para restablecer (el enlace anterior dejará de funcionar)",

  // Who's working
  "Who's working today": "Quién trabaja hoy",
  "Your team": "Tu equipo",
  "You haven't been assigned to a department yet. Ask your admin to set this up in the Departments tab.": "Aún no tienes departamento asignado. Pídele a tu administrador que lo configure.",
  "Day": "Día",

  // Open shifts
  "Pick up available shifts posted by your manager": "Toma turnos disponibles publicados por tu gerente",
  "No open shifts available right now": "No hay turnos abiertos por ahora",
  "Claim this shift": "Tomar este turno",
  "My Claimed Shifts": "Turnos que tomé",
  "Shift claimed - awaiting approval": "Turno tomado: esperando aprobación",
  "Someone already claimed that shift": "Alguien ya tomó ese turno",
  "Couldn't claim — check connection": "No se pudo tomar: revisa tu conexión",
  "Open": "Abierto",
  "Awaiting approval": "Esperando aprobación",
  "Filled": "Cubierto",
  "Note": "Nota",

  // Time off
  "Request vacation, sick days, or personal time": "Pide vacaciones, días por enfermedad o tiempo personal",
  "New Request": "Nueva solicitud",
  "Request type": "Tipo de solicitud",
  "Start date": "Fecha de inicio",
  "Select start date": "Elige la fecha de inicio",
  "End date (optional)": "Fecha final (opcional)",
  "Same as start": "Igual que el inicio",
  "Reason (optional)": "Motivo (opcional)",
  "Any details...": "Algún detalle...",
  "Submit Request": "Enviar solicitud",
  "Your Requests": "Tus solicitudes",
  "No requests yet": "Aún no hay solicitudes",
  "Time-off request submitted": "Solicitud de tiempo libre enviada",
  "Vacation": "Vacaciones",
  "Sick Day": "Día por enfermedad",
  "Personal": "Personal",
  "Unpaid Leave": "Permiso sin goce de sueldo",
  "Other": "Otro",

  // Swap
  "Request a swap with a colleague": "Pide un cambio con un compañero",
  "Swap with": "Cambiar con",
  "Select a colleague...": "Elige un compañero...",
  "Your current shift — this is what you're swapping": "Tu turno actual: esto es lo que vas a cambiar",
  "You would take this shift": "Tú tomarías este turno",
  "shift on": "turno el",
  "has no shift on": "no tiene turno el",
  "Their": "Su",
  "They": "Esa persona",
  "No shift scheduled": "Sin turno programado",
  "Swap": "Cambio",
  "Swap request submitted": "Solicitud de cambio enviada",

  // Call in
  "Notify your manager if you will be absent, late, or leaving early.": "Avísale a tu gerente si vas a faltar, llegar tarde o salir temprano.",
  "Attendance Notice": "Aviso de asistencia",
  "Type": "Tipo",
  "Note for manager": "Nota para tu gerente",
  "Let your manager know what's happening...": "Cuéntale a tu gerente qué pasa...",
  "Send Notice": "Enviar aviso",
  "Your Recent Notices": "Tus avisos recientes",
  "Attendance notice submitted": "Aviso enviado",
  "Absent": "Ausente",
  "Running Late": "Llegaré tarde",
  "Leaving Early": "Saldré temprano",
  "Can't make it": "No puedo ir",
  "Acknowledged": "Recibido",
  "Pending": "Pendiente",

  // Clock in
  "Clock In / Out": "Entrada / salida",
  "Track your hours for payroll": "Registra tus horas para la nómina",
  "Today's Shift": "Turno de hoy",
  "No shift scheduled today": "Hoy no tienes turno",
  "Clocked In": "Entrada marcada",
  "Not Clocked In": "Sin marcar entrada",
  "On Lunch": "En almuerzo",
  "Clock Out": "Marcar salida",
  "Lunch Out": "Salir a almorzar",
  "Back From Lunch": "Volver del almuerzo",
  "Today's punches": "Marcas de hoy",
  "Clocked in! Have a great shift.": "¡Entrada marcada! Que tengas un buen turno.",
  "Clocked out! See you next time.": "¡Salida marcada! Hasta la próxima.",
  "Lunch started - enjoy your break!": "Almuerzo iniciado: ¡disfruta tu descanso!",
  "Back from lunch!": "¡De vuelta del almuerzo!",
  "worked": "trabajado",

  // Statuses
  "pending": "pendiente",
  "approved": "aprobada",
  "Declined": "Rechazada",
  "Expired": "Vencida",
  "Cancelled": "Cancelada",

  // Settings
  "Language": "Idioma",
  "Changes the employee screens on this phone.": "Cambia las pantallas de empleado en este teléfono.",
};
