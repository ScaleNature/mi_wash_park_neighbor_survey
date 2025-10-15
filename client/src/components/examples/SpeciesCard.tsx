import SpeciesCard, { Species } from '../SpeciesCard';

const mockSpecies: Species = {
  id: '1',
  name: 'Garlic Mustard',
  scientificName: 'Alliaria petiolata',
  category: 'herbaceous',
  description: 'A biennial herb that invades forest understories, producing chemicals that inhibit native plant growth.',
  removalMethod: 'Pull before flowering (April-May), ensuring entire root is removed. Bag and dispose of flowering plants.',
};

export default function SpeciesCardExample() {
  return (
    <div className="p-6 max-w-sm">
      <SpeciesCard species={mockSpecies} />
    </div>
  );
}
