import './SiteHeader.css'
import '../styles/paranormis.css'

type Section = 'map' | 'bestiary' | 'discover' | 'channels'

export default function SiteHeader({active, overlay = false}: {active: Section; overlay?: boolean}) {
  return (
    <header className={'site-header ' + (overlay ? 'site-header--overlay' : '')}>
      <a className="site-header__brand" href="/map" aria-label="Paranormis — radar de campo">
        <span className="site-header__sigil" aria-hidden="true">⌖</span>
        <span className="site-header__brand-copy">PARANORMIS<small>INVESTIGACIÓN PARANORMAL · UNIDAD DE CAMPO</small></span>
      </a>
      <nav className="site-header__nav" aria-label="Navegación principal">
        <a href="/map" aria-label="Radar de campo" aria-current={active === 'map' ? 'page' : undefined}><span aria-hidden="true">01</span><span className="site-header__nav-full" aria-hidden="true">Radar de campo</span><span className="site-header__nav-short" aria-hidden="true">Radar</span></a>
        <a href="/bestiary" aria-label="Archivo" aria-current={active === 'bestiary' ? 'page' : undefined}><span aria-hidden="true">02</span><span className="site-header__nav-full" aria-hidden="true">Archivo</span><span className="site-header__nav-short" aria-hidden="true">Archivo</span></a>
        <a href="/explorar" aria-label="Explorar casos" aria-current={active === 'discover' ? 'page' : undefined}><span aria-hidden="true">03</span><span className="site-header__nav-full" aria-hidden="true">Explorar casos</span><span className="site-header__nav-short" aria-hidden="true">Explorar</span></a>
        <a href="/canales" aria-label="Canales" aria-current={active === 'channels' ? 'page' : undefined}><span aria-hidden="true">04</span><span className="site-header__nav-full" aria-hidden="true">Canales</span><span className="site-header__nav-short" aria-hidden="true">Canales</span></a>
      </nav>
      <span className="site-header__classification">PR—01 <i /> EN LÍNEA</span>
    </header>
  )
}



