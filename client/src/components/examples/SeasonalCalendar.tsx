import SeasonalCalendar, { CalendarItem } from '../SeasonalCalendar';

const mockCalendar: CalendarItem[] = [
  {
    month: 'March',
    actions: ['Begin early spring monitoring', 'Identify emerging garlic mustard'],
  },
  {
    month: 'April',
    actions: ['Pull garlic mustard before flowering', 'Remove dame\'s rocket seedlings'],
  },
  {
    month: 'May',
    actions: ['Continue pulling flowering invasives', 'Monitor for bush honeysuckle'],
  },
];

export default function SeasonalCalendarExample() {
  return (
    <div className="p-6 max-w-2xl">
      <SeasonalCalendar items={mockCalendar} />
    </div>
  );
}
