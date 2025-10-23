import { useState } from "react";
import SpeciesCard, { Species } from "@/components/SpeciesCard";
import SeasonalCalendar, { CalendarItem } from "@/components/SeasonalCalendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Card } from "@/components/ui/card";

const woodySpecies: Species[] = [
  {
    id: 'w1',
    name: 'Bush Honeysuckle',
    scientificName: 'Lonicera maackii',
    category: 'woody',
    description: 'A dense shrub that crowds out native understory plants and leafs out early in spring, shading native wildflowers.',
    removalMethod: 'Cut stems and apply herbicide to cut surface. Remove small plants by digging out entire root system.',
  },
  {
    id: 'w2',
    name: 'Autumn Olive',
    scientificName: 'Elaeagnus umbellata',
    category: 'woody',
    description: 'A nitrogen-fixing shrub that alters soil chemistry and outcompetes native species.',
    removalMethod: 'Cut and treat stumps with herbicide. Young plants can be hand-pulled when soil is moist.',
  },
];

const herbaceousSpecies: Species[] = [
  {
    id: 'h1',
    name: 'Garlic Mustard',
    scientificName: 'Alliaria petiolata',
    category: 'herbaceous',
    description: 'A biennial herb that invades forest understories, producing chemicals that inhibit native plant growth.',
    removalMethod: 'Pull before flowering (April-May), ensuring entire root is removed. Bag and dispose of flowering plants.',
  },
  {
    id: 'h2',
    name: "Dame's Rocket",
    scientificName: 'Hesperis matronalis',
    category: 'herbaceous',
    description: 'A showy flowering plant often mistaken for native phlox, it spreads rapidly and outcompetes wildflowers.',
    removalMethod: 'Hand-pull before seed set in late spring. Remove entire root to prevent regrowth.',
  },
];

const vineSpecies: Species[] = [
  {
    id: 'v1',
    name: 'Oriental Bittersweet',
    scientificName: 'Celastrus orbiculatus',
    category: 'vine',
    description: 'An aggressive vine that girdles trees and shrubs, eventually killing them.',
    removalMethod: 'Cut vines at base and remove from trees. Treat cut stumps with herbicide to prevent resprouting.',
  },
];

const calendar: CalendarItem[] = [
  {
    month: 'March',
    actions: ['Begin early spring monitoring', 'Identify emerging garlic mustard rosettes', 'Plan removal strategy'],
  },
  {
    month: 'April',
    actions: ['Pull garlic mustard before flowering', "Remove dame's rocket seedlings", 'Cut bush honeysuckle'],
  },
  {
    month: 'May',
    actions: ['Continue pulling flowering invasives', 'Monitor for new autumn olive growth', 'Bag seed-bearing plants'],
  },
  {
    month: 'June',
    actions: ['Cut oriental bittersweet vines', 'Final garlic mustard removal', 'Apply herbicide to woody stumps'],
  },
  {
    month: 'July-Aug',
    actions: ['Monitor for regrowth', 'Remove any missed flowering plants', 'Document cleared areas'],
  },
  {
    month: 'September',
    actions: ['Identify autumn olive berries', 'Plan fall woody removal', 'Prepare tools for cutting season'],
  },
  {
    month: 'October-Nov',
    actions: ['Cut woody invasives before dormancy', 'Treat stumps with herbicide', 'Clear cut material'],
  },
];

export default function EducationPage() {
  const [activeTab, setActiveTab] = useState('woody');

  const { data: settings } = useQuery<{ adminEmail: string }>({
    queryKey: ["/api/settings"],
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {settings?.adminEmail && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Questions? Contact:</span>
              <a 
                href={`mailto:${settings.adminEmail}`} 
                className="font-medium text-primary hover:underline"
                data-testid="link-admin-email"
              >
                {settings.adminEmail}
              </a>
            </div>
          </Card>
        )}
        
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Invasive Species Guide</h1>
          <p className="text-lg text-muted-foreground">
            Learn about invasive species in Southeast Michigan and how to remove them effectively.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="woody" data-testid="tab-woody">Invasive Woody</TabsTrigger>
            <TabsTrigger value="herbaceous" data-testid="tab-herbaceous">Herbaceous</TabsTrigger>
            <TabsTrigger value="vines" data-testid="tab-vines">Vines</TabsTrigger>
          </TabsList>
          
          <TabsContent value="woody" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {woodySpecies.map((species) => (
                <SpeciesCard key={species.id} species={species} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="herbaceous" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {herbaceousSpecies.map((species) => (
                <SpeciesCard key={species.id} species={species} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="vines" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {vineSpecies.map((species) => (
                <SpeciesCard key={species.id} species={species} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-12">
          <SeasonalCalendar items={calendar} />
        </div>
      </div>
    </div>
  );
}
