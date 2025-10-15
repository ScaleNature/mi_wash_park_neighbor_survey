import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface Species {
  id: string;
  name: string;
  scientificName: string;
  category: 'woody' | 'herbaceous' | 'vine';
  description: string;
  removalMethod: string;
}

interface SpeciesCardProps {
  species: Species;
}

export default function SpeciesCard({ species }: SpeciesCardProps) {
  const categoryColors = {
    woody: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    herbaceous: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    vine: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <Card className="h-full" data-testid={`card-species-${species.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{species.name}</CardTitle>
          <Badge variant="outline" className={categoryColors[species.category]}>
            {species.category}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground italic">{species.scientificName}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{species.description}</p>
        <div>
          <p className="text-sm font-semibold text-primary">Removal Method:</p>
          <p className="text-sm text-muted-foreground">{species.removalMethod}</p>
        </div>
      </CardContent>
    </Card>
  );
}
