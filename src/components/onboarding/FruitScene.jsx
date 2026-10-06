// Two inks and a few large shapes keep the scenery quieter than the fruit.
// The shared viewBox keeps each setting and character aligned at any size.
const INKS = {
  orchard: ['#DDE8D0', '#8DAA91'],
  kitchen: ['#E4E9E4', '#91AAA6'],
  room: ['#E4E9E4', '#91AAA6'],
  garden: ['#DDE8D0', '#8DAA91'],
};

function Orchard({ light, dark }) {
  return (
    <>
      <circle cx="300" cy="49" r="22" fill={light} />
      <path d="M7 235C66 192 117 210 177 225S290 199 393 222V252H7Z" fill={light} />
      <path d="M31 246C116 231 249 264 382 237" fill="none" stroke={dark} strokeWidth="3" strokeLinecap="round" />
      <path d="M40 154C14 149 10 128 21 111C4 84 27 65 45 66C49 33 94 29 106 57C137 55 146 88 125 103C144 128 119 153 95 147C82 166 57 166 40 154Z" fill={light} />
      <path d="M74 70V235M74 127L47 102M74 165L101 137" fill="none" stroke={dark} strokeWidth="5" strokeLinecap="round" />
      <path d="M74 70C112 70 125 110 95 147C87 154 81 157 74 158Z" fill={dark} />
      <path d="M326 214V157" stroke={dark} strokeWidth="4" strokeLinecap="round" />
      <path d="M299 165C284 150 299 125 315 111C321 104 325 95 327 88C332 103 346 114 355 128C368 148 359 166 343 172C326 177 310 175 299 165Z" fill={light} />
      <path d="M327 88C332 103 346 114 355 128C368 148 359 166 343 172C338 174 333 175 327 175Z" fill={dark} />
    </>
  );
}

function Kitchen({ light, dark, quiet = false }) {
  return (
    <>
      <path d="M14 236H386V253H14Z" fill={light} />
      <path d="M14 235H386" stroke={dark} strokeWidth="4" strokeLinecap="round" />
      <rect x="28" y="42" width="115" height="137" rx="2" fill={light} />
      <path d="M85 44V177M30 110H141M20 181H151" fill="none" stroke={dark} strokeWidth="4" strokeLinecap="round" />
      <path d="M37 98L76 54M94 164L131 122" stroke={dark} strokeWidth="2" strokeLinecap="round" />
      {!quiet && (
        <>
          <path d="M255 104H378" stroke={dark} strokeWidth="4" strokeLinecap="round" />
          <path d="M271 103V78H294V103M301 103V67H316V103" fill={light} />
          <path d="M332 104L329 86H351L348 104Z" fill={dark} />
          <path d="M340 86C318 85 318 63 320 59C336 62 340 74 340 86M340 82C339 64 351 58 363 58C362 72 353 81 340 82" fill={light} />
        </>
      )}
      <path d="M334 212V158" fill="none" stroke={dark} strokeWidth="3" strokeLinecap="round" />
      <path d="M334 184C310 184 303 166 305 153C326 154 334 167 334 184M334 170C333 148 347 136 362 136C362 155 352 168 334 170" fill={dark} />
      <path d="M334 206C352 204 365 190 365 176C346 177 335 188 334 206" fill={light} />
      <path d="M315 211H352L347 234H320Z" fill={light} />
      <path d="M341 211H352L347 234H339Z" fill={dark} />
    </>
  );
}

function Garden({ light, dark }) {
  return (
    <>
      <circle cx="88" cy="56" r="21" fill={light} />
      <path d="M14 239C73 211 112 233 165 232C251 227 299 209 387 237V252H14Z" fill={light} />
      <path d="M38 243C123 252 270 234 367 244" stroke={dark} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M64 236V129M64 184L43 169M64 157L85 142M330 235V106M330 174L350 155M330 204L309 187" fill="none" stroke={dark} strokeWidth="4" strokeLinecap="round" />
      <path d="M64 146C44 137 38 114 46 101C62 106 69 126 64 146M66 170C70 144 88 131 102 136C100 155 85 170 66 170M45 171C24 175 13 160 15 146C33 145 44 154 45 171" fill={light} />
      <path d="M330 136C306 127 302 103 310 89C327 95 334 115 330 136M347 160C344 136 358 116 376 116C380 137 367 157 347 160M311 190C289 190 276 174 280 155C300 157 312 171 311 190" fill={dark} />
    </>
  );
}

export default function FruitScene({ scene = 'orchard', src, alt, className = '', priority = false }) {
  const [light, dark] = INKS[scene] || INKS.orchard;
  const pair = scene === 'room';

  return (
    <svg
      viewBox="0 0 400 280"
      className={`block w-full h-full overflow-visible ${className}`}
      role="img"
      aria-label={alt}
      focusable="false"
    >
      <g aria-hidden="true">
        {scene === 'orchard' && <Orchard light={light} dark={dark} />}
        {scene === 'kitchen' && <Kitchen light={light} dark={dark} />}
        {scene === 'room' && <Kitchen light={light} dark={dark} quiet />}
        {scene === 'garden' && <Garden light={light} dark={dark} />}
        <image
          href={src}
          x={pair ? 90 : 97}
          y={pair ? 78 : 28}
          width={pair ? 230 : 216}
          height={pair ? 192 : 244}
          preserveAspectRatio="xMidYMid meet"
          fetchPriority={priority ? 'high' : 'auto'}
        />
      </g>
    </svg>
  );
}
