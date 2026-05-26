import s from './MovieTabsNav.module.css'

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${s.tabBtn}${active ? ` ${s.tabBtnActive}` : ''}`}>
      {label}
      <span className={s.tabBtnIndicator} />
    </button>
  )
}

type MovieTabsNavProps = {
  tabs: string[]
  activeTab: string
  onTabChange: (tab: string) => void
}

export function MovieTabsNav({ tabs, activeTab, onTabChange }: MovieTabsNavProps) {
  return (
    <div className={s.nav}>
      <div className={s.inner}>
        {tabs.map((t) => (
          <TabBtn key={t} label={t} active={activeTab === t} onClick={() => onTabChange(t)} />
        ))}
      </div>
    </div>
  )
}
