# Park Neighbor Survey Application - Design Guidelines

## Design Approach

**Selected Approach**: Design System with Nature-Inspired Customization  
**Rationale**: Utility-focused civic tool requiring clarity and accessibility, enhanced with environmental branding appropriate for a park stewardship application.  
**Key Principles**: 
- Environmental stewardship visual identity
- Data clarity for map-based interactions
- Accessible community tool design
- Trust-building through professional presentation

---

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Primary: 142 45% 35% (Forest Green - representing healthy ecosystems)
- Secondary: 158 55% 25% (Deep Teal - water and wetlands)
- Background: 0 0% 98% (Soft white)
- Surface: 0 0% 100% (Pure white)
- Text Primary: 0 0% 15%
- Text Secondary: 0 0% 40%
- Success (Light Green - Q1 only): 110 50% 75%
- Success Strong (Forest Green - Q1+Q2): 142 45% 35%
- Border: 0 0% 88%

**Dark Mode:**
- Primary: 142 40% 50%
- Secondary: 158 45% 40%
- Background: 0 0% 10%
- Surface: 0 0% 14%
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 70%
- Border: 0 0% 25%

### B. Typography

**Font Families:**
- Primary: 'Inter' (Google Fonts) - Clean, highly legible for data and forms
- Accent: 'Merriweather' (Google Fonts) - For educational content and headings

**Type Scale:**
- Hero/Display: text-5xl font-bold (Merriweather)
- Section Headers: text-3xl font-semibold (Merriweather)
- Page Titles: text-2xl font-semibold (Inter)
- Body: text-base font-normal (Inter)
- Captions/Labels: text-sm font-medium (Inter)
- Map UI: text-xs to text-sm font-medium (Inter)

### C. Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24  
- Component padding: p-4 to p-8
- Section spacing: py-12 to py-20
- Card spacing: p-6
- Form elements: gap-4 to gap-6
- Map controls: p-2 to p-4

**Container Strategy:**
- Map page: Full viewport with sidebar (w-80 to w-96)
- Survey forms: max-w-2xl centered
- Educational content: max-w-4xl
- Admin dashboard: Full width with max-w-7xl

### D. Component Library

**Map Interface:**
- Primary canvas: Full viewport Leaflet map with parcel overlays
- Parcel states: Default (neutral gray), Light Green (Q1 yes), Forest Green (Q1+Q2 yes), Compost icon overlay (Q3 yes)
- Map controls: Zoom buttons, layer toggle, legend in bottom-right corner
- Hover states: Parcel highlight with subtle border glow and info popup

**Navigation:**
- Top header: Sticky with logo (leaf icon + "Molin Nature Area Survey"), navigation links, subtle shadow on scroll
- Mobile: Hamburger menu with slide-in drawer

**Survey Form:**
- Card-based layout with elevation shadow
- Question cards: Numbered headers, radio buttons (Yes/No), textarea for comments
- Progress indicator: Subtle bar showing completion
- Submit button: Full-width primary color with icon

**Admin Dashboard:**
- Data table: Striped rows, sortable columns (Parcel ID, Code Phrase, Status, Response Date)
- Status indicators: Color-coded badges matching map colors
- Search/filter: Top bar with input field and dropdown filters

**Educational Page:**
- Species cards: Grid layout (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Each card: Species image placeholder, name, category badge, description
- Seasonal calendar: Horizontal timeline with month markers and action items

### E. Iconography

Use **Heroicons** (outline style) via CDN:
- Navigation: Bars3Icon, MapIcon, DocumentTextIcon, AcademicCapIcon
- Map: MapPinIcon, CheckCircleIcon, CompostBinIcon (custom SVG for compost)
- Forms: CheckIcon, XMarkIcon, ChatBubbleLeftIcon
- Admin: ClipboardDocumentListIcon, MagnifyingGlassIcon, FunnelIcon

### F. Interactive Elements

**Code Phrase Entry:**
- Nature-themed phrases displayed in monospace font on gray background
- Entry validation with immediate feedback (green checkmark or error state)
- Example phrases: "Woodland Trillium Bloom", "Oak Savanna Restoration"

**Map Interactions:**
- Click parcel: Show info popup with address and survey status
- Hover: Subtle scale transform and border highlight
- Zoom controls: Material-style circular buttons with icons

**Form Validation:**
- Inline validation with green checkmarks for valid inputs
- Error messages in red with icon indicators
- Disabled submit until all required fields complete

---

## Page-Specific Guidelines

### Public Map View
- Centered map taking 70% viewport width, sidebar with survey status legend
- Sticky header with minimal height (h-16)
- Floating legend card in bottom-right with transparent background blur

### Survey Entry Page
- Centered card (max-w-2xl) with generous padding (p-8)
- Two-step process: Code entry → Survey questions
- Progress breadcrumbs at top
- Environmental background: Subtle leaf pattern or texture at 5% opacity

### Admin Dashboard
- Split layout: Table on left (65%), details panel on right (35%)
- Export functionality with download icon button
- Code phrase displayed in copyable format with click-to-copy

### Educational Resources
- Hero section with nature photography (tall grass prairie or oak forest)
- Tabbed interface: "Invasive Woody" | "Herbaceous" | "Vines"
- Seasonal calendar as horizontal scrollable timeline below species cards
- Action items displayed as timeline events with month badges

---

## Images

**Hero Image**: Yes - Educational page only  
Nature photography of Southeast Michigan ecosystem (oak savanna, prairie, or forest understory). High-quality, wide aspect ratio (21:9), with subtle overlay gradient for text readability.

**Species Cards**: Placeholder images (400x300px) for each invasive species, showing plant identification details. Use subtle border and shadow for card elevation.

**Map Background**: OpenStreetMap or similar tiles with muted color scheme to keep parcel overlays prominent.