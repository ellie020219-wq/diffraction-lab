import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Aperture, ArrowLeft } from 'lucide-react'
import { LabHome } from './LabHome'
import { ModelGuide } from './ModelGuide'
import { SlitExperiment } from './SlitExperiment'
import { defaultSettings } from './farfield/FarFieldControls'
import { pageFor, routes, type Page } from './navigation'
import type { Mode } from './settings'

const FarFieldPage = lazy(() => import('./farfield/FarFieldPage'))

function subscribeHash(change: () => void) {
  window.addEventListener('hashchange', change)
  return () => window.removeEventListener('hashchange', change)
}

const navigation: ReadonlyArray<{ page: Page; label: string }> = [
  { page: 'home', label: '首頁' },
  { page: 'slits', label: '一維干涉與繞射' },
  { page: 'farfield', label: '二維孔徑繞射' },
  { page: 'comparison', label: '近場與遠場比較' },
  { page: 'model', label: '模型說明' },
]

export default function App() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash)
  const page = pageFor(hash)
  const tab = page === 'farfield' ? 'lab' : page === 'comparison' ? 'comparison' : page === 'quiz' ? 'quiz' : null
  const [slitsOpened, setSlitsOpened] = useState(page === 'slits')
  const [farFieldOpened, setFarFieldOpened] = useState(tab !== null)
  const [mode, setMode] = useState<Mode>('double')
  const [apertureSettings, setApertureSettings] = useState(defaultSettings)
  const content = useRef<HTMLElement>(null)
  const previousHash = useRef(hash)

  useEffect(() => {
    if (page === 'slits') setSlitsOpened(true)
    if (tab !== null) setFarFieldOpened(true)
  }, [page, tab])

  useEffect(() => {
    if (previousHash.current !== hash) {
      content.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
    }
    previousHash.current = hash
    if (hash === '#experiment' || hash === '#results' || hash === '#model') {
      document.getElementById(hash.slice(1))?.scrollIntoView?.()
    }
  }, [hash])

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault()
        content.current?.focus()
      }}>跳至主要內容</a>
      <header className="site-header">
        <div className="header-inner">
          <a href={routes.home} className="brand"><span className="brand-icon"><Aperture size={22} aria-hidden="true" /></span>
            光學實驗室
          </a>
          <nav className="site-nav" aria-label="網站導覽">
            {navigation.map(({ page: target, label }) => <a key={target} href={routes[target]}
              aria-current={target === page || (target === 'farfield' && page === 'quiz') ? 'page' : undefined}>{label}</a>)}
          </nav>
        </div>
      </header>
      <main className="page" id="main-content" tabIndex={-1} ref={content}>
        {page !== 'home' && <a href={routes.home} className="back-home"><ArrowLeft size={16} aria-hidden="true" /> 返回首頁</a>}
        <div hidden={page !== 'home'}>
          <LabHome chooseMode={setMode} chooseShape={(shape) => setApertureSettings((settings) => ({ ...settings, shape }))} />
        </div>
        {(page === 'slits' || slitsOpened) && <div hidden={page !== 'slits'}>
          <SlitExperiment mode={mode} setMode={setMode} />
        </div>}
        {(tab !== null || farFieldOpened) && <div hidden={tab === null}>
          <Suspense fallback={<p className="ff-loading" role="status">正在載入二維孔徑實驗…</p>}>
            <FarFieldPage tab={tab} settings={apertureSettings} setSettings={setApertureSettings} />
          </Suspense>
        </div>}
        {page === 'model' && <ModelGuide />}
      </main>
      <footer className="site-footer"><Aperture size={16} aria-hidden="true" /> 光的干涉與繞射互動實驗室</footer>
    </>
  )
}
