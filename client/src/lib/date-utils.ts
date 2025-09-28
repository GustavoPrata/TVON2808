import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistance, isToday, isYesterday, isThisWeek, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

/**
 * Converte um timestamp UTC para o horário de Brasília e formata
 * @param date - Data em formato string ISO ou Date object
 * @param formatString - String de formatação (ex: 'HH:mm', 'dd/MM/yyyy HH:mm')
 * @returns String formatada no horário de Brasília
 */
export function formatInBrazilTime(date: string | Date, formatString: string = 'HH:mm'): string {
  try {
    // Parse the date
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Format directly in Brazil timezone
    return formatInTimeZone(dateObj, BRAZIL_TIMEZONE, formatString, { locale: ptBR });
  } catch (error) {
    console.error('Error formatting date in Brazil time:', error);
    // Fallback to basic formatting
    return dateFnsFormat(new Date(date), formatString, { locale: ptBR });
  }
}

/**
 * Formata tempo relativo (ex: "há 2 minutos") no horário de Brasília
 * @param date - Data em formato string ISO ou Date object
 * @returns String formatada como tempo relativo
 */
export function formatDistanceInBrazilTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const brazilDate = toZonedTime(dateObj, BRAZIL_TIMEZONE);
    
    return dateFnsFormatDistance(brazilDate, {
      addSuffix: true,
      locale: ptBR
    });
  } catch (error) {
    console.error('Error formatting distance in Brazil time:', error);
    return dateFnsFormatDistance(new Date(date), {
      addSuffix: true,
      locale: ptBR
    });
  }
}

/**
 * Retorna apenas o horário no formato HH:mm no horário de Brasília
 * @param date - Data em formato string ISO ou Date object
 * @returns String no formato HH:mm
 */
export function formatTimeInBrazil(date: string | Date): string {
  return formatInBrazilTime(date, 'HH:mm');
}

/**
 * Retorna data e hora completas no formato brasileiro
 * @param date - Data em formato string ISO ou Date object  
 * @returns String no formato dd/MM/yyyy HH:mm
 */
export function formatDateTimeInBrazil(date: string | Date): string {
  return formatInBrazilTime(date, 'dd/MM/yyyy HH:mm');
}

/**
 * Retorna apenas a data no formato brasileiro
 * @param date - Data em formato string ISO ou Date object
 * @returns String no formato dd/MM/yyyy
 */
export function formatDateInBrazil(date: string | Date): string {
  return formatInBrazilTime(date, 'dd/MM/yyyy');
}

/**
 * Formata para exibição curta (horário se hoje, data se outro dia)
 * @param date - Data em formato string ISO ou Date object
 * @returns String formatada
 */
export function formatShortInBrazil(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const brazilDate = toZonedTime(dateObj, BRAZIL_TIMEZONE);
    const now = toZonedTime(new Date(), BRAZIL_TIMEZONE);
    
    // Se é hoje, mostra apenas o horário
    if (isToday(brazilDate)) {
      return formatTimeInBrazil(date);
    }
    
    // Se foi ontem, mostra "ontem"
    if (isYesterday(brazilDate)) {
      return `ontem ${formatTimeInBrazil(date)}`;
    }
    
    // Calcula a diferença em dias
    const diffInMs = now.getTime() - brazilDate.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    // Se está dentro de 6 dias anteriores, mostra o nome do dia (sem "feira")
    if (diffInDays <= 6 && diffInDays >= 0) {
      const dayName = dateFnsFormat(brazilDate, 'EEEE', { locale: ptBR });
      // Remove "-feira" do nome do dia
      const shortDayName = dayName.replace('-feira', '');
      return `${shortDayName} ${formatTimeInBrazil(date)}`;
    }
    
    // Para datas com mais de 6 dias, mostra o formato dd/MM
    return formatInBrazilTime(date, 'dd/MM HH:mm');
  } catch (error) {
    console.error('Error formatting short date in Brazil time:', error);
    return formatTimeInBrazil(date);
  }
}