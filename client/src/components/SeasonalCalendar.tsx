import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface CalendarItem {
  month: string;
  actions: string[];
}

interface SeasonalCalendarProps {
  items: CalendarItem[];
}

export default function SeasonalCalendar({ items }: SeasonalCalendarProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">Seasonal Action Calendar</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="flex gap-4" data-testid={`calendar-item-${index}`}>
              <Badge variant="outline" className="shrink-0 h-fit">
                {item.month}
              </Badge>
              <div className="flex-1">
                <ul className="space-y-1">
                  {item.actions.map((action, actionIndex) => (
                    <li key={actionIndex} className="text-sm text-muted-foreground">
                      • {action}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
