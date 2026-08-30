export function FocusGuardLogo() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="focusguard-mark" x1="7" y1="5" x2="33" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5eea91" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <path d="M20 3.5 33 8.3v9.3c0 8.1-5.3 15.5-13 18.9C12.3 33.1 7 25.7 7 17.6V8.3L20 3.5Z" fill="url(#focusguard-mark)" />
      <path d="M20 7.2 29.5 10.7v6.8c0 6.2-3.9 12-9.5 14.8-5.6-2.8-9.5-8.6-9.5-14.8v-6.8L20 7.2Z" fill="#052e16" fillOpacity=".22" />
      <circle cx="20" cy="19" r="6.2" fill="none" stroke="#052e16" strokeWidth="2.2" />
      <circle cx="20" cy="19" r="2.2" fill="#052e16" />
      <path d="M20 10v3M20 25v3M11 19h3M26 19h3" stroke="#052e16" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
