const TONS = {
  claro: { fundo: "#E2E7EE", carro: "#C9D2DE", roda: "#B1BCCB" },
  escuro: { fundo: "#16233A", carro: "#22324D", roda: "#2B3D5C" },
};

interface Props {
  url: string | null | undefined;
  alt: string;
  tom?: keyof typeof TONS;
  className?: string;
}

export function ImagemDoCarro({ url, alt, tom = "claro", className = "" }: Props) {
  if (url) return <img src={url} alt={alt} loading="lazy" className={className} />;
  const cores = TONS[tom];
  return (
    <svg
      role="img"
      aria-label="Sem foto"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <rect width="400" height="300" fill={cores.fundo} />
      <path
        d="M92 186c4-22 14-36 32-44l30-30c8-8 18-12 30-12h56c14 0 24 5 32 14l26 30c22 4 36 14 40 30l2 12c0 6-4 10-10 10h-22a30 30 0 0 0-58 0h-96a30 30 0 0 0-58 0H98c-5 0-8-4-6-10z"
        fill={cores.carro}
      />
      <circle cx="135" cy="200" r="20" fill={cores.roda} />
      <circle cx="285" cy="200" r="20" fill={cores.roda} />
    </svg>
  );
}
