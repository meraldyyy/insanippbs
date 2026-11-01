type BrandProps = { light?: boolean; compact?: boolean; platform?: 'ppbs' | 'cim' | 'both' | 'satuinsani' };

export function Brand({ light = false, compact = false, platform = 'both' }: BrandProps) {
  const logos = platform === 'satuinsani'
    ? [{ src: '/satuinsani.png', alt: 'Logo Satu Insani' }]
    : platform === 'both'
    ? [
        { src: '/logoppbs.jpeg', alt: 'Logo Insani PPBS' },
        { src: '/cimlogo.jpeg', alt: 'Logo Insani CIM' },
      ]
    : [{
        src: platform === 'ppbs' ? '/logoppbs.jpeg' : '/cimlogo.jpeg',
        alt: platform === 'ppbs' ? 'Logo Insani PPBS' : 'Logo Insani CIM',
      }];
  const brandName = platform === 'satuinsani'
    ? 'SATU INSANI'
    : platform === 'both' ? 'INSANI' : `INSANI-${platform.toUpperCase()}`;

  return (
    <div className={`brand${light ? ' brand-light' : ''}${compact ? ' mobile-brand' : ''}`}>
      <div className="brand-logos">
        {logos.map((logo) => (
          <span className={`brand-mark${platform === 'satuinsani' ? ' brand-mark-satuinsani' : ''}`} key={logo.src}><img src={logo.src} alt={logo.alt} /></span>
        ))}
      </div>
      {compact ? (
        <strong>{brandName}</strong>
      ) : (
        <div>
          <strong>{brandName}</strong>
          <small>
            {platform === 'satuinsani'
              ? 'INTEGRASI SISTEM AKTIVITAS DAN NILAI SANTRI'
            : platform === 'both'
            ? <>PPBS <span aria-hidden="true">•</span> CIM</>
            : platform === 'ppbs' ? 'Pondok Pesantren Baitussalam' : 'Citra Insan Mulia'}
          </small>
        </div>
      )}
    </div>
  );
}
