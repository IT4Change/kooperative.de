<template>
  <div>
    <!-- View Toggle -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-2">
        <button
          type="button"
          :class="[
            'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
            viewMode === 'calendar'
              ? 'bg-primary-700 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ]"
          @click="viewMode = 'calendar'"
        >
          Kalender
        </button>
        <button
          type="button"
          :class="[
            'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
            viewMode === 'list'
              ? 'bg-primary-700 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ]"
          @click="viewMode = 'list'"
        >
          Liste
        </button>
      </div>
    </div>

    <!-- Calendar View -->
    <div v-if="viewMode === 'calendar'">
      <!-- Calendar Navigation -->
      <div class="flex items-center justify-between mb-4">
        <button
          type="button"
          class="inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Vorheriger Monat"
          @click="prevMonth"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div class="flex items-center gap-3">
          <h2 class="text-xl font-serif font-bold text-gray-900">
            {{ monthNames[currentMonth] }} {{ currentYear }}
          </h2>
          <button
            type="button"
            class="text-xs px-2 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors font-medium"
            @click="goToToday"
          >
            Heute
          </button>
        </div>

        <button
          type="button"
          class="inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Nächster Monat"
          @click="nextMonth"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <!-- Weekday Headers -->
      <div class="grid grid-cols-7 mb-1">
        <div
          v-for="dayName in dayNames"
          :key="dayName"
          class="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider py-2"
        >
          {{ dayName }}
        </div>
      </div>

      <!-- Calendar Grid -->
      <div class="grid grid-cols-7 border-t border-l border-gray-200">
        <button
          v-for="(day, index) in calendarDays"
          :key="index"
          type="button"
          :class="[
            'relative min-h-[4rem] md:min-h-[5rem] p-1 md:p-2 border-r border-b border-gray-200 text-left transition-colors',
            day.isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 text-gray-400',
            day.isToday && 'ring-2 ring-inset ring-primary-500',
            selectedDate && day.date === selectedDate && 'bg-primary-50',
          ]"
          @click="selectDate(day)"
        >
          <span
            :class="[
              'inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-full text-xs md:text-sm font-medium',
              day.isToday && 'bg-primary-700 text-white',
            ]"
          >
            {{ day.dayNumber }}
          </span>

          <!-- Event dots -->
          <div v-if="day.events.length > 0" class="flex flex-wrap gap-0.5 mt-1">
            <span
              v-for="(evt, i) in day.events.slice(0, 3)"
              :key="i"
              class="w-1.5 h-1.5 rounded-full bg-primary-500"
              :title="evt.title"
            />
            <span
              v-if="day.events.length > 3"
              class="text-[10px] text-gray-400 leading-none"
            >
              +{{ day.events.length - 3 }}
            </span>
          </div>

          <!-- Event titles (visible on larger screens) -->
          <div class="hidden md:block mt-0.5 space-y-0.5 overflow-hidden">
            <div
              v-for="(evt, i) in day.events.slice(0, 2)"
              :key="i"
              class="text-[10px] leading-tight text-primary-700 bg-primary-50 rounded px-1 py-0.5 truncate"
            >
              {{ evt.title }}
            </div>
            <div
              v-if="day.events.length > 2"
              class="text-[10px] text-gray-400"
            >
              +{{ day.events.length - 2 }} weitere
            </div>
          </div>
        </button>
      </div>

      <!-- Selected Day Events -->
      <div v-if="selectedDate && selectedDayEvents.length > 0" class="mt-6">
        <h3 class="text-lg font-serif font-bold text-gray-900 mb-3">
          Veranstaltungen am {{ formatGermanDate(selectedDate) }}
        </h3>
        <div class="space-y-3">
          <div
            v-for="event in selectedDayEvents"
            :key="event.title"
            class="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-primary-300 transition-colors"
          >
            <div class="shrink-0 w-1 h-full min-h-[3rem] rounded-full bg-primary-500" />
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-gray-900">{{ event.title }}</h4>
              <p v-if="event.time" class="text-sm text-gray-500 mt-0.5">
                {{ event.time }} Uhr
              </p>
              <p v-if="event.location" class="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                {{ event.location }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="selectedDate && selectedDayEvents.length === 0" class="mt-6 text-center py-6 text-gray-400 text-sm">
        Keine Veranstaltungen an diesem Tag.
      </div>
    </div>

    <!-- List View -->
    <div v-else>
      <div v-if="sortedEvents.length > 0" class="space-y-4">
        <div
          v-for="event in sortedEvents"
          :key="event.title + event.startDate"
          class="flex items-start gap-4 p-4 md:p-5 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-primary-300 transition-all duration-200"
        >
          <div class="shrink-0 w-14 text-center">
            <div class="text-2xl font-bold text-primary-700 leading-none">
              {{ new Date(event.startDate).getDate() }}
            </div>
            <div class="text-xs text-gray-500 uppercase mt-1">
              {{ shortMonthNames[new Date(event.startDate).getMonth()] }}
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <h3 class="font-serif font-bold text-gray-900 mb-1">{{ event.title }}</h3>

            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              <span v-if="getEventTime(event.startDate)" class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                {{ getEventTime(event.startDate) }} Uhr
              </span>
              <span v-if="event.location" class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                {{ event.location }}
              </span>
            </div>

            <p v-if="event.description" class="text-sm text-gray-600 mt-2 line-clamp-2">
              {{ event.description }}
            </p>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-16">
        <svg class="mx-auto w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
        <p class="text-gray-500 text-lg">Keine Veranstaltungen gefunden</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface CalendarEvent {
  title: string;
  slug: string;
  description: string;
  startDate: string;
  endDate?: string;
  location?: string;
  image?: { url: string };
  section?: { name: string; slug: string };
}

interface CalendarDay {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

const props = defineProps<{
  events: string;
}>();

const parsedEvents = computed<CalendarEvent[]>(() => {
  try {
    return JSON.parse(props.events);
  } catch {
    return [];
  }
});

const viewMode = ref<'calendar' | 'list'>('calendar');

const today = new Date();
const currentMonth = ref(today.getMonth());
const currentYear = ref(today.getFullYear());
const selectedDate = ref<string | null>(null);

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const shortMonthNames = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayKey(): string {
  return toDateKey(today);
}

const eventsByDate = computed(() => {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of parsedEvents.value) {
    const startDate = new Date(event.startDate);
    const endDate = event.endDate ? new Date(event.endDate) : startDate;

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      const key = toDateKey(current);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
      current.setDate(current.getDate() + 1);
    }
  }
  return map;
});

const calendarDays = computed<CalendarDay[]>(() => {
  const year = currentYear.value;
  const month = currentMonth.value;

  const firstDay = new Date(year, month, 1);
  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: CalendarDay[] = [];
  const todayStr = todayKey();

  // Previous month fill
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const date = new Date(year, month - 1, d);
    const key = toDateKey(date);
    days.push({
      date: key,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: key === todayStr,
      events: eventsByDate.value.get(key) || [],
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = toDateKey(date);
    days.push({
      date: key,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: key === todayStr,
      events: eventsByDate.value.get(key) || [],
    });
  }

  // Next month fill
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      const key = toDateKey(date);
      days.push({
        date: key,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: key === todayStr,
        events: eventsByDate.value.get(key) || [],
      });
    }
  }

  return days;
});

const selectedDayEvents = computed(() => {
  if (!selectedDate.value) return [];
  return eventsByDate.value.get(selectedDate.value) || [];
});

const sortedEvents = computed(() => {
  return [...parsedEvents.value].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
});

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
  selectedDate.value = null;
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
  selectedDate.value = null;
}

function goToToday() {
  currentMonth.value = today.getMonth();
  currentYear.value = today.getFullYear();
  selectedDate.value = todayKey();
}

function selectDate(day: CalendarDay) {
  selectedDate.value = day.date;
}

function formatGermanDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getEventTime(isoDate: string): string | null {
  const d = new Date(isoDate);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  if (hours === 0 && minutes === 0) return null;
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
</script>
