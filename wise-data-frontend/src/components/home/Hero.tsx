import Lightfall from "../react-bits/Lightfall";

const Hero = () => {
  return (
    <main className="relative z-0 min-h-dvh overflow-hidden bg-[#08084d]">
      <Lightfall
        className="absolute inset-0 h-full w-full"
        mouseInteraction={false}
        backgroundColor="#020208"
        colors={["#8bbcff", "#3024ff", "#d672ff"]}
        speed={0.2}
      />

      <div className="absolute inset-0 flex items-center justify-center px-6 pb-10 pt-32 text-center lg:justify-start lg:px-[8vw] lg:pb-0 lg:pt-0 lg:text-start">
        <div className="flex max-w-xl flex-col items-center lg:items-start">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl xl:text-6xl">
            Todo tu inventario.
            <span className="block bg-linear-to-r from-blue-200 via-white to-fuchsia-200 bg-clip-text text-transparent">
              Una forma más sencilla de gestionarlo.
            </span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-blue-100/75 sm:text-lg">
            Organiza tus productos, controla tus datos y toma mejores decisiones
            desde un solo lugar.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href="#signup"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-blue-950/30 transition-transform hover:-translate-y-0.5"
            >
              Empieza ahora
            </a>
            <a
              href="#features"
              className="rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              Descubre WiseData
            </a>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Hero;
