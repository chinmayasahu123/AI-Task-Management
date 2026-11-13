import {
  ArrowRightOutlined,
  BellOutlined,
  CalendarOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloudOutlined,
  CloseOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileTextOutlined,
  FullscreenOutlined,
  FlagOutlined,
  FolderOutlined,
  HomeOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MoonOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  SunOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

const icons = {
  home: HomeOutlined,
  check: CheckOutlined,
  note: FileTextOutlined,
  expand: FullscreenOutlined,
  folder: FolderOutlined,
  calendar: CalendarOutlined,
  users: TeamOutlined,
  flag: FlagOutlined,
  chart: LineChartOutlined,
  settings: SettingOutlined,
  search: SearchOutlined,
  bell: BellOutlined,
  moon: MoonOutlined,
  sun: SunOutlined,
  clock: ClockCircleOutlined,
  cloud: CloudOutlined,
  partlyCloudy: CloudOutlined,
  rain: CloudOutlined,
  snow: CloudOutlined,
  storm: ThunderboltOutlined,
  plus: PlusOutlined,
  eye: EyeOutlined,
  eyeOff: EyeInvisibleOutlined,
  more: MoreOutlined,
  arrow: ArrowRightOutlined,
  spark: ThunderboltOutlined,
  close: CloseOutlined,
  logout: LogoutOutlined,
}

export default function Icon({ name, size = 18, style, ...props }) {
  const AntIcon = icons[name] ?? CheckOutlined

  return (
    <AntIcon
      aria-hidden="true"
      style={{ fontSize: size, lineHeight: 1, ...style }}
      {...props}
    />
  )
}
