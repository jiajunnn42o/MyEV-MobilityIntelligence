import React from 'react';
import * as Iconsax from 'iconsax-react';

/**
 * MyEV shared icon renderer.
 * TwoTone for regular icons; rounded, slightly heavier chevrons for navigation.
 * This component is separate from App.jsx so page code need not change.
 */
const ICON_NAMES = {
  arrow: 'ArrowRight',
  moon: 'Moon',
  sun: 'Sun1',
  download: 'DocumentDownload',
  chart: 'Chart2',
  map: 'Map',
  pin: 'Location',
  activity: 'Activity',
  layers: 'Layer',
  filter: 'Filter',
  file: 'DocumentText',
  info: 'InfoCircle',
  external: 'Export',
  check: 'TickCircle',
  pause: 'Pause',
  close: 'CloseCircle',
  menu: 'HambergerMenu',
  search: 'SearchNormal1',
  grid: 'Element4',
  spark: 'MagicStar',
  history: 'Refresh',
  database: 'Database',
  plug: 'Electricity',
  shield: 'ShieldTick',
  clock: 'Clock',
  leaf: 'Tree',
  compass: 'Discover',
  calendar: 'Calendar',
  more: 'More',
};

const CHEVRONS = {
  up: '5 15 12 8 19 15',
  down: '5 9 12 16 19 9',
  arrow: '9 5 16 12 9 19',
  right: '9 5 16 12 9 19',
  left: '15 5 8 12 15 19',
  'chevron-up': '5 15 12 8 19 15',
  'chevron-down': '5 9 12 16 19 9',
  'chevron-right': '9 5 16 12 9 19',
  'chevron-left': '15 5 8 12 15 19',
};

export default function VolterraIcon({
  name,
  size = 18,
  className = '',
  color = 'currentColor',
  style,
  ...props
}) {
  if (CHEVRONS[name]) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}
        aria-hidden="true"
        {...props}
      >
        <polyline points={CHEVRONS[name]} />
      </svg>
    );
  }

  const resolvedName = ICON_NAMES[name] || name || 'InfoCircle';
  const Component = Iconsax[resolvedName] || Iconsax.InfoCircle || Iconsax.SearchNormal1;
  if (!Component) return null;

  return (
    <Component
      size={size}
      color={color}
      variant="TwoTone"
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}
      aria-hidden="true"
      {...props}
    />
  );
}
