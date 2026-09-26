import './SiteHeader.css'
import '../styles/paranormis.css'

type Section = 'map' | 'bestiary' | 'report'

export default function SiteHeader({active, overlay = false}: {active: Section; overlay?: boolean}) {
  return (
    <header className={'site-header ' + (overlay ? 'site-header--overlay' : '')}>
      <a className="site-header__brand" href="/map" aria-label="Paranormis — radar de campo">
        <span className="site-header__sigil" aria-hidden="true">⌖</span>
        <span className="site-header__brand-copy">PARANORMIS<small>INVESTIGACIÓN PARANORMAL · UNIDAD DE CAMPO</small></span>
      </a>
      <nav className="site-header__nav" aria-label="Navegación principal">
        <a href="/map" aria-current={active === 'map' ? 'page' : undefined}><span>01</span> Radar de campo</a>
        <a href="/bestiary" aria-current={active === 'bestiary' ? 'page' : undefined}><span>02</span> Archivo</a>
        <a href="/report" aria-current={active === 'report' ? 'page' : undefined}><span>03</span> Reportar hallazgo</a>
      </nav>
      <span className="site-header__classification">PR—01 <i /> EN LÍNEA</span>
    </header>
  )
}



