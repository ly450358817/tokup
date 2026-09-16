import { useId, useState } from 'react';

export type CharacterKind = 'youth' | 'cool' | 'cute' | 'mature';

type CharacterArtProps = {
  kind: CharacterKind;
  className?: string;
};

function ArtBase({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 260 300"
      role="img"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#020617" floodOpacity="0.28" />
        </filter>
      </defs>
      <ellipse cx="130" cy="282" rx="94" ry="16" fill={`url(#${id}-ground)`} />
      <g filter={`url(#${id}-shadow)`}>{children}</g>
    </svg>
  );
}

function YouthArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <ArtBase id={id} className={className}>
      <path d="M31 300c5-54 33-86 77-101h44c44 15 72 47 77 101H31Z" fill="#dff8ff" />
      <path d="M54 300c9-42 32-68 64-79l12 18 12-18c32 11 55 37 64 79H54Z" fill="#eafcff" />
      <path d="M108 177h44v55h-44z" fill="#f2b59f" />
      <path d="M75 118c0-43 22-72 55-72s55 29 55 72c0 47-20 76-55 76s-55-29-55-76Z" fill="#f6c3ad" />
      <ellipse cx="75" cy="126" rx="10" ry="16" fill="#f0b39d" />
      <ellipse cx="185" cy="126" rx="10" ry="16" fill="#f0b39d" />
      <path d="M74 121c-4-54 22-83 57-83 37 0 61 27 58 73-10-20-25-31-44-35-14 13-38 23-71 25Z" fill="#17263e" />
      <path d="M88 73c14-14 30-21 47-21 15 0 28 4 39 13-15-2-28 2-39 11-15 12-31 17-47 15-1-7-1-13 0-18Z" fill="#27415f" />
      <path d="M155 63c11 6 20 16 25 31-13-12-29-19-47-20 7-6 14-9 22-11Z" fill="#0f1b2e" />
      <path d="M103 113c8-8 18-10 27-4" fill="none" stroke="#26395a" strokeWidth="4" strokeLinecap="round" />
      <path d="M153 109c9-6 19-4 27 4" fill="none" stroke="#26395a" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="116" cy="122" rx="10" ry="11" fill="#fff" />
      <ellipse cx="159" cy="122" rx="10" ry="11" fill="#fff" />
      <circle cx="117" cy="123" r="6" fill="#2dd4bf" />
      <circle cx="158" cy="123" r="6" fill="#2dd4bf" />
      <circle cx="117" cy="123" r="2.5" fill="#102033" />
      <circle cx="158" cy="123" r="2.5" fill="#102033" />
      <path d="M106 113c7-5 14-5 20 0M147 113c7-5 14-5 20 0" stroke="#17263e" strokeWidth="3" strokeLinecap="round" />
      <path d="M130 135c3 3 4 6 1 8" stroke="#d68e79" strokeWidth="3" strokeLinecap="round" />
      <path d="M116 155c9 8 20 8 29 0" fill="none" stroke="#b75e5a" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="102" cy="143" rx="9" ry="5" fill="#f58f93" opacity=".32" />
      <ellipse cx="162" cy="143" rx="9" ry="5" fill="#f58f93" opacity=".32" />
      <path d="M82 223c18 15 35 22 49 22s31-7 48-22l15 15c-15 22-36 34-63 34s-48-12-64-34l15-15Z" fill="#62d8f0" opacity=".92" />
      <path d="M130 245v55M101 232l29 13 29-13" fill="none" stroke="#f8fbff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="130" cy="255" r="4" fill="#f8fbff" />
    </ArtBase>
  );
}

function CoolArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <ArtBase id={id} className={className}>
      <path d="M24 300c7-57 35-88 83-103h46c48 15 76 46 83 103H24Z" fill="#171a2e" />
      <path d="M47 300c10-42 32-69 60-82l23 29 23-29c28 13 50 40 60 82H47Z" fill="#252544" />
      <path d="M109 176h42v57h-42z" fill="#efb29c" />
      <path d="M75 117c0-43 22-72 55-72s55 29 55 72c0 48-20 77-55 77s-55-29-55-77Z" fill="#f3bca7" />
      <ellipse cx="74" cy="127" rx="10" ry="16" fill="#e8aa95" />
      <ellipse cx="186" cy="127" rx="10" ry="16" fill="#e8aa95" />
      <path d="M68 143c-11-49 2-91 39-108 35-16 76 2 89 39-18-12-36-14-54-7-25 11-50 31-74 76Z" fill="#bfc7df" />
      <path d="M77 81c9-29 30-48 57-51 20-2 37 4 50 18-19-4-38 0-56 13-16 11-33 18-51 20Z" fill="#f1f5ff" />
      <path d="M72 92c9-35 31-56 59-56 27 0 48 16 60 46-18-13-37-17-57-12-21 6-42 14-62 22Z" fill="#7c84ab" />
      <path d="M79 94c-15 34-13 71 5 108l-29-2c-11-41-4-77 24-106Z" fill="#7c84ab" opacity=".92" />
      <path d="M181 94c15 34 13 71-5 108l29-2c11-41 4-77-24-106Z" fill="#7c84ab" opacity=".92" />
      <path d="M101 113c8-7 18-8 28-3M153 110c10-5 20-4 28 3" fill="none" stroke="#343853" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="116" cy="123" rx="10" ry="11" fill="#fff" />
      <ellipse cx="159" cy="123" rx="10" ry="11" fill="#fff" />
      <circle cx="117" cy="123" r="6" fill="#a78bfa" />
      <circle cx="158" cy="123" r="6" fill="#a78bfa" />
      <circle cx="117" cy="123" r="2.5" fill="#201a3a" />
      <circle cx="158" cy="123" r="2.5" fill="#201a3a" />
      <path d="M130 136c2 3 3 6 0 8" stroke="#d18f7d" strokeWidth="3" strokeLinecap="round" />
      <path d="M119 158c7 4 15 4 22-1" fill="none" stroke="#9a5961" strokeWidth="4" strokeLinecap="round" />
      <path d="M78 221c17 17 35 25 52 25 18 0 36-8 53-25l21 20c-19 24-43 37-74 37s-55-13-74-37l22-20Z" fill="#5b4bc4" opacity=".9" />
      <path d="M130 246v54M96 234l34 12 34-12" fill="none" stroke="#d8d4ff" strokeWidth="4" strokeLinecap="round" />
      <path d="M87 236l42 30-49-11M173 236l-42 30 49-11" fill="none" stroke="#16182e" strokeWidth="5" strokeLinecap="round" />
      <circle cx="130" cy="258" r="4" fill="#d8d4ff" />
    </ArtBase>
  );
}

function CuteArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <ArtBase id={id} className={className}>
      <path d="M34 300c7-54 35-86 78-100h36c43 14 71 46 78 100H34Z" fill="#ffd9e8" />
      <path d="M57 300c12-43 36-68 68-78l5 16 5-16c32 10 56 35 68 78H57Z" fill="#fff0f6" />
      <path d="M110 176h40v54h-40z" fill="#f3b9c8" />
      <path d="M79 117c0-42 22-70 51-70s51 28 51 70c0 47-19 76-51 76s-51-29-51-76Z" fill="#ffc7d2" />
      <ellipse cx="79" cy="128" rx="9" ry="15" fill="#f4b5c5" />
      <ellipse cx="181" cy="128" rx="9" ry="15" fill="#f4b5c5" />
      <path d="M57 144C42 93 60 46 104 34c43-12 79 14 91 50-18-12-34-17-49-14-21 5-39 26-53 65l-36 9Z" fill="#f070aa" />
      <path d="M71 104C67 61 91 36 127 37c35 1 57 27 56 67-13-20-28-31-45-34-18-3-40 8-67 34Z" fill="#ff8fbd" />
      <path d="M57 144c20 5 39-4 55-27 17-25 40-36 68-33-10 28-27 48-51 60-22 11-46 11-72 0Z" fill="#d94d91" opacity=".78" />
      <path d="M42 148c-17-8-27-22-30-42 13 4 25 10 34 19l-4 23ZM218 148c17-8 27-22 30-42-13 4-25 10-34 19l4 23Z" fill="#d94d91" opacity=".72" />
      <circle cx="52" cy="163" r="18" fill="#ff8fbd" />
      <circle cx="208" cy="163" r="18" fill="#ff8fbd" />
      <circle cx="52" cy="163" r="9" fill="#ffe5f0" />
      <circle cx="208" cy="163" r="9" fill="#ffe5f0" />
      <path d="M103 114c7-6 16-7 24-2M153 112c9-5 18-4 25 2" fill="none" stroke="#9c4f78" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="116" cy="123" rx="11" ry="13" fill="#fff" />
      <ellipse cx="159" cy="123" rx="11" ry="13" fill="#fff" />
      <circle cx="117" cy="124" r="7" fill="#fb7185" />
      <circle cx="158" cy="124" r="7" fill="#fb7185" />
      <circle cx="117" cy="124" r="2.8" fill="#471d35" />
      <circle cx="158" cy="124" r="2.8" fill="#471d35" />
      <circle cx="114" cy="120" r="2" fill="#fff" />
      <circle cx="155" cy="120" r="2" fill="#fff" />
      <path d="M130 137c2 2 3 4 1 6" stroke="#d8899c" strokeWidth="3" strokeLinecap="round" />
      <path d="M118 155c8 7 19 7 27-1" fill="none" stroke="#b94f72" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="102" cy="143" rx="9" ry="5" fill="#f06f9c" opacity=".28" />
      <ellipse cx="162" cy="143" rx="9" ry="5" fill="#f06f9c" opacity=".28" />
      <path d="M72 222c18 14 37 21 58 21s40-7 58-21l14 18c-18 22-42 34-72 34s-54-12-72-34l14-18Z" fill="#f472b6" opacity=".86" />
      <path d="M104 232h52l-26 36-26-36Z" fill="#fff0f6" />
      <path d="M130 266v34" stroke="#fff0f6" strokeWidth="5" strokeLinecap="round" />
    </ArtBase>
  );
}

function MatureArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <ArtBase id={id} className={className}>
      <path d="M18 300c8-59 38-91 89-105h46c51 14 81 46 89 105H18Z" fill="#1e1421" />
      <path d="M47 300c11-43 33-70 63-83l20 26 20-26c30 13 52 40 63 83H47Z" fill="#5b2438" />
      <path d="M109 176h42v57h-42z" fill="#efb39e" />
      <path d="M73 116c0-43 24-72 57-72s57 29 57 72c0 48-20 78-57 78s-57-30-57-78Z" fill="#f5bfae" />
      <ellipse cx="73" cy="127" rx="10" ry="16" fill="#eca894" />
      <ellipse cx="187" cy="127" rx="10" ry="16" fill="#eca894" />
      <path d="M61 147C45 93 57 43 99 27c39-15 84 3 103 39-22-10-43-10-63 1-27 14-49 38-78 80Z" fill="#3a1a2c" />
      <path d="M68 99c8-31 30-51 61-54 29-3 52 8 66 31-20-8-41-7-63 5-20 11-41 21-64 18Z" fill="#6a2946" />
      <path d="M74 93c8-34 30-55 57-55 28 0 50 16 61 45-18-13-37-18-57-14-23 4-43 13-61 24Z" fill="#4a1f36" />
      <path d="M78 94c-17 34-19 75-4 116l-29-5c-8-43-1-82 33-111Z" fill="#3a1a2c" />
      <path d="M182 94c17 34 19 75 4 116l29-5c8-43 1-82-33-111Z" fill="#3a1a2c" />
      <path d="M101 113c8-7 18-8 28-2M153 111c10-6 20-5 29 2" fill="none" stroke="#5c3044" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="116" cy="123" rx="10" ry="11" fill="#fff" />
      <ellipse cx="159" cy="123" rx="10" ry="11" fill="#fff" />
      <circle cx="117" cy="123" r="6" fill="#f59e0b" />
      <circle cx="158" cy="123" r="6" fill="#f59e0b" />
      <circle cx="117" cy="123" r="2.5" fill="#3a1f12" />
      <circle cx="158" cy="123" r="2.5" fill="#3a1f12" />
      <path d="M130 136c2 3 3 6 0 8" stroke="#d18f7d" strokeWidth="3" strokeLinecap="round" />
      <path d="M117 157c9 4 18 3 26-2" fill="none" stroke="#9c4c58" strokeWidth="4" strokeLinecap="round" />
      <path d="M78 221c18 18 37 27 52 27 16 0 35-9 53-27l18 20c-20 25-44 39-71 39-28 0-52-14-71-39l19-20Z" fill="#7f2d49" opacity=".9" />
      <path d="M110 232l20 26 20-26 18 19-38 29-38-29 18-19Z" fill="#f0b45e" opacity=".9" />
      <path d="M91 238l39 49 39-49" fill="none" stroke="#f0b45e" strokeWidth="3" />
      <circle cx="130" cy="269" r="4" fill="#fff1c9" />
      <path d="M74 126c-8 5-13 13-14 24M186 126c8 5 13 13 14 24" fill="none" stroke="#f0b45e" strokeWidth="2" opacity=".8" />
    </ArtBase>
  );
}

const CHARACTER_IMAGES: Record<CharacterKind, string> = {
  youth: '/assets/subscription/characters/youth-v2.webp',
  cool: '/assets/subscription/characters/cool-v2.webp',
  cute: '/assets/subscription/characters/cute.webp',
  mature: '/assets/subscription/characters/mature-v2.webp',
};

export default function SubscriptionCharacterArt({ kind, className }: CharacterArtProps) {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src={CHARACTER_IMAGES[kind]}
        alt=""
        aria-hidden="true"
        draggable={false}
        onError={() => setFailed(true)}
        className={`${className || ''} select-none object-contain`}
      />
    );
  }

  if (kind === 'youth') return <YouthArt className={className} />;
  if (kind === 'cool') return <CoolArt className={className} />;
  if (kind === 'cute') return <CuteArt className={className} />;
  return <MatureArt className={className} />;
}
