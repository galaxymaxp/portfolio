// Edit this file — all text on the page comes from here.
export const profile = {
  name: 'Fely Max Razel P. Dilinila',
  role: 'BSIT student · Creative generalist',
  tagline: 'I build apps that take the busywork off your plate.',
  // Leave empty to point the contact buttons at GitHub instead of email.
  email: '',
  links: [{ label: 'GitHub', href: 'https://github.com/galaxymaxp' }],
  about:
    'I am a BSIT student at the University of the Cordilleras and a MAWD graduate from STI Senior High School. ' +
    'I work across code, video editing, digital art and Photoshop, and I coach and mentor on the side. ' +
    'I like building things that solve a real problem I or my friends have, then polishing them until they feel good to use.',
  skills: ['TypeScript', 'React / React Native', 'Next.js', 'Supabase', 'Video editing', 'Photoshop', 'Digital art'],
}

// One entry per 3D object. `shape` picks the object in src/objects.jsx.
export const projects = [
  {
    id: 'stay-focused',
    shape: 'knot',
    title: 'Stay Focused',
    blurb:
      'A mobile-first study app that turns school material — Canvas courses, PDFs and photos of notes — into reviewers you can save and study from.',
    stack: ['Expo / React Native', 'Next.js', 'Supabase', 'OpenAI', 'Canvas API', 'OCR'],
    href: 'https://galaxymaxp.github.io/stay-focused-showcase/',
    repo: 'https://github.com/galaxymaxp/stay-focused-v2',
  },
  {
    id: 'val-checker',
    shape: 'box',
    title: 'VAL Checker',
    blurb:
      'Watches the VALORANT skins you want and emails you the day one shows up in your daily store — with encrypted sessions and support for multiple Riot accounts.',
    stack: ['Next.js', 'TypeScript', 'Supabase', 'Browser extension'],
    href: 'https://val-checker-three.vercel.app',
    repo: 'https://github.com/galaxymaxp/val-checker',
  },
]
