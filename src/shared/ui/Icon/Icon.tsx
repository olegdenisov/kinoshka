type IconProps = {
  size?: number
  filled?: boolean
}

export const StarIcon = ({ size = 11, filled = true }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    style={{ display: 'inline-block', verticalAlign: '-1px' }}
  >
    <path
      d='M12 2.5 L14.9 8.8 L21.8 9.6 L16.6 14.3 L18.1 21.1 L12 17.6 L5.9 21.1 L7.4 14.3 L2.2 9.6 L9.1 8.8 Z'
      fill={filled ? '#E6B86A' : 'none'}
      stroke={filled ? 'none' : 'rgba(242,240,239,0.8)'}
      strokeWidth='1.5'
    />
  </svg>
)

export const PlusIcon = ({ size = 12 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <path
      d='M12 5v14M5 12h14'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
    />
  </svg>
)

export const EyeIcon = ({ size = 12 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <path
      d='M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z'
      stroke='currentColor'
      strokeWidth='1.6'
    />
    <circle cx='12' cy='12' r='3' stroke='currentColor' strokeWidth='1.6' />
  </svg>
)

export const SearchIcon = ({ size = 15 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <circle cx='11' cy='11' r='7' stroke='currentColor' strokeWidth='1.6' />
    <path
      d='m20 20-3.5-3.5'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
    />
  </svg>
)

export const BellIcon = ({ size = 15 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <path
      d='M6 8a6 6 0 1 1 12 0c0 5 2 7 2 7H4s2-2 2-7Z'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinejoin='round'
    />
    <path
      d='M10 19a2 2 0 0 0 4 0'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
    />
  </svg>
)

export const HeartIcon = ({ size = 13, filled = false }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill={filled ? 'currentColor' : 'none'}
  >
    <path
      d='M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinejoin='round'
    />
  </svg>
)

export const ShareIcon = ({ size = 13 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <circle cx='18' cy='5' r='3' stroke='currentColor' strokeWidth='1.7' />
    <circle cx='6' cy='12' r='3' stroke='currentColor' strokeWidth='1.7' />
    <circle cx='18' cy='19' r='3' stroke='currentColor' strokeWidth='1.7' />
    <path d='m9 11 6-4M9 13l6 4' stroke='currentColor' strokeWidth='1.7' />
  </svg>
)

export const HomeIcon = ({ size = 20, filled = false }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill={filled ? 'currentColor' : 'none'}
  >
    <path
      d='M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9Z'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinejoin='round'
    />
  </svg>
)

export const ListsIcon = ({ size = 20, filled = false }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <path
      d='M4 6h16M4 12h16M4 18h10'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap='round'
    />
    {filled && <circle cx='3' cy='6' r='1.2' fill='currentColor' />}
  </svg>
)

export const ProfileIcon = ({ size = 20, filled = false }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill={filled ? 'currentColor' : 'none'}
  >
    <circle cx='12' cy='8' r='4' stroke='currentColor' strokeWidth='1.7' />
    <path
      d='M4 21c0-4 3.5-7 8-7s8 3 8 7'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
    />
  </svg>
)

export const ChevronLeftIcon = ({ size = 12 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <path
      d='M15 6l-6 6 6 6'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
)

export const ChevronRightIcon = ({ size = 12 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <path
      d='M9 6l6 6-6 6'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
)

export const ChevronDownIcon = ({ size = 10 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <path
      d='m6 9 6 6 6-6'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
)

export const CloseIcon = ({ size = 12 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <path
      d='M5 5l14 14M19 5 5 19'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
    />
  </svg>
)

export const FilterIcon = ({ size = 12 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <path
      d='M4 6h16M7 12h10M10 18h4'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
    />
  </svg>
)

export const PlayIcon = ({ size = 22 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor'>
    <path d='M6 4l14 8-14 8V4z' />
  </svg>
)

export const SunIcon = ({ size = 15 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <circle cx='12' cy='12' r='4.5' stroke='currentColor' strokeWidth='1.6' />
    <path
      d='M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
    />
  </svg>
)

export const MoonIcon = ({ size = 15 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <path
      d='M20.5 14.5a8.5 8.5 0 1 1-9-11 7 7 0 0 0 9 11Z'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinejoin='round'
    />
  </svg>
)

export const CheckIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
    <path
      d='m5 12 5 5 9-11'
      stroke='#D18E5F'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
)
