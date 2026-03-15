import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';

// ─── Categorised sample prompts (matching legacy) ───────────────────────────

const SAMPLE_CATEGORIES = {
  new: {
    "Classic & Heritage": [
      { title: "Gulf Racing", prompt: "Gulf Racing heritage livery — pale powder blue base with broad burnt orange stripe across the hood and flanks, white roundels, period-correct Gulf logo placement, thin pinstripe border between colours" },
      { title: "Martini Racing", prompt: "Martini Racing tribute — white base, narrow red and dark blue tricolour bands running horizontally across the mid-body, Martini wordmark in elegant script along the sill" },
      { title: "John Player Special", prompt: "John Player Special homage — gloss black body, gold coachline accent along the beltline, subtle gold houndstooth texture on the hood, minimalist number treatment in gold" },
      { title: "Rothmans Rally", prompt: "Rothmans rally tribute — white upper body transitioning to dark navy lower, bold red block lettering, geometric blue accent stripe, clean official-sponsor aesthetic" },
      { title: "Jägermeister Orange", prompt: "Jägermeister racing tribute — bright tangerine orange body, bold white number on black roundel, deer head emblem on the door, clean 1970s touring car feel" },
      { title: "Castrol Rally", prompt: "Castrol rally livery — white base, bold red and green diagonal stripes across the mid-section, large Castrol shield logo on the door, clean professional rally aesthetic" },
      { title: "Porsche Pink Pig", prompt: "Porsche Pink Pig tribute — pastel pink body with butcher shop diagram lines showing meat cuts drawn across panels in dark pink, whimsical retro 1971 Le Mans aesthetic, number 23" },
      { title: "BMW Art Car", prompt: "BMW Art Car inspired — white base with bold multicoloured geometric paint splashes and abstract shapes across all panels, art gallery meets motorsport, Alexander Calder style" },
    ],
    "Modern Motorsport": [
      { title: "Neon Cyberpunk", prompt: "Aggressive black-to-carbon fade base, electric cyan accent stripe that traces the entire aero line from front splitter through door to rear diffuser, cyan glow-effect number" },
      { title: "Crimson Assault", prompt: "Deep crimson primary colour with aggressive angular white graphic cutting across both doors, matte black roof and hood, contrasting brushed-aluminium mirror caps" },
      { title: "Electric Storm", prompt: "Vibrant electric blue with a sweeping white chevron originating at the nose and fanning out across the roof and rear quarter, hi-vis yellow safety accents on the bumpers" },
      { title: "Split Contrast", prompt: "Two-tone split livery — gloss white upper half, gloss obsidian black lower half, separated by a razor-thin red pinstripe along the waistline, number in red on white door" },
      { title: "Circuit Board", prompt: "Matte dark grey body covered in subtle PCB trace patterns in metallic silver, LED-green accent highlights along aero edges, futuristic tech sponsor aesthetic" },
      { title: "Hyper GT", prompt: "Metallic pearl white body with holographic chrome accent panels on the lower sills and rear quarter, ultra-modern angular graphics in dark grey, premium hypercar feel" },
      { title: "Night Attack", prompt: "Satin black body with matte dark red geometric shards exploding from the rear quarter forward, as if the car is shattering through glass, aggressive motorsport energy" },
      { title: "Arctic Warfare", prompt: "White and pale ice blue dazzle camouflage pattern across the entire body, dark navy number panels, military precision meets motorsport, clean sharp edges" },
    ],
    "Elegant & Minimalist": [
      { title: "Midnight Silver", prompt: "Matte midnight blue body with a single broad silver metallic band sweeping rearward from the front splitter, polished-metal detailing on mirrors and spoiler, no sponsor clutter" },
      { title: "Carbon Champagne", prompt: "Satin graphite base coat with a subtle carbon-weave texture overlay on the hood and roof, champagne gold pinstripe outlining the door seams, understated race number in ivory" },
      { title: "Stealth Shadow", prompt: "Monochromatic gloss black with deep gunmetal grey graphic panels on the doors, ghost watermark of a circuit map in the background, minimal white number in a clean sans-serif" },
      { title: "Brooklands Green", prompt: "British Racing Green with a thin gold coachline running the full length of the car, cream race numbers on black roundels, classic Brooklands-era feel" },
      { title: "Monochrome Class", prompt: "Pure white body with a single thin black horizontal pinstripe at waistline height, race number in a refined serif font on the door, less is more racing elegance" },
      { title: "Gentleman Racer", prompt: "Deep burgundy body with tan leather-look accents on the roof and mirror caps, gold wire-wheel motif on the door, vintage gentleman racer aesthetic, number in cream" },
    ],
    "National Racing Colours": [
      { title: "Italian Tricolore", prompt: "Italian tricolore-inspired — verde hood into bianco mid-section into rosso rear quarter, subtle fade transitions, race number in classic gold on black shield" },
      { title: "Japanese Hinomaru", prompt: "Japanese racing white — clean white body with a single large red hinomaru on each door, red front bumper lip, minimal black detailing, purposeful and uncluttered" },
      { title: "German Silver Arrow", prompt: "German racing silver — brushed aluminium silver effect overall, eagle emblem watermark faint on the hood, black number panels, purposeful Motorsport pedigree aesthetic" },
      { title: "French Bleu", prompt: "French racing blue — deep Bleu de France body, white racing stripe from hood to tail, red accent on the wing mirrors, tricolore cockade emblem on the rear quarter" },
      { title: "American Stars", prompt: "American racing — navy blue body with broad white and red longitudinal stripes from nose to tail, star motif on the roof, patriotic but tasteful motorsport aesthetic" },
      { title: "Australian Gold", prompt: "Australian racing — dark green body with vivid gold kangaroo emblems on each door, gold accent stripes along the sill, Southern Cross constellation on the roof in white" },
    ],
    "Creative & Artsy": [
      { title: "Tuxedo", prompt: "Tuxedo livery — gloss white front half transitioning sharply to gloss black from the B-pillar rearward, bow-tie motif on the roof in silver foil effect, white number on black door" },
      { title: "Chequered Fade", prompt: "Chequered flag fade — white body with a large chequered flag graphic fading out from the rear quarter forward, becoming a ghost pattern towards the nose, bold black race number" },
      { title: "Sunset Gradient", prompt: "Sunset gradient — fiery deep orange at the nose softly blending through amber and coral to dusky violet at the rear, metallic flake finish, white race number edged in gold" },
      { title: "Vaporwave", prompt: "Vaporwave aesthetic — pastel pink and teal gradient body, retro sunset grid graphic on the hood, palm tree silhouettes on the rear quarter, synthwave purple accent lines, 80s nostalgia" },
      { title: "Watercolour Wash", prompt: "Watercolour splash livery — white base with loose, flowing watercolour washes of cerulean blue and emerald green across the doors and hood, paint drip effects along the lower edges" },
      { title: "Pop Art", prompt: "Pop Art livery — bold primary colour blocks in red, yellow, and blue separated by thick black outlines, comic book halftone dot pattern in the background, Roy Lichtenstein inspired" },
      { title: "Galaxy Nebula", prompt: "Deep space nebula livery — dark purple-black base with swirling nebula clouds in magenta, teal, and gold across the flanks, tiny star field dots, cosmic and otherworldly" },
      { title: "Graffiti Tag", prompt: "Urban graffiti livery — matte concrete grey base with vibrant spray-paint style tags, drips, and throw-ups across all panels, neon pink and lime green dominant colours, street art energy" },
    ],
    "Exotic & Unusual": [
      { title: "Dragon Scale", prompt: "Dragon scale livery — deep emerald green body with an overlapping scale texture across all panels, gold metallic edges on each scale, fiery orange-red accents on the splitter and diffuser" },
      { title: "Arctic Camo", prompt: "Arctic warfare camouflage — irregular white, pale grey, and ice blue camo blocks across the entire body, matte finish, tactical stencil-style number in dark grey" },
      { title: "Candy Chrome", prompt: "Candy chrome livery — iridescent colour-shifting paint that transitions from deep purple to electric blue to teal across the body length, mirror chrome accent on the roof scoop and wing" },
      { title: "Rust Rat Rod", prompt: "Rat rod patina livery — faux weathered bare metal body with realistic rust patches, primer spots in flat grey, hand-painted number in white house paint style, anti-establishment aesthetic" },
      { title: "Origami Paper", prompt: "Origami-inspired livery — white base with geometric folded-paper shadow effects creating a 3D faceted appearance across all panels, subtle pastel colour on alternate facets" },
      { title: "Tribal Ink", prompt: "Polynesian tribal tattoo livery — matte black base with intricate white tribal patterns flowing from the hood across the doors to the rear, bold cultural art meets motorsport" },
    ],
    "Joke & Meme": [
      { title: "Lambo Door LOL", prompt: "Lambo door joke livery — neon lime green body with massive upward-opening door graphics drawn as if the car's panels are hydraulic supercar doors that don't actually open, with exaggerated hinges and mechanical lines" },
      { title: "Minion Chaos", prompt: "Minion-inspired chaos livery — bright banana yellow base with big googly eyes on the hood, gibberish text in Comic Sans across the doors, chaotic splashes of blue and purple, absolute maximum meme energy" },
      { title: "E-Boy Drift", prompt: "E-boy drift car — hot pink and black split livery, fake LED light graphic running along the sills, tilted cat emoji decals, oversized winglets drawn on the side, ironic sponsorship of energy drinks and RGB cable brands" },
      { title: "Beans", prompt: "Beans livery — the entire car covered in realistic rendered 3D beans, hundreds of them scattered across every panel, various sizes, different bean types, suspended as if falling onto the car, absolute bean chaos" },
      { title: "Big Floppy Hat", prompt: "Big floppy hat livery — cartoony oversized comical straw hat graphic spanning the entire roof panel, hat flopping down the sides of the car, bow tie visible on the front, whimsical derp aesthetic" },
      { title: "Fish Eye", prompt: "Fish eye livery — the car's entire front fascia designed to look like a shocked fish face, massive wide-open eye graphics where the headlights go, alarmed expression, fish scales across the hood" },
      { title: "Speedlines Overload", prompt: "Speedlines overload — entire car plastered with aggressive blue and red speedlines shooting in all directions, so many lines they overlap and create visual chaos, thick neon trails, looks perpetually moving at 500mph" },
      { title: "Meme Text Racing", prompt: "Meme text racing — the entire livery is just overlapping Impact font text in various sizes and colours ('FAST', 'BEEP BEEP', 'ZOOM', 'VROOOOM', 'SPEED', random LOL speech bubbles) chaotically scattered everywhere" },
      { title: "Anime Protagonist", prompt: "Anime protagonist car — giant anime girl eyes taking up most of the hood, dramatic hair streaks flowing down the sides, roses and sparkle effects everywhere, dramatic shounen racing energy, impossible physics implied by the design" },
      { title: "Corporate Ipsum", prompt: "Corporate ipsum livery — entire car covered in Lorem Ipsum placeholder text as design, 'Lorem Dolor Sit Amet' stamped across panels in various enterprise-looking fonts, unironic corporate placeholder aesthetic" },
    ],
  },
  modify: {
    "Weathering & Age": [
      { title: "Race-Worn", prompt: "Add realistic race-worn weathering throughout — stone chips across the nose and leading edges, brake dust staining around the rear wheel arches, tyre rubber deposits along the lower sills, faded paint on the roof from prolonged sun exposure" },
      { title: "Gravel Rally Dust", prompt: "Apply a full gravel-rally dust treatment — thick fine dust build-up on the lower third of the car, stone impact marks scattered across the bonnet and front bumper, mud splatter on the rear quarter panels and diffuser" },
      { title: "30-Year Aged", prompt: "Age the livery 30 years — introduce UV sun-fade to the primary colours, hairline cracking in the clear coat over the roof and bonnet, yellowing of white graphics, oxidation mottling on the darker panels" },
      { title: "Battle Damage", prompt: "Add post-race battle damage — subtle panel scuffs on the driver-side door and rear quarter, light scratch marks on the front bumper consistent with wheel-to-wheel contact, minor paint transfer in a contrasting colour" },
      { title: "Fire Scorching", prompt: "Introduce fire scorching to the rear diffuser and lower rear bumper — blackened soot marks, heat discolouration transitioning from amber to blue on the exhaust-adjacent areas, blistering paint texture at the hottest points" },
      { title: "Mud Endurance", prompt: "Add heavy endurance race mud — thick dark brown mud coating the lower quarter of the car, splatter up the doors, partially obscured number and sponsors, windscreen washer streak marks across the hood" },
    ],
    "Sponsors & Branding": [
      { title: "Full Sponsor Package", prompt: "Add a full sponsor package — place 5-6 fictional sponsor logos across the hood, front quarter panels, doors, and rear bumper in a professional layout that respects the existing design flow and colour hierarchy" },
      { title: "Replace All Sponsors", prompt: "Replace all existing sponsor logos with fictional motorsport brands (e.g. HelixFuel, Torque88, VectorOil, ApexGear, NovaDrive) — match the size, position and style of the originals as closely as possible" },
      { title: "Title Sponsor", prompt: "Add a single prominent title sponsor across the full hood — large, bold wordmark in a colour that contrasts the hood base, with the sponsor's web address in small print along the lower bumper" },
      { title: "Tyre & Team Branding", prompt: "Add tyre brand markings on the lower sill area and a team name banner along the A-pillar and windscreen visor strip in a clean bold font" },
      { title: "Number Board", prompt: "Integrate a national motorsport series number board — white rectangular panel on each front door with the race number in large black digits and a small series logo at the top" },
      { title: "Racing Series Decals", prompt: "Add a complete racing series decal package — class sticker on rear quarter, technical inspection stickers near the A-pillar, fuel flap arrow, tow point markers in red triangles, windscreen banner" },
    ],
    "Colour & Finish": [
      { title: "Shift to Prussian Blue", prompt: "Shift the primary body colour from its current hue to a deep gloss Prussian blue, preserving all existing graphic elements, logos, and colour hierarchy exactly — only the primary base changes" },
      { title: "Gloss to Matte", prompt: "Convert the livery finish from gloss to matte throughout — desaturate slightly and remove all specular qualities from the base colour while keeping graphics and detailing intact" },
      { title: "Pearlescent Shift", prompt: "Add a two-tone pearlescent effect to the primary colour — the base now shifts subtly between a cool silver and the original hue depending on viewing angle, while keeping all graphics unchanged" },
      { title: "Chrome Graphics", prompt: "Introduce a chrome or polished-metal mirror finish on all white graphic areas while keeping the base body colour exactly as-is" },
      { title: "Darken 25%", prompt: "Darken the entire livery by 25% — richer, deeper tones throughout, as if photographed under overcast conditions — no structural changes to the graphics" },
      { title: "Neon Accents", prompt: "Replace all accent-colour elements with vivid neon versions — neon green, neon pink, or neon orange — while keeping the primary base colour untouched, creating an electrified contrast" },
      { title: "Satin Wrap", prompt: "Convert the entire body to a satin wrap finish — slightly more sheen than matte but nowhere near gloss, with a silky smooth quality, while retaining all graphic details precisely" },
    ],
    "Graphics & Decals": [
      { title: "Carbon Fibre Panels", prompt: "Add a wide carbon-fibre texture overlay to the hood, roof panel, and door mirror caps — the weave should blend naturally with the paint edges using a feathered mask" },
      { title: "Racing Stripes", prompt: "Add a pair of broad racing stripes running from the nose to the tail along the centreline of the car — stripes should be 15% of the car's width, in a contrasting colour to the primary body" },
      { title: "Waterfall Splash", prompt: "Introduce a waterfall graphic on each door — a complex brushstroke-like paint splash in a complementary accent colour, as if painted by hand at high speed" },
      { title: "Roof Flag", prompt: "Add a large national flag graphic — stretched across the entire roof panel and partially wrapping down onto the upper door, flag colours respecting the existing design palette" },
      { title: "Circuit Map Watermark", prompt: "Add a subtle ghosted circuit map of a famous track (e.g. Spa-Francorchamps or Suzuka) as a watermark pattern across the hood and bonnet in a monochromatic tint matching the base colour" },
      { title: "Hex Grid Overlay", prompt: "Add a subtle hexagonal grid pattern overlay across the lower third of the body in a slightly darker shade of the base colour, creating a modern tech-inspired texture" },
      { title: "Claw Mark Scratches", prompt: "Add dramatic diagonal claw-mark scratches across both doors revealing a contrasting colour underneath — as if a beast raked across the bodywork, with torn paint edges" },
    ],
    "Number & Identity": [
      { title: "Change Number to 77", prompt: "Change the race number to 77 — update every instance of the number on the car (doors, roof, nose) ensuring the same font, size, colour and backing panel treatment as the original" },
      { title: "Roof Number", prompt: "Reposition the race number from the doors to the roof panel — large enough to be visible from the camera helicopter angle, in a high-contrast colour to the roof base" },
      { title: "Retro Oversized Number", prompt: "Replace the current number treatment with a retro-style oversized number — filling almost the entire door surface, in a vintage font with a thin contrasting outline" },
      { title: "Driver Name Banners", prompt: "Add driver name banners — a driver name above each door number in a smaller but matching font treatment, and a second driver name on the windscreen visor strip" },
    ],
    "Structural Changes": [
      { title: "Waistline Stripe", prompt: "Add a bold contrasting stripe around the entire car at waistline height — 80px wide, hard-edged, in a colour that creates strong contrast with both the upper and lower body" },
      { title: "Rear Fade to Black", prompt: "Apply a gradient fade from the current primary colour to gloss black from the B-pillar rearward — transition should be smooth over approximately 30% of the body length" },
      { title: "Speed Blade", prompt: "Add a sharply angular forward-swept graphic on each front quarter panel — like a speed blade — in white or silver, giving a modern aggressive style without touching the door graphics" },
      { title: "Splatter Lower", prompt: "Wrap the lower 20% of the car in a dark splatter / hex-grid pattern in charcoal, transitioning to the main body colour with a hard masked edge at the sill line" },
      { title: "Roof Accent Panel", prompt: "Add a roof accent panel — contrasting colour panel with thin pinstripe border covering the full roof surface, as if the top of the car belongs to a different but complementary livery" },
      { title: "Diagonal Split", prompt: "Split the car diagonally — top-left to bottom-right across each side — with the existing colour on top and a complementary new colour on the bottom half, creating a dynamic angular division" },
    ],
    "Iterate — Edge & Clarity": [
      { title: "Sharpen All Edges", prompt: "Sharpen all edges and clean up any blurry or muddy transitions between colour blocks — crisp, vector-quality boundaries throughout" },
      { title: "Fix Misalignment", prompt: "Fix any misalignment between the graphics and the UV wireframe seams — ensure all elements respect panel boundaries" },
      { title: "Clean Up Artefacts", prompt: "Clean up the hood area — remove any artefacts and ensure the graphics are symmetrical and well-composed" },
      { title: "Smooth Transitions", prompt: "Make the colour transitions smoother and more professional — eliminate any banding or harsh unintended edges" },
      { title: "Fix Colour Bleeding", prompt: "Fix any colour bleeding across panel seams — each panel should have a clean, deliberate colour boundary" },
    ],
    "Iterate — Colour & Contrast": [
      { title: "Boost Saturation", prompt: "Improve colour saturation — make the primary colours richer and more vibrant without changing the actual hues" },
      { title: "Increase Contrast", prompt: "Increase contrast between the primary and accent colours for better visibility at race distance" },
      { title: "Add Depth", prompt: "Add more depth to the design — subtle gradient or texture overlays on large flat colour areas" },
      { title: "Fix Wheel Arches", prompt: "Fix the wheel arch and window cutout areas — ensure they are solid black (#000000) with clean edges" },
    ],
    "Iterate — Detail & Polish": [
      { title: "Refine Numbers", prompt: "Add more detail and refinement to the number graphics — cleaner font rendering, better placement, proper outline/shadow" },
      { title: "Reduce Clutter", prompt: "Reduce visual clutter — simplify overly busy areas while keeping the core design language intact" },
      { title: "Better Composition", prompt: "Improve the overall composition — better balance between graphic-heavy and breathing-space areas" },
      { title: "Polish Text", prompt: "Clean up text and sponsor placement — ensure all text is sharp, readable, and properly oriented" },
      { title: "Refine Pinstripes", prompt: "Refine the pinstripes and border lines — make them thinner, more consistent, and perfectly following body contours" },
      { title: "Premium Finish", prompt: "Make the overall design feel more premium and race-ready — polish every element to professional motorsport quality" },
    ],
  },
};

export function SamplePromptsModal({ isOpen, onClose, onSelectPrompt, mode = 'new' }) {
  const modeKey = mode === 'modify' ? 'modify' : 'new';
  const categories = useMemo(() => SAMPLE_CATEGORIES[modeKey] || {}, [modeKey]);
  const categoryNames = useMemo(() => Object.keys(categories), [categories]);
  const [activeCategory, setActiveCategory] = useState(null);

  // Reset to first category when mode or open state changes
  const currentCategory = activeCategory && categoryNames.includes(activeCategory)
    ? activeCategory
    : categoryNames[0] || null;

  const items = currentCategory ? categories[currentCategory] : [];

  const title = modeKey === 'modify' ? 'Modification Samples' : 'Livery Samples';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="flex flex-col h-[70vh]">
        {/* Category tab bar */}
        <div className="flex gap-1 px-4 pt-3 pb-2 overflow-x-auto flex-shrink-0 border-b border-border-default">
          {categoryNames.map((name) => (
            <button
              key={name}
              onClick={() => setActiveCategory(name)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
                currentCategory === name
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Prompt cards */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-2">
            {items.map((item) => (
              <button
                key={item.title}
                onClick={() => {
                  onSelectPrompt?.(item.prompt);
                  onClose();
                }}
                className="w-full text-left p-3 bg-bg-card border border-border-default rounded-lg hover:border-accent/40 hover:bg-bg-hover transition-all group cursor-pointer"
              >
                <div className="text-[13px] font-semibold text-text-primary mb-1 group-hover:text-accent transition-colors">
                  {item.title}
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
                  {item.prompt}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default SamplePromptsModal;
